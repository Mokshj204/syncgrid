import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Compass, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  X, 
  Sparkles, 
  Activity, 
  Users, 
  Table, 
  ShieldCheck, 
  SlidersHorizontal 
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface TourStep {
  target: string;
  titleKey: any;
  descKey: any;
  icon: React.ReactNode;
}

interface TourGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '#tour-brand',
    titleKey: 'tourStep1Title',
    descKey: 'tourStep1Desc',
    icon: <Sparkles size={18} color="#10b981" />,
  },
  {
    target: '#tour-status',
    titleKey: 'tourStep2Title',
    descKey: 'tourStep2Desc',
    icon: <ShieldCheck size={18} color="#06b6d4" />,
  },
  {
    target: '#tour-actions',
    titleKey: 'tourStep3Title',
    descKey: 'tourStep3Desc',
    icon: <SlidersHorizontal size={18} color="#f59e0b" />,
  },
  {
    target: '#tour-collaborators',
    titleKey: 'tourStep4Title',
    descKey: 'tourStep4Desc',
    icon: <Users size={18} color="#8b5cf6" />,
  },
  {
    target: '#tour-table',
    titleKey: 'tourStep6Title',
    descKey: 'tourStep6Desc',
    icon: <Table size={18} color="#10b981" />,
  },
  {
    target: '',
    titleKey: 'tourStep7Title',
    descKey: 'tourStep7Desc',
    icon: <Activity size={18} color="#ec4899" />,
  },
];

export const TourGuide: React.FC<TourGuideProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!isOpen) return;
    const step = TOUR_STEPS[currentStep];
    const el = step?.target ? document.querySelector(step.target) : null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const bounds = el.getBoundingClientRect();
      setRect(bounds);
    } else {
      setRect(null);
    }
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const timer = setTimeout(updatePosition, 300);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, currentStep, updatePosition]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleComplete = () => {
    localStorage.setItem('syncgrid_tour_completed', 'true');
    setCurrentStep(0);
    onClose();
  };

  // Tooltip dynamic positioning calculation: strictly clamped within viewport
  let tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10002,
    maxWidth: '420px',
    width: '90vw',
  };

  if (rect) {
    const cardEstimatedHeight = 260;
    const cardEstimatedWidth = 420;

    // Check if element is a huge container (like #tour-table) that takes up most of the screen
    const isLargeContainer = rect.height > window.innerHeight * 0.45;

    if (isLargeContainer) {
      // For large elements like the whole table, center it cleanly in the upper-middle of viewport
      tooltipStyle.top = `${Math.max(70, Math.min(window.innerHeight - cardEstimatedHeight - 20, 110))}px`;
      tooltipStyle.left = '50%';
      tooltipStyle.transform = 'translateX(-50%)';
    } else {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let topPos: number;
      if (spaceBelow >= cardEstimatedHeight || spaceBelow >= spaceAbove) {
        // Position below target element
        topPos = rect.bottom + 14;
      } else {
        // Position above target element
        topPos = rect.top - cardEstimatedHeight - 14;
      }

      // Clamp strictly within viewport so the tooltip is ALWAYS 100% visible
      topPos = Math.max(20, Math.min(window.innerHeight - cardEstimatedHeight - 20, topPos));
      const leftPos = Math.max(20, Math.min(window.innerWidth - cardEstimatedWidth - 20, rect.left + rect.width / 2 - cardEstimatedWidth / 2));

      tooltipStyle.top = `${topPos}px`;
      tooltipStyle.left = `${leftPos}px`;
    }
  } else {
    // Center of screen fallback
    tooltipStyle.top = '50%';
    tooltipStyle.left = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  }

  return (
    <>
      {/* Target Element Spotlight Cutout Ring */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            top: `${rect.top - 6}px`,
            left: `${rect.left - 6}px`,
            width: `${rect.width + 12}px`,
            height: `${rect.height + 12}px`,
            borderRadius: '14px',
            border: '2px solid #10b981',
            boxShadow: '0 0 0 9999px rgba(6, 9, 15, 0.78), 0 0 30px rgba(16, 185, 129, 0.65)',
            zIndex: 10001,
            pointerEvents: 'none',
            transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        />
      )}

      {/* Dimmed backdrop when no specific rect is found */}
      {!rect && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 9, 15, 0.78)',
            backdropFilter: 'blur(4px)',
            zIndex: 10001,
          }}
          onClick={handleComplete}
        />
      )}

      {/* Floating Guided Tour Card */}
      <div
        ref={tooltipRef}
        className="glass-panel"
        style={{
          ...tooltipStyle,
          padding: '22px 24px',
          borderRadius: '18px',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.25)',
          animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header: Step counter & close button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className="badge"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <Compass size={12} />
              {t('tourStep')} {currentStep + 1} {t('tourOf')} {TOUR_STEPS.length}
            </span>
          </div>

          <button
            onClick={handleComplete}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
            title={t('tourSkip')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Step Title & Icon */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
          <div
            style={{
              padding: '6px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '2px',
            }}
          >
            {step.icon}
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', margin: 0, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
            {t(step.titleKey)}
          </h3>
        </div>

        {/* Step Description */}
        <p style={{ color: '#e2e8f0', fontSize: '0.84rem', lineHeight: 1.6, margin: '8px 0 18px', whiteSpace: 'pre-line' }}>
          {t(step.descKey)}
        </p>

        {/* Progress Bar Indicators */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '18px' }}>
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '999px',
                background: i === currentStep ? '#10b981' : i < currentStep ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.15)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onClick={() => setCurrentStep(i)}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={handleComplete}
            style={{ 
              fontSize: '0.8rem', 
              padding: '6px 14px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {t('tourSkip')}
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                style={{ 
                  fontSize: '0.82rem', 
                  padding: '6px 12px', 
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px' 
                }}
              >
                <ChevronLeft size={14} />
                {t('tourPrev')}
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              style={{ 
                fontSize: '0.82rem', 
                padding: '6px 16px', 
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex', 
                alignItems: 'center', 
                gap: '5px',
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
              }}
            >
              <span>{isLast ? t('tourFinish') : t('tourNext')}</span>
              {isLast ? <Check size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
