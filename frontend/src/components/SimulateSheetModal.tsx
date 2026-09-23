import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { TableRow } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface SimulateSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: string[];
  rows: TableRow[];
  onSimulate: (payload: { rowId: number; cells?: Record<string, string> }) => Promise<void>;
}

export const SimulateSheetModal: React.FC<SimulateSheetModalProps> = ({
  isOpen,
  onClose,
  columns,
  rows,
  onSimulate,
}) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const [selectedRowId, setSelectedRowId] = useState<number>(rows[0]?.rowId || 1);
  const [cellEdits, setCellEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const currentRow = rows.find((r) => r.rowId === selectedRowId) || rows[0];
  const currentCells = currentRow?.cells || currentRow || {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const merged: Record<string, string> = {};
      columns.forEach((col) => {
        merged[col] = cellEdits[col] !== undefined ? cellEdits[col] : String(currentCells[col] || '');
      });

      await onSimulate({
        rowId: selectedRowId,
        cells: merged,
      });
      onClose();
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#818cf8" />
            {t('simulateTitle')}
          </h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              {t('simulateSubtitle')}
            </p>

            <div className="form-group">
              <label>{t('simulateRowLabel')}</label>
              <select
                className="form-control"
                value={selectedRowId}
                onChange={(e) => {
                  const id = parseInt(e.target.value, 10);
                  setSelectedRowId(id);
                  setCellEdits({});
                }}
              >
                {rows.map((r) => (
                  <option key={r.rowId} value={r.rowId}>
                    {t('rowIdHeader')} #{r.rowId}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', maxHeight: '240px', overflowY: 'auto' }}>
              {columns.map((col) => (
                <div key={col} className="form-group">
                  <label>
                    <span className="col-tag">{col}</span> {t('simulateValuesLabel')}
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={String(currentCells[col] || `${col}...`)}
                    value={cellEdits[col] ?? ''}
                    onChange={(e) => setCellEdits({ ...cellEdits, [col]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              {t('cancelBtn')}
            </button>
            <button type="submit" className="btn btn-action-indigo" disabled={loading}>
              {loading ? t('simulatingBtn') : t('simulateExecuteBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
