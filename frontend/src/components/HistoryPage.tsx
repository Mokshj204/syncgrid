import React, { useState, useMemo } from 'react';
import { 
  History, 
  ArrowLeft, 
  Globe, 
  FileSpreadsheet, 
  Zap, 
  Radio, 
  Search, 
  Filter, 
  Trash2, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { ActivityLog } from '../types';
import { useLanguage } from '../context/LanguageContext';

export function translateLogDescription(desc: string, lang: 'en' | 'hi'): string {
  if (lang !== 'hi' || !desc) return desc;

  let m = desc.match(/^Row #(\d+) updated in PostgreSQL$/i);
  if (m) return `पंक्ति #${m[1]} PostgreSQL में अपडेट की गई`;

  m = desc.match(/^Row #(\d+) added via Web Interface$/i);
  if (m) return `पंक्ति #${m[1]} वेब इंटरफ़ेस द्वारा जोड़ी गई`;

  m = desc.match(/^Row #(\d+) deleted via Web Interface$/i);
  if (m) return `पंक्ति #${m[1]} वेब इंटरफ़ेस द्वारा हटाई गई`;

  m = desc.match(/^Column '([^']+)' added to table$/i);
  if (m) return `कॉलम '${m[1]}' तालिका में जोड़ा गया`;

  m = desc.match(/^Google Sheet edit at Row (\d+), Col (.+)$/i);
  if (m) return `गूगल शीट संपादन: पंक्ति ${m[1]}, कॉलम ${m[2]}`;

  m = desc.match(/^Manual synchronization triggered \((\d+) rows pulled from Google Sheets\)$/i);
  if (m) return `मैन्युअल सिंक्रोनाइज़ेशन संपन्न (गूगल शीट्स से ${m[1]} पंक्तियाँ प्राप्त की गईं)`;

  if (desc === 'Google Sheet edited directly') {
    return 'गूगल शीट में सीधे संपादन किया गया';
  }
  if (desc === 'Google Sheet background change synchronization') {
    return 'गूगल शीट बैकग्राउंड परिवर्तन सिंक्रोनाइज़ेशन';
  }
  if (desc === 'Simulated Google Sheets edit applied') {
    return 'सिम्युलेटेड गूगल शीट्स संपादन लागू किया गया';
  }
  if (desc === 'External edit detected via Apps Script webhook') {
    return 'ऐप्स स्क्रिप्ट वेबहुक द्वारा बाहरी संपादन का पता चला';
  }

  return desc;
}

interface HistoryPageProps {
  logs: ActivityLog[];
  onNavigateHome: () => void;
  onClearLogs?: () => void;
  onForceSync?: () => void;
  isSyncing?: boolean;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  logs,
  onNavigateHome,
  onClearLogs,
  onForceSync,
  isSyncing = false,
}) => {
  const { language, t } = useLanguage();
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Filtering
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Source match
      if (selectedSource !== 'all') {
        if (selectedSource === 'web' && log.source !== 'web') return false;
        if (selectedSource === 'sheets' && log.source !== 'sheets_poller' && log.source !== 'google_sheets_direct_edit' && log.source !== 'manual_trigger') return false;
        if (selectedSource === 'webhook' && log.source !== 'google_apps_script') return false;
      }
      // Text search match
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const descMatch = log.description?.toLowerCase().includes(q);
        const translatedDescMatch = translateLogDescription(log.description, language).toLowerCase().includes(q);
        const typeMatch = log.type?.toLowerCase().includes(q);
        const sourceMatch = log.source?.toLowerCase().includes(q);
        const dataMatch = log.data ? JSON.stringify(log.data).toLowerCase().includes(q) : false;
        if (!descMatch && !translatedDescMatch && !typeMatch && !sourceMatch && !dataMatch) return false;
      }
      return true;
    });
  }, [logs, selectedSource, searchFilter, language]);

  const getSourceBadge = (source: ActivityLog['source']) => {
    switch (source) {
      case 'web':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600 }}>
            <Globe size={12} /> {t('historyBadgeWeb')}
          </span>
        );
      case 'google_apps_script':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#818cf8', background: 'rgba(129, 140, 248, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600 }}>
            <Zap size={12} /> {t('historyBadgeWebhook')}
          </span>
        );
      case 'google_sheets_direct_edit':
      case 'sheets_poller':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600 }}>
            <FileSpreadsheet size={12} /> {t('historyBadgeSheets')}
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 600 }}>
            <Radio size={12} /> {t('historyBadgePoller')}
          </span>
        );
    }
  };

  return (
    <div className="overview-container history-page-wrapper" style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px' }}>
      {/* Top Navigation & Back Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onNavigateHome}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
        >
          <ArrowLeft size={14} /> {t('historyBackBtn')}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {onForceSync && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onForceSync}
              disabled={isSyncing}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
            >
              <RefreshCw size={13} className={isSyncing ? 'spin-icon' : ''} />
              <span>{isSyncing ? t('syncing') : t('forceSyncBtn')}</span>
            </button>
          )}

          {onClearLogs && logs.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClearLogs}
              title={t('historyClearBtn')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-dim)' }}
            >
              <Trash2 size={13} /> {t('historyClearBtn')}
            </button>
          )}
        </div>
      </div>

      {/* Main Page Title Header */}
      <div className="overview-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{ 
            width: '38px', 
            height: '38px', 
            borderRadius: '8px', 
            background: 'rgba(16, 185, 129, 0.12)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--accent-green)',
            flexShrink: 0
          }}>
            <History size={20} />
          </div>
          <div>
            <h1 className="history-title" style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
              {t('historyTitle')}
            </h1>
            <p className="history-subtitle" style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              {t('historySubtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel history-filter-panel" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        {/* Source Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={12} /> {t('historySourceFilter')}
          </span>
          {[
            { id: 'all', label: t('historyFilterAll') },
            { id: 'sheets', label: t('historyFilterSheets') },
            { id: 'web', label: t('historyFilterWeb') },
            { id: 'webhook', label: t('historyFilterWebhook') },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`ribbon-btn ${selectedSource === tab.id ? 'active' : ''}`}
              style={{ height: '26px', fontSize: '0.76rem', padding: '0 10px' }}
              onClick={() => setSelectedSource(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="history-search-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '220px' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="form-control history-search-input"
            style={{ paddingLeft: '30px', height: '30px', fontSize: '0.8rem', width: '100%' }}
            placeholder={t('historySearchPlaceholder')}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Events Log List */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ 
          padding: '12px 18px', 
          background: 'var(--bg-toolbar)', 
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{t('historyLiveStream')}</span>
          </div>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {t('historyShowing')
              .replace('{shown}', String(filteredLogs.length))
              .replace('{total}', String(logs.length))}
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
            <Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              {t('historyNoEvents')}
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              {logs.length === 0 
                ? t('historyNoEventsSession')
                : t('historyNoFilterMatch')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasData = log.data && Object.keys(log.data).length > 0;

              return (
                <div 
                  key={log.id} 
                  style={{ 
                    borderBottom: '1px solid var(--border-color)',
                    padding: '12px 18px',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
                      {getSourceBadge(log.source)}
                      <code style={{ fontSize: '0.72rem', background: 'var(--bg-toolbar)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                        {log.type}
                      </code>
                      <span style={{ fontSize: '0.84rem', fontWeight: 500, color: 'var(--text-main)', wordBreak: 'break-word' }}>
                        {translateLogDescription(log.description, language)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      {hasData && (
                        <button
                          type="button"
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '0.74rem',
                            gap: '2px'
                          }}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable JSON Data Inspector */}
                  {isExpanded && hasData && (
                    <div style={{ 
                      marginTop: '10px', 
                      padding: '10px 14px', 
                      background: 'var(--input-bg)', 
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.74rem'
                    }}>
                      <div style={{ color: 'var(--text-dim)', marginBottom: '4px', fontWeight: 600 }}>{t('historyPayloadData')}</div>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#cbd5e1' }}>
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
