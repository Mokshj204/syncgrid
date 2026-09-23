import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Users, Lock } from 'lucide-react';
import { Collaborator } from '../types';
import { CollaboratorIcon } from './CollaboratorIcon';
import { useLanguage } from '../context/LanguageContext';

interface CapacityLockScreenProps {
  maxCollaborators?: number;
  collaborators?: Collaborator[];
  onRetry: () => void;
}

export const CapacityLockScreen: React.FC<CapacityLockScreenProps> = ({
  maxCollaborators = 10,
  collaborators = [],
  onRetry,
}) => {
  const { t } = useLanguage();
  const [countdown, setCountdown] = useState<number>(10);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleManualRetry();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleManualRetry = () => {
    setIsRetrying(true);
    onRetry();
    setTimeout(() => {
      setIsRetrying(false);
      setCountdown(10);
    }, 1200);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(7, 10, 16, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '560px',
          width: '100%',
          padding: '36px',
          borderRadius: '24px',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(245, 158, 11, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '20px',
        }}
      >
        {/* Warning Icon Badge */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fbbf24',
            boxShadow: '0 0 24px rgba(245, 158, 11, 0.25)',
          }}
        >
          <Lock size={30} />
        </div>

        <div>
          <div
            className="badge"
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              marginBottom: '10px',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            <ShieldAlert size={13} />
            {t('capacityLimitEnforced')}
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            {t('capacityTitle')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {t('capacityDescription')}
          </p>
        </div>

        {/* Capacity Indicator Progress Bar */}
        <div style={{ width: '100%', background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={14} /> {t('capacitySeatsOccupied')}
            </span>
            <span style={{ color: '#fbbf24', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {maxCollaborators} / {maxCollaborators} (100%)
            </span>
          </div>

          <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                borderRadius: '999px',
              }}
            />
          </div>
        </div>

        {/* Active Collaborators Preview */}
        {collaborators.length > 0 && (
          <div style={{ width: '100%', textAlign: 'left' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('currentlyActive')} ({collaborators.length}):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {collaborators.map((c) => (
                <div
                  key={c.socketId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '0.78rem',
                    border: `1px solid ${c.color}40`,
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: c.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                    }}
                  >
                    <CollaboratorIcon name={c.icon} size={10} color="#fff" />
                  </div>
                  <span style={{ color: 'var(--text-main)' }}>{c.nickname}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button & Auto-Retry Timer */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '0.95rem',
            }}
            onClick={handleManualRetry}
            disabled={isRetrying}
          >
            <RefreshCw size={16} className={isRetrying ? 'spin' : ''} />
            {isRetrying ? t('checkingSeatBtn') : t('checkSeatBtn')}
          </button>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            {t('autoRecheckIn')} <strong style={{ color: 'var(--text-muted)' }}>{countdown}s</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
