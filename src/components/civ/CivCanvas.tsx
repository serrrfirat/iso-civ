'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { renderTerrain, screenToGrid, gridToScreen, TILE_WIDTH, TILE_HEIGHT, renderFogOfWar } from './TerrainRenderer';
import { renderUnits, renderCities } from './UnitRenderer';
import { CivId } from '@/games/civ/types';
import { spriteCache } from '@/lib/civ/spriteLoader';

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3.0;
const KEY_PAN_SPEED = 520;

export function CivCanvas() {
  const { state, stateRef, perspective } = useCivGame();
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

      // Terrain layer
      const terrainCtx = terrainCanvasRef.current?.getContext('2d');
      if (terrainCtx) {
        terrainCtx.clearRect(0, 0, rect.width, rect.height);
        renderTerrain(
          terrainCtx, currentState.grid, currentState.gridSize,
          currentOffset, currentZoom, rect.width, rect.height, time / 1000,
        );
      }

      // Entity layer (units + cities)
      const entityCtx = entityCanvasRef.current?.getContext('2d');
      if (entityCtx) {
        entityCtx.clearRect(0, 0, rect.width, rect.height);
        renderCities(entityCtx, currentState.cities, currentOffset, currentZoom);
        renderUnits(entityCtx, currentState.units, currentOffset, currentZoom);
      }

      // UI layer (fog of war + hover)
      const uiCtx = uiCanvasRef.current?.getContext('2d');
      if (uiCtx) {
        uiCtx.clearRect(0, 0, rect.width, rect.height);

        // Fog of war based on perspective
        if (perspective !== 'global') {
          const civ = currentState.civilizations[perspective as CivId];
          if (civ) {
            const knownSet = new Set(civ.knownTiles);
            renderFogOfWar(uiCtx, currentState.gridSize, knownSet, currentOffset, currentZoom, rect.width, rect.height);
          }
        }

        // Hover tile highlight
        if (hoveredTile && hoveredTile.x >= 0 && hoveredTile.x < currentState.gridSize && hoveredTile.y >= 0 && hoveredTile.y < currentState.gridSize) {
          uiCtx.save();
          uiCtx.translate(currentOffset.x, currentOffset.y);
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
  }, [stateRef, perspective, hoveredTile]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y };
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
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

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
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <canvas ref={terrainCanvasRef} className="absolute inset-0" />
      <canvas ref={entityCanvasRef} className="absolute inset-0" />
      <canvas ref={uiCanvasRef} className="absolute inset-0" />

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
    </div>
  );
}
