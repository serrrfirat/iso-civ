'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CivTurnSummary, TurnEvent } from '@/games/civ/types';

const STEP_INTERVAL_MS = 2000;
const START_DELAY_MS = 800;

export interface AutoReplayState {
  isPlaying: boolean;
  currentCivIndex: number;
  currentEventIndex: number;
  currentSummary: CivTurnSummary | null;
  currentEvent: TurnEvent | null;
  totalEvents: number;
  completedEvents: number;
  skip: () => void;
}

export function useAutoReplay(): AutoReplayState {
  const {
    state,
    autoReplay,
    panToGrid,
    setReplayHighlight,
    setIsReplaying,
  } = useCivGame();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCivIndex, setCurrentCivIndex] = useState(0);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  const lastSeenTurnRef = useRef(-1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track flattened event position via refs for the interval callback
  const civIndexRef = useRef(0);
  const eventIndexRef = useRef(0);
  const isPlayingRef = useRef(false);

  const summaries = state.civTurnSummaries ?? [];

  // Compute total events across all civs
  const totalEvents = summaries.reduce(
    (sum, s) => sum + (s.resolvedEvents?.length ?? 0),
    0
  );

  // Completed events up to current position
  let completedEvents = 0;
  for (let i = 0; i < currentCivIndex && i < summaries.length; i++) {
    completedEvents += summaries[i]?.resolvedEvents?.length ?? 0;
  }
  completedEvents += currentEventIndex;

  const currentSummary = summaries[currentCivIndex] ?? null;
  const currentEvent = currentSummary?.resolvedEvents?.[currentEventIndex] ?? null;

  const highlightEvent = useCallback(
    (event: TurnEvent | null, civId?: string) => {
      if (event?.location) {
        panToGrid(event.location.x, event.location.y);
        setReplayHighlight({
          location: event.location,
          targetLocation: event.targetLocation,
          civId: civId || event.civId,
          type: event.type,
        });
      } else {
        setReplayHighlight(null);
      }
    },
    [panToGrid, setReplayHighlight]
  );

  const stopReplay = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
    setReplayHighlight(null);
    setIsReplaying(false);
    setCurrentCivIndex(0);
    setCurrentEventIndex(0);
    civIndexRef.current = 0;
    eventIndexRef.current = 0;
  }, [setReplayHighlight, setIsReplaying]);

  const startReplay = useCallback(() => {
    if (summaries.length === 0 || totalEvents === 0) return;

    setCurrentCivIndex(0);
    setCurrentEventIndex(0);
    civIndexRef.current = 0;
    eventIndexRef.current = 0;
    setIsPlaying(true);
    isPlayingRef.current = true;
    setIsReplaying(true);

    // Show first event immediately
    const firstEvent = summaries[0]?.resolvedEvents?.[0] ?? null;
    highlightEvent(firstEvent, summaries[0]?.civId);

    // Start interval for stepping
    timerRef.current = setInterval(() => {
      if (!isPlayingRef.current) return;

      const ci = civIndexRef.current;
      const ei = eventIndexRef.current;
      const curSummaries = summaries;
      const curEvents = curSummaries[ci]?.resolvedEvents ?? [];

      if (ei < curEvents.length - 1) {
        // Next event in same civ
        const nextEi = ei + 1;
        eventIndexRef.current = nextEi;
        setCurrentEventIndex(nextEi);
        highlightEvent(curEvents[nextEi], curSummaries[ci]?.civId);
      } else if (ci < curSummaries.length - 1) {
        // Move to next civ
        const nextCi = ci + 1;
        civIndexRef.current = nextCi;
        eventIndexRef.current = 0;
        setCurrentCivIndex(nextCi);
        setCurrentEventIndex(0);
        const nextEvent = curSummaries[nextCi]?.resolvedEvents?.[0] ?? null;
        highlightEvent(nextEvent, curSummaries[nextCi]?.civId);
      } else {
        // All events done
        stopReplay();
      }
    }, STEP_INTERVAL_MS);
  }, [summaries, totalEvents, highlightEvent, setIsReplaying, stopReplay]);

  // Watch for turn completion → auto-start replay
  useEffect(() => {
    if (!autoReplay) return;
    if (summaries.length === 0) return;

    const currentTurn = summaries[0]?.turn ?? -1;
    if (currentTurn <= lastSeenTurnRef.current) return;
    if (state.phase !== 'idle') return;

    // New turn detected
    lastSeenTurnRef.current = currentTurn;

    // Delay start to let narrator overlay finish
    delayTimerRef.current = setTimeout(() => {
      startReplay();
    }, START_DELAY_MS);

    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
    };
  }, [autoReplay, summaries, state.phase, startReplay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    };
  }, []);

  return {
    isPlaying,
    currentCivIndex,
    currentEventIndex,
    currentSummary,
    currentEvent,
    totalEvents,
    completedEvents,
    skip: stopReplay,
  };
}
