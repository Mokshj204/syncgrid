import postgres from 'postgres';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let sql = null;
let isConnected = false;

const DEFAULT_COLUMNS = ['A', 'B', 'C'];

/**
 * Intelligent SSL resolver for remote PostgreSQL connections.
 */
function getSslConfig(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes('sslmode=disable')) return false;
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) {
    return lower.includes('sslmode=require') ? { rejectUnauthorized: false } : false;
  }
  // Cloud remote databases require SSL (support self-signed / pooled certificates)
  return { rejectUnauthorized: false };
}

/**
 * Initialize connection to remote PostgreSQL database using postgres.js
 * Supports cold-start retries for serverless providers (Neon / Supabase).
 */
export async function initDb(maxRetries = 3, retryDelayMs = 2000) {
  const connectionString = process.env.DATABASE_URL || '';

  if (!connectionString) {
    console.error('[PostgreSQL / postgres.js] Critical: DATABASE_URL not found in environment.');
    return false;
  }

  let effectiveUrl = connectionString;
  let ssl = getSslConfig(connectionString);

  if (connectionString.toLowerCase().includes('sslmode=disable')) {
    effectiveUrl = connectionString.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '');
    ssl = false;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[PostgreSQL / postgres.js] Connecting to remote PostgreSQL (attempt ${attempt}/${maxRetries}, ssl: ${Boolean(ssl)})...`);

      sql = postgres(effectiveUrl, {
        ssl,
        max: 10,
        idle_timeout: 30,
        connect_timeout: 15,
        onnotice: () => {},
      });

      // Test connection
      await sql`SELECT 1;`;
      console.log('[PostgreSQL / postgres.js] Connected to remote PostgreSQL database successfully!');

      // 1. Users Table (persists nicknames, colors, and timestamps for future auth)
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          nickname VARCHAR(100) UNIQUE NOT NULL,
          color VARCHAR(30) DEFAULT '#10b981',
          icon VARCHAR(30) DEFAULT 'zap',
          last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // 2. Sheet Columns Table (dynamic headers: A, B, C, D...)
      await sql`
        CREATE TABLE IF NOT EXISTS sheet_columns (
          name VARCHAR(50) PRIMARY KEY,
          position INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // 3. Sheet Rows Table (dynamic cell key-value pairs stored in JSONB)
      await sql`
        CREATE TABLE IF NOT EXISTS sheet_rows (
          row_id INTEGER PRIMARY KEY,
          cells JSONB NOT NULL DEFAULT '{}'::jsonb,
          version VARCHAR(32) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // 4. Cell Formats Table (Excel data types & formatting)
      await sql`
        CREATE TABLE IF NOT EXISTS cell_formats (
          cell_ref VARCHAR(50) PRIMARY KEY,
          format JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // 5. Google Sheets Dynamic Configuration Table (Persists Spreadsheet ID and Sheet Name)
      await sql`
        CREATE TABLE IF NOT EXISTS google_sheets_config (
          id INTEGER PRIMARY KEY DEFAULT 1,
          spreadsheet_id VARCHAR(255) NOT NULL DEFAULT '',
          sheet_name VARCHAR(100) NOT NULL DEFAULT 'Sheet1',
          sync_enabled BOOLEAN NOT NULL DEFAULT true,
          last_synced_at TIMESTAMP WITH TIME ZONE,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      await sql`
        INSERT INTO google_sheets_config (id, spreadsheet_id, sheet_name, sync_enabled, updated_at)
        VALUES (1, '', 'Sheet1', true, NOW())
        ON CONFLICT (id) DO NOTHING;
      `;

      // Seed default columns if table is empty
      const existingCols = await sql`SELECT name FROM sheet_columns;`;
      if (existingCols.length === 0) {
        for (let i = 0; i < DEFAULT_COLUMNS.length; i++) {
          await sql`
            INSERT INTO sheet_columns (name, position)
            VALUES (${DEFAULT_COLUMNS[i]}, ${i + 1})
            ON CONFLICT (name) DO NOTHING;
          `;
        }
        console.log('[PostgreSQL] Initialized default sheet columns (A, B, C).');
      }

      isConnected = true;
      return true;
    } catch (err) {
      console.warn(`[PostgreSQL] Connection attempt ${attempt} failed: ${err.message}`);

      // If TLS failed, automatically negotiate unencrypted connection for next attempt
      const isTlsError = 
        err.message.includes('TLS connection') ||
        err.message.includes('does not support SSL') ||
        err.message.includes('ECONNRESET') ||
        err.message.includes('socket disconnected');

      if (isTlsError && ssl !== false) {
        console.log('[PostgreSQL] Server does not support SSL. Switching to unencrypted mode for retry...');
        ssl = false;
        effectiveUrl = connectionString.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '');
        continue;
      }

      if (attempt < maxRetries) {
        console.log(`[PostgreSQL] Retrying in ${retryDelayMs / 1000}s (serverless cold start / network delay)...`);
        await new Promise((res) => setTimeout(res, retryDelayMs));
      } else {
        console.error('[PostgreSQL] All connection attempts exhausted. Database is offline.');
        isConnected = false;
        return false;
      }
    }
  }

  return false;
}

export function isDbActive() {
  return isConnected && sql !== null;
}

function ensureDb() {
  if (!isDbActive()) {
    throw new Error('PostgreSQL database is not connected. Please verify your connection.');
  }
}

// ----------------------------------------------------
// Column Management
// ----------------------------------------------------
export async function getColumns() {
  ensureDb();
  try {
    const rows = await sql`SELECT name FROM sheet_columns ORDER BY position ASC;`;
    return rows.length > 0 ? rows.map(r => r.name) : DEFAULT_COLUMNS;
  } catch (err) {
    console.error('[PostgreSQL] Error fetching columns:', err.message);
    throw err;
  }
}

export async function addColumn(name) {
  ensureDb();
  const colName = name.trim();
  if (!colName) return getColumns();

  try {
    const countRes = await sql`SELECT COUNT(*)::int AS count FROM sheet_columns;`;
    const position = (countRes[0]?.count || 0) + 1;
    await sql`
      INSERT INTO sheet_columns (name, position)
      VALUES (${colName}, ${position})
      ON CONFLICT (name) DO NOTHING;
    `;
    return getColumns();
  } catch (err) {
    console.error('[PostgreSQL] Error adding column:', err.message);
    throw err;
  }
}

// ----------------------------------------------------
// Row & Dynamic Cell Management (Atomic JSONB Upsert)
// ----------------------------------------------------
export async function getChunkedRows(page = 1, limit = 25) {
  ensureDb();
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safeLimit;

  try {
    const totalResult = await sql`SELECT COUNT(*)::int AS count FROM sheet_rows;`;
    const totalRows = totalResult[0]?.count || 0;
    const totalPages = Math.max(1, Math.ceil(totalRows / safeLimit));

    const rowsResult = await sql`
      SELECT row_id, cells, version, updated_at
      FROM sheet_rows
      ORDER BY row_id ASC
      LIMIT ${safeLimit} OFFSET ${offset};
    `;

    const formattedRows = rowsResult.map(r => ({
      rowId: r.row_id,
      cells: r.cells || {},
      version: r.version,
      ...(r.cells || {}),
    }));

    const columns = await getColumns();
    return {
      columns,
      rows: formattedRows,
      totalRows,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  } catch (err) {
    console.error('[PostgreSQL] Error fetching chunked rows:', err.message);
    throw err;
  }
}

export async function upsertRow(rowId, cells, replace = false) {
  ensureDb();
  const cleanCells = cells || {};
  const version = crypto.createHash('md5').update(JSON.stringify(cleanCells)).digest('hex').substring(0, 8);

  try {
    // When replace is true (e.g. full-sheet sync), replace cells completely so deleted columns/values are purged.
    // When false (e.g. single cell edit), merge with existing cells.
    const result = replace
      ? await sql`
          INSERT INTO sheet_rows (row_id, cells, version, updated_at)
          VALUES (${rowId}, ${sql.json(cleanCells)}, ${version}, NOW())
          ON CONFLICT (row_id) DO UPDATE SET
            cells = EXCLUDED.cells,
            version = EXCLUDED.version,
            updated_at = NOW()
          RETURNING row_id, cells, version;
        `
      : await sql`
          INSERT INTO sheet_rows (row_id, cells, version, updated_at)
          VALUES (${rowId}, ${sql.json(cleanCells)}, ${version}, NOW())
          ON CONFLICT (row_id) DO UPDATE SET
            cells = COALESCE(sheet_rows.cells, '{}'::jsonb) || EXCLUDED.cells,
            version = EXCLUDED.version,
            updated_at = NOW()
          RETURNING row_id, cells, version;
        `;

    const updated = result[0];
    return {
      rowId: updated.row_id,
      cells: updated.cells,
      version: updated.version,
      ...updated.cells,
    };
  } catch (err) {
    console.error('[PostgreSQL] Error upserting row:', err.message);
    throw err;
  }
}

export async function deleteRow(rowId) {
  ensureDb();
  try {
    const result = await sql`DELETE FROM sheet_rows WHERE row_id = ${rowId};`;
    return result.count > 0;
  } catch (err) {
    console.error('[PostgreSQL] Error deleting row:', err.message);
    throw err;
  }
}

// ----------------------------------------------------
// Users Table (Nicknames & Real-Time Presence)
// ----------------------------------------------------
export async function getOrCreateUser(nickname, color = '#10b981', icon = 'zap') {
  ensureDb();
  if (!nickname) return null;

  try {
    const result = await sql`
      INSERT INTO users (nickname, color, icon, last_seen)
      VALUES (${nickname}, ${color}, ${icon}, NOW())
      ON CONFLICT (nickname) DO UPDATE SET
        color = EXCLUDED.color,
        icon = EXCLUDED.icon,
        last_seen = NOW()
      RETURNING id, nickname, color, icon, last_seen, created_at;
    `;
    return result[0];
  } catch (err) {
    console.error('[PostgreSQL] Error saving user:', err.message);
    throw err;
  }
}

export async function getAllUsers() {
  ensureDb();
  try {
    return await sql`SELECT id, nickname, color, icon, last_seen, created_at FROM users ORDER BY last_seen DESC;`;
  } catch (err) {
    console.error('[PostgreSQL] Error fetching users:', err.message);
    throw err;
  }
}

// ----------------------------------------------------
// Cell Formats (Number, Currency, Date, Time styles)
// ----------------------------------------------------
export async function getCellFormats() {
  ensureDb();
  try {
    const rows = await sql`SELECT cell_ref, format FROM cell_formats;`;
    const formats = {};
    rows.forEach(r => {
      formats[r.cell_ref] = r.format;
    });
    return formats;
  } catch (err) {
    console.error('[PostgreSQL] Error fetching cell formats:', err.message);
    throw err;
  }
}

export async function saveCellFormat(cellRef, format) {
  ensureDb();
  if (!cellRef || !format) return;

  try {
    await sql`
      INSERT INTO cell_formats (cell_ref, format, updated_at)
      VALUES (${cellRef}, ${sql.json(format)}, NOW())
      ON CONFLICT (cell_ref) DO UPDATE SET
        format = EXCLUDED.format,
        updated_at = NOW();
    `;
  } catch (err) {
    console.error('[PostgreSQL] Error saving cell format:', err.message);
    throw err;
  }
}

// ----------------------------------------------------
// Google Sheets Dynamic Configuration Management
// ----------------------------------------------------
export async function getGoogleSheetsConfig() {
  ensureDb();
  try {
    const rows = await sql`
      SELECT spreadsheet_id, sheet_name, sync_enabled, last_synced_at, updated_at
      FROM google_sheets_config
      WHERE id = 1;
    `;
    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        spreadsheetId: r.spreadsheet_id || '',
        sheetName: r.sheet_name || 'Sheet1',
        syncEnabled: r.sync_enabled ?? true,
        lastSyncedAt: r.last_synced_at ? r.last_synced_at.toISOString() : null,
        updatedAt: r.updated_at ? r.updated_at.toISOString() : new Date().toISOString(),
        isPersisted: true,
      };
    }
    return {
      spreadsheetId: '',
      sheetName: 'Sheet1',
      syncEnabled: true,
      lastSyncedAt: null,
      updatedAt: new Date().toISOString(),
      isPersisted: false,
    };
  } catch (err) {
    console.error('[PostgreSQL] Error fetching google_sheets_config:', err.message);
    throw err;
  }
}

export async function saveGoogleSheetsConfig({ spreadsheetId, sheetName, syncEnabled }) {
  ensureDb();
  const cleanId = (spreadsheetId || '').trim();
  const cleanName = (sheetName || 'Sheet1').trim();
  const isEnabled = syncEnabled !== undefined ? Boolean(syncEnabled) : true;

  try {
    const rows = await sql`
      INSERT INTO google_sheets_config (id, spreadsheet_id, sheet_name, sync_enabled, updated_at)
      VALUES (1, ${cleanId}, ${cleanName}, ${isEnabled}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        spreadsheet_id = EXCLUDED.spreadsheet_id,
        sheet_name = EXCLUDED.sheet_name,
        sync_enabled = EXCLUDED.sync_enabled,
        updated_at = NOW()
      RETURNING spreadsheet_id, sheet_name, sync_enabled, last_synced_at, updated_at;
    `;
    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        spreadsheetId: r.spreadsheet_id,
        sheetName: r.sheet_name,
        syncEnabled: r.sync_enabled,
        lastSyncedAt: r.last_synced_at ? r.last_synced_at.toISOString() : null,
        updatedAt: r.updated_at ? r.updated_at.toISOString() : new Date().toISOString(),
        isPersisted: true,
      };
    }
  } catch (err) {
    console.error('[PostgreSQL] Error saving google_sheets_config:', err.message);
    throw err;
  }
}

export async function updateGoogleSheetsLastSynced() {
  ensureDb();
  const now = new Date().toISOString();
  try {
    await sql`
      UPDATE google_sheets_config
      SET last_synced_at = NOW()
      WHERE id = 1;
    `;
    return now;
  } catch (err) {
    console.error('[PostgreSQL] Error updating last_synced_at:', err.message);
    throw err;
  }
}

export async function getDatabaseStats() {
  ensureDb();
  try {
    const [rowCount] = await sql`SELECT COUNT(*)::int AS count FROM sheet_rows;`;
    const [colCount] = await sql`SELECT COUNT(*)::int AS count FROM sheet_columns;`;
    const [userCount] = await sql`SELECT COUNT(*)::int AS count FROM users;`;

    return {
      isDbConnected: true,
      mode: 'remote_postgresql',
      totalRows: rowCount?.count || 0,
      totalColumns: colCount?.count || 0,
      totalUsers: userCount?.count || 0,
    };
  } catch (err) {
    console.error('[PostgreSQL] Error fetching database stats:', err.message);
    throw err;
  }
}
