import './env_loader.js';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import axios from 'axios';
import { config } from './config.js';
import { 
  initDb, 
  isDbActive, 
  getColumns, 
  addColumn, 
  getChunkedRows, 
  upsertRow, 
  syncFullSheet,
  deleteRow, 
  getOrCreateUser, 
  getAllUsers, 
  getCellFormats, 
  saveCellFormat,
  getGoogleSheetsConfig,
  saveGoogleSheetsConfig,
  updateGoogleSheetsLastSynced,
  getDatabaseStats
} from './db/index.js';

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.use(cors());
app.use(express.json());

// Initialize remote PostgreSQL connection and sync saved sheet config with Python service
initDb()
  .then(async () => {
    try {
      const sheetsConfig = await getGoogleSheetsConfig();
      if (sheetsConfig?.spreadsheetId) {
        await axios.post(`${config.pythonServiceUrl}/api/sheets/reconfigure`, {
          spreadsheetId: sheetsConfig.spreadsheetId,
          sheetName: sheetsConfig.sheetName,
        }, { timeout: 4000 }).catch(() => {});
        console.log(`[Google Sheets] Synchronized persisted sheet configuration (${sheetsConfig.spreadsheetId}) with Python engine.`);
      }
    } catch {}
  })
  .catch(err => console.warn('[PostgreSQL / postgres.js] Init error:', err.message));

const syncActivityLog = [];
function logActivity(type, source, description, data = null) {
  const entry = {
    id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    type,
    source,
    description,
    data,
  };
  syncActivityLog.unshift(entry);
  if (syncActivityLog.length > 50) {
    syncActivityLog.pop();
  }
  return entry;
}

// ----------------------------------------------------
// Collaborator Capacity & Identity Configuration
// Cap: Exactly 10 concurrent active users
// ----------------------------------------------------
const MAX_COLLABORATORS = 10;
const activeCollaborators = new Map();

const AVATAR_COLORS = [
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#8b5cf6', // Violet
  '#ec4899', // Fuchsia
  '#84cc16', // Lime
  '#3b82f6', // Blue
  '#f97316', // Orange
];

const ADJECTIVES = ['Cosmic', 'Quantum', 'Solar', 'Neon', 'Atlas', 'Nova', 'Cyber', 'Velvet', 'Shadow', 'Emerald'];
const ANIMALS = ['Falcon', 'Otter', 'Phoenix', 'Fox', 'Lynx', 'Panda', 'Tiger', 'Dolphin', 'Hawk', 'Wolf'];
const ICONS = ['zap', 'sparkles', 'flame', 'shield', 'compass', 'feather', 'star', 'rocket', 'sun', 'moon'];

function generateCollaboratorIdentity(index) {
  const adj = ADJECTIVES[index % ADJECTIVES.length];
  const animal = ANIMALS[index % ANIMALS.length];
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const icon = ICONS[index % ICONS.length];
  return {
    nickname: `${adj} ${animal}`,
    color,
    icon,
  };
}

// Fetch current table data from Python Sheets service with chunking support
async function fetchLatestDataFromPython(page = 1, limit = 25) {
  try {
    const res = await axios.get(`${config.pythonServiceUrl}/api/sheets/data`, {
      params: { page, limit },
      timeout: 3000,
    });
    return res.data;
  } catch {
    return null;
  }
}

app.get('/health', async (req, res) => {
  let pythonHealth = null;
  try {
    const pyRes = await axios.get(`${config.pythonServiceUrl}/health`, { timeout: 2000 });
    pythonHealth = pyRes.data;
  } catch (err) {
    pythonHealth = { status: 'offline', error: err.message };
  }

  res.json({
    status: 'healthy',
    service: 'backend-node-gateway',
    orm: 'Drizzle ORM',
    database: isDbActive() ? 'connected (PostgreSQL / Drizzle)' : 'disconnected (Awaiting DATABASE_URL in .env)',
    activeCollaborators: activeCollaborators.size,
    maxCollaborators: MAX_COLLABORATORS,
    pythonService: pythonHealth,
  });
});

// Retrieve active collaborators list
app.get('/api/collaborators', (req, res) => {
  res.json({
    status: 'success',
    count: activeCollaborators.size,
    max: MAX_COLLABORATORS,
    collaborators: Array.from(activeCollaborators.values()),
  });
});

