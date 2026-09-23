import axios from 'axios';
import { TableRow, SheetDataResponse, ActivityLog } from '../types';

// Determine base URL: If VITE_API_URL is configured (cross-domain), ensure /api suffix is handled
const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const baseURL = rawApiUrl ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`) : '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const getSheetData = async (page = 1, limit = 25): Promise<SheetDataResponse> => {
  const res = await api.get<SheetDataResponse>('/data', {
    params: { page, limit },
  });
  return res.data;
};

export const updateRow = async (
  rowId: number,
  payload: {
    cells: Record<string, string>;
    originalCells?: Record<string, string>;
    force?: boolean;
    A?: string;
    B?: string;
    C?: string;
    originalA?: string;
    originalB?: string;
    originalC?: string;
  }
): Promise<{ status: string; message: string; row: TableRow }> => {
  const res = await api.put(`/rows/${rowId}`, payload);
  return res.data;
};

export const addRow = async (
  payload: { cells: Record<string, string> }
): Promise<{ status: string; row: TableRow }> => {
  const res = await api.post('/rows', payload);
  return res.data;
};

export const addColumn = async (
  name: string
): Promise<{ status: string; columns: string[] }> => {
  const res = await api.post('/columns', { name });
  return res.data;
};

export const deleteRow = async (
  rowId: number
): Promise<{ status: string; message: string }> => {
  const res = await api.delete(`/rows/${rowId}`);
  return res.data;
};

export const getActivityLogs = async (): Promise<{ status: string; logs: ActivityLog[] }> => {
  const res = await api.get('/activity');
  return res.data;
};

export const simulateSheetEdit = async (payload: {
  rowId: number;
  cells?: Record<string, string>;
  A?: string;
  B?: string;
  C?: string;
}): Promise<{ status: string; message: string; row: TableRow }> => {
  const res = await api.post('/simulate-sheet-edit', payload);
  return res.data;
};

export const forceSync = async (): Promise<{ status: string; changed: boolean; columns: string[]; rows: TableRow[] }> => {
  const res = await api.post('/force-sync');
  return res.data;
};

export const checkHealth = async (): Promise<any> => {
  const res = await axios.get('/health');
  return res.data;
};

export const getSheetsConfig = async (): Promise<import('../types').SheetsConfigResponse> => {
  const res = await api.get('/sheets-config');
  return res.data;
};

export const saveSheetsConfig = async (payload: {
  spreadsheetId: string;
  sheetName: string;
  syncEnabled?: boolean;
}): Promise<{ status: string; config: import('../types').GoogleSheetsConfig; pythonResult: any }> => {
  const res = await api.post('/sheets-config', payload);
  return res.data;
};

export const testSheetsConnection = async (payload: {
  spreadsheetId: string;
  sheetName: string;
}): Promise<{ success: boolean; spreadsheetTitle?: string; sheetTitle?: string; rowCount?: number; headers?: string[]; error?: string; message?: string }> => {
  const res = await api.post('/sheets-config/test', payload);
  return res.data;
};

export default api;
