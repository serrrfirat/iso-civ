'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS, TurnEvent, TurnEventType } from '@/games/civ/types';

// Event type configuration for icons and colors
const EVENT_CONFIG: Record<TurnEventType, { icon: string; color: string; label: string }> = {
  move: { icon: '>', color: 'text-blue-400', label: 'Move' },
  attack: { icon: '!', color: 'text-red-400', label: 'Attack' },
  build: { icon: '+', color: 'text-yellow-400', label: 'Build' },
  research: { icon: '*', color: 'text-purple-400', label: 'Research' },
  diplomacy: { icon: '@', color: 'text-cyan-400', label: 'Diplomacy' },
  city_founded: { icon: '#', color: 'text-green-400', label: 'City Founded' },
  unit_created: { icon: '^', color: 'text-emerald-400', label: 'Unit Created' },
  building_completed: { icon: '=', color: 'text-amber-400', label: 'Building' },
  research_completed: { icon: '~', color: 'text-violet-400', label: 'Tech' },
  unit_destroyed: { icon: 'x', color: 'text-red-500', label: 'Unit Lost' },
  improvement: { icon: '%', color: 'text-lime-400', label: 'Improvement' },
  city_growth: { icon: 'o', color: 'text-teal-400', label: 'City Growth' },
  culture: { icon: '♦', color: 'text-violet-400', label: 'Culture' },
};

const ALL_EVENT_TYPES: TurnEventType[] = [
  'move',
  'attack',
  'build',
  'research',
  'diplomacy',
  'city_founded',
  'unit_created',
  'building_completed',
  'research_completed',
  'unit_destroyed',
  'improvement',
  'city_growth',
  'culture',
];

function EventCard({ event }: { event: TurnEvent }) {
  const config = EVENT_CONFIG[event.type];
  const civColor = event.civId ? CIV_COLORS[event.civId]?.primary : undefined;

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 hover:bg-gray-800/50 rounded transition-colors">
      <span
        className={`font-mono text-xs w-5 h-5 flex items-center justify-center rounded ${config.color} bg-gray-800`}
        title={config.label}
      >
        {config.icon}
      </span>
      <div className="flex-1 min-w-0">
        <span
          className="text-xs text-gray-300"
          style={civColor ? { borderLeft: `2px solid ${civColor}`, paddingLeft: '6px' } : undefined}
        >
          {event.message}
        </span>
      </div>
    </div>
  );
}

interface TurnGroupProps {
  turn: number;
  events: TurnEvent[];
  isCurrentTurn: boolean;
}

function TurnGroup({ turn, events, isCurrentTurn }: TurnGroupProps) {
  const [isExpanded, setIsExpanded] = useState(isCurrentTurn);

  useEffect(() => {
    if (isCurrentTurn) {
      setIsExpanded(true);
    }
  }, [isCurrentTurn]);

  return (
    <div className="border-b border-gray-800 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
          isCurrentTurn ? 'bg-indigo-900/30' : 'hover:bg-gray-800/50'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {isExpanded ? '\u25BC' : '\u25B6'}
          </span>
          <span className={`text-sm font-bold ${isCurrentTurn ? 'text-indigo-300' : 'text-gray-400'}`}>
            Turn {turn}
          </span>
          {isCurrentTurn && (
            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/30 text-indigo-300 rounded">
              CURRENT
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">{events.length} events</span>
      </button>
      {isExpanded && (
        <div className="pb-2">
          {events.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TurnSummaryPanel() {
  const { state } = useCivGame();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [turnFilter, setTurnFilter] = useState<number | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TurnEventType | 'all'>('all');

  // Group events by turn
  const eventsByTurn = useMemo(() => {
    const events = state.turnEvents || [];
    const grouped: Record<number, TurnEvent[]> = {};

    for (const event of events) {
      // Apply filters
      if (turnFilter !== 'all' && event.turn !== turnFilter) continue;
      if (typeFilter !== 'all' && event.type !== typeFilter) continue;

      if (!grouped[event.turn]) {
        grouped[event.turn] = [];
      }
      grouped[event.turn].push(event);
    }

    return grouped;
  }, [state.turnEvents, turnFilter, typeFilter]);

  // Get sorted turn numbers (descending - most recent first)
  const sortedTurns = useMemo(() => {
    return Object.keys(eventsByTurn)
      .map(Number)
      .sort((a, b) => b - a);
  }, [eventsByTurn]);

  // Get all unique turns for the filter dropdown
  const allTurns = useMemo(() => {
    const turns = new Set<number>();
    for (const event of state.turnEvents || []) {
      turns.add(event.turn);
    }
    return Array.from(turns).sort((a, b) => b - a);
  }, [state.turnEvents]);

  // Auto-scroll to top (most recent) on new events
  useEffect(() => {
    if (scrollRef.current && turnFilter === 'all') {
      scrollRef.current.scrollTop = 0;
    }
  }, [state.turnEvents?.length, turnFilter]);

  const totalEvents = state.turnEvents?.length ?? 0;
  const filteredEvents = Object.values(eventsByTurn).flat().length;

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="shrink-0 px-3 py-2 border-b border-gray-700 bg-gray-850 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-12">Turn:</label>
          <select
            value={turnFilter}
            onChange={(e) => setTurnFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-600"
          >
            <option value="all">All Turns</option>
            {allTurns.map((turn) => (
              <option key={turn} value={turn}>
                Turn {turn}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 w-12">Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TurnEventType | 'all')}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-600"
          >
            <option value="all">All Types</option>
            {ALL_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_CONFIG[type].label}
              </option>
            ))}
          </select>
        </div>
        {(turnFilter !== 'all' || typeFilter !== 'all') && (
          <div className="text-[10px] text-gray-500">
            Showing {filteredEvents} of {totalEvents} events
          </div>
        )}
      </div>

      {/* Event list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        {sortedTurns.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm italic px-4">
            No events recorded yet. The history awaits...
          </div>
        ) : (
          sortedTurns.map((turn) => (
            <TurnGroup
              key={turn}
              turn={turn}
              events={eventsByTurn[turn]}
              isCurrentTurn={turn === state.turn}
            />
          ))
        )}
      </div>

      {/* Legend */}
      <div className="shrink-0 px-3 py-2 border-t border-gray-700 bg-gray-850">
        <div className="text-[10px] text-gray-500 mb-1">EVENT TYPES:</div>
        <div className="flex flex-wrap gap-1">
          {ALL_EVENT_TYPES.slice(0, 6).map((type) => (
            <span
              key={type}
              className={`text-[10px] ${EVENT_CONFIG[type].color} bg-gray-800 px-1.5 py-0.5 rounded`}
            >
              {EVENT_CONFIG[type].icon} {EVENT_CONFIG[type].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
