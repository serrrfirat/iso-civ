'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CivTurnSummary, TurnEvent } from '@/games/civ/types';

export type ReplayState = 'idle' | 'playing' | 'paused';

export interface ActionReplayControls {
  replayState: ReplayState;
  currentCivIndex: number;
  currentEventIndex: number;
  currentSummary: CivTurnSummary | null;
  currentEvent: TurnEvent | null;
  summaries: CivTurnSummary[];
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBack: () => void;
  skipToNextCiv: () => void;
  skipToPrevCiv: () => void;
  reset: () => void;
  jumpToCiv: (index: number) => void;
}

export function useActionReplay(): ActionReplayControls {
  const { state, panToGrid, setReplayHighlight, setIsReplaying } = useCivGame();
  const [replayState, setReplayState] = useState<ReplayState>('idle');
  const [currentCivIndex, setCurrentCivIndex] = useState(0);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const summaries = state.civTurnSummaries ?? [];
  const currentSummary = summaries[currentCivIndex] ?? null;
  const events = currentSummary?.resolvedEvents ?? [];
  const currentEvent = events[currentEventIndex] ?? null;

  // Update highlight when event changes
  const updateHighlight = useCallback((event: TurnEvent | null, civId?: string) => {
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
  }, [panToGrid, setReplayHighlight]);

  // Step forward one event
  const stepForward = useCallback(() => {
    if (summaries.length === 0) return;

    setCurrentEventIndex(prev => {
      const currentEvents = summaries[currentCivIndex]?.resolvedEvents ?? [];
      if (prev < currentEvents.length - 1) {
        const nextEvent = currentEvents[prev + 1];
        updateHighlight(nextEvent, summaries[currentCivIndex]?.civId);
        return prev + 1;
      }
      // Move to next civ
      if (currentCivIndex < summaries.length - 1) {
        setCurrentCivIndex(ci => {
          const nextCi = ci + 1;
          const nextEvents = summaries[nextCi]?.resolvedEvents ?? [];
          const nextEvent = nextEvents[0] ?? null;
          updateHighlight(nextEvent, summaries[nextCi]?.civId);
          return nextCi;
        });
        return 0;
      }
      // Reached end -- stop playing
      setReplayState('paused');
      return prev;
    });
  }, [summaries, currentCivIndex, updateHighlight]);

  // Step back one event
  const stepBack = useCallback(() => {
    if (summaries.length === 0) return;

    setCurrentEventIndex(prev => {
      if (prev > 0) {
        const prevEvent = (summaries[currentCivIndex]?.resolvedEvents ?? [])[prev - 1];
        updateHighlight(prevEvent, summaries[currentCivIndex]?.civId);
        return prev - 1;
      }
      // Move to previous civ's last event
      if (currentCivIndex > 0) {
        setCurrentCivIndex(ci => {
          const prevCi = ci - 1;
          const prevEvents = summaries[prevCi]?.resolvedEvents ?? [];
          const lastIndex = Math.max(0, prevEvents.length - 1);
          updateHighlight(prevEvents[lastIndex] ?? null, summaries[prevCi]?.civId);
          return prevCi;
        });
        const prevCivEvents = summaries[currentCivIndex - 1]?.resolvedEvents ?? [];
        return Math.max(0, prevCivEvents.length - 1);
      }
      return 0;
    });
  }, [summaries, currentCivIndex, updateHighlight]);

  const skipToNextCiv = useCallback(() => {
    if (currentCivIndex < summaries.length - 1) {
      const nextCi = currentCivIndex + 1;
      setCurrentCivIndex(nextCi);
      setCurrentEventIndex(0);
      const nextEvent = (summaries[nextCi]?.resolvedEvents ?? [])[0] ?? null;
      updateHighlight(nextEvent, summaries[nextCi]?.civId);
    }
  }, [currentCivIndex, summaries, updateHighlight]);

  const skipToPrevCiv = useCallback(() => {
    if (currentCivIndex > 0) {
      const prevCi = currentCivIndex - 1;
      setCurrentCivIndex(prevCi);
      setCurrentEventIndex(0);
      const prevEvent = (summaries[prevCi]?.resolvedEvents ?? [])[0] ?? null;
      updateHighlight(prevEvent, summaries[prevCi]?.civId);
    }
  }, [currentCivIndex, summaries, updateHighlight]);

  const jumpToCiv = useCallback((index: number) => {
    if (index >= 0 && index < summaries.length) {
      setCurrentCivIndex(index);
      setCurrentEventIndex(0);
      const event = (summaries[index]?.resolvedEvents ?? [])[0] ?? null;
      updateHighlight(event, summaries[index]?.civId);
    }
  }, [summaries, updateHighlight]);

  const play = useCallback(() => {
    setReplayState('playing');
    setIsReplaying(true);
    if (summaries.length > 0) {
      const event = (summaries[currentCivIndex]?.resolvedEvents ?? [])[currentEventIndex] ?? null;
      updateHighlight(event, summaries[currentCivIndex]?.civId);
    }
  }, [summaries, currentCivIndex, currentEventIndex, updateHighlight, setIsReplaying]);

  const pause = useCallback(() => {
    setReplayState('paused');
  }, []);

  const reset = useCallback(() => {
    setReplayState('idle');
    setCurrentCivIndex(0);
    setCurrentEventIndex(0);
    setReplayHighlight(null);
    setIsReplaying(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [setReplayHighlight, setIsReplaying]);

  // Auto-advance timer
  useEffect(() => {
    if (replayState === 'playing') {
      timerRef.current = setInterval(() => {
        stepForward();
      }, 1500);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [replayState, stepForward]);

  // Reset when summaries change (new turn)
  useEffect(() => {
    reset();
  }, [summaries.length]);

  return {
    replayState,
    currentCivIndex,
    currentEventIndex,
    currentSummary,
    currentEvent,
    summaries,
    play,
    pause,
    stepForward,
    stepBack,
    skipToNextCiv,
    skipToPrevCiv,
    reset,
    jumpToCiv,
  };
}
