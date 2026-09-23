import React from 'react';
import { Table, Zap, Clock, Columns } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface MetricsBarProps {
  rowCount: number;
  columnCount: number;
  limit: number;
  lastSyncTime: string;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ rowCount, columnCount, limit, lastSyncTime }) => {
  const { t } = useLanguage();

  const formattedTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString()
    : t('justNow');

  return (
    <div id="tour-metrics" className="metrics-grid">
      <div className="metric-card glass-panel">
        <div className="metric-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
          <Table size={22} />
        </div>
        <div className="metric-content">
          <div className="metric-label">{t('rowsSynced')}</div>
          <div className="metric-value">{rowCount}</div>
        </div>
      </div>

      <div className="metric-card glass-panel">
        <div className="metric-icon-box" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
          <Columns size={22} />
        </div>
        <div className="metric-content">
          <div className="metric-label">{t('activeColumns')}</div>
          <div className="metric-value">{columnCount}</div>
        </div>
      </div>

      <div className="metric-card glass-panel">
        <div className="metric-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
          <Zap size={22} />
        </div>
        <div className="metric-content">
          <div className="metric-label">{t('chunkWindow')}</div>
          <div className="metric-value">{limit} {t('rowsPerPage')}</div>
        </div>
      </div>

      <div className="metric-card glass-panel">
        <div className="metric-icon-box" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
          <Clock size={22} />
        </div>
        <div className="metric-content">
          <div className="metric-label">{t('lastSynced')}</div>
          <div className="metric-value">{formattedTime}</div>
        </div>
      </div>
    </div>
  );
};
