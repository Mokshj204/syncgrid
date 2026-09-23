import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  RefreshCw, 
  Sparkles, 
  Compass, 
  Languages, 
  Sun, 
  Moon, 
  Edit2, 
  Check,
  History
} from 'lucide-react';
import { ConnectionStatus, Collaborator } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { CollaboratorIcon } from './CollaboratorIcon';

interface NavbarProps {
  status: ConnectionStatus;
  mode: 'live' | 'disconnected' | string;
  isSyncing: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onForceSync: () => void;
  onOpenSimulate: () => void;
  onOpenDocs?: () => void;
  onOpenTour?: () => void;
  currentCollaborator: Collaborator | null;
  collaborators: Collaborator[];
  onUpdateNickname: (nickname: string) => void;
  lastSyncTime?: string;
  currentRoute?: string;
  onNavigate?: (route: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  status,
  mode,
  isSyncing,
  theme,
  onToggleTheme,
  onForceSync,
  onOpenSimulate,
  onOpenDocs: _onOpenDocs,
  onOpenTour,
  currentCollaborator,
  collaborators,
  onUpdateNickname,
  lastSyncTime,
  currentRoute = '/',
  onNavigate,
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [newNick, setNewNick] = useState(currentCollaborator?.nickname || '');

  const handleSaveNick = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNick.trim()) {
      onUpdateNickname(newNick.trim());
      setIsEditingNick(false);
    }
  };

  return (
    <header id="tour-brand" className="compact-navbar">
      {/* Left: Clean Brand & Live Connection Indicator */}
      <div className="nav-left">
        <div className="sheet-logo">
          <FileSpreadsheet size={18} color="#10b981" />
          <span>{t('brandTitle')}</span>
        </div>

        {/* Status Dot */}
        <div 
          id="tour-status"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          title={`Status: ${status} (${mode === 'live' ? 'Live Sheet' : 'Disconnected'})${lastSyncTime ? ` • Last synced: ${new Date(lastSyncTime).toLocaleTimeString()}` : ''}`}
        >
          <span className={`status-dot ${status === 'syncing' ? 'syncing' : status === 'disconnected' ? 'disconnected' : ''}`} />
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {mode === 'live' ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Center: Essential Actions */}
      <div id="tour-actions" className="nav-center">
        <button
          className="btn btn-sm"
          onClick={onForceSync}
          disabled={isSyncing}
          title="Force manual synchronization check"
        >
          <RefreshCw size={13} className={isSyncing ? 'spin-icon' : ''} />
          <span>{isSyncing ? t('syncing') : t('forceSyncBtn')}</span>
        </button>

        <button 
          className="btn btn-sm"
          onClick={onOpenSimulate}
          title="Simulate someone editing a cell in Google Sheets"
        >
          <Sparkles size={13} color="#818cf8" />
          <span>{t('simulateBtn')}</span>
        </button>

        <button
          id="tour-history"
          className="btn btn-sm"
          onClick={() => onNavigate?.(currentRoute === '/history' ? '/' : '/history')}
          title="View audit and synchronization history"
          style={currentRoute === '/history' ? { borderColor: 'var(--accent-green)', color: 'var(--accent-green)' } : {}}
        >
          <History size={13} color={currentRoute === '/history' ? '#10b981' : '#38bdf8'} />
          <span>{currentRoute === '/history' ? t('spreadsheetNav') : t('historyNav')}</span>
        </button>

        {onOpenTour && (
          <button
            className="btn btn-sm"
            onClick={onOpenTour}
            title="Launch interactive tour guide"
          >
            <Compass size={13} color="#10b981" />
            <span>{t('takeTourBtn')}</span>
          </button>
        )}
      </div>

      {/* Right: Nickname, Collaborator Avatars, Language, and Theme Toggle */}
      <div id="tour-collaborators" className="nav-right">
        {/* Collaborators Avatar Stack */}
        {collaborators.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', marginRight: '4px' }}>
            {collaborators.map((c, i) => {
              const isMe = c.socketId === currentCollaborator?.socketId;
              const focusInfo = c.focusedCell ? `Row ${c.focusedCell.rowId}, Col ${c.focusedCell.col}` : 'Viewing';

              return (
                <div
                  key={c.socketId || i}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: c.color,
                    border: isMe ? '2px solid #ffffff' : '2px solid var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    marginLeft: i === 0 ? 0 : '-6px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                    zIndex: 20 - i,
                  }}
                  title={`${c.nickname} ${isMe ? `(${t('collaboratorYou')})` : ''} • ${focusInfo}`}
                >
                  <CollaboratorIcon name={c.icon} size={13} color="#fff" />
                </div>
              );
            })}
          </div>
        )}

        {/* Current User Nickname Pill */}
        {currentCollaborator && (
          <div 
            className="user-identity-pill"
            style={{ borderColor: `${currentCollaborator.color}66` }}
          >
            <div 
              className="user-avatar-badge"
              style={{ background: currentCollaborator.color }}
            >
              <CollaboratorIcon name={currentCollaborator.icon} size={12} color="#fff" />
            </div>

            {isEditingNick ? (
              <form onSubmit={handleSaveNick} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ padding: '1px 6px', fontSize: '0.78rem', height: '22px', maxWidth: '110px' }}
                  value={newNick}
                  onChange={(e) => setNewNick(e.target.value)}
                  autoFocus
                  maxLength={25}
                />
                <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '2px 5px', height: '22px' }}>
                  <Check size={11} />
                </button>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: currentCollaborator.color }}>{currentCollaborator.nickname}</span>
                <button
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: '2px' }}
                  onClick={() => {
                    setNewNick(currentCollaborator.nickname);
                    setIsEditingNick(true);
                  }}
                  title={t('changeNickname')}
                >
                  <Edit2 size={11} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Language Switcher */}
        <button
          className="btn btn-sm btn-icon"
          onClick={toggleLanguage}
          title={language === 'en' ? 'Switch to Hindi (हिंदी)' : 'Switch to English'}
          style={{ fontSize: '0.78rem', padding: '5px 8px' }}
        >
          <Languages size={13} />
          <span>{language === 'en' ? 'हिं' : 'EN'}</span>
        </button>

        {/* Theme Toggle (Dark / Light) */}
        <button
          className="btn btn-sm btn-icon"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} color="#6366f1" />}
        </button>
      </div>
    </header>
  );
};
