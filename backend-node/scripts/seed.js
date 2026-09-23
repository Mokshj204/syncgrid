#!/usr/bin/env node

/**
 * ==============================================================================
 * Database Schema & Seeding Script (Remote PostgreSQL)
 * ==============================================================================
 * Connects to your remote PostgreSQL instance
 * and provisions all tables, indexes, schemas, and initial seed data.
 *
 * Usage:
 *   node scripts/seed.js
 *   node scripts/seed.js "postgresql://user:pass@host:5432/db?sslmode=require"
 *   npm run db:seed
 *   npm run db:seed -- --reset   (Drops and re-creates all tables)
 * ==============================================================================
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend-node or project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Parse CLI flags and arguments
const args = process.argv.slice(2);
const isReset = args.includes('--reset') || args.includes('--force');
const urlArg = args.find((a) => !a.startsWith('--') && (a.startsWith('postgres://') || a.startsWith('postgresql://')));
const databaseUrl = urlArg || process.env.DATABASE_URL;

function printBanner() {
  console.log('\n=============================================================');
  console.log('  🚀 Remote PostgreSQL Schema & Seeding Engine');
  console.log('=============================================================');
}

if (!databaseUrl) {
  printBanner();
  console.error('\n❌ ERROR: No DATABASE_URL found!');
  console.error('\nPlease supply a remote PostgreSQL connection string in one of two ways:');
  console.error('  1. Add DATABASE_URL to your .env file:');
  console.error('     DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require\n');
  console.error('  2. Pass it directly as a command-line argument:');
  console.error('     node scripts/seed.js "postgresql://user:password@host:5432/dbname?sslmode=require"\n');
  process.exit(1);
}

// Mask password in connection string for safe console logging
function maskUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return 'postgresql://[masked_host]';
  }
}

async function connectWithFallback(url) {
  const lower = (url || '').toLowerCase();
  const cleanNonSslUrl = url.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/[?&]$/, '');

  if (lower.includes('sslmode=disable')) {
    console.log('⏳ Connecting to remote PostgreSQL (sslmode=disable)...');
    const sql = postgres(cleanNonSslUrl, {
      ssl: false,
      max: 1,
      connect_timeout: 15,
      onnotice: () => {},
    });
    await sql`SELECT 1 AS connected;`;
    return { sql, mode: 'unencrypted (sslmode=disable)' };
  }

  // Try with SSL first (required for Neon, Supabase, RDS, etc.)
  try {
    console.log('⏳ Connecting to remote PostgreSQL (attempting SSL)...');
    const sql = postgres(url, {
      ssl: { rejectUnauthorized: false },
      max: 1,
      connect_timeout: 10,
      onnotice: () => {},
    });
    await sql`SELECT 1 AS connected;`;
    return { sql, mode: 'encrypted (SSL)' };
  } catch (err) {
    const isTlsError = 
      err.message.includes('TLS connection') ||
      err.message.includes('does not support SSL') ||
      err.message.includes('ECONNRESET') ||
      err.message.includes('socket disconnected');

    if (isTlsError) {
      console.log('ℹ️  Server does not use SSL encryption. Auto-negotiating unencrypted connection...');
      const fallbackSql = postgres(cleanNonSslUrl, {
        ssl: false,
        max: 1,
        connect_timeout: 15,
        onnotice: () => {},
      });
      await fallbackSql`SELECT 1 AS connected;`;
      return { sql: fallbackSql, mode: 'unencrypted (auto-negotiated)' };
    }
    throw err;
  }
}

async function runSeed() {
  printBanner();
  console.log(`\n📡 Target Database: ${maskUrl(databaseUrl)}`);
  console.log(`⚙️  Mode: ${isReset ? 'RESET (Drop & Re-create)' : 'SAFE (Idempotent / IF NOT EXISTS)'}\n`);

  let sql = null;
  const startTime = Date.now();

  try {
    const conn = await connectWithFallback(databaseUrl);
    sql = conn.sql;
    console.log(`✅ Connection established successfully (${conn.mode}).\n`);

    // 2. Drop existing tables if --reset was passed
    if (isReset) {
      console.log('⚠️  Reset flag detected. Dropping existing tables...');
      await sql`DROP TABLE IF EXISTS cell_formats CASCADE;`;
      await sql`DROP TABLE IF EXISTS sheet_rows CASCADE;`;
      await sql`DROP TABLE IF EXISTS sheet_columns CASCADE;`;
      await sql`DROP TABLE IF EXISTS google_sheets_config CASCADE;`;
      await sql`DROP TABLE IF EXISTS users CASCADE;`;
      console.log('   Dropped tables cleanly.\n');
    }

    // 3. Create Tables and Schemas
    console.log('📦 Provisioning database schemas & tables...');

    // Users table (for collaborator nicknames, colors, and future auth)
    console.log('   -> Creating table: users');
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
    await sql`CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);`;

    // Sheet Columns table
    console.log('   -> Creating table: sheet_columns');
    await sql`
      CREATE TABLE IF NOT EXISTS sheet_columns (
        name VARCHAR(50) PRIMARY KEY,
        position INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_sheet_columns_position ON sheet_columns(position);`;

    // Sheet Rows table with JSONB cells
    console.log('   -> Creating table: sheet_rows');
    await sql`
      CREATE TABLE IF NOT EXISTS sheet_rows (
        row_id INTEGER PRIMARY KEY,
        cells JSONB NOT NULL DEFAULT '{}'::jsonb,
        version VARCHAR(32) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_sheet_rows_cells ON sheet_rows USING gin (cells);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sheet_rows_updated_at ON sheet_rows(updated_at);`;

    // Cell Formats table
    console.log('   -> Creating table: cell_formats');
    await sql`
      CREATE TABLE IF NOT EXISTS cell_formats (
        cell_ref VARCHAR(50) PRIMARY KEY,
        format JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Google Sheets Config table
    console.log('   -> Creating table: google_sheets_config');
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

    console.log('✅ All tables and indexes provisioned successfully.\n');

    // 4. Seeding Initial Data
    console.log('🌱 Seeding initial baseline data...');

    // Columns: A, B, C
    const columns = [
      { name: 'A', position: 1 },
      { name: 'B', position: 2 },
      { name: 'C', position: 3 },
    ];
    for (const col of columns) {
      await sql`
        INSERT INTO sheet_columns (name, position)
        VALUES (${col.name}, ${col.position})
        ON CONFLICT (name) DO NOTHING;
      `;
    }
    console.log('   ✓ Seeded default columns (A, B, C)');

    // Google Sheets dynamic config row 1
    await sql`
      INSERT INTO google_sheets_config (id, spreadsheet_id, sheet_name, sync_enabled, updated_at)
      VALUES (1, '', 'Sheet1', true, NOW())
      ON CONFLICT (id) DO NOTHING;
    `;
    console.log('   ✓ Seeded google_sheets_config singleton record (Row 1)');

    // Sample Rows
    const sampleRows = [
      { rowId: 1, cells: { A: 'Quarterly Target', B: '15000', C: 'Confirmed' } },
      { rowId: 2, cells: { A: 'Marketing Budget', B: '4500', C: 'Approved' } },
      { rowId: 3, cells: { A: 'Engineering Sprint', B: '8200', C: 'In Progress' } },
      { rowId: 4, cells: { A: 'Infrastructure Ops', B: '2300', C: 'Active' } },
      { rowId: 5, cells: { A: 'Client Deliverable', B: '9800', C: 'Review' } },
    ];

    for (const r of sampleRows) {
      const version = Math.random().toString(36).substring(2, 10);
      await sql`
        INSERT INTO sheet_rows (row_id, cells, version, created_at, updated_at)
        VALUES (${r.rowId}, ${sql.json(r.cells)}, ${version}, NOW(), NOW())
        ON CONFLICT (row_id) DO NOTHING;
      `;
    }
    console.log(`   ✓ Seeded ${sampleRows.length} starter spreadsheet data rows`);

    // Sample Collaborator Users
    const sampleUsers = [
      { nickname: 'Cosmic Falcon', color: '#10b981', icon: 'zap' },
      { nickname: 'Quantum Otter', color: '#6366f1', icon: 'sparkles' },
      { nickname: 'Solar Phoenix', color: '#f59e0b', icon: 'flame' },
    ];

    for (const u of sampleUsers) {
      await sql`
        INSERT INTO users (nickname, color, icon, last_seen, created_at)
        VALUES (${u.nickname}, ${u.color}, ${u.icon}, NOW(), NOW())
        ON CONFLICT (nickname) DO NOTHING;
      `;
    }
    console.log(`   ✓ Seeded initial user identities (${sampleUsers.map(u => u.nickname).join(', ')})`);

    // 5. Verification & Summary Metrics
    console.log('\n📊 Database Status & Verification:');
    const [rowRes] = await sql`SELECT COUNT(*)::int AS count FROM sheet_rows;`;
    const [colRes] = await sql`SELECT COUNT(*)::int AS count FROM sheet_columns;`;
    const [userRes] = await sql`SELECT COUNT(*)::int AS count FROM users;`;
    const [configRes] = await sql`SELECT spreadsheet_id, sheet_name, sync_enabled FROM google_sheets_config WHERE id = 1;`;

    console.log(`   • sheet_rows:          ${rowRes.count} records`);
    console.log(`   • sheet_columns:       ${colRes.count} columns`);
    console.log(`   • users:               ${userRes.count} users`);
    console.log(`   • google_sheets_config: id=1 [sheet: "${configRes?.sheet_name || 'Sheet1'}", active_id: "${configRes?.spreadsheet_id || 'none (disconnected)'}"]`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Seeding completed successfully in ${duration}s!\n`);

    await sql.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seeding failed with error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    if (err.hint) console.error('   Hint:', err.hint);
    await sql.end();
    process.exit(1);
  }
}

runSeed();
