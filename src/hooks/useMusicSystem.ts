'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getMusicManager } from '@/lib/audio/MusicManager';
import type { CivGameState, RelationshipStatus } from '@/games/civ/types';

interface UseMusicSystemOptions {
  /** Whether to auto-start music when component mounts */
  autoStart?: boolean;
  /** Initial volume (0.0 - 1.0) */
  initialVolume?: number;
}

interface UseMusicSystemReturn {
  /** Start playing music */
  start: () => Promise<void>;
  /** Stop playing music */
  stop: () => void;
  /** Set volume (0.0 - 1.0) */
  setVolume: (volume: number) => void;
  /** Get current volume */
  volume: number;
  /** Whether music is currently playing */
  isPlaying: boolean;
  /** Manually set intensity (0 = peaceful, 1 = tense) */
  setIntensity: (level: number) => void;
  /** Play victory swell effect */
  playVictorySwell: () => void;
}

/**
 * Hook to manage background music based on game state
 *
 * Features:
 * - Automatically adjusts intensity based on war status
 * - Peaceful music during diplomacy/idle phases
 * - Tense music when civilizations are at war
 * - Triumphant swell on victory
 */
export function useMusicSystem(
  gameState: CivGameState | null,
  options: UseMusicSystemOptions = {}
): UseMusicSystemReturn {
  const { autoStart = false, initialVolume = 0.3 } = options;

  const musicManagerRef = useRef(getMusicManager());
  const [volume, setVolumeState] = useState(initialVolume);
  const [isPlaying, setIsPlaying] = useState(false);
  const previousWinnerRef = useRef<string | null>(null);
  const hasStartedRef = useRef(false);

  // Start music
  const start = useCallback(async () => {
    try {
      await musicManagerRef.current.start();
      setIsPlaying(true);
      hasStartedRef.current = true;
    } catch (error) {
      console.error('Failed to start music:', error);
    }
  }, []);

  // Stop music
  const stop = useCallback(() => {
    musicManagerRef.current.stop();
    setIsPlaying(false);
  }, []);

  // Set volume
  const setVolume = useCallback((vol: number) => {
    const clampedVol = Math.max(0, Math.min(1, vol));
    musicManagerRef.current.setVolume(clampedVol);
    setVolumeState(clampedVol);
  }, []);

  // Set intensity manually
  const setIntensity = useCallback((level: number) => {
    musicManagerRef.current.setIntensity(level);
  }, []);

  // Play victory swell
  const playVictorySwell = useCallback(() => {
    musicManagerRef.current.playVictorySwell();
  }, []);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart && !hasStartedRef.current) {
      start();
    }

    // Cleanup on unmount
    return () => {
      // Don't stop music on unmount - it's a singleton
      // stop();
    };
  }, [autoStart, start]);

  // Set initial volume
  useEffect(() => {
    musicManagerRef.current.setVolume(initialVolume);
  }, [initialVolume]);

  // Calculate intensity based on game state
  useEffect(() => {
    if (!gameState || !isPlaying) return;

    // Check for victory
    if (gameState.winner && gameState.winner !== previousWinnerRef.current) {
      previousWinnerRef.current = gameState.winner;
      playVictorySwell();
      // Reduce intensity for victory celebration
      setIntensity(0);
      return;
    }

    // Calculate war intensity
    const intensity = calculateWarIntensity(gameState);
    setIntensity(intensity);
  }, [gameState, isPlaying, playVictorySwell, setIntensity]);

  return {
    start,
    stop,
    setVolume,
    volume,
    isPlaying,
    setIntensity,
    playVictorySwell,
  };
}

/**
 * Calculate the music intensity based on game state
 * Returns a value between 0 (peaceful) and 1 (tense)
 */
function calculateWarIntensity(state: CivGameState): number {
  const civs = Object.values(state.civilizations);
  const aliveCivs = civs.filter((c) => c.isAlive);

  if (aliveCivs.length === 0) return 0;

  // Count war relationships
  let warCount = 0;
  let hostileCount = 0;
  let totalRelationships = 0;

  for (const civ of aliveCivs) {
    for (const [otherId, status] of Object.entries(civ.relationships)) {
      // Only count if other civ is alive
      const otherCiv = state.civilizations[otherId];
      if (!otherCiv || !otherCiv.isAlive) continue;

      totalRelationships++;

      if (status === 'war') {
        warCount++;
      } else if (status === 'hostile') {
        hostileCount++;
      }
    }
  }

  if (totalRelationships === 0) return 0;

  // Calculate intensity
  // War relationships have full weight, hostile has partial weight
  const warRatio = warCount / totalRelationships;
  const hostileRatio = hostileCount / totalRelationships;

  // Recent combat events also increase tension
  const recentCombatBonus = calculateRecentCombatBonus(state);

  // Combine factors
  let intensity = warRatio * 0.8 + hostileRatio * 0.3 + recentCombatBonus;

  // Phase-based adjustments
  if (state.phase === 'diplomacy') {
    // Slightly reduce intensity during diplomacy
    intensity *= 0.8;
  } else if (state.phase === 'resolution') {
    // Increase intensity during resolution (combat happens here)
    intensity = Math.min(1, intensity * 1.2);
  }

  return Math.max(0, Math.min(1, intensity));
}

/**
 * Calculate bonus intensity from recent combat events
 */
function calculateRecentCombatBonus(state: CivGameState): number {
  const currentTurn = state.turn;
  const recentTurns = 3;

  // Count combat events in recent turns
  const recentCombat = state.combatLog.filter(
    (event) => event.turn >= currentTurn - recentTurns
  );

  // More recent combat = more intensity
  if (recentCombat.length === 0) return 0;
  if (recentCombat.length >= 5) return 0.3;
  if (recentCombat.length >= 3) return 0.2;
  return 0.1;
}

export default useMusicSystem;
