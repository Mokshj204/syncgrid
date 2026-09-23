import React, { useState } from 'react';
import { Users, Edit2, Check, ShieldAlert } from 'lucide-react';
import { Collaborator } from '../types';
import { CollaboratorIcon } from './CollaboratorIcon';
import { useLanguage } from '../context/LanguageContext';

interface CollaboratorBarProps {
  currentCollaborator: Collaborator | null;
  collaborators: Collaborator[];
  maxCollaborators?: number;
  onUpdateNickname: (nickname: string) => void;
}

export const CollaboratorBar: React.FC<CollaboratorBarProps> = ({
  currentCollaborator,
  collaborators,
  maxCollaborators = 10,
  onUpdateNickname,
}) => {
  const { t } = useLanguage();
  const [isEditingNick, setIsEditingNick] = useState(false);
  const [newNick, setNewNick] = useState(currentCollaborator?.nickname || '');

  const handleSaveNick = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNick.trim()) {
      onUpdateNickname(newNick.trim());
      setIsEditingNick(false);
    }
  };

  const isNearCapacity = collaborators.length >= maxCollaborators - 2;

  return (
    <div 
      id="tour-collaborators" 
      className="glass-panel" 
      style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}
    >
      {/* Current User Card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {currentCollaborator && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '6px 14px', 
              borderRadius: '9999px', 
              background: 'rgba(255, 255, 255, 0.04)', 
              border: `1.5px solid ${currentCollaborator.color}`,
              boxShadow: `0 0 12px ${currentCollaborator.color}33`
            }}
          >
            <div 
              style={{ 
                width: '24px', 
                height: '24px', 
                borderRadius: '50%', 
                background: currentCollaborator.color, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#fff' 
              }}
            >
              <CollaboratorIcon name={currentCollaborator.icon} size={13} color="#fff" />
            </div>

            {isEditingNick ? (
              <form onSubmit={handleSaveNick} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ padding: '2px 8px', fontSize: '0.8rem', height: '26px', maxWidth: '140px' }}
                  value={newNick}
                  onChange={(e) => setNewNick(e.target.value)}
                  autoFocus
                  maxLength={25}
                />
                <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '2px 8px', height: '26px' }}>
                  <Check size={12} />
                </button>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {t('collaboratorYou')}: <span style={{ color: currentCollaborator.color }}>{currentCollaborator.nickname}</span>
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 6px', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                  onClick={() => {
                    setNewNick(currentCollaborator.nickname);
                    setIsEditingNick(true);
                  }}
                  title={t('changeNickname')}
                >
                  <Edit2 size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collaborators Roster & Capacity Counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        {/* Avatars Stack */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {collaborators.map((c, i) => {
            const isMe = c.socketId === currentCollaborator?.socketId;
            const focusInfo = c.focusedCell 
              ? `Row #${c.focusedCell.rowId}, Col ${c.focusedCell.col}` 
              : t('viewingSheet');

            return (
              <div
                key={c.socketId || i}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: c.color,
                  border: isMe ? '2px solid white' : '2px solid var(--bg-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  marginLeft: i === 0 ? 0 : '-8px',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  transition: 'transform 0.15s ease, z-index 0.15s ease',
                  zIndex: 10 - i,
                }}
                title={`${c.nickname} ${isMe ? `(${t('collaboratorYou')})` : ''} • ${focusInfo}`}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px) scale(1.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
              >
                <CollaboratorIcon name={c.icon} size={15} color="#fff" />
              </div>
            );
          })}
        </div>

        {/* 10-Person Capacity Gauge */}
        <div 
          className="badge" 
          style={{ 
            background: isNearCapacity ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            color: isNearCapacity ? '#fbbf24' : 'var(--text-muted)',
            border: isNearCapacity ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-color)',
            fontSize: '0.78rem'
          }}
          title={t('seatsOccupiedTooltip', { count: collaborators.length, max: maxCollaborators })}
        >
          {isNearCapacity ? <ShieldAlert size={13} color="#fbbf24" /> : <Users size={13} />}
          <span>
            {collaborators.length} / {maxCollaborators} {t('activeSeats')}
          </span>
        </div>
      </div>
    </div>
  );
};
