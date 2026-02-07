'use client';

import React, { useState, useCallback } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CIV_COLORS, City } from '@/games/civ/types';
import { ruleset } from '@/lib/civ/ruleset';
import { CivCanvas } from '@/components/civ/CivCanvas';
import { DiplomacyFeed } from './DiplomacyFeed';
import { TechTreePanel } from './TechTreePanel';
import { NarratorOverlay } from './NarratorOverlay';
import { CityListPanel } from './CityListPanel';
import { UnitListPanel } from './UnitListPanel';
import { TurnSummaryPanel } from './TurnSummaryPanel';
import { ActionReplayPanel } from './ActionReplayPanel';
import { EventAnnouncement } from './EventAnnouncement';
import { WorldTracker } from './WorldTracker';
import { CulturePanel } from './CulturePanel';
import { BottomHUD, OverlayId } from './BottomHUD';
import { OverlayPanel } from './OverlayPanel';
import { ToastNotifications } from './ToastNotifications';
import {
  DiplomacyIcon,
  TechIcon,
  CitiesIcon,
  UnitsIcon,
  EventsIcon,
  CultureHudIcon,
  WorldTrackerIcon,
} from './HudIcons';
import { useEventAnnouncements } from '@/hooks/useEventAnnouncements';
import { useAutoReplay } from '@/hooks/useAutoReplay';
import { ReplayBanner } from './ReplayBanner';

// ---- City Detail floating panel (extracted from BottomBar) ----

interface CityDetailFloatingProps {
  city: City;
  onClose: () => void;
}

