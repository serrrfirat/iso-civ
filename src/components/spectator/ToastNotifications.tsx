'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { GameNotification, NotificationType } from '@/games/civ/types';

const TOAST_COLORS: Record<NotificationType, { border: string; text: string; icon: string }> = {
  combat: { border: '#dc2626', text: 'text-red-200', icon: '\u2694' },
  city: { border: '#d97706', text: 'text-amber-200', icon: '\u{1F3DB}' },
  tech: { border: '#059669', text: 'text-emerald-200', icon: '\u2697' },
  diplomacy: { border: '#2563eb', text: 'text-blue-200', icon: '\u2709' },
  unit: { border: '#7c3aed', text: 'text-purple-200', icon: '\u2694' },
};

const MAX_TOASTS = 3;
const TOAST_DURATION = 5000;

interface Toast {
  id: string;
  notification: GameNotification;
  enterTime: number;
}

export function ToastNotifications() {
  const { state, panToGrid } = useCivGame();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastSeenCountRef = useRef(state.notifications.length);

  // Watch for new notifications
  useEffect(() => {
    const currentCount = state.notifications.length;
    if (currentCount > lastSeenCountRef.current) {
      const newNotifs = state.notifications.slice(lastSeenCountRef.current);
      const now = Date.now();
      const newToasts: Toast[] = newNotifs.map(n => ({
        id: n.id,
        notification: n,
        enterTime: now,
      }));
      setToasts(prev => [...prev, ...newToasts].slice(-MAX_TOASTS));
    }
    lastSeenCountRef.current = currentCount;
  }, [state.notifications]);

  // Auto-dismiss toasts
  useEffect(() => {
    if (toasts.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => now - t.enterTime < TOAST_DURATION));
    }, 500);
    return () => clearInterval(interval);
  }, [toasts.length]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleClick = useCallback((toast: Toast) => {
    if (toast.notification.location) {
      panToGrid(toast.notification.location.x, toast.notification.location.y);
    }
    dismissToast(toast.id);
  }, [panToGrid, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-auto">
      {toasts.map(toast => {
        const colors = TOAST_COLORS[toast.notification.type];
        return (
          <div
            key={toast.id}
            onClick={() => handleClick(toast)}
            className="cursor-pointer bg-slate-900/95 backdrop-blur-sm rounded-lg shadow-xl px-3 py-2 min-w-[240px] max-w-[320px] animate-slide-in-right"
            style={{
              borderLeft: `3px solid ${colors.border}`,
              border: `1px solid ${colors.border}30`,
              borderLeftWidth: '3px',
              borderLeftColor: colors.border,
            }}
          >
            <div className="flex items-start gap-2">
              <span className="text-sm mt-0.5">{colors.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-xs ${colors.text} font-medium leading-tight`}>
                  {toast.notification.message}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Turn {toast.notification.turn}
                  {toast.notification.location && ' \u2022 Click to view'}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(toast.id);
                }}
                className="text-gray-600 hover:text-gray-400 transition-colors p-0.5 shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
