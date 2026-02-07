'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { renderTerrain, screenToGrid, gridToScreen, TILE_WIDTH, TILE_HEIGHT, renderFogOfWar, renderBarbarianCamps } from './TerrainRenderer';
import { renderUnits, renderCities, setHoveredUnit, setSelectedUnit, findUnitAtPosition } from './UnitRenderer';
import { renderCityBanners } from './CityBannerRenderer';
import { renderCombatEffects, cleanupCombatEffects, hasActiveCombatEffects } from './CombatEffectRenderer';
import { particleSystem } from './ParticleRenderer';
import { CivId, CIV_COLORS } from '@/games/civ/types';
import { spriteCache } from '@/lib/civ/spriteLoader';

const SLOW_MOTION_DURATION = 2000; // 2 seconds of slow motion for combat

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3.0;
const KEY_PAN_SPEED = 520;

// Camera pan duration in ms
const CAMERA_PAN_DURATION = 500;
// How long to hold on an event before processing the next
const EVENT_HOLD_DURATION = 1500;

// Easing function for smooth camera movement (ease-in-out cubic)
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Camera pan animation state
interface CameraPanState {
  startOffset: { x: number; y: number };
  targetOffset: { x: number; y: number };
  startTime: number;
  duration: number;
}

// Event hold state after panning
interface EventHoldState {
  startTime: number;
  duration: number;
}

