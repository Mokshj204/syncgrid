export interface TableRow {
  rowId: number;
  cells: Record<string, string>;
  version?: string;
  [key: string]: any;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'update' | 'create' | 'delete' | 'sync' | 'webhook' | 'conflict';
  source: 'web' | 'sheets_poller' | 'google_apps_script' | 'google_sheets_direct_edit' | 'manual_trigger' | 'system';
  description: string;
  data?: any;
}

export interface SheetDataResponse {
  status: string;
  mode: 'live' | 'disconnected' | string;
  columns: string[];
  rows: TableRow[];
  totalRows: number;
  page: number;
  limit: number;
  totalPages: number;
  hash: string;
  lastSyncTime: string;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'syncing' | 'disconnected';

export interface ConflictData {
  rowId: number;
  message: string;
  currentServerRow: TableRow;
  attemptedValues: Record<string, string>;
}

export interface ActiveEditor {
  socketId: string;
  username: string;
  color?: string;
  timestamp: number;
}

export interface CellTypingInfo {
  socketId: string;
  rowId: number;
  col: string;
  text: string;
  color?: string;
  nickname?: string;
}

export interface Collaborator {
  socketId: string;
  index: number;
  nickname: string;
  color: string;
  icon: string;
  focusedCell: { rowId: number; col: string } | null;
  typing?: { rowId: number; col: string; text: string } | null;
  joinedAt: number;
}

export type CellDataType = 
  | 'general' 
  | 'number' 
  | 'currency_usd' 
  | 'currency_inr' 
  | 'currency_eur' 
  | 'currency_gbp' 
  | 'percent' 
  | 'date_short' 
  | 'date_long' 
  | 'time' 
  | 'datetime' 
  | 'text' 
  | 'scientific';

export interface CellFormat {
  type?: CellDataType;
  decimals?: number;
  useGrouping?: boolean;
  currencySymbol?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  bgColor?: string;
}

export type CellFormatMap = Record<string, CellFormat>;

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName: string;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  updatedAt: string;
  isPersisted?: boolean;
}

export interface DatabaseStats {
  isDbConnected: boolean;
  mode: string;
  totalRows: number;
  totalColumns: number;
  totalUsers: number;
}

export interface SheetsConfigResponse {
  status: string;
  config: GoogleSheetsConfig;
  stats: DatabaseStats;
  pythonService?: {
    status?: string;
    mode?: string;
    spreadsheet_id?: string;
    sheet_name?: string;
    spreadsheet_id_configured?: boolean;
    poller_running?: boolean;
    columns?: string[];
    error?: string;
  };
}


