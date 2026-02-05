'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { useCivGame } from '@/context/CivGameContext';
import { CivId, TERRAIN_COLORS, CIV_COLORS } from '@/games/civ/types';
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT } from '@/components/civ/TerrainRenderer';

const MINIMAP_SIZE = 150;

// Minimap terrain colors (simplified flat colors)
const MINIMAP_TERRAIN_COLORS: Record<string, string> = {
  plains: '#6B8E23',
  forest: '#228B22',
  mountain: '#808080',
  water: '#4A90D9',
  desert: '#DEB887',
  hills: '#8FBC8F',
};

interface MinimapProps {
  /** Callback when minimap is clicked to pan the main view */
  onPanTo?: (gridX: number, gridY: number) => void;
  /** Current viewport offset from CivCanvas */
  viewportOffset: { x: number; y: number };
  /** Current zoom level from CivCanvas */
  viewportZoom: number;
  /** Canvas dimensions */
  canvasSize: { width: number; height: number };
}

export function Minimap({ onPanTo, viewportOffset, viewportZoom, canvasSize }: MinimapProps) {
  const { state, perspective } = useCivGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Get known tiles set based on perspective
  const getKnownTiles = useCallback((): Set<string> | null => {
    if (perspective === 'global') return null; // Global view sees everything
    const civ = state.civilizations[perspective as CivId];
    return civ ? new Set(civ.knownTiles) : null;
  }, [state.civilizations, perspective]);

  // Calculate minimap scale and offsets
  const getMinimapTransform = useCallback(() => {
    const gridSize = state.gridSize;

    // Calculate the bounds of the isometric grid in screen space
    // Top-left corner in screen space (tile 0,0)
    const topCorner = gridToScreen(0, 0);
    // Bottom-right corner in screen space (tile gridSize-1, gridSize-1)
    const bottomCorner = gridToScreen(gridSize - 1, gridSize - 1);
    // Left corner (tile 0, gridSize-1)
    const leftCorner = gridToScreen(0, gridSize - 1);
    // Right corner (tile gridSize-1, 0)
    const rightCorner = gridToScreen(gridSize - 1, 0);

    const minX = leftCorner.x;
    const maxX = rightCorner.x + TILE_WIDTH;
    const minY = topCorner.y;
    const maxY = bottomCorner.y + TILE_HEIGHT;

    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;

    // Scale to fit minimap
    const scale = Math.min(MINIMAP_SIZE / worldWidth, MINIMAP_SIZE / worldHeight) * 0.9;

    // Center the map in the minimap
    const offsetX = (MINIMAP_SIZE - worldWidth * scale) / 2 - minX * scale;
    const offsetY = (MINIMAP_SIZE - worldHeight * scale) / 2 - minY * scale;

    return { scale, offsetX, offsetY, minX, minY, worldWidth, worldHeight };
  }, [state.gridSize]);

  // Render the minimap
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_SIZE * dpr;
    canvas.height = MINIMAP_SIZE * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    const { scale, offsetX, offsetY } = getMinimapTransform();
    const knownTiles = getKnownTiles();
    const gridSize = state.gridSize;

    // Draw terrain tiles
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = state.grid[y]?.[x];
        if (!tile) continue;

        // Check fog of war
        const tileKey = `${x},${y}`;
        if (knownTiles && !knownTiles.has(tileKey)) {
          continue; // Don't draw unknown tiles
        }

        const screen = gridToScreen(x, y);
        const miniX = screen.x * scale + offsetX + (TILE_WIDTH / 2) * scale;
        const miniY = screen.y * scale + offsetY + (TILE_HEIGHT / 2) * scale;

        // Draw terrain as small diamond/rect
        const tileSize = Math.max(2, 3 * scale);
        const terrainColor = MINIMAP_TERRAIN_COLORS[tile.terrain] || TERRAIN_COLORS[tile.terrain]?.top || '#333';

        ctx.fillStyle = terrainColor;
        ctx.fillRect(miniX - tileSize / 2, miniY - tileSize / 2, tileSize, tileSize);
      }
    }

    // Draw cities as larger dots
    for (const city of Object.values(state.cities)) {
      const tileKey = `${city.x},${city.y}`;
      if (knownTiles && !knownTiles.has(tileKey)) continue;

      const screen = gridToScreen(city.x, city.y);
      const miniX = screen.x * scale + offsetX + (TILE_WIDTH / 2) * scale;
      const miniY = screen.y * scale + offsetY + (TILE_HEIGHT / 2) * scale;

      const civColor = CIV_COLORS[city.ownerId]?.primary || '#FFFFFF';
      const citySize = 5;

      // Draw city marker
      ctx.fillStyle = civColor;
      ctx.beginPath();
      ctx.arc(miniX, miniY, citySize, 0, Math.PI * 2);
      ctx.fill();

      // City border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw units as smaller dots
    for (const unit of Object.values(state.units)) {
      const tileKey = `${unit.x},${unit.y}`;
      if (knownTiles && !knownTiles.has(tileKey)) continue;

      const screen = gridToScreen(unit.x, unit.y);
      const miniX = screen.x * scale + offsetX + (TILE_WIDTH / 2) * scale;
      const miniY = screen.y * scale + offsetY + (TILE_HEIGHT / 2) * scale;

      const civColor = CIV_COLORS[unit.ownerId]?.primary || '#FFFFFF';
      const unitSize = 2.5;

      ctx.fillStyle = civColor;
      ctx.beginPath();
      ctx.arc(miniX, miniY, unitSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw viewport rectangle
    if (canvasSize.width > 0 && canvasSize.height > 0) {
      // Calculate viewport bounds in world coordinates
      const viewLeft = -viewportOffset.x / viewportZoom;
      const viewTop = -viewportOffset.y / viewportZoom;
      const viewWidth = canvasSize.width / viewportZoom;
      const viewHeight = canvasSize.height / viewportZoom;

      // Convert to minimap coordinates
      const rectX = viewLeft * scale + offsetX;
      const rectY = viewTop * scale + offsetY;
      const rectW = viewWidth * scale;
      const rectH = viewHeight * scale;

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(rectX, rectY, rectW, rectH);

      // Semi-transparent fill
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(rectX, rectY, rectW, rectH);
    }

  }, [state, getMinimapTransform, getKnownTiles, viewportOffset, viewportZoom, canvasSize]);

  // Re-render on state changes
  useEffect(() => {
    render();
  }, [render]);

  // Handle click to pan
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPanTo) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const { scale, offsetX, offsetY } = getMinimapTransform();

    // Convert click position to world screen coordinates
    const worldX = (clickX - offsetX) / scale;
    const worldY = (clickY - offsetY) / scale;

    // Convert screen coords to grid coords using inverse of gridToScreen
    // screenX = (gx - gy) * (TILE_WIDTH / 2)
    // screenY = (gx + gy) * (TILE_HEIGHT / 2)
    // Solving for gx, gy:
    // gx = (screenX / (TILE_WIDTH/2) + screenY / (TILE_HEIGHT/2)) / 2
    // gy = (screenY / (TILE_HEIGHT/2) - screenX / (TILE_WIDTH/2)) / 2
    const gx = (worldX / (TILE_WIDTH / 2) + worldY / (TILE_HEIGHT / 2)) / 2;
    const gy = (worldY / (TILE_HEIGHT / 2) - worldX / (TILE_WIDTH / 2)) / 2;

    onPanTo(Math.round(gx), Math.round(gy));
  }, [onPanTo, getMinimapTransform]);

  return (
    <div
      className="absolute bottom-16 left-2 z-10 rounded-lg overflow-hidden border-2 border-gray-700 bg-gray-900/90 shadow-lg"
      style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE, cursor: 'pointer' }}
        onClick={handleClick}
      />
    </div>
  );
}
