'use client';

import React from 'react';
import { CIV_COLORS, TurnEventType } from '@/games/civ/types';
import type { AutoReplayState } from '@/hooks/useAutoReplay';

const EVENT_ICONS: Record<TurnEventType, string> = {
  move: '➜',
  attack: '⚔',
  build: '🔨',
  research: '🔬',
  diplomacy: '📜',
  city_founded: '🏛',
  unit_created: '🛡',
  building_completed: '🏗',
  research_completed: '💡',
  unit_destroyed: '💀',
  improvement: '🌾',
  city_growth: '📈',
  culture: '🎭',
};

interface ReplayBannerProps {
  replay: AutoReplayState;
}

export function ReplayBanner({ replay }: ReplayBannerProps) {
  if (!replay.isPlaying) return null;

  const civId = replay.currentSummary?.civId;
  const civColors = civId ? CIV_COLORS[civId] : null;
  const civName = civColors?.label ?? civId ?? 'Unknown';
  const primaryColor = civColors?.primary ?? '#888';
  const eventType = replay.currentEvent?.type;
  const icon = eventType ? EVENT_ICONS[eventType] ?? '•' : '•';
  const message = replay.currentEvent?.message ?? 'Processing...';
  const progress = replay.totalEvents > 0
    ? (replay.completedEvents / replay.totalEvents) * 100
    : 0;

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-[420px] max-w-[90%] rounded-lg overflow-hidden shadow-2xl animate-slideDown"
      style={{
        background: 'linear-gradient(180deg, rgba(10, 15, 30, 0.95) 0%, rgba(15, 20, 40, 0.92) 100%)',
        border: '1px solid rgba(100, 120, 160, 0.3)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Event info */}
      <div className="px-4 py-2.5 flex items-center gap-2.5">
        {/* Civ color dot */}
        <div
          className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/20"
          style={{ backgroundColor: primaryColor }}
        />
        {/* Civ name */}
        <span
          className="text-xs font-bold shrink-0"
          style={{ color: primaryColor }}
        >
          {civName}
        </span>
        {/* Icon */}
        <span className="text-sm shrink-0">{icon}</span>
        {/* Message */}
        <span className="text-xs text-gray-300 truncate flex-1">{message}</span>
      </div>

      {/* Progress bar + skip */}
      <div className="px-4 pb-2.5 flex items-center gap-3">
        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${primaryColor}cc, ${primaryColor})`,
            }}
          />
        </div>
        {/* Event counter */}
        <span className="text-[10px] text-gray-500 font-mono shrink-0">
          {replay.completedEvents + 1}/{replay.totalEvents}
        </span>
        {/* Skip button */}
        <button
          onClick={replay.skip}
          className="text-[10px] font-bold text-gray-400 hover:text-white px-2 py-0.5 rounded bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700/50 transition-colors shrink-0"
        >
          Skip
        </button>
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -12px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
