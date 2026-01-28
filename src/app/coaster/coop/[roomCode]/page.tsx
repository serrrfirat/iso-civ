'use client';

import React, { useState, useRef } from 'react';
import { CoasterProvider } from '@/context/CoasterContext';
import { MultiplayerContextProvider } from '@/context/MultiplayerContext';
import CoasterGame from '@/components/coaster/Game';
import { CoasterCoopModal } from '@/components/coaster/multiplayer/CoasterCoopModal';
import { GameState as CoasterGameState } from '@/games/coaster/types';
import {
  COASTER_AUTOSAVE_KEY,
  buildSavedParkMeta,
  readSavedParksIndex,
  saveCoasterStateToStorage,
  upsertSavedParkMeta,
  writeSavedParksIndex,
} from '@/games/coaster/saveUtils';
import { useParams, useRouter } from 'next/navigation';

function saveParkToIndex(state: CoasterGameState, roomCode?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const meta = buildSavedParkMeta(state, Date.now(), roomCode);
    const updated = upsertSavedParkMeta(meta, readSavedParksIndex());
    writeSavedParksIndex(updated);
  } catch (e) {
    console.error('Failed to save park to index:', e);
  }
}

export default function CoasterCoopPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string)?.toUpperCase();

  const [showGame, setShowGame] = useState(false);
  const [showCoopModal, setShowCoopModal] = useState(true);
  const [startFresh, setStartFresh] = useState(false);
  const isStartingGameRef = useRef(false);

  const handleExitGame = () => {
    router.push('/coaster');
  };

  const handleCoopStart = (isHost: boolean, initialState?: CoasterGameState, code?: string) => {
    isStartingGameRef.current = true;

    if (initialState) {
      try {
        saveCoasterStateToStorage(COASTER_AUTOSAVE_KEY, initialState);
        if (code) {
          saveParkToIndex(initialState, code);
        }
      } catch (e) {
        console.error('Failed to save co-op park state:', e);
      }
      setStartFresh(false);
    } else if (isHost) {
      setStartFresh(true);
    } else {
      setStartFresh(true);
    }

    setShowGame(true);
    setShowCoopModal(false);
  };

  const handleModalClose = (open: boolean) => {
    if (!open && !showGame && !isStartingGameRef.current) {
      router.push('/coaster');
    }
    setShowCoopModal(open);
  };

  if (showGame) {
    return (
      <MultiplayerContextProvider>
        <CoasterProvider startFresh={startFresh}>
          <main className="h-screen w-screen overflow-hidden">
            <CoasterGame onExit={handleExitGame} />
          </main>
        </CoasterProvider>
      </MultiplayerContextProvider>
    );
  }

  return (
    <MultiplayerContextProvider>
      <main className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-950 to-emerald-950 flex items-center justify-center">
        <CoasterCoopModal
          open={showCoopModal}
          onOpenChange={handleModalClose}
          onStartGame={handleCoopStart}
          pendingRoomCode={roomCode}
        />
      </main>
    </MultiplayerContextProvider>
  );
}
