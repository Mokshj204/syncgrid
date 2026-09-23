-- ==============================================================================
-- Google Sheets Sync & Real-Time Collaborative Spreadsheet Database Schema
-- PostgreSQL Database Schema
-- ==============================================================================

-- Optional standard extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Users Table (Stores user nicknames, color tags, and avatar icons for auth)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nickname VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(30) DEFAULT '#10b981',
  icon VARCHAR(30) DEFAULT 'zap',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_nickname ON users (nickname);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen);

-- ------------------------------------------------------------------------------
-- 2. Sheet Columns Table (Dynamic column headers: A, B, C, D...)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sheet_columns (
  name VARCHAR(50) PRIMARY KEY,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sheet_columns_position ON sheet_columns (position);

-- ------------------------------------------------------------------------------
-- 3. Sheet Rows Table (Dynamic cell data persisted in high-performance JSONB)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sheet_rows (
  row_id INTEGER PRIMARY KEY,
  cells JSONB NOT NULL DEFAULT '{}'::jsonb,
  version VARCHAR(32) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GIN index enables rapid JSONB path lookups and cell queries
CREATE INDEX IF NOT EXISTS idx_sheet_rows_cells ON sheet_rows USING gin (cells);
CREATE INDEX IF NOT EXISTS idx_sheet_rows_updated_at ON sheet_rows (updated_at);

-- ------------------------------------------------------------------------------
-- 4. Cell Formats Table (Excel data types, formats, number formatting, colors)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cell_formats (
  cell_ref VARCHAR(50) PRIMARY KEY,
  format JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. Google Sheets Dynamic Configuration Table (Persisted runtime config)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_sheets_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  spreadsheet_id VARCHAR(255) NOT NULL DEFAULT '',
  sheet_name VARCHAR(100) NOT NULL DEFAULT 'Sheet1',
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Baseline Seed Data
-- ------------------------------------------------------------------------------

-- Default columns (A, B, C)
INSERT INTO sheet_columns (name, position)
VALUES 
  ('A', 1),
  ('B', 2),
  ('C', 3)
ON CONFLICT (name) DO NOTHING;

-- Default Google Sheets integration state (Row ID 1)
INSERT INTO google_sheets_config (id, spreadsheet_id, sheet_name, sync_enabled, updated_at)
VALUES (1, '', 'Sheet1', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Sample initial spreadsheet rows (Rows 1 to 5)
INSERT INTO sheet_rows (row_id, cells, version, created_at, updated_at)
VALUES 
  (1, '{"A": "Quarterly Target", "B": "15000", "C": "Confirmed"}'::jsonb, md5(random()::text), NOW(), NOW()),
  (2, '{"A": "Marketing Budget", "B": "4500", "C": "Approved"}'::jsonb, md5(random()::text), NOW(), NOW()),
  (3, '{"A": "Engineering Sprint", "B": "8200", "C": "In Progress"}'::jsonb, md5(random()::text), NOW(), NOW()),
  (4, '{"A": "Infrastructure Ops", "B": "2300", "C": "Active"}'::jsonb, md5(random()::text), NOW(), NOW()),
  (5, '{"A": "Client Deliverable", "B": "9800", "C": "Review"}'::jsonb, md5(random()::text), NOW(), NOW())
ON CONFLICT (row_id) DO NOTHING;

-- Sample initial user nicknames for collaborator presence
INSERT INTO users (nickname, color, icon, last_seen, created_at)
VALUES 
  ('Cosmic Falcon', '#10b981', 'zap', NOW(), NOW()),
  ('Quantum Otter', '#6366f1', 'sparkles', NOW(), NOW()),
  ('Solar Phoenix', '#f59e0b', 'flame', NOW(), NOW())
ON CONFLICT (nickname) DO NOTHING;
