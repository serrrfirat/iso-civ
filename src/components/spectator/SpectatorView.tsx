'use client';

import React, { useState } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CivCanvas } from '@/components/civ/CivCanvas';
import { DiplomacyFeed } from './DiplomacyFeed';
import { TechTreePanel } from './TechTreePanel';
import { NarratorOverlay } from './NarratorOverlay';
import { TopBar } from './TopBar';
import { CityListPanel } from './CityListPanel';
import { UnitListPanel } from './UnitListPanel';
import { NotificationPanel } from './NotificationPanel';
import { TurnSummaryPanel } from './TurnSummaryPanel';
import { EventAnnouncement } from './EventAnnouncement';
import { CivTracker } from './CivTracker';
import { WorldTracker } from './WorldTracker';
import { BottomBar } from './BottomBar';
import { useEventAnnouncements } from '@/hooks/useEventAnnouncements';

type SidebarTab = 'diplomacy' | 'techtree' | 'cities' | 'units' | 'events';

// Helper function to get visual event CSS classes
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

export function SpectatorView() {
  const { isAdvancing, announcement, clearAnnouncement, activeVisualEvent } = useCivGame();
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('diplomacy');

  // Initialize event announcements system (watches for game events and triggers overlays)
  useEventAnnouncements();

  // Get CSS classes for current visual event
  const visualEventClass = getVisualEventClasses(activeVisualEvent);

  return (
    <div className={`flex flex-col h-full w-full relative ${visualEventClass}`}>
      {/* Visual event overlay effects */}
      {activeVisualEvent && (
        <div
          className="absolute inset-0 pointer-events-none z-50 transition-opacity duration-300"
          style={{
            opacity: activeVisualEvent ? 1 : 0,
          }}
        >
          {/* Golden age - gold border flash */}
          {activeVisualEvent === 'golden_age' && (
            <div
              className="absolute inset-0 animate-pulse"
              style={{
                boxShadow: 'inset 0 0 60px 20px rgba(255, 215, 0, 0.4), inset 0 0 120px 40px rgba(255, 215, 0, 0.2)',
                border: '4px solid rgba(255, 215, 0, 0.6)',
              }}
            />
          )}

          {/* Combat - red pulse */}
          {activeVisualEvent === 'combat' && (
            <div
              className="absolute inset-0"
              style={{
                animation: 'combatPulse 0.3s ease-out',
                boxShadow: 'inset 0 0 80px 30px rgba(220, 38, 38, 0.3)',
              }}
            />
          )}

          {/* Destruction - intense red flash */}
          {activeVisualEvent === 'destruction' && (
            <div
              className="absolute inset-0"
              style={{
                animation: 'destructionFlash 0.5s ease-out',
                background: 'radial-gradient(ellipse at center, rgba(220, 38, 38, 0.3) 0%, transparent 70%)',
              }}
            />
          )}

          {/* Tense - vignette effect */}
          {activeVisualEvent === 'tense' && (
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.5) 100%)',
                animation: 'tenseVignette 2s ease-in-out infinite',
              }}
            />
          )}

          {/* City founded / Tech complete - sparkle border */}
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

      {/* Top bar - Civ 6 style */}
      <TopBar />

      {/* Main content: map + sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Map area (60%) */}
        <div className="relative flex-[3] min-w-0">
          <CivCanvas />
          <WorldTracker />
          <NotificationPanel />
          <NarratorOverlay />
          <CivTracker />
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

        {/* Right sidebar (40%) */}
        <div className="flex-[2] min-w-[320px] max-w-[480px] border-l border-gray-700 bg-gray-900 flex flex-col">
          {/* Sidebar tab switcher */}
          <div className="flex border-b border-gray-700 shrink-0">
            <button
              onClick={() => setSidebarTab('diplomacy')}
              className={`flex-1 px-4 py-2 text-sm font-bold tracking-wider transition-colors ${
                sidebarTab === 'diplomacy'
                  ? 'text-gray-200 bg-gray-800 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/40'
              }`}
            >
              DIPLOMACY
            </button>
            <button
              onClick={() => setSidebarTab('techtree')}
              className={`flex-1 px-4 py-2 text-sm font-bold tracking-wider transition-colors ${
                sidebarTab === 'techtree'
                  ? 'text-gray-200 bg-gray-800 border-b-2 border-emerald-500'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/40'
              }`}
            >
              TECH TREE
            </button>
            <button
              onClick={() => setSidebarTab('cities')}
              className={`flex-1 px-4 py-2 text-sm font-bold tracking-wider transition-colors ${
                sidebarTab === 'cities'
                  ? 'text-gray-200 bg-gray-800 border-b-2 border-amber-500'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/40'
              }`}
            >
              CITIES
            </button>
            <button
              onClick={() => setSidebarTab('units')}
              className={`flex-1 px-4 py-2 text-sm font-bold tracking-wider transition-colors ${
                sidebarTab === 'units'
                  ? 'text-gray-200 bg-gray-800 border-b-2 border-red-500'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/40'
              }`}
            >
              UNITS
            </button>
            <button
              onClick={() => setSidebarTab('events')}
              className={`flex-1 px-4 py-2 text-sm font-bold tracking-wider transition-colors ${
                sidebarTab === 'events'
                  ? 'text-gray-200 bg-gray-800 border-b-2 border-purple-500'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800/40'
              }`}
            >
              EVENTS
            </button>
          </div>

          {/* Sidebar content */}
          {sidebarTab === 'diplomacy' && <DiplomacyFeed />}
          {sidebarTab === 'techtree' && <TechTreePanel />}
          {sidebarTab === 'cities' && <CityListPanel />}
          {sidebarTab === 'units' && <UnitListPanel />}
          {sidebarTab === 'events' && <TurnSummaryPanel />}
        </div>
      </div>

      {/* Bottom Bar - Civ 6 style with minimap, controls, and city detail */}
      <BottomBar />

      {/* Event announcement overlay */}
      {announcement && (
        <EventAnnouncement event={announcement} onDismiss={clearAnnouncement} />
      )}

      {/* CSS for visual event animations */}
      <style jsx>{`
        @keyframes combatPulse {
          0% {
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes destructionFlash {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          20% {
            opacity: 1;
            transform: scale(1.1);
          }
          100% {
            opacity: 0;
            transform: scale(1);
          }
        }

        @keyframes tenseVignette {
          0%, 100% {
            opacity: 0.7;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes sparkleBorder {
          0% {
            opacity: 0;
            filter: brightness(1);
          }
          50% {
            opacity: 1;
            filter: brightness(1.5);
          }
          100% {
            opacity: 0.6;
            filter: brightness(1);
          }
        }
      `}</style>
    </div>
  );
}
