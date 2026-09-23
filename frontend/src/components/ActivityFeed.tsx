import React from 'react';
import { History, Globe, FileSpreadsheet, Zap, Radio } from 'lucide-react';
import { ActivityLog } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { translateLogDescription } from './HistoryPage';

interface ActivityFeedProps {
  logs: ActivityLog[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ logs }) => {
  const { language, t } = useLanguage();

  const getSourceBadge = (source: ActivityLog['source']) => {
    switch (source) {
      case 'web':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#34d399' }}>
            <Globe size={12} /> {t('sourceWeb')}
          </span>
        );
      case 'google_apps_script':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#818cf8' }}>
            <Zap size={12} /> {t('sourceWebhook')}
          </span>
        );
      case 'google_sheets_direct_edit':
      case 'sheets_poller':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#38bdf8' }}>
            <FileSpreadsheet size={12} /> {t('sourceSheets')}
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#fbbf24' }}>
            <Radio size={12} /> {t('sourcePoller')}
          </span>
        );
    }
  };

  return (
    <section id="tour-activity" className="activity-section" style={{ margin: '0 16px 24px' }}>
      <div className="activity-section-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
          <History size={15} color="var(--accent-green)" />
          {t('activityTitle')}
        </h3>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          {logs.length} {t('liveStreamBadge')}
        </span>
      </div>

      <div className="activity-list">
        {logs.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.84rem' }}>
            {t('noActivityYet')}
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="activity-item">
              <div className="activity-desc">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  {getSourceBadge(log.source)}
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>•</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Type: <code style={{ color: '#cbd5e1' }}>{log.type}</code>
                  </span>
                </div>
                <div>{translateLogDescription(log.description, language)}</div>
              </div>
              <div className="activity-time">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
