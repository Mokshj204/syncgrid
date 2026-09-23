import React, { useState, useEffect } from 'react';
import { 
  Database, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  ExternalLink, 
  RefreshCw, 
  Save, 
  ShieldCheck,
  Sliders,
  Sparkles
} from 'lucide-react';
import { GoogleSheetsConfig, DatabaseStats, SheetsConfigResponse } from '../types';
import { getSheetsConfig, saveSheetsConfig, testSheetsConnection } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface OverviewPageProps {
  onNavigateHome: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigateHome }) => {
  const { t } = useLanguage();
  const [config, setConfig] = useState<GoogleSheetsConfig>({
    spreadsheetId: '',
    sheetName: 'Sheet1',
    syncEnabled: true,
    lastSyncedAt: null,
    updatedAt: new Date().toISOString(),
    isPersisted: false,
  });

  const [stats, setStats] = useState<DatabaseStats>({
    isDbConnected: false,
    mode: 'in_memory_fallback',
    totalRows: 0,
    totalColumns: 0,
    totalUsers: 0,
  });

  const [pythonInfo, setPythonInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // Form input fields
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState<string>('');
  const [sheetNameInput, setSheetNameInput] = useState<string>('Sheet1');
  const [syncEnabledInput, setSyncEnabledInput] = useState<boolean>(true);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    details?: string;
  } | null>(null);

  // Load configuration on mount
  const fetchOverviewData = async () => {
    try {
      setIsLoading(true);
      const res: SheetsConfigResponse = await getSheetsConfig();
      if (res.config) {
        setConfig(res.config);
        setSpreadsheetIdInput(res.config.spreadsheetId || '');
        setSheetNameInput(res.config.sheetName || 'Sheet1');
        setSyncEnabledInput(res.config.syncEnabled ?? true);
      }
      if (res.stats) {
        setStats(res.stats);
      }
      if (res.pythonService) {
        setPythonInfo(res.pythonService);
      }
    } catch (err: any) {
      console.warn('Failed to load overview data:', err.message);
      setFeedback({
        type: 'error',
        message: 'Could not fetch current configuration from backend.',
        details: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  // Handle Test Connection
  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spreadsheetIdInput.trim()) {
      setFeedback({
        type: 'error',
        message: 'Spreadsheet ID is required to run connection test.',
      });
      return;
    }

    try {
      setIsTesting(true);
      setFeedback(null);
      const res = await testSheetsConnection({
        spreadsheetId: spreadsheetIdInput.trim(),
        sheetName: sheetNameInput.trim() || 'Sheet1',
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Connection Verified: Successfully connected to "${res.spreadsheetTitle}" (Tab: "${res.sheetTitle}").`,
          details: `Found ${res.rowCount} data rows and ${res.headers?.length || 0} columns (${res.headers?.join(', ')}).`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: 'Connection Failed: Google Sheets rejected the request.',
          details: res.error || 'Please ensure the service account has Viewer/Editor permission on the spreadsheet.',
        });
      }
    } catch (err: any) {
      const errDetail = err.response?.data?.error || err.response?.data?.message || err.message;
      setFeedback({
        type: 'error',
        message: 'Test Request Failed',
        details: errDetail,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Handle Save Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setFeedback(null);
      const res = await saveSheetsConfig({
        spreadsheetId: spreadsheetIdInput.trim(),
        sheetName: sheetNameInput.trim() || 'Sheet1',
        syncEnabled: syncEnabledInput,
      });

      if (res.config) {
        setConfig(res.config);
      }

      const isLive = Boolean(res.pythonResult?.success && res.pythonResult?.mode === 'live');
      setFeedback({
        type: 'success',
        message: 'Configuration successfully persisted to PostgreSQL database!',
        details: isLive
          ? `Live sync active: Connected to Google Sheet "${res.pythonResult?.spreadsheetTitle || spreadsheetIdInput.trim()}".`
          : res.pythonResult?.message || 'Updated configuration saved.',
      });

      // Refresh overview status
      await fetchOverviewData();
    } catch (err: any) {
      const errDetail = err.response?.data?.error || err.response?.data?.message || err.message;
      setFeedback({
        type: 'error',
        message: 'Failed to persist configuration to PostgreSQL database.',
        details: errDetail,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Disconnect Google Sheets
  const handleDisconnectSheet = async () => {
    setSpreadsheetIdInput('');
    setSheetNameInput('Sheet1');
    try {
      setIsSaving(true);
      await saveSheetsConfig({
        spreadsheetId: '',
        sheetName: 'Sheet1',
        syncEnabled: true,
      });
      setFeedback({
        type: 'info',
        message: 'Google Sheets disconnected.',
      });
      await fetchOverviewData();
    } finally {
      setIsSaving(false);
    }
  };

  const isLiveConnected = Boolean(config.spreadsheetId && pythonInfo?.mode === 'live');

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px', width: '100%' }}>
      {/* Top Breadcrumb & Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            className="btn btn-sm"
            onClick={onNavigateHome}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>{t('sheetViewBtn')}</span>
          </button>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
              Google Sheets & Database Control Center
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Manage dynamic sheet binding, inspect remote PostgreSQL persistence, and monitor synchronization health at runtime.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-sm"
            onClick={fetchOverviewData}
            disabled={isLoading}
            title="Refresh overview metrics"
          >
            <RefreshCw size={13} className={isLoading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Alert / Feedback Notification */}
      {feedback && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '6px',
            border: `1px solid ${
              feedback.type === 'success' ? '#10b98155' : feedback.type === 'error' ? '#ef444455' : '#3b82f655'
            }`,
            background:
              feedback.type === 'success' ? '#10b98115' : feedback.type === 'error' ? '#ef444415' : '#3b82f615',
            color: 'var(--text-main)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={18} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
          ) : feedback.type === 'error' ? (
            <AlertCircle size={18} color="#ef4444" style={{ marginTop: '2px', flexShrink: 0 }} />
          ) : (
            <Sparkles size={18} color="#3b82f6" style={{ marginTop: '2px', flexShrink: 0 }} />
          )}
          <div style={{ fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600 }}>{feedback.message}</div>
            {feedback.details && (
              <div style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                {feedback.details}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Card 1: Remote PostgreSQL Status */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.95rem' }}>
              <Database size={16} color="#3b82f6" />
              <span>PostgreSQL Database</span>
            </div>
            <span style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '999px',
              fontWeight: 600,
              background: stats.isDbConnected ? '#10b98122' : '#f59e0b22',
              color: stats.isDbConnected ? '#10b981' : '#f59e0b',
              border: `1px solid ${stats.isDbConnected ? '#10b98144' : '#f59e0b44'}`
            }}>
              {stats.isDbConnected ? 'Connected (Remote)' : 'Memory Fallback'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '14px' }}>
            <div style={{ background: 'var(--bg-surface-secondary)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{stats.totalRows}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Rows Persisted</div>
            </div>
            <div style={{ background: 'var(--bg-surface-secondary)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{stats.totalColumns}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Columns</div>
            </div>
            <div style={{ background: 'var(--bg-surface-secondary)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{stats.totalUsers}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Users (Auth)</div>
            </div>
          </div>

          <div style={{ marginTop: '14px', fontSize: '0.78rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={13} color="#10b981" />
            <span>Driver: postgres.js (Direct SQL + JSONB cell atomicity)</span>
          </div>
        </div>

        {/* Card 2: Google Sheets Status */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.95rem' }}>
              <FileSpreadsheet size={16} color="#10b981" />
              <span>Google Sheets Integration</span>
            </div>
            <span style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '999px',
              fontWeight: 600,
              background: isLiveConnected ? '#10b98122' : '#6366f122',
              color: isLiveConnected ? '#10b981' : '#818cf8',
              border: `1px solid ${isLiveConnected ? '#10b98144' : '#818cf844'}`
            }}>
              {isLiveConnected ? 'LIVE SHEET' : 'DISCONNECTED'}
            </span>
          </div>

          <div style={{ fontSize: '0.82rem', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Spreadsheet ID:</span>
              <span style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '0.78rem', 
                maxWidth: '180px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}>
                {config.spreadsheetId || '(None - Disconnected)'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Active Tab:</span>
              <span style={{ fontWeight: 600 }}>{config.sheetName || 'Sheet1'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Auto Synchronization:</span>
              <span style={{ color: config.syncEnabled ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                {config.syncEnabled ? 'Enabled' : 'Paused'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-muted)' }}>Last Synced:</span>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                {config.lastSyncedAt ? new Date(config.lastSyncedAt).toLocaleTimeString() : 'Never'}
              </span>
            </div>
          </div>

          {config.spreadsheetId && (
            <div style={{ marginTop: '12px' }}>
              <a
                href={`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.76rem',
                  color: 'var(--accent-blue)',
                  textDecoration: 'none',
                }}
              >
                <span>Open in Google Sheets</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Google Sheets Management Form */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Sliders size={18} color="#10b981" />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
            Dynamic Google Sheets Configuration
          </h2>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Connect any Google Sheet dynamically. Changes are immediately saved to PostgreSQL and reloaded into the Python sync service without rebooting the server.
        </p>

        <form onSubmit={handleSaveConfig}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Spreadsheet ID Input */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                Google Spreadsheet ID
              </label>
              <input
                type="text"
                className="form-control"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '0.86rem',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                }}
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                value={spreadsheetIdInput}
                onChange={(e) => setSpreadsheetIdInput(e.target.value)}
              />
              <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                Found inside your Google Sheets URL: <span style={{ fontFamily: 'var(--font-mono)' }}>docs.google.com/spreadsheets/d/<b>&lt;SPREADSHEET_ID&gt;</b>/edit</span>
              </div>
            </div>

            {/* Sheet Name Input */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  Sheet / Tab Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '0.86rem',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    borderRadius: '6px',
                    color: 'var(--text-main)',
                  }}
                  placeholder="Sheet1"
                  value={sheetNameInput}
                  onChange={(e) => setSheetNameInput(e.target.value)}
                />
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  The tab name at the bottom of your Google Sheet (default: <span style={{ fontFamily: 'var(--font-mono)' }}>Sheet1</span>).
                </div>
              </div>

              {/* Automated Sync Toggle */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                  Sync Settings
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  height: '42px',
                  padding: '0 12px',
                  background: 'var(--bg-surface-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <input
                    type="checkbox"
                    id="sync-toggle"
                    checked={syncEnabledInput}
                    onChange={(e) => setSyncEnabledInput(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#10b981' }}
                  />
                  <label htmlFor="sync-toggle" style={{ fontSize: '0.82rem', cursor: 'pointer', userSelect: 'none' }}>
                    Enable automated background synchronization
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleTestConnection}
                  disabled={isTesting || !spreadsheetIdInput.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={13} className={isTesting ? 'spin-icon' : ''} />
                  <span>{isTesting ? 'Testing Connectivity...' : 'Test Connection'}</span>
                </button>

                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  disabled={isSaving}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={13} />
                  <span>{isSaving ? 'Saving to Database...' : 'Save & Persist to Database'}</span>
                </button>
              </div>

              {config.spreadsheetId && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={handleDisconnectSheet}
                  disabled={isSaving}
                  style={{ fontSize: '0.78rem', color: '#ef4444', borderColor: '#ef444466' }}
                >
                  Disconnect Sheet
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

    </div>
  );
};