// Helper to query the live synchronization mode from the Python sync engine
async function getSheetsMode() {
  try {
    const res = await axios.get(`${config.pythonServiceUrl}/health`, { timeout: 1500 });
    return res.data?.mode === 'live' ? 'live' : 'disconnected';
  } catch {
    return 'disconnected';
  }
}

// Retrieve synchronized table data in chunks (PostgreSQL with Drizzle ORM fallback to Python)
app.get('/api/data', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;

  try {
    const sheetsMode = await getSheetsMode();

    // 1. If PostgreSQL (Drizzle) has data, serve it directly
    const dbData = await getChunkedRows(page, limit);
    if (dbData && (dbData.rows.length > 0 || isDbActive())) {
      return res.json({
        status: 'success',
        mode: sheetsMode,
        ...dbData,
      });
    }

    // 2. Otherwise fallback to Python sheets service
    const pyData = await fetchLatestDataFromPython(page, limit);
    if (pyData) {
      return res.json(pyData);
    }

    res.json({
      status: 'success',
      mode: sheetsMode,
      ...dbData,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Retrieve recent sync activity logs
app.get('/api/activity', (req, res) => {
  res.json({
    status: 'success',
    logs: syncActivityLog,
  });
});

// ----------------------------------------------------
// Users API (Persisting Nicknames via Drizzle ORM)
// ----------------------------------------------------
app.get('/api/users', async (req, res) => {
  try {
    const allUsers = await getAllUsers();
    res.json({ status: 'success', users: allUsers });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/users/profile', async (req, res) => {
  const { nickname, color, icon } = req.body;
  if (!nickname || !nickname.trim()) {
    return res.status(400).json({ status: 'error', message: 'Nickname is required' });
  }
  try {
    const user = await getOrCreateUser(nickname.trim(), color, icon);
    res.json({ status: 'success', user });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ----------------------------------------------------
// Cell Formats API (Excel styles via Drizzle ORM)
// ----------------------------------------------------
app.get('/api/formats', async (req, res) => {
  try {
    const formats = await getCellFormats();
    res.json({ status: 'success', formats });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/formats', async (req, res) => {
  const { cellRef, format } = req.body;
  if (!cellRef || !format) {
    return res.status(400).json({ status: 'error', message: 'cellRef and format are required' });
  }
  try {
    await saveCellFormat(cellRef, format);
    io.emit('format_updated', { cellRef, format });
    res.json({ status: 'success', cellRef, format });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Active row editors map: { [rowId: number]: { socketId: string, username: string } }
const activeEditors = {};

// Edit & Submit workflow across dynamic columns with Drizzle persistence
app.put('/api/rows/:rowId', async (req, res) => {
  const rowId = parseInt(req.params.rowId, 10);
  const { cells, originalCells, force } = req.body;

  try {
    // 1. Persist directly in PostgreSQL via Drizzle ORM (Atomic JSONB Merge)
    const updatedRow = await upsertRow(rowId, cells || {});

    // 2. Also forward to Python service to maintain Google Sheets sync
    try {
      await axios.put(`${config.pythonServiceUrl}/api/sheets/rows/${rowId}`, {
        cells,
        originalCells,
        force: Boolean(force),
      }, { timeout: 10000 });
    } catch (pyErr) {
      if (pyErr.response?.status === 409) {
        console.warn(`[Node.js] Conflict detected in Python service for row ${rowId}:`, pyErr.response.data);
        return res.status(409).json(pyErr.response.data);
      }
      console.warn(`[Node.js] Failed to forward row ${rowId} update to Python:`, pyErr.message);
    }

    const activity = logActivity('update', 'web', `Row #${rowId} updated in PostgreSQL`, updatedRow);

    io.emit('row_updated', {
      rowId,
      row: updatedRow,
      cells: updatedRow.cells || updatedRow,
      source: 'web',
      activity,
    });

    delete activeEditors[rowId];
    io.emit('row_editing_status', activeEditors);

    res.json({
      status: 'success',
      message: `Row ${rowId} updated successfully`,
      row: updatedRow,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to update row',
    });
  }
});

// Add new row with dynamic columns
app.post('/api/rows', async (req, res) => {
  const { cells, rowId: requestedRowId } = req.body;

  try {
    // Determine rowId
    let targetRowId = requestedRowId;
    if (!targetRowId) {
      const data = await getChunkedRows(1, 1000);
      targetRowId = data.totalRows + 1;
    }

    const newRow = await upsertRow(targetRowId, cells || {});

    // Also forward to Python with targetRowId
    try {
      await axios.post(`${config.pythonServiceUrl}/api/sheets/rows`, {
        cells,
        rowId: targetRowId,
      }, { timeout: 10000 });
    } catch (pyErr) {
      console.warn(`[Node.js] Failed to forward new row ${targetRowId} to Python:`, pyErr.message);
    }

    const activity = logActivity('create', 'web', `Row #${newRow.rowId} added via Web Interface`, newRow);

    io.emit('row_added', {
      row: newRow,
      source: 'web',
      activity,
    });

    res.json({
      status: 'success',
      row: newRow,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to append row',
    });
  }
});

// Add new column to sheet
app.post('/api/columns', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ status: 'error', message: 'Column name is required.' });
  }

  try {
    const columns = await addColumn(name.trim());

    // Also forward to Python if online
    try {
      await axios.post(`${config.pythonServiceUrl}/api/sheets/columns`, { name: name.trim() }, { timeout: 2000 });
    } catch {}

    const activity = logActivity('update', 'web', `Column '${name}' added to table`, { name, columns });

    io.emit('columns_updated', {
      columns,
      activity,
    });

    res.json({ status: 'success', columns });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Delete row by ID
app.delete('/api/rows/:rowId', async (req, res) => {
  const rowId = parseInt(req.params.rowId, 10);
  try {
    await deleteRow(rowId);

    // Also forward to Python if online
    try {
      await axios.delete(`${config.pythonServiceUrl}/api/sheets/rows/${rowId}`, { timeout: 2000 });
    } catch {}

    const activity = logActivity('delete', 'web', `Row #${rowId} deleted via Web Interface`, { rowId });

    io.emit('row_deleted', {
      rowId,
      source: 'web',
      activity,
    });

    res.json({ status: 'success', message: `Row ${rowId} deleted` });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to delete row',
    });
  }
});

function numToColLetter(num) {
  let n = Number(num);
  if (isNaN(n) || n <= 0) return 'A';
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Google Apps Script Webhook Ingestion
app.post('/api/webhook/sheets', async (req, res) => {
  try {
    const { token, row, col, value, colName, cells, rowId } = req.body;

    if (config.webhookSecret && token && token !== config.webhookSecret) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized webhook request.' });
    }

    // Persist incoming webhook edit directly into PostgreSQL (1-to-1 rowId mapping)
    const targetRowId = rowId || row || 1;
    const targetCol = colName || (col ? (typeof col === 'number' ? numToColLetter(col) : String(col)) : 'A');

    if (cells && typeof cells === 'object' && Object.keys(cells).length > 0) {
      await upsertRow(targetRowId, cells, false);
    } else if (targetRowId && targetCol) {
      await upsertRow(targetRowId, { [targetCol]: value !== undefined && value !== null ? String(value) : '' }, false);
    }

    const updatedData = await getChunkedRows(1, 25);
    const activity = logActivity(
      'webhook',
      'google_apps_script',
      `Google Sheet edit at Row ${targetRowId}, Col ${targetCol}`,
      { row: targetRowId, col: targetCol, value, colName: targetCol }
    );

    io.emit('sheet_updated', {
      source: 'google_apps_script_webhook',
      timestamp: new Date().toISOString(),
      columns: updatedData.columns,
      rows: updatedData.rows,
      totalRows: updatedData.totalRows,
      mode: isDbActive() ? 'postgresql_drizzle' : 'disconnected',
      activity,
    });

    res.json({ status: 'success', message: 'Webhook received and broadcasted.' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Internal sync event relay from Python background poller
app.post('/internal/sync-event', async (req, res) => {
  const { source, timestamp, rows, columns, mode, rowCount } = req.body;

  // Sync columns if provided
  if (columns && Array.isArray(columns) && columns.length > 0) {
    try {
      const existingCols = await getColumns();
      const existingSet = new Set(existingCols);
      for (const c of columns) {
        if (!existingSet.has(c)) {
          await addColumn(c);
          existingSet.add(c);
        }
      }
    } catch (colErr) {
      console.warn('[Node.js] Failed to sync columns in sync-event:', colErr.message);
    }
  }

  // Sync rows from Google Sheets poller into PostgreSQL (syncFullSheet prunes deleted rows and empties deleted cells)
  if (source !== 'web_edit' && source !== 'web_add') {
    await syncFullSheet(rows || []);
  }

  const updatedData = await getChunkedRows(1, 25);

  const activity = logActivity(
    'sync',
    source || 'sheets_poller',
    source === 'google_sheets_direct_edit'
      ? 'Google Sheet edited directly'
      : 'Google Sheet background change synchronization',
    { rowCount: updatedData.totalRows }
  );

  io.emit('sheet_updated', {
    source: source || 'sheets_poller',
    timestamp,
    columns: columns || updatedData.columns,
    rows: updatedData.rows,
    totalRows: updatedData.totalRows,
    mode: mode || 'live',
    activity,
  });

  res.json({ status: 'acknowledged' });
});

// Simulate direct sheet edit
app.post('/api/simulate-sheet-edit', async (req, res) => {
  try {
    const { rowId, cells, A, B, C } = req.body;
    const cleanCells = cells || {};
    if (A !== undefined) cleanCells.A = A;
    if (B !== undefined) cleanCells.B = B;
    if (C !== undefined) cleanCells.C = C;

    const updated = await upsertRow(rowId, cleanCells);

    try {
      await axios.post(`${config.pythonServiceUrl}/api/sheets/simulate-sheet-edit`, req.body, { timeout: 2000 });
    } catch {}

    res.json({ status: 'success', row: updated });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ----------------------------------------------------
// Google Sheets Dynamic Configuration Endpoints
// (Managed dynamically via SPA /overview and persisted in PostgreSQL)
// ----------------------------------------------------

// Retrieve current configuration & database health stats
app.get('/api/sheets-config', async (req, res) => {
  try {
    const configData = await getGoogleSheetsConfig();
    const stats = await getDatabaseStats();

    let pythonHealth = null;
    try {
      const pyRes = await axios.get(`${config.pythonServiceUrl}/health`, { timeout: 2000 });
      pythonHealth = pyRes.data;
    } catch (err) {
      pythonHealth = { mode: 'offline', error: err.message };
    }

    res.json({
      status: 'success',
      config: configData,
      stats,
      pythonService: pythonHealth,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Persist Google Sheets configuration to PostgreSQL and hot-reconfigure Python sync engine
app.post('/api/sheets-config', async (req, res) => {
  try {
    const { spreadsheetId, sheetName, syncEnabled } = req.body;

    // 1. Save to PostgreSQL
    const savedConfig = await saveGoogleSheetsConfig({
      spreadsheetId: spreadsheetId || '',
      sheetName: sheetName || 'Sheet1',
      syncEnabled: syncEnabled !== undefined ? Boolean(syncEnabled) : true,
    });

    // 2. Reconfigure Python engine dynamically
    let pythonResult = null;
    try {
      const pyRes = await axios.post(
        `${config.pythonServiceUrl}/api/sheets/reconfigure`,
        {
          spreadsheetId: savedConfig.spreadsheetId,
          sheetName: savedConfig.sheetName,
        },
        { timeout: 15000 }
      );
      pythonResult = pyRes.data;
    } catch (pyErr) {
      pythonResult = {
        success: false,
        error: pyErr.response?.data?.error || pyErr.response?.data?.detail || pyErr.message,
      };
    }

    // 3. Log audit activity
    const activity = logActivity(
      'config_updated',
      'web',
      `Google Sheets configuration updated: ${savedConfig.spreadsheetId ? savedConfig.spreadsheetId : 'Disconnected'} [Tab: ${savedConfig.sheetName}]`,
      savedConfig
    );

    // 4. Broadcast update to all connected SPA clients
    io.emit('sheets_config_updated', {
      config: savedConfig,
      pythonResult,
      activity,
    });

    res.json({
      status: 'success',
      config: savedConfig,
      pythonResult,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Test Google Sheets connectivity without saving
app.post('/api/sheets-config/test', async (req, res) => {
  try {
    const { spreadsheetId, sheetName } = req.body;
    const pyRes = await axios.post(
      `${config.pythonServiceUrl}/api/sheets/test-connection`,
      {
        spreadsheetId: spreadsheetId || '',
        sheetName: sheetName || 'Sheet1',
      },
      { timeout: 15000 }
    );
    res.json(pyRes.data);
  } catch (err) {
    const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Python sync service unavailable';
    res.status(err.response?.status || 500).json({
      success: false,
      error: errorMsg,
    });
  }
});

// Force manual synchronization check
app.post('/api/force-sync', async (req, res) => {
  try {
    // 1. Trigger Python force-sync and fetch live Google Sheet data
    let pyRows = [];
    let pyColumns = [];
    try {
      const pyRes = await axios.post(`${config.pythonServiceUrl}/api/sheets/force-sync`, {}, { timeout: 15000 });
      pyRows = pyRes.data?.rows || [];
      pyColumns = pyRes.data?.columns || [];
    } catch (pyErr) {
      console.warn('[Node.js] Failed to call Python force-sync, attempting direct data query:', pyErr.message);
      const pyData = await fetchLatestDataFromPython(1, 100);
      if (pyData?.rows) {
        pyRows = pyData.rows;
      }
      if (pyData?.columns) {
        pyColumns = pyData.columns;
      }
    }

    // Persist new columns into PostgreSQL
    if (pyColumns && Array.isArray(pyColumns) && pyColumns.length > 0) {
      try {
        const existingCols = await getColumns();
        const existingSet = new Set(existingCols);
        for (const c of pyColumns) {
          if (!existingSet.has(c)) {
            await addColumn(c);
            existingSet.add(c);
          }
        }
      } catch (colErr) {
        console.warn('[Node.js] Failed to sync columns in force-sync:', colErr.message);
      }
    }

    // 2. Persist fresh Google Sheet rows into PostgreSQL (syncFullSheet prunes deleted rows and empties deleted cells)
    await syncFullSheet(pyRows || []);

    // 3. Return and broadcast updated data
    const data = await getChunkedRows(1, 25);
    await updateGoogleSheetsLastSynced();
    const activity = logActivity('sync', 'manual_trigger', `Manual synchronization triggered (${pyRows.length} rows pulled from Google Sheets)`);

    const sheetsMode = await getSheetsMode();
    io.emit('sheet_updated', {
      source: 'manual_trigger',
      timestamp: new Date().toISOString(),
      columns: data.columns,
      rows: data.rows,
      totalRows: data.totalRows,
      mode: sheetsMode,
      activity,
    });

    res.json({ status: 'success', mode: sheetsMode, ...data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Socket.IO connection lifecycle with 10-collaborator capacity enforcement
io.on('connection', async (socket) => {
  if (activeCollaborators.size >= MAX_COLLABORATORS) {
    console.warn(`[Socket.IO] Sheet capacity reached (${MAX_COLLABORATORS}/${MAX_COLLABORATORS}). Rejecting ${socket.id}`);
    socket.emit('capacity_reached', {
      maxCollaborators: MAX_COLLABORATORS,
      message: 'Sheet has reached maximum capacity of 10 concurrent collaborators. Please wait for a collaborator to leave.',
    });
    socket.disconnect(true);
    return;
  }

  const usedIndices = new Set(Array.from(activeCollaborators.values()).map(c => c.index));
  let assignedIndex = 0;
  for (let i = 0; i < MAX_COLLABORATORS; i++) {
    if (!usedIndices.has(i)) {
      assignedIndex = i;
      break;
    }
  }

  const identity = generateCollaboratorIdentity(assignedIndex);
  const collaborator = {
    socketId: socket.id,
    index: assignedIndex,
    nickname: identity.nickname,
    color: identity.color,
    icon: identity.icon,
    focusedCell: { rowId: 1, col: 'A' },
    typing: null,
    joinedAt: Date.now(),
  };

  // Persist user nickname to PostgreSQL via Drizzle ORM
  try {
    await getOrCreateUser(collaborator.nickname, collaborator.color, collaborator.icon);
  } catch (err) {
    console.warn('[Drizzle] Failed to persist initial user:', err.message);
  }

  activeCollaborators.set(socket.id, collaborator);
  console.log(`[Socket.IO] Collaborator joined: ${collaborator.nickname} (${socket.id}). Active: ${activeCollaborators.size}/${MAX_COLLABORATORS}`);

  const latestData = await getChunkedRows(1, 25);
  const formats = await getCellFormats();
  const sheetsConfig = await getGoogleSheetsConfig();
  const dbStats = await getDatabaseStats();

  const sheetsMode = await getSheetsMode();

  socket.emit('init_state', {
    status: 'connected',
    clientId: socket.id,
    collaborator,
    collaborators: Array.from(activeCollaborators.values()),
    maxCollaborators: MAX_COLLABORATORS,
    columns: latestData.columns,
    data: latestData.rows,
    totalRows: latestData.totalRows,
    page: latestData.page,
    limit: latestData.limit,
    totalPages: latestData.totalPages,
    mode: sheetsMode,
    activityLog: syncActivityLog.slice(0, 15),
    activeEditors,
    cellFormats: formats,
    sheetsConfig,
    dbStats,
  });

  io.emit('collaborators_changed', Array.from(activeCollaborators.values()));

  socket.on('cell_focus', ({ rowId, col }) => {
    const user = activeCollaborators.get(socket.id);
    if (user) {
      user.focusedCell = { rowId: Number(rowId), col: String(col) };
      if (user.typing && (user.typing.rowId !== Number(rowId) || user.typing.col !== String(col))) {
        io.emit('cell_stop_typing', { socketId: socket.id, rowId: user.typing.rowId, col: user.typing.col });
        user.typing = null;
      }
      io.emit('collaborators_changed', Array.from(activeCollaborators.values()));
    }
  });

  socket.on('cell_blur', () => {
    const user = activeCollaborators.get(socket.id);
    if (user && user.focusedCell) {
      user.focusedCell = null;
      if (user.typing) {
        io.emit('cell_stop_typing', { socketId: socket.id, rowId: user.typing.rowId, col: user.typing.col });
        user.typing = null;
      }
      io.emit('collaborators_changed', Array.from(activeCollaborators.values()));
    }
  });

  socket.on('cell_typing', ({ rowId, col, text }) => {
    const user = activeCollaborators.get(socket.id);
    if (user) {
      user.focusedCell = { rowId: Number(rowId), col: String(col) };
      user.typing = { rowId: Number(rowId), col: String(col), text: String(text ?? '') };
      io.emit('cell_typing', {
        socketId: socket.id,
        rowId: Number(rowId),
        col: String(col),
        text: String(text ?? ''),
        color: user.color,
        nickname: user.nickname,
      });
      io.emit('collaborators_changed', Array.from(activeCollaborators.values()));
    }
  });

  socket.on('cell_stop_typing', ({ rowId, col }) => {
    const user = activeCollaborators.get(socket.id);
    if (user) {
      user.typing = null;
      io.emit('cell_stop_typing', {
        socketId: socket.id,
        rowId: Number(rowId),
        col: String(col),
      });
      io.emit('collaborators_changed', Array.from(activeCollaborators.values()));
    }
  });

  // Update profile nickname or color - persisted in PostgreSQL via Drizzle ORM
  socket.on('update_profile', async ({ nickname, color, icon }) => {
    const user = activeCollaborators.get(socket.id);
    if (user) {
      if (nickname && nickname.trim()) user.nickname = nickname.trim().substring(0, 25);
      if (color) user.color = color;
      if (icon) user.icon = icon;

      // Persist in Drizzle PostgreSQL
      try {
        await getOrCreateUser(user.nickname, user.color, user.icon);
      } catch (err) {
        console.warn('[Drizzle] Error saving profile update:', err.message);
      }

      io.emit('collaborators_changed', Array.from(activeCollaborators.values()));
    }
  });

  // Save Excel format for cell / column
  socket.on('save_format', async ({ cellRef, format }) => {
    if (cellRef && format) {
      await saveCellFormat(cellRef, format);
      io.emit('format_updated', { cellRef, format });
    }
  });

  socket.on('editing_start', ({ rowId, username }) => {
    const user = activeCollaborators.get(socket.id);
    activeEditors[rowId] = {
      socketId: socket.id,
      username: username || user?.nickname || `User-${socket.id.substring(0, 4)}`,
      color: user?.color || '#fbbf24',
      timestamp: Date.now(),
    };
    io.emit('row_editing_status', activeEditors);
  });

  socket.on('editing_stop', ({ rowId }) => {
    if (activeEditors[rowId] && activeEditors[rowId].socketId === socket.id) {
      delete activeEditors[rowId];
      io.emit('row_editing_status', activeEditors);
    }
  });

  socket.on('disconnect', () => {
    const user = activeCollaborators.get(socket.id);
    if (user?.typing) {
      io.emit('cell_stop_typing', { socketId: socket.id, rowId: user.typing.rowId, col: user.typing.col });
    }
    activeCollaborators.delete(socket.id);
    console.log(`[Socket.IO] Collaborator left: ${socket.id}. Active: ${activeCollaborators.size}/${MAX_COLLABORATORS}`);
    io.emit('collaborators_changed', Array.from(activeCollaborators.values()));

    let changed = false;
    for (const rId in activeEditors) {
      if (activeEditors[rId].socketId === socket.id) {
        delete activeEditors[rId];
        changed = true;
      }
    }
    if (changed) {
      io.emit('row_editing_status', activeEditors);
    }
  });
});

server.listen(config.port, config.host, () => {
  console.log(`Node.js Gateway with Drizzle ORM listening on port ${config.port}`);
});
