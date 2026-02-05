'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { CivGameState, CivId, CameraEvent, CameraEventType } from '@/games/civ/types';
import { createInitialGameState } from '@/lib/civ/mapGenerator';
import { EventAnnouncementData } from '@/components/spectator/EventAnnouncement';

interface ViewportState {
  offset: { x: number; y: number };
  zoom: number;
  canvasSize: { width: number; height: number };
}

export interface ScreenShakeState {
  intensity: number;
  duration: number;
  startTime: number;
}

export type VisualEventType = 'combat' | 'destruction' | 'golden_age' | 'city_founded' | 'tech_complete' | 'tense';

interface CivGameContextValue {
  state: CivGameState;
  stateRef: React.RefObject<CivGameState>;
  setState: React.Dispatch<React.SetStateAction<CivGameState>>;
  perspective: CivId | 'global';
  setPerspective: (p: CivId | 'global') => void;
  autoAdvance: boolean;
  setAutoAdvance: (a: boolean) => void;
  speed: number;
  setSpeed: (s: number) => void;
  selectedCityId: string | null;
  setSelectedCityId: (id: string | null) => void;
  isAdvancing: boolean;
  setIsAdvancing: (a: boolean) => void;
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  panToGrid: (gridX: number, gridY: number) => void;
  setPanToGrid: (fn: (gridX: number, gridY: number) => void) => void;
  slowMotion: boolean;
  slowMotionFactor: number;
  setSlowMotion: (enabled: boolean, duration?: number) => void;
  // Camera event queue for auto-pan system
  eventQueue: CameraEvent[];
  addCameraEvent: (type: CameraEventType, x: number, y: number, priority: number) => void;
  processingEvent: boolean;
  setProcessingEvent: (processing: boolean) => void;
  consumeCameraEvent: () => CameraEvent | null;
  // Screen shake for visual effects
  screenShake: ScreenShakeState | null;
  triggerScreenShake: (intensity: number, duration: number) => void;
  // Visual event highlights for SpectatorView
  activeVisualEvent: VisualEventType | null;
  triggerVisualEvent: (type: VisualEventType, duration?: number) => void;
  // Event announcements for dramatic moments
  announcement: EventAnnouncementData | null;
  showAnnouncement: (event: EventAnnouncementData) => void;
  clearAnnouncement: () => void;
}

const CivGameCtx = createContext<CivGameContextValue | null>(null);

