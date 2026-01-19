'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { CoasterProvider } from '@/context/CoasterContext';
import CoasterGame from '@/components/coaster/Game';
import {
  buildSavedParkMeta,
  COASTER_AUTOSAVE_KEY,
  COASTER_SAVED_PARK_PREFIX,
  deleteCoasterStateFromStorage,
  loadCoasterStateFromStorage,
  readSavedParksIndex,
  removeSavedParkMeta,
  SavedParkMeta,
  upsertSavedParkMeta,
  writeSavedParksIndex,
} from '@/games/coaster/saveUtils';

export default function CoasterPage() {
  const [showGame, setShowGame] = useState(false);
  const [startFresh, setStartFresh] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [savedParks, setSavedParks] = useState<SavedParkMeta[]>([]);
  const [loadParkId, setLoadParkId] = useState<string | null>(null);

  const refreshSavedParks = useCallback(() => {
    let parks = readSavedParksIndex();
    const autosaveState = loadCoasterStateFromStorage(COASTER_AUTOSAVE_KEY);
    if (autosaveState) {
      const autosaveMeta = buildSavedParkMeta(autosaveState);
      parks = upsertSavedParkMeta(autosaveMeta, parks);
      writeSavedParksIndex(parks);
    }
    setSavedParks(parks);
    setHasSaved(parks.length > 0);
    setIsChecking(false);
  }, []);

  // Check for saved game on mount
  useEffect(() => {
    refreshSavedParks();
  }, [refreshSavedParks]);

  // Handle exit from game - refresh saved state check
  const handleExitGame = () => {
    setShowGame(false);
    setStartFresh(false);
    setLoadParkId(null);
    refreshSavedParks();
  };

  if (showGame) {
    return (
      <CoasterProvider startFresh={startFresh} loadParkId={loadParkId}>
        <main className="h-screen w-screen overflow-hidden">
          <CoasterGame onExit={handleExitGame} />
        </main>
      </CoasterProvider>
    );
  }

  if (isChecking) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-900 to-purple-950 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </main>
    );
  }

  // Landing page
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-900 to-purple-950 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full flex flex-col items-center justify-center space-y-12">
        {/* Title */}
        <div className="text-center space-y-4">
          <h1 className="text-7xl font-light tracking-wider text-white/90">
            IsoCoaster
          </h1>
          <p className="text-xl text-white/60 font-light">
            Build the ultimate theme park
          </p>
        </div>
        
        {/* Features list */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { icon: '🎢', label: 'Custom Coasters' },
            { icon: '🎡', label: 'Flat Rides' },
            { icon: '🍿', label: 'Food & Shops' },
            { icon: '👥', label: 'Happy Guests' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <span className="text-4xl">{icon}</span>
              <span className="text-white/70 text-sm">{label}</span>
            </div>
          ))}
        </div>
        
        {/* Buttons */}
        <div className="flex flex-col gap-3">
          {/* Main button - Continue if saved, New Park if not */}
          <Button 
            onClick={() => {
              if (hasSaved && savedParks.length > 0) {
                setStartFresh(false);
                setLoadParkId(savedParks[0].id);
              } else {
                setStartFresh(true);
                setLoadParkId(null);
              }
              setShowGame(true);
            }}
            className="w-64 py-8 text-2xl font-light tracking-wide bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none transition-all duration-300"
          >
            {hasSaved ? 'Continue' : 'New Park'}
          </Button>
          
          {/* New Park button (only shown if there's a saved game) */}
          {hasSaved && (
            <Button 
              onClick={() => {
                setStartFresh(true);
                setLoadParkId(null);
                setShowGame(true);
              }}
              variant="outline"
              className="w-64 py-8 text-2xl font-light tracking-wide bg-transparent hover:bg-white/10 text-white/60 hover:text-white border border-white/20 rounded-none transition-all duration-300"
            >
              New Park
            </Button>
          )}
        </div>

        {/* Saved parks list */}
        {savedParks.length > 0 && (
          <div className="w-full max-w-3xl bg-white/5 border border-white/10 rounded-none">
            <div className="px-5 py-3 border-b border-white/10 text-xs uppercase tracking-widest text-white/60">
              Saved Parks
            </div>
            <div className="divide-y divide-white/10">
              {savedParks.map((park) => {
                const savedDate = new Date(park.savedAt);
                const dateLabel = savedDate.toLocaleString();
                return (
                  <div key={park.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-white/90 text-lg font-light truncate">{park.name}</div>
                      <div className="text-white/50 text-xs">
                        Saved {dateLabel} · Guests {park.guests.toLocaleString()} · Rating {park.rating}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => {
                          setStartFresh(false);
                          setLoadParkId(park.id);
                          setShowGame(true);
                        }}
                        className="h-9 px-4 text-sm bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-none"
                      >
                        Play
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-9 px-3 text-sm text-white/50 hover:text-white"
                        onClick={() => {
                          const autosaveState = loadCoasterStateFromStorage(COASTER_AUTOSAVE_KEY);
                          if (autosaveState?.id === park.id) {
                            deleteCoasterStateFromStorage(COASTER_AUTOSAVE_KEY);
                          }
                          deleteCoasterStateFromStorage(`${COASTER_SAVED_PARK_PREFIX}${park.id}`);
                          const updated = removeSavedParkMeta(park.id, savedParks);
                          writeSavedParksIndex(updated);
                          setSavedParks(updated);
                          setHasSaved(updated.length > 0);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Back to IsoCity link */}
        <a
          href="/"
          className="text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          ← Back to IsoCity
        </a>
      </div>
    </main>
  );
}
