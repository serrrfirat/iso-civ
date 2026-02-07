'use client';

import React, { useEffect, useRef } from 'react';

interface OverlayPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  width?: number;
  children: React.ReactNode;
}

export function OverlayPanel({
  isOpen,
  onClose,
  title,
  icon,
  accentColor,
  width = 420,
  children,
}: OverlayPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(0, 0, 0, 0.3)', bottom: '80px' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 z-50 flex flex-col transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: `${width}px`,
          bottom: '80px',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.95) 100%)',
          borderLeft: `2px solid ${accentColor}40`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{
            borderBottom: `1px solid ${accentColor}30`,
            background: `linear-gradient(90deg, ${accentColor}15 0%, transparent 100%)`,
          }}
        >
          <div className="flex items-center gap-2.5">
            <span style={{ color: accentColor }}>{icon}</span>
            <span
              className="text-sm font-bold tracking-wider uppercase"
              style={{ color: accentColor }}
            >
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded hover:bg-white/5"
            aria-label={`Close ${title} panel`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}