function CityDetailFloating({ city, onClose }: CityDetailFloatingProps) {
  const civColors = CIV_COLORS[city.ownerId];
  const primaryColor = civColors?.primary ?? '#888888';

  const getProductionTargetName = (type: 'unit' | 'building', target: string): string => {
    if (type === 'unit') {
      const u = ruleset.getUnit(target);
      return u?.name ?? target;
    }
    const b = ruleset.getBuilding(target);
    return b?.name ?? target;
  };

  const productionPct = city.currentProduction
    ? Math.min((city.currentProduction.progress / city.currentProduction.cost) * 100, 100)
    : 0;

  return (
    <div
      className="absolute left-4 bottom-4 z-30 w-[280px] rounded-lg overflow-hidden shadow-xl"
      style={{
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid rgba(71, 85, 105, 0.5)',
      }}
    >
      {/* City Header */}
      <div
        className="px-3 py-2 border-b border-amber-700/30 flex items-center justify-between"
        style={{ borderTopColor: primaryColor, borderTopWidth: '3px' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          />
          <h3 className="text-sm font-bold text-amber-100 truncate">{city.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-amber-300 transition-colors p-0.5 rounded hover:bg-amber-900/30 flex-shrink-0"
          aria-label="Close city panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="p-3">
        {/* Population & Defense */}
        <div className="flex gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-blue-900/60 flex items-center justify-center">
              <span className="text-[10px] text-blue-300">P</span>
            </div>
            <span className="text-sm font-bold text-white">{city.population}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-slate-700/60 flex items-center justify-center">
              <span className="text-[10px] text-gray-300">D</span>
            </div>
            <span className="text-sm font-bold text-white">{city.defense}</span>
          </div>
        </div>

        {/* Yields Grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="flex items-center gap-1 bg-yellow-900/20 px-2 py-1 rounded border border-yellow-700/30">
            <span className="text-yellow-400 text-[10px] font-bold">G</span>
            <span className="text-xs text-yellow-200">+{city.goldPerTurn}</span>
          </div>
          <div className="flex items-center gap-1 bg-green-900/20 px-2 py-1 rounded border border-green-700/30">
            <span className="text-green-400 text-[10px] font-bold">F</span>
            <span className="text-xs text-green-200">+{city.foodPerTurn}</span>
          </div>
          <div className="flex items-center gap-1 bg-orange-900/20 px-2 py-1 rounded border border-orange-700/30">
            <span className="text-orange-400 text-[10px] font-bold">P</span>
            <span className="text-xs text-orange-200">+{city.productionPerTurn}</span>
          </div>
          <div className="flex items-center gap-1 bg-blue-900/20 px-2 py-1 rounded border border-blue-700/30">
            <span className="text-blue-400 text-[10px] font-bold">S</span>
            <span className="text-xs text-blue-200">+{city.sciencePerTurn}</span>
          </div>
          <div className="flex items-center gap-1 bg-purple-900/20 px-2 py-1 rounded border border-purple-700/30">
            <span className="text-purple-400 text-[10px] font-bold">C</span>
            <span className="text-xs text-purple-200">+{city.culturePerTurn}</span>
          </div>
        </div>

        {/* Production */}
        <div className="border-t border-amber-800/30 pt-2">
          <div className="text-[10px] uppercase tracking-wider text-amber-600/80 font-bold mb-1.5">
            Production
          </div>
          {city.currentProduction ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-orange-300 font-semibold">
                  {getProductionTargetName(city.currentProduction.type, city.currentProduction.target)}
                </span>
                <span className="text-[10px] text-gray-500">
                  {city.currentProduction.progress}/{city.currentProduction.cost}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-amber-700/30">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-300"
                  style={{ width: `${productionPct}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-600 italic">No production</div>
          )}
        </div>

        {/* Buildings count */}
        {city.buildings.length > 0 && (
          <div className="mt-2 pt-2 border-t border-amber-800/30">
            <div className="text-[10px] text-gray-500">
              {city.buildings.length} building{city.buildings.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Visual event overlay helper ----

function getVisualEventClasses(eventType: string | null): string {
  switch (eventType) {
    case 'golden_age':
      return 'visual-event-golden-age';
    case 'combat':
      return 'visual-event-combat';
    case 'destruction':
      return 'visual-event-destruction';
    case 'tense':
      return 'visual-event-tense';
    case 'city_founded':
    case 'tech_complete':
      return 'visual-event-sparkle';
    default:
      return '';
  }
}

// ---- Overlay panel configuration ----

const OVERLAY_PANELS: Array<{
  id: OverlayId;
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  width: number;
}> = [
  { id: 'diplomacy', title: 'Diplomacy', icon: <DiplomacyIcon className="w-5 h-5" />, accentColor: '#3b82f6', width: 420 },
  { id: 'techtree', title: 'Tech Tree', icon: <TechIcon className="w-5 h-5" />, accentColor: '#10b981', width: 560 },
  { id: 'cities', title: 'Cities', icon: <CitiesIcon className="w-5 h-5" />, accentColor: '#f59e0b', width: 440 },
  { id: 'units', title: 'Units', icon: <UnitsIcon className="w-5 h-5" />, accentColor: '#ef4444', width: 420 },
  { id: 'events', title: 'Events', icon: <EventsIcon className="w-5 h-5" />, accentColor: '#a855f7', width: 440 },
  { id: 'culture', title: 'Culture', icon: <CultureHudIcon className="w-5 h-5" />, accentColor: '#8b5cf6', width: 440 },
  { id: 'worldtracker', title: 'World Tracker', icon: <WorldTrackerIcon className="w-5 h-5" />, accentColor: '#14b8a6', width: 300 },
];

// ---- Main component ----

export function SpectatorView() {
  const {
    isAdvancing,
    announcement,
    clearAnnouncement,
    activeVisualEvent,
    selectedCityId,
    setSelectedCityId,
    state,
  } = useCivGame();

  const [activeOverlay, setActiveOverlay] = useState<OverlayId | null>(null);
  const [eventsMode, setEventsMode] = useState<'log' | 'replay'>('log');

  // Initialize event announcements system
  useEventAnnouncements();

  // Auto-replay system
  const autoReplayState = useAutoReplay();

  const toggleOverlay = useCallback((id: OverlayId) => {
    setActiveOverlay(prev => (prev === id ? null : id));
  }, []);

  const closeOverlay = useCallback(() => {
    setActiveOverlay(null);
  }, []);

  const selectedCity = selectedCityId ? state.cities[selectedCityId] : null;
  const visualEventClass = getVisualEventClasses(activeVisualEvent);

  // Render overlay content based on ID
  const renderOverlayContent = (id: OverlayId) => {
    switch (id) {
      case 'diplomacy':
        return <DiplomacyFeed />;
      case 'techtree':
        return <TechTreePanel />;
      case 'cities':
        return <CityListPanel />;
      case 'units':
        return <UnitListPanel />;
      case 'events':
        return (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex border-b border-gray-700/50 shrink-0">
              <button
                onClick={() => setEventsMode('log')}
                className={`flex-1 px-3 py-1.5 text-[10px] font-bold tracking-wider ${
                  eventsMode === 'log' ? 'text-purple-300 border-b border-purple-500 bg-gray-800/50' : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                EVENT LOG
              </button>
              <button
                onClick={() => setEventsMode('replay')}
                className={`flex-1 px-3 py-1.5 text-[10px] font-bold tracking-wider ${
                  eventsMode === 'replay' ? 'text-purple-300 border-b border-purple-500 bg-gray-800/50' : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                ACTION REPLAY
              </button>
            </div>
            {eventsMode === 'log' ? <TurnSummaryPanel /> : <ActionReplayPanel />}
          </div>
        );
      case 'culture':
        return <CulturePanel />;
      case 'worldtracker':
        return <WorldTracker />;
      default:
        return null;
    }
  };

  return (
    <div className={`flex flex-col h-full w-full relative ${visualEventClass}`}>
      {/* Visual event overlay effects */}
      {activeVisualEvent && (
        <div
          className="absolute inset-0 pointer-events-none z-50 transition-opacity duration-300"
          style={{ opacity: activeVisualEvent ? 1 : 0 }}
        >
          {activeVisualEvent === 'golden_age' && (
            <div
              className="absolute inset-0 animate-pulse"
              style={{
                boxShadow: 'inset 0 0 60px 20px rgba(255, 215, 0, 0.4), inset 0 0 120px 40px rgba(255, 215, 0, 0.2)',
                border: '4px solid rgba(255, 215, 0, 0.6)',
              }}
            />
          )}
          {activeVisualEvent === 'combat' && (
            <div
              className="absolute inset-0"
              style={{
                animation: 'combatPulse 0.3s ease-out',
                boxShadow: 'inset 0 0 80px 30px rgba(220, 38, 38, 0.3)',
              }}
            />
          )}
          {activeVisualEvent === 'destruction' && (
            <div
              className="absolute inset-0"
              style={{
                animation: 'destructionFlash 0.5s ease-out',
                background: 'radial-gradient(ellipse at center, rgba(220, 38, 38, 0.3) 0%, transparent 70%)',
              }}
            />
          )}
          {activeVisualEvent === 'tense' && (
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.5) 100%)',
                animation: 'tenseVignette 2s ease-in-out infinite',
              }}
            />
          )}
          {(activeVisualEvent === 'city_founded' || activeVisualEvent === 'tech_complete') && (
            <div
              className="absolute inset-0"
              style={{
                boxShadow: 'inset 0 0 40px 10px rgba(135, 206, 250, 0.3), inset 0 0 80px 20px rgba(135, 206, 250, 0.15)',
                animation: 'sparkleBorder 0.5s ease-out',
              }}
            />
          )}
        </div>
      )}

      {/* Map area - fills all available space */}
      <div className="relative flex-1 min-h-0">
        <CivCanvas />
        <NarratorOverlay />
        <ReplayBanner replay={autoReplayState} />

        {/* Floating city detail panel */}
        {selectedCity && (
          <CityDetailFloating
            city={selectedCity}
            onClose={() => setSelectedCityId(null)}
          />
        )}

        {/* Processing overlay */}
        {isAdvancing && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="bg-gray-950/80 backdrop-blur-sm border border-amber-700/50 rounded-lg px-6 py-4 flex items-center gap-3 shadow-2xl">
              <span className="inline-block w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
              <span className="text-sm text-amber-100 font-medium">Civilizations are deciding their next moves...</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom HUD */}
      <BottomHUD activeOverlay={activeOverlay} onToggleOverlay={toggleOverlay} />

      {/* Overlay panels */}
      {OVERLAY_PANELS.map(panel => (
        <OverlayPanel
          key={panel.id}
          isOpen={activeOverlay === panel.id}
          onClose={closeOverlay}
          title={panel.title}
          icon={panel.icon}
          accentColor={panel.accentColor}
          width={panel.width}
        >
          {renderOverlayContent(panel.id)}
        </OverlayPanel>
      ))}

      {/* Toast notifications */}
      <ToastNotifications />

      {/* Event announcement overlay */}
      {announcement && (
        <EventAnnouncement event={announcement} onDismiss={clearAnnouncement} />
      )}

      {/* CSS for visual event animations */}
      <style jsx>{`
        @keyframes combatPulse {
          0% { opacity: 0; }
          30% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes destructionFlash {
          0% { opacity: 0; transform: scale(0.8); }
          20% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1); }
        }
        @keyframes tenseVignette {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes sparkleBorder {
          0% { opacity: 0; filter: brightness(1); }
          50% { opacity: 1; filter: brightness(1.5); }
          100% { opacity: 0.6; filter: brightness(1); }
        }
      `}</style>
    </div>
  );
}