export function CivCanvas() {
  const {
    state, stateRef, setState, perspective, setSelectedCityId, setViewport, setPanToGrid,
    slowMotion, slowMotionFactor, setSlowMotion,
    eventQueue, addCameraEvent, processingEvent, setProcessingEvent, consumeCameraEvent,
    screenShake, triggerScreenShake, triggerVisualEvent,
    replayHighlight, isReplaying
  } = useCivGame();
  const terrainCanvasRef = useRef<HTMLCanvasElement>(null);
  const entityCanvasRef = useRef<HTMLCanvasElement>(null);
  const uiCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [offset, setOffset] = useState({ x: 500, y: 100 });
  const [zoom, setZoom] = useState(0.8);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);

  const offsetRef = useRef(offset);
  const zoomRef = useRef(zoom);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastCombatEffectCountRef = useRef(0);
  const [showCombatText, setShowCombatText] = useState(false);

  // Auto-pan camera state
  const cameraPanRef = useRef<CameraPanState | null>(null);
  const eventHoldRef = useRef<EventHoldState | null>(null);

  // Screen shake calculation
  const screenShakeRef = useRef(screenShake);
  screenShakeRef.current = screenShake;

  // Replay highlight ref for render loop access
  const replayHighlightRef = useRef(replayHighlight);
  replayHighlightRef.current = replayHighlight;

  // isReplaying ref for camera guard
  const isReplayingRef = useRef(isReplaying);
  isReplayingRef.current = isReplaying;

  // Track combat effects for particle emission
  const lastCombatEffectsRef = useRef<string[]>([]);

  // Track processed camera events to avoid duplicates
  const processedCameraEventsRef = useRef<number>(0);

  offsetRef.current = offset;
  zoomRef.current = zoom;

  // Resize canvases to fill container
  const resizeCanvases = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    for (const ref of [terrainCanvasRef, entityCanvasRef, uiCanvasRef]) {
      const canvas = ref.current;
      if (!canvas) continue;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    }
  }, []);

  useEffect(() => {
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);
    // Preload all sprite assets
    spriteCache.preloadAll();
    return () => window.removeEventListener('resize', resizeCanvases);
  }, [resizeCanvases]);

  // Sync viewport state to context for minimap
  useEffect(() => {
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    setViewport({
      offset,
      zoom,
      canvasSize: { width: rect?.width || 0, height: rect?.height || 0 },
    });
  }, [offset, zoom, setViewport]);

  // Register pan-to-grid function for minimap clicks
  useEffect(() => {
    const panToGridFn = (gridX: number, gridY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      // Convert grid coords to screen coords
      const screen = gridToScreen(gridX, gridY);
      // Center the target tile in the viewport
      const targetX = rect.width / 2 - (screen.x + TILE_WIDTH / 2) * zoomRef.current;
      const targetY = rect.height / 2 - (screen.y + TILE_HEIGHT / 2) * zoomRef.current;
      setOffset({ x: targetX, y: targetY });
    };
    setPanToGrid(panToGridFn);
  }, [setPanToGrid]);

  // Detect new combat effects and trigger slow motion, screen shake, and particles
  useEffect(() => {
    const currentEffectCount = state.combatEffects?.length ?? 0;
    const previousCount = lastCombatEffectCountRef.current;
    const currentEffects = state.combatEffects ?? [];
    const currentEffectIds = currentEffects.map(e => e.id);
    const previousEffectIds = lastCombatEffectsRef.current;

    // Find new effects (not in previous list)
    const newEffects = currentEffects.filter(e => !previousEffectIds.includes(e.id));

    // New combat effects detected - trigger slow motion, shake, and particles
    if (newEffects.length > 0) {
      setSlowMotion(true, SLOW_MOTION_DURATION);
      setShowCombatText(true);
      // Hide combat text after a brief flash
      setTimeout(() => setShowCombatText(false), 500);

      // Trigger visual event and screen shake
      triggerVisualEvent('combat', 1500);

      // Trigger screen shake for each new combat effect
      for (const effect of newEffects) {
        // Shake intensity based on destruction
        const shakeIntensity = effect.defenderDestroyed ? 12 : 6;
        triggerScreenShake(shakeIntensity, 400);

        // Emit explosion particles at defender location
        particleSystem.emit('explosion', effect.defenderX, effect.defenderY, undefined, 1);

        // If destroyed, emit smoke particles
        if (effect.defenderDestroyed) {
          setTimeout(() => {
            particleSystem.emit('smoke', effect.defenderX, effect.defenderY, undefined, 1.5);
          }, 200);
          triggerVisualEvent('destruction', 2000);
        }
      }
    }

    lastCombatEffectCountRef.current = currentEffectCount;
    lastCombatEffectsRef.current = currentEffectIds;
  }, [state.combatEffects, setSlowMotion, triggerScreenShake, triggerVisualEvent]);

  // Sync camera events from game state to context event queue
  useEffect(() => {
    const cameraEvents = state.cameraEvents ?? [];
    const newEventsCount = cameraEvents.length;
    const processedCount = processedCameraEventsRef.current;

    // Process any new camera events
    if (newEventsCount > processedCount) {
      const newEvents = cameraEvents.slice(processedCount);
      for (const event of newEvents) {
        addCameraEvent(event.type, event.x, event.y, event.priority);
      }
      processedCameraEventsRef.current = newEventsCount;
    }

    // Reset processed count if camera events were cleared (new turn started)
    if (newEventsCount < processedCount) {
      processedCameraEventsRef.current = newEventsCount;
    }
  }, [state.cameraEvents, addCameraEvent]);

  // Auto-pan camera system - watches eventQueue and smoothly pans to events
  useEffect(() => {
    // Don't start processing if already processing, no events, or replaying
    if (processingEvent || eventQueue.length === 0 || isReplaying) return;

    // Get the highest priority event (already sorted)
    const event = eventQueue[0];
    if (!event) return;

    // Calculate target offset to center on the event location
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    // Convert grid coords to screen coords
    const screen = gridToScreen(event.x, event.y);
    // Center the target tile in the viewport
    const targetX = rect.width / 2 - (screen.x + TILE_WIDTH / 2) * zoomRef.current;
    const targetY = rect.height / 2 - (screen.y + TILE_HEIGHT / 2) * zoomRef.current;

    // Start the pan animation
    cameraPanRef.current = {
      startOffset: { x: offsetRef.current.x, y: offsetRef.current.y },
      targetOffset: { x: targetX, y: targetY },
      startTime: performance.now(),
      duration: CAMERA_PAN_DURATION,
    };

    // Mark as processing
    setProcessingEvent(true);

    // Consume the event from the queue
    consumeCameraEvent();

  }, [eventQueue, processingEvent, setProcessingEvent, consumeCameraEvent, isReplaying]);

  // Animation loop for camera panning
  useEffect(() => {
    if (!cameraPanRef.current && !eventHoldRef.current) return;

    let animationId: number;

    const animatePan = () => {
      const now = performance.now();

      // If we're panning
      if (cameraPanRef.current) {
        const pan = cameraPanRef.current;
        const elapsed = now - pan.startTime;
        const progress = Math.min(elapsed / pan.duration, 1);
        const eased = easeInOutCubic(progress);

        // Interpolate offset
        const newX = pan.startOffset.x + (pan.targetOffset.x - pan.startOffset.x) * eased;
        const newY = pan.startOffset.y + (pan.targetOffset.y - pan.startOffset.y) * eased;
        setOffset({ x: newX, y: newY });

        // Pan complete
        if (progress >= 1) {
          cameraPanRef.current = null;
          // Start the hold period
          eventHoldRef.current = {
            startTime: now,
            duration: EVENT_HOLD_DURATION,
          };
        }
      }

      // If we're holding on the event
      if (eventHoldRef.current) {
        const hold = eventHoldRef.current;
        const elapsed = now - hold.startTime;

        // Hold complete
        if (elapsed >= hold.duration) {
          eventHoldRef.current = null;
          // Allow processing of next event
          setProcessingEvent(false);
          return;
        }
      }

      // Continue animation
      if (cameraPanRef.current || eventHoldRef.current) {
        animationId = requestAnimationFrame(animatePan);
      }
    };

    animationId = requestAnimationFrame(animatePan);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [processingEvent, setProcessingEvent]);

  // Ref to store slow motion factor for use in render loop
  const slowMotionFactorRef = useRef(slowMotionFactor);
  slowMotionFactorRef.current = slowMotionFactor;

  // Main render loop
  useEffect(() => {
    let running = true;

    function render(time: number) {
      if (!running) return;
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Keyboard panning
      const keys = keysRef.current;
      const panSpeed = KEY_PAN_SPEED * dt;
      let dx = 0, dy = 0;
      if (keys.has('ArrowLeft') || keys.has('a')) dx += panSpeed;
      if (keys.has('ArrowRight') || keys.has('d')) dx -= panSpeed;
      if (keys.has('ArrowUp') || keys.has('w')) dy += panSpeed;
      if (keys.has('ArrowDown') || keys.has('s')) dy -= panSpeed;
      if (dx !== 0 || dy !== 0) {
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      }

      const currentState = stateRef.current;
      const currentOffset = offsetRef.current;
      const currentZoom = zoomRef.current;
      const container = containerRef.current;
      if (!container) { animFrameRef.current = requestAnimationFrame(render); return; }
      const rect = container.getBoundingClientRect();

      // Calculate screen shake offset using sine wave decay
      let shakeOffsetX = 0;
      let shakeOffsetY = 0;
      const currentShake = screenShakeRef.current;
      if (currentShake) {
        const elapsed = Date.now() - currentShake.startTime;
        const progress = elapsed / currentShake.duration;
        if (progress < 1) {
          // Decay using exponential falloff with sine wave oscillation
          const decay = Math.pow(1 - progress, 2);
          const frequency = 30; // Shake frequency in Hz
          const shakeX = Math.sin(elapsed * frequency * 0.05) * currentShake.intensity * decay;
          const shakeY = Math.cos(elapsed * frequency * 0.07) * currentShake.intensity * decay * 0.7;
          shakeOffsetX = shakeX;
          shakeOffsetY = shakeY;
        }
      }

      // Apply shake offset to the effective offset
      const effectiveOffset = {
        x: currentOffset.x + shakeOffsetX,
        y: currentOffset.y + shakeOffsetY,
      };

      // Terrain layer
      const terrainCtx = terrainCanvasRef.current?.getContext('2d');
      if (terrainCtx) {
        terrainCtx.clearRect(0, 0, rect.width, rect.height);
        renderTerrain(
          terrainCtx, currentState.grid, currentState.gridSize,
          effectiveOffset, currentZoom, rect.width, rect.height, time / 1000,
        );
      }

      // Entity layer (units + cities + barbarian camps + combat effects + particles)
      const entityCtx = entityCanvasRef.current?.getContext('2d');
      if (entityCtx) {
        entityCtx.clearRect(0, 0, rect.width, rect.height);
        // Render barbarian camps before cities (so camps appear behind structures if overlapping)
        renderBarbarianCamps(entityCtx, currentState.barbarianCamps, effectiveOffset, currentZoom);
        renderCities(entityCtx, currentState.cities, effectiveOffset, currentZoom);
        // Render Civ 6 style city banners above cities
        renderCityBanners(entityCtx, currentState.cities, effectiveOffset, currentZoom);
        // Pass current time for unit animation interpolation
        const now = Date.now();
        renderUnits(entityCtx, currentState.units, effectiveOffset, currentZoom, now);

        // Update and render particle system
        particleSystem.update();
        particleSystem.render(entityCtx, effectiveOffset, currentZoom);

        // Render combat effects with slow motion factor
        if (currentState.combatEffects && currentState.combatEffects.length > 0) {
          const currentSlowMotionFactor = slowMotionFactorRef.current;
          renderCombatEffects(entityCtx, currentState.combatEffects, effectiveOffset, currentZoom, now, currentSlowMotionFactor);

          // Clean up expired effects periodically (account for slow motion extending duration)
          const effectiveDuration = currentSlowMotionFactor < 1 ? 1 / currentSlowMotionFactor : 1;
          const cleanedEffects = cleanupCombatEffects(currentState.combatEffects, now, effectiveDuration);
          if (cleanedEffects.length !== currentState.combatEffects.length) {
            setState(prev => ({
              ...prev,
              combatEffects: cleanupCombatEffects(prev.combatEffects, Date.now(), effectiveDuration),
            }));
          }
        }
      }

      // UI layer (fog of war + hover) - uses effectiveOffset for screen shake
      const uiCtx = uiCanvasRef.current?.getContext('2d');
      if (uiCtx) {
        uiCtx.clearRect(0, 0, rect.width, rect.height);

        // Fog of war based on perspective
        if (perspective !== 'global') {
          const civ = currentState.civilizations[perspective as CivId];
          if (civ) {
            const knownSet = new Set(civ.knownTiles);
            renderFogOfWar(uiCtx, currentState.gridSize, knownSet, effectiveOffset, currentZoom, rect.width, rect.height);
          }
        }

        // Replay highlight
        const currentReplayHighlight = replayHighlightRef.current;
        if (currentReplayHighlight?.location) {
          uiCtx.save();
          uiCtx.translate(effectiveOffset.x, effectiveOffset.y);
          uiCtx.scale(currentZoom, currentZoom);

          const loc = currentReplayHighlight.location;
          const screen = gridToScreen(loc.x, loc.y);
          const hw = TILE_WIDTH / 2;
          const hh = TILE_HEIGHT / 2;

          // Pulsing diamond highlight
          const pulse = 0.6 + 0.4 * Math.sin(time / 300);
          const civColors = CIV_COLORS[currentReplayHighlight.civId || ''];
          const highlightColor = civColors?.primary || '#FFD700';

          uiCtx.globalAlpha = pulse * 0.6;
          uiCtx.strokeStyle = highlightColor;
          uiCtx.lineWidth = 3 / currentZoom;
          uiCtx.beginPath();
          uiCtx.moveTo(screen.x + hw, screen.y);
          uiCtx.lineTo(screen.x + TILE_WIDTH, screen.y + hh);
          uiCtx.lineTo(screen.x + hw, screen.y + TILE_HEIGHT);
          uiCtx.lineTo(screen.x, screen.y + hh);
          uiCtx.closePath();
          uiCtx.stroke();

          // Fill with semi-transparent color
          uiCtx.globalAlpha = pulse * 0.15;
          uiCtx.fillStyle = highlightColor;
          uiCtx.fill();

          // Arrow to target if exists
          if (currentReplayHighlight.targetLocation) {
            const target = currentReplayHighlight.targetLocation;
            const targetScreen = gridToScreen(target.x, target.y);

            uiCtx.globalAlpha = pulse * 0.7;
            uiCtx.strokeStyle = highlightColor;
            uiCtx.lineWidth = 2 / currentZoom;
            uiCtx.setLineDash([6 / currentZoom, 4 / currentZoom]);
            uiCtx.beginPath();
            uiCtx.moveTo(screen.x + hw, screen.y + hh);
            uiCtx.lineTo(targetScreen.x + hw, targetScreen.y + hh);
            uiCtx.stroke();
            uiCtx.setLineDash([]);

            // Target diamond
            uiCtx.globalAlpha = pulse * 0.4;
            uiCtx.strokeStyle = '#FF4444';
            uiCtx.lineWidth = 2 / currentZoom;
            uiCtx.beginPath();
            uiCtx.moveTo(targetScreen.x + hw, targetScreen.y);
            uiCtx.lineTo(targetScreen.x + TILE_WIDTH, targetScreen.y + hh);
            uiCtx.lineTo(targetScreen.x + hw, targetScreen.y + TILE_HEIGHT);
            uiCtx.lineTo(targetScreen.x, targetScreen.y + hh);
            uiCtx.closePath();
            uiCtx.stroke();
          }

          uiCtx.globalAlpha = 1;
          uiCtx.restore();
        }

        // Hover tile highlight
        if (hoveredTile && hoveredTile.x >= 0 && hoveredTile.x < currentState.gridSize && hoveredTile.y >= 0 && hoveredTile.y < currentState.gridSize) {
          uiCtx.save();
          uiCtx.translate(effectiveOffset.x, effectiveOffset.y);
          uiCtx.scale(currentZoom, currentZoom);
          const screen = gridToScreen(hoveredTile.x, hoveredTile.y);
          const hw = TILE_WIDTH / 2;
          const hh = TILE_HEIGHT / 2;
          uiCtx.strokeStyle = '#FFFFFF';
          uiCtx.lineWidth = 2 / currentZoom;
          uiCtx.beginPath();
          uiCtx.moveTo(screen.x + hw, screen.y);
          uiCtx.lineTo(screen.x + TILE_WIDTH, screen.y + hh);
          uiCtx.lineTo(screen.x + hw, screen.y + TILE_HEIGHT);
          uiCtx.lineTo(screen.x, screen.y + hh);
          uiCtx.closePath();
          uiCtx.stroke();
          uiCtx.restore();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    }

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [stateRef, setState, perspective, hoveredTile]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y };
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    if (isDragging && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setOffset({ x: dragStartRef.current.ox + dx, y: dragStartRef.current.oy + dy });
    }

    // Update hovered tile
    const sx = (e.clientX - rect.left - offsetRef.current.x) / zoomRef.current;
    const sy = (e.clientY - rect.top - offsetRef.current.y) / zoomRef.current;
    const gridPos = screenToGrid(sx, sy);
    setHoveredTile(gridPos);

    // Check for unit hover (for selection glow effect)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hoveredUnit = findUnitAtPosition(
      stateRef.current.units,
      mouseX,
      mouseY,
      offsetRef.current,
      zoomRef.current,
      Date.now()
    );
    setHoveredUnit(hoveredUnit);
  }, [isDragging, stateRef]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Distinguish click from drag: if mouse moved less than 5px, treat as click
    const downPos = mouseDownPosRef.current;
    if (downPos) {
      const dx = e.clientX - downPos.x;
      const dy = e.clientY - downPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        // This is a click, not a drag — check for unit or city on tile
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          // First check if clicking on a unit
          const clickedUnit = findUnitAtPosition(
            stateRef.current.units,
            mouseX,
            mouseY,
            offsetRef.current,
            zoomRef.current,
            Date.now()
          );

          if (clickedUnit) {
            setSelectedUnit(clickedUnit);
            setSelectedCityId(null);
          } else {
            // No unit clicked, check for city
            setSelectedUnit(null);
            const sx = (e.clientX - rect.left - offsetRef.current.x) / zoomRef.current;
            const sy = (e.clientY - rect.top - offsetRef.current.y) / zoomRef.current;
            const gridPos = screenToGrid(sx, sy);
            const currentState = stateRef.current;

            if (
              gridPos.x >= 0 && gridPos.x < currentState.gridSize &&
              gridPos.y >= 0 && gridPos.y < currentState.gridSize
            ) {
              const tile = currentState.grid[gridPos.y]?.[gridPos.x];
              if (tile?.cityId) {
                setSelectedCityId(tile.cityId);
              } else {
                setSelectedCityId(null);
              }
            } else {
              setSelectedCityId(null);
            }
          }
        }
      }
    }

    setIsDragging(false);
    dragStartRef.current = null;
    mouseDownPosRef.current = null;
  }, [stateRef, setSelectedCityId]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setZoom(prevZoom => {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prevZoom * delta));
      const scale = newZoom / prevZoom;

      setOffset(prev => ({
        x: mouseX - (mouseX - prev.x) * scale,
        y: mouseY - (mouseY - prev.y) * scale,
      }));

      return newZoom;
    });
  }, []);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.key);
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Tile info panel
  const tileInfo = hoveredTile && hoveredTile.x >= 0 && hoveredTile.x < state.gridSize && hoveredTile.y >= 0 && hoveredTile.y < state.gridSize
    ? state.grid[hoveredTile.y]?.[hoveredTile.x]
    : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-gray-900 cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setIsDragging(false); dragStartRef.current = null; mouseDownPosRef.current = null; setHoveredUnit(null); }}
      onWheel={handleWheel}
    >
      <canvas ref={terrainCanvasRef} className="absolute inset-0" />
      <canvas ref={entityCanvasRef} className="absolute inset-0" />
      <canvas ref={uiCanvasRef} className="absolute inset-0" />

      {/* Slow motion vignette effect */}
      {slowMotion && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.4) 100%)',
            boxShadow: 'inset 0 0 100px 20px rgba(180, 0, 0, 0.2)',
          }}
        />
      )}

      {/* Combat text flash */}
      {showCombatText && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="text-6xl font-black text-red-500 tracking-widest animate-pulse"
            style={{
              textShadow: '0 0 20px rgba(255, 0, 0, 0.8), 0 0 40px rgba(255, 0, 0, 0.5), 2px 2px 4px rgba(0, 0, 0, 0.8)',
              animation: 'combatFlash 0.5s ease-out forwards',
            }}
          >
            COMBAT
          </div>
        </div>
      )}

      {/* Tile Info Tooltip */}
      {tileInfo && (
        <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-3 py-2 rounded-lg pointer-events-none">
          <div className="font-bold capitalize">{tileInfo.terrain}</div>
          {tileInfo.resource && <div className="text-yellow-300">Resource: {tileInfo.resource}</div>}
          {tileInfo.ownerId && <div className="text-blue-300">Territory: {tileInfo.ownerId}</div>}
          {tileInfo.cityId && <div className="text-green-300">City: {state.cities[tileInfo.cityId]?.name}</div>}
          {tileInfo.unitId && <div className="text-red-300">Unit: {state.units[tileInfo.unitId]?.type} ({state.units[tileInfo.unitId]?.ownerId})</div>}
          <div className="text-gray-400">({tileInfo.x}, {tileInfo.y})</div>
        </div>
      )}

      {/* CSS for combat flash animation */}
      <style jsx>{`
        @keyframes combatFlash {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
          100% {
            opacity: 0;
            transform: scale(1.5);
          }
        }
      `}</style>
    </div>
  );
}