export function CivGameProvider({ children, initialState }: { children: React.ReactNode; initialState?: CivGameState }) {
  const [state, setState] = useState<CivGameState>(() => initialState ?? createInitialGameState(Date.now()));
  const stateRef = useRef(state);
  stateRef.current = state;

  const [perspective, setPerspective] = useState<CivId | 'global'>('global');
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [viewport, setViewport] = useState<ViewportState>({
    offset: { x: 500, y: 100 },
    zoom: 0.8,
    canvasSize: { width: 0, height: 0 },
  });
  const [panToGridFn, setPanToGridFn] = useState<(gridX: number, gridY: number) => void>(() => () => {});
  const [slowMotion, setSlowMotionState] = useState(false);
  const [slowMotionFactor, setSlowMotionFactor] = useState(1);
  const slowMotionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Camera event queue for auto-pan system
  const [eventQueue, setEventQueue] = useState<CameraEvent[]>([]);
  const [processingEvent, setProcessingEvent] = useState(false);

  // Screen shake state for visual effects
  const [screenShake, setScreenShake] = useState<ScreenShakeState | null>(null);
  const screenShakeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Visual event highlights for SpectatorView
  const [activeVisualEvent, setActiveVisualEvent] = useState<VisualEventType | null>(null);
  const visualEventTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Event announcement state for dramatic overlays
  const [announcement, setAnnouncement] = useState<EventAnnouncementData | null>(null);
  const announcementTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setSlowMotion = useCallback((enabled: boolean, duration?: number) => {
    // Clear any existing timeout
    if (slowMotionTimeoutRef.current) {
      clearTimeout(slowMotionTimeoutRef.current);
      slowMotionTimeoutRef.current = null;
    }

    setSlowMotionState(enabled);
    setSlowMotionFactor(enabled ? 0.3 : 1);

    // Auto-reset after duration if enabled and duration is provided
    if (enabled && duration) {
      slowMotionTimeoutRef.current = setTimeout(() => {
        setSlowMotionState(false);
        setSlowMotionFactor(1);
        slowMotionTimeoutRef.current = null;
      }, duration);
    }
  }, []);

  // Add a camera event to the queue, sorted by priority (higher = more important)
  const addCameraEvent = useCallback((type: CameraEventType, x: number, y: number, priority: number) => {
    setEventQueue(prev => {
      const newEvent: CameraEvent = { type, x, y, priority };
      // Insert in priority order (descending - higher priority first)
      const newQueue = [...prev, newEvent].sort((a, b) => b.priority - a.priority);
      return newQueue;
    });
  }, []);

  // Consume the highest priority camera event from the queue
  const consumeCameraEvent = useCallback((): CameraEvent | null => {
    let event: CameraEvent | null = null;
    setEventQueue(prev => {
      if (prev.length === 0) return prev;
      event = prev[0];
      return prev.slice(1);
    });
    return event;
  }, []);

  // Trigger screen shake effect
  const triggerScreenShake = useCallback((intensity: number, duration: number) => {
    // Clear any existing shake timeout
    if (screenShakeTimeoutRef.current) {
      clearTimeout(screenShakeTimeoutRef.current);
      screenShakeTimeoutRef.current = null;
    }

    setScreenShake({
      intensity,
      duration,
      startTime: Date.now(),
    });

    // Auto-clear shake after duration
    screenShakeTimeoutRef.current = setTimeout(() => {
      setScreenShake(null);
      screenShakeTimeoutRef.current = null;
    }, duration);
  }, []);

  // Trigger visual event highlight
  const triggerVisualEvent = useCallback((type: VisualEventType, duration: number = 1500) => {
    // Clear any existing visual event timeout
    if (visualEventTimeoutRef.current) {
      clearTimeout(visualEventTimeoutRef.current);
      visualEventTimeoutRef.current = null;
    }

    setActiveVisualEvent(type);

    // Auto-clear after duration
    visualEventTimeoutRef.current = setTimeout(() => {
      setActiveVisualEvent(null);
      visualEventTimeoutRef.current = null;
    }, duration);
  }, []);

  // Show an event announcement overlay
  const showAnnouncement = useCallback((event: EventAnnouncementData) => {
    // Clear any existing announcement timeout
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
      announcementTimeoutRef.current = null;
    }

    setAnnouncement(event);

    // Auto-clear after 3 seconds (component handles its own animation timing)
    announcementTimeoutRef.current = setTimeout(() => {
      setAnnouncement(null);
      announcementTimeoutRef.current = null;
    }, 3000);
  }, []);

  // Clear the current announcement
  const clearAnnouncement = useCallback(() => {
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
      announcementTimeoutRef.current = null;
    }
    setAnnouncement(null);
  }, []);

  const panToGrid = useCallback((gridX: number, gridY: number) => {
    panToGridFn(gridX, gridY);
  }, [panToGridFn]);

  const setPanToGrid = useCallback((fn: (gridX: number, gridY: number) => void) => {
    setPanToGridFn(() => fn);
  }, []);

  // SSE connection for real-time state updates
  useEffect(() => {
    if (!state.id) return;

    const es = new EventSource(`/api/game/${state.id}/stream`);

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === 'turn_complete') {
          setIsAdvancing(false);
        }

        if (msg.data) {
          setState(msg.data);
        }
      } catch {}
    };

    return () => {
      es.close();
    };
  }, [state.id]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (slowMotionTimeoutRef.current) {
        clearTimeout(slowMotionTimeoutRef.current);
      }
      if (screenShakeTimeoutRef.current) {
        clearTimeout(screenShakeTimeoutRef.current);
      }
      if (visualEventTimeoutRef.current) {
        clearTimeout(visualEventTimeoutRef.current);
      }
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  return (
    <CivGameCtx.Provider value={{
      state, stateRef, setState, perspective, setPerspective,
      autoAdvance, setAutoAdvance, speed, setSpeed,
      selectedCityId, setSelectedCityId,
      isAdvancing, setIsAdvancing,
      viewport, setViewport, panToGrid, setPanToGrid,
      slowMotion, slowMotionFactor, setSlowMotion,
      eventQueue, addCameraEvent, processingEvent, setProcessingEvent, consumeCameraEvent,
      screenShake, triggerScreenShake,
      activeVisualEvent, triggerVisualEvent,
      announcement, showAnnouncement, clearAnnouncement,
    }}>
      {children}
    </CivGameCtx.Provider>
  );
}

export function useCivGame(): CivGameContextValue {
  const ctx = useContext(CivGameCtx);
  if (!ctx) throw new Error('useCivGame must be used within CivGameProvider');
  return ctx;
}
