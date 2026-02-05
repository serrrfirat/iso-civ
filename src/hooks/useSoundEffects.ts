'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { SoundManager, SoundId } from '@/lib/audio/SoundManager';
import { CivGameState, GameNotification, CombatEffect, Civilization } from '@/games/civ/types';

interface UseSoundEffectsOptions {
  enabled?: boolean;
}

interface UseSoundEffectsReturn {
  muted: boolean;
  setMuted: (muted: boolean) => void;
  toggleMute: () => void;
  volume: number;
  setVolume: (volume: number) => void;
  playSound: (soundId: SoundId) => void;
}

/**
 * Hook that subscribes to game events and plays appropriate sound effects.
 * Listens to notifications, combat effects, turn changes, and other game events.
 */
export function useSoundEffects(options: UseSoundEffectsOptions = {}): UseSoundEffectsReturn {
  const { enabled = true } = options;
  const { state } = useCivGame();

  const [muted, setMutedState] = useState(() => SoundManager.isMuted());
  const [volume, setVolumeState] = useState(() => SoundManager.getVolume());

  // Track previous state for detecting changes
  const prevStateRef = useRef<{
    turn: number;
    notificationCount: number;
    combatEffectCount: number;
    winner: string | null;
    processedNotificationIds: Set<string>;
    processedCombatEffectIds: Set<string>;
  }>({
    turn: state.turn,
    notificationCount: state.notifications.length,
    combatEffectCount: state.combatEffects.length,
    winner: state.winner,
    processedNotificationIds: new Set(),
    processedCombatEffectIds: new Set(),
  });

  // Initialize sound manager on first user interaction
  const initRef = useRef(false);

  const initializeAudio = useCallback(() => {
    if (!initRef.current) {
      SoundManager.init();
      initRef.current = true;
    }
  }, []);

  // Initialize on any click/touch/keypress
  useEffect(() => {
    const handleInteraction = () => {
      initializeAudio();
      // Remove listeners after first interaction
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    window.addEventListener('keydown', handleInteraction);

    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [initializeAudio]);

  // Volume and mute controls
  const setMuted = useCallback((newMuted: boolean) => {
    initializeAudio();
    SoundManager.setMuted(newMuted);
    setMutedState(newMuted);
  }, [initializeAudio]);

  const toggleMute = useCallback(() => {
    initializeAudio();
    const newMuted = SoundManager.toggleMute();
    setMutedState(newMuted);
  }, [initializeAudio]);

  const setVolume = useCallback((newVolume: number) => {
    initializeAudio();
    SoundManager.setVolume(newVolume);
    setVolumeState(newVolume);
  }, [initializeAudio]);

  const playSound = useCallback((soundId: SoundId) => {
    if (!enabled) return;
    initializeAudio();
    SoundManager.playSound(soundId);
  }, [enabled, initializeAudio]);

  // Map notification types to sound IDs
  const getNotificationSound = useCallback((notification: GameNotification): SoundId | null => {
    switch (notification.type) {
      case 'combat':
        // Check if it's a death notification (message contains "destroyed" or "defeated")
        if (notification.message.toLowerCase().includes('destroyed') ||
            notification.message.toLowerCase().includes('defeated') ||
            notification.message.toLowerCase().includes('killed')) {
          return 'combat_death';
        }
        return 'combat_hit';
      case 'city':
        if (notification.message.toLowerCase().includes('founded') ||
            notification.message.toLowerCase().includes('settled')) {
          return 'city_founded';
        }
        return 'notification';
      case 'tech':
        if (notification.message.toLowerCase().includes('researched') ||
            notification.message.toLowerCase().includes('discovered') ||
            notification.message.toLowerCase().includes('complete')) {
          return 'tech_complete';
        }
        return 'notification';
      case 'diplomacy':
      case 'unit':
      default:
        return 'notification';
    }
  }, []);

  // Listen to game state changes and play sounds
  useEffect(() => {
    if (!enabled) return;

    const prev = prevStateRef.current;

    // Turn changed - play turn start sound
    if (state.turn !== prev.turn && state.turn > 1) {
      playSound('turn_start');
    }

    // Check for victory
    if (state.winner !== null && prev.winner === null) {
      playSound('victory');
    }

    // Process new notifications
    const newNotifications = state.notifications.filter(
      n => !prev.processedNotificationIds.has(n.id)
    );

    newNotifications.forEach(notification => {
      const soundId = getNotificationSound(notification);
      if (soundId) {
        // Small delay to prevent too many sounds at once
        setTimeout(() => {
          playSound(soundId);
        }, Math.random() * 100);
      }
      prev.processedNotificationIds.add(notification.id);
    });

    // Process new combat effects (separate from notifications for more responsive combat sounds)
    const newCombatEffects = state.combatEffects.filter(
      e => !prev.processedCombatEffectIds.has(e.id)
    );

    newCombatEffects.forEach(effect => {
      if (effect.defenderDestroyed) {
        playSound('combat_death');
      } else {
        playSound('combat_hit');
      }
      prev.processedCombatEffectIds.add(effect.id);
    });

    // Check for golden age in civilizations
    Object.values(state.civilizations).forEach(civ => {
      // This would need previous state tracking for golden age detection
      // For now, we handle it via notifications
    });

    // Update tracked state
    prev.turn = state.turn;
    prev.notificationCount = state.notifications.length;
    prev.combatEffectCount = state.combatEffects.length;
    prev.winner = state.winner;

    // Clean up old IDs to prevent memory leak (keep last 100)
    if (prev.processedNotificationIds.size > 200) {
      const idsArray = Array.from(prev.processedNotificationIds);
      prev.processedNotificationIds = new Set(idsArray.slice(-100));
    }
    if (prev.processedCombatEffectIds.size > 200) {
      const idsArray = Array.from(prev.processedCombatEffectIds);
      prev.processedCombatEffectIds = new Set(idsArray.slice(-100));
    }

  }, [state, enabled, playSound, getNotificationSound]);

  // Check for golden age start via civilization state changes
  const prevCivsRef = useRef<Record<string, { goldenAgeTurns: number }>>({});

  useEffect(() => {
    if (!enabled) return;

    const prevCivs = prevCivsRef.current;

    (Object.entries(state.civilizations) as [string, Civilization][]).forEach(([civId, civ]) => {
      const prevCiv = prevCivs[civId];

      // Golden age just started
      if (civ.goldenAgeTurns > 0 && (!prevCiv || prevCiv.goldenAgeTurns === 0)) {
        playSound('golden_age');
      }

      // Update tracking
      prevCivs[civId] = { goldenAgeTurns: civ.goldenAgeTurns };
    });

  }, [state.civilizations, enabled, playSound]);

  return {
    muted,
    setMuted,
    toggleMute,
    volume,
    setVolume,
    playSound,
  };
}
