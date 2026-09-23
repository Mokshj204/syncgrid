import React from 'react';
import { X, Layers, Cpu, Zap, Shield } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} color="#34d399" />
            System Architecture & Synchronization Mechanics
          </h3>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '20px' }}>
          <div>
            <h4 style={{ color: 'white', marginBottom: '8px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={16} color="#38bdf8" />
              Technology Stack Separation
            </h4>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              • <strong>Frontend (React + TypeScript + Vite)</strong>: Single-page application rendering an exact 3-column table (A, B, C), handling the Edit & Submit workflow, optimistic updates, and reactive WebSocket events.<br />
              • <strong>Real-Time Gateway (Node.js + Express + Socket.IO)</strong>: Manages high-throughput WebSocket duplex channels to connected clients and ingests instant Google Apps Script HTTP webhooks.<br />
              • <strong>Sync Engine (Python + FastAPI + Google Sheets API v4)</strong>: Connects securely to Google Sheets using Service Account authentication, performs batch updates, computes deterministic hashes, and runs an asynchronous background polling detector.
            </p>
          </div>

          <div>
            <h4 style={{ color: 'white', marginBottom: '8px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={16} color="#fbbf24" />
              Bidirectional Synchronization Flow
            </h4>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.82rem', lineHeight: '1.7', border: '1px solid var(--border-color)' }}>
              <div><strong>1. Web → Google Sheets:</strong> React UI Edit & Submit → Node.js REST API → Python Sheets Engine → Google Sheets API v4 (<code style={{ color: '#34d399' }}>A{'{row}'}:C{'{row}'}</code> update) → WebSocket broadcast to all connected browsers.</div>
              <div style={{ marginTop: '8px' }}><strong>2. Google Sheets → Web (Dual-Mode):</strong>
                <ul style={{ paddingLeft: '18px', marginTop: '4px' }}>
                  <li><strong>Fast Push (&lt; 500ms latency)</strong>: Google Apps Script <code style={{ color: '#818cf8' }}>onEdit</code> trigger dispatches an immediate HTTP webhook to Node.js.</li>
                  <li><strong>Reliable Pull Fallback (2–3s latency)</strong>: Python background worker calculates continuous SHA hashes of sheet rows to catch any out-of-band edits.</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ color: 'white', marginBottom: '8px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={16} color="#10b981" />
              Connecting Your Live Google Sheet
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              1. In Google Cloud Console, enable <em>Google Sheets API</em> and create a <em>Service Account</em>.<br />
              2. Download the JSON key file as <code>credentials.json</code> and place it in <code>backend-python/credentials.json</code>.<br />
              3. Share your Google Sheet with the Service Account email address with <strong>Editor</strong> permissions.<br />
              4. Copy the Sheet ID from the URL and set <code>SPREADSHEET_ID=your_id</code> in <code>backend-python/.env</code>.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
