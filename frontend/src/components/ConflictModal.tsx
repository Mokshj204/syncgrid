import React from 'react';
import { AlertTriangle, ArrowRight, Check, X, RefreshCw } from 'lucide-react';
import { ConflictData } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface ConflictModalProps {
  conflict: ConflictData | null;
  columns: string[];
  onClose: () => void;
  onForceOverwrite: (rowId: number, attemptedValues: Record<string, string>) => Promise<void>;
  onAcceptRemote: (rowId: number) => void;
  onReEdit: (rowId: number, currentServerRow: Record<string, string>) => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  conflict,
  columns,
  onClose,
  onForceOverwrite,
  onAcceptRemote,
  onReEdit,
}) => {
  const { t } = useLanguage();
  if (!conflict) return null;

  const { rowId, currentServerRow, attemptedValues, message } = conflict;
  const currentCells = currentServerRow.cells || currentServerRow;

  // Use all columns present across current and attempted
  const displayColumns = columns.length > 0 
    ? columns 
    : Array.from(new Set([...Object.keys(currentCells), ...Object.keys(attemptedValues)]));

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '680px' }}>
        <div className="modal-header" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
            <AlertTriangle size={20} color="#fbbf24" />
            {t('conflictTitle')} — #{rowId}
          </h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
            {message || t('conflictDescription')}
          </p>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {t('conflictDescription')}
          </p>

          {/* Dynamic Comparison Table */}
          <div style={{ background: 'rgba(0, 0, 0, 0.35)', borderRadius: '8px', border: '1px solid var(--border-color)', maxHeight: '260px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)' }}>{t('rowIdHeader')}</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#38bdf8' }}>{t('remoteSheet')}</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: '#f59e0b' }}>{t('localAttempted')}</th>
                </tr>
              </thead>
              <tbody>
                {displayColumns.map((col) => {
                  const currVal = currentCells[col] ?? '';
                  const attemptVal = attemptedValues[col] ?? '';
                  const hasDiff = currVal !== attemptVal;

                  return (
                    <tr key={col} style={{ borderBottom: '1px solid var(--border-color)', background: hasDiff ? 'rgba(245, 158, 11, 0.06)' : 'transparent' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {col}
                      </td>
                      <td style={{ padding: '10px 14px', color: hasDiff ? '#38bdf8' : 'var(--text-main)' }}>
                        {currVal || <span style={{ color: 'var(--text-dim)' }}>(blank)</span>}
                      </td>
                      <td style={{ padding: '10px 14px', color: hasDiff ? '#fbbf24' : 'var(--text-main)' }}>
                        {attemptVal || <span style={{ color: 'var(--text-dim)' }}>(blank)</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onAcceptRemote(rowId)}
            title={t('acceptRemoteBtn')}
          >
            <Check size={14} />
            {t('acceptRemoteBtn')}
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onReEdit(rowId, currentCells)}
              title={t('reviewMergeBtn')}
            >
              <RefreshCw size={14} />
              {t('reviewMergeBtn')}
            </button>
            <button
              className="btn btn-primary btn-sm"
              style={{ background: '#f59e0b' }}
              onClick={() => onForceOverwrite(rowId, attemptedValues)}
              title={t('keepMineBtn')}
            >
              <ArrowRight size={14} />
              {t('keepMineBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
