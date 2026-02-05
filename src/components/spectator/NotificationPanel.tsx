'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { GameNotification, NotificationType } from '@/games/civ/types';

const NOTIFICATION_COLORS: Record<NotificationType, { bg: string; border: string; text: string }> = {
  combat: { bg: 'bg-red-900/80', border: 'border-red-600', text: 'text-red-200' },
  city: { bg: 'bg-amber-900/80', border: 'border-amber-600', text: 'text-amber-200' },
  tech: { bg: 'bg-emerald-900/80', border: 'border-emerald-600', text: 'text-emerald-200' },
  diplomacy: { bg: 'bg-blue-900/80', border: 'border-blue-600', text: 'text-blue-200' },
  unit: { bg: 'bg-purple-900/80', border: 'border-purple-600', text: 'text-purple-200' },
};

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  combat: '\u2694', // crossed swords
  city: '\u{1F3DB}', // classical building
  tech: '\u2697', // flask
  diplomacy: '\u2709', // envelope
  unit: '\u2694', // crossed swords (for unit events)
};

const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  combat: 'Combat',
  city: 'City',
  tech: 'Tech',
  diplomacy: 'Diplomacy',
  unit: 'Unit',
};

interface NotificationItemProps {
  notification: GameNotification;
  onClick: (notification: GameNotification) => void;
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const colors = NOTIFICATION_COLORS[notification.type];
  const icon = NOTIFICATION_ICONS[notification.type];

  return (
    <div
      className={`${colors.bg} ${colors.border} border rounded px-2 py-1.5 cursor-pointer transition-all hover:brightness-110 hover:scale-[1.01]`}
      onClick={() => onClick(notification)}
    >
      <div className="flex items-start gap-2">
        <span className="text-sm">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-xs ${colors.text} font-medium leading-tight`}>
            {notification.message}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            Turn {notification.turn}
            {notification.location && (
              <span className="ml-1 text-gray-500">
                ({notification.location.x}, {notification.location.y})
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationPanel() {
  const { state, panToGrid } = useCivGame();
  const [activeFilters, setActiveFilters] = useState<Set<NotificationType>>(
    new Set(['combat', 'city', 'tech', 'diplomacy', 'unit'])
  );
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleFilter = useCallback((type: NotificationType) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleNotificationClick = useCallback((notification: GameNotification) => {
    if (notification.location) {
      panToGrid(notification.location.x, notification.location.y);
    }
  }, [panToGrid]);

  // Get filtered notifications (last 10)
  const filteredNotifications = useMemo(() => {
    return state.notifications
      .filter(n => activeFilters.has(n.type))
      .slice(-10)
      .reverse(); // Most recent first
  }, [state.notifications, activeFilters]);

  const allTypes: NotificationType[] = ['combat', 'city', 'tech', 'diplomacy', 'unit'];

  return (
    <div className="absolute bottom-4 left-4 z-30 pointer-events-auto">
      <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl w-72 max-h-80 flex flex-col">
        {/* Header with collapse toggle */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-gray-700 cursor-pointer hover:bg-gray-800/50"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span className="text-xs font-bold text-gray-300 tracking-wider">NOTIFICATIONS</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">
              {filteredNotifications.length} events
            </span>
            <span className="text-gray-400 text-sm">
              {isCollapsed ? '\u25B6' : '\u25BC'}
            </span>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {/* Filter tabs */}
            <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-gray-700/50">
              {allTypes.map(type => {
                const isActive = activeFilters.has(type);
                const colors = NOTIFICATION_COLORS[type];
                return (
                  <button
                    key={type}
                    onClick={() => toggleFilter(type)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                      isActive
                        ? `${colors.bg} ${colors.text} border ${colors.border}`
                        : 'bg-gray-800/50 text-gray-500 border border-gray-700 hover:text-gray-400'
                    }`}
                  >
                    {NOTIFICATION_LABELS[type]}
                  </button>
                );
              })}
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-48">
              {filteredNotifications.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-4">
                  No notifications
                </div>
              ) : (
                filteredNotifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={handleNotificationClick}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
