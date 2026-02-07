'use client';

import React from 'react';
import { useActionReplay } from '@/hooks/useActionReplay';
import { CIV_COLORS } from '@/games/civ/types';

const EVENT_ICONS: Record<string, string> = {
  move: '\u2192',
  attack: '\u2694',
  build: '\uD83D\uDD28',
  research: '\uD83D\uDD2C',
  diplomacy: '\uD83D\uDCDC',
  city_founded: '\uD83C\uDFDB',
  unit_created: '\u2692',
  building_completed: '\uD83C\uDFD7',
  research_completed: '\uD83D\uDCA1',
  unit_destroyed: '\uD83D\uDC80',
  improvement: '\uD83C\uDF3E',
  city_growth: '\uD83D\uDCC8',
  culture: '\uD83C\uDFAD',
};

export function ActionReplayPanel() {
  const {
    replayState,
    currentCivIndex,
    currentEventIndex,
    currentSummary,
    summaries,
    play,
    pause,
    stepForward,
    stepBack,
    skipToNextCiv,
    skipToPrevCiv,
    reset,
    jumpToCiv,
  } = useActionReplay();

  if (summaries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-4">
        No action replay data available. Advance a turn to see the replay.
      </div>
    );
  }

  const events = currentSummary?.resolvedEvents ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Civ tabs */}
      <div className="flex border-b border-gray-700 shrink-0">
        {summaries.map((summary, i) => {
          const colors = CIV_COLORS[summary.civId];
          const isActive = i === currentCivIndex;
          return (
            <button
              key={summary.civId}
              onClick={() => jumpToCiv(i)}
              className={`flex-1 px-3 py-2 text-xs font-bold tracking-wider transition-colors ${
                isActive
                  ? 'text-white bg-gray-800'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/40'
              }`}
              style={isActive ? { borderBottom: `2px solid ${colors?.primary || '#888'}` } : undefined}
            >
              {colors?.label || summary.civId}
            </button>
          );
        })}
      </div>

      {/* Diplomacy messages for current civ */}
      {currentSummary && currentSummary.diplomacyMessages.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-700/50 bg-gray-800/30">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Diplomacy</div>
          {currentSummary.diplomacyMessages.map((msg) => (
            <div key={msg.id} className="text-xs text-gray-400 mb-1">
              <span className="text-blue-400">[{msg.type}]</span> to {msg.to === 'all' ? 'all' : (CIV_COLORS[msg.to]?.label || msg.to)}: {msg.content}
            </div>
          ))}
        </div>
      )}

      {/* Event list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {events.length === 0 ? (
          <div className="text-gray-500 text-xs p-4 text-center">No actions this turn</div>
        ) : (
          events.map((event, i) => {
            const isHighlighted = i === currentEventIndex && replayState !== 'idle';
            const icon = EVENT_ICONS[event.type] || '\u2022';
            return (
              <div
                key={event.id}
                className={`px-3 py-2 border-b border-gray-800/50 text-xs transition-colors cursor-pointer hover:bg-gray-800/40 ${
                  isHighlighted ? 'bg-gray-700/60 ring-1 ring-inset ring-amber-500/40' : ''
                }`}
              >
                <span className="mr-2">{icon}</span>
                <span className={isHighlighted ? 'text-amber-200' : 'text-gray-300'}>
                  {event.message}
                </span>
                {event.location && (
                  <span className="text-gray-600 ml-1">
                    ({event.location.x},{event.location.y})
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Playback controls */}
      <div className="flex items-center justify-center gap-2 px-3 py-2 border-t border-gray-700 bg-gray-800/50 shrink-0">
        <button
          onClick={skipToPrevCiv}
          disabled={currentCivIndex === 0}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300"
          title="Previous Civ"
        >
          {'\u23EE'}
        </button>
        <button
          onClick={stepBack}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
          title="Step Back"
        >
          {'\u25C0'}
        </button>
        {replayState === 'playing' ? (
          <button
            onClick={pause}
            className="px-3 py-1 text-xs rounded bg-amber-700 hover:bg-amber-600 text-white font-bold"
            title="Pause"
          >
            {'\u23F8'}
          </button>
        ) : (
          <button
            onClick={play}
            className="px-3 py-1 text-xs rounded bg-amber-700 hover:bg-amber-600 text-white font-bold"
            title="Play"
          >
            {'\u25B6'}
          </button>
        )}
        <button
          onClick={stepForward}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
          title="Step Forward"
        >
          {'\u25B6'}
        </button>
        <button
          onClick={skipToNextCiv}
          disabled={currentCivIndex >= summaries.length - 1}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300"
          title="Next Civ"
        >
          {'\u23ED'}
        </button>
        <button
          onClick={reset}
          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 ml-2"
          title="Reset"
        >
          {'\u23F9'}
        </button>
      </div>
    </div>
  );
}
