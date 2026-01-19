'use client';

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Tile, Tool } from '@/games/coaster/types';
import { getSpriteInfo, getSpriteRect, COASTER_SPRITE_PACK } from '@/games/coaster/lib/coasterRenderConfig';
import { drawStraightTrack, drawCurvedTrack, drawSlopeTrack, drawLoopTrack, drawChainLift } from '@/components/coaster/tracks';
import { drawGuest } from '@/components/coaster/guests';

// Track tools that support drag-to-draw
const TRACK_DRAG_TOOLS: Tool[] = [
  'coaster_build',
  'coaster_track',
  'path',
];

// =============================================================================
// CONSTANTS (shared with isocity)
// =============================================================================

const TILE_WIDTH = 64;
const HEIGHT_RATIO = 0.60;
const TILE_HEIGHT = TILE_WIDTH * HEIGHT_RATIO;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;
const HEIGHT_UNIT = 20;

// Water texture path (same as city game)
const WATER_ASSET_PATH = '/assets/water.png';

// Background color to filter (red)
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
const COLOR_THRESHOLD = 155;

// =============================================================================
// SPRITE SHEET LOADING
// =============================================================================

function filterBackgroundColor(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const distance = Math.sqrt(
      Math.pow(r - BACKGROUND_COLOR.r, 2) +
      Math.pow(g - BACKGROUND_COLOR.g, 2) +
      Math.pow(b - BACKGROUND_COLOR.b, 2)
    );
    
    if (distance <= COLOR_THRESHOLD) {
      data[i + 3] = 0; // Make transparent
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function gridToScreen(
  gridX: number,
  gridY: number,
  offsetX: number,
  offsetY: number
): { screenX: number; screenY: number } {
  const screenX = (gridX - gridY) * (TILE_WIDTH / 2) + offsetX;
  const screenY = (gridX + gridY) * (TILE_HEIGHT / 2) + offsetY;
  return { screenX, screenY };
}

function screenToGrid(
  screenX: number,
  screenY: number,
  offsetX: number,
  offsetY: number
): { gridX: number; gridY: number } {
  const adjustedX = screenX - offsetX;
  const adjustedY = screenY - offsetY;
  
  const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
  
  return { gridX: Math.floor(gridX), gridY: Math.floor(gridY) };
}

// =============================================================================
// DRAWING FUNCTIONS
// =============================================================================

// Grass tile colors matching the city game
const GRASS_COLORS = {
  top: '#4a7c3f',
  left: '#3d6634',
  right: '#5a8f4f',
  stroke: '#2d4a26',
};

function drawGrassTile(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number = 1) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Draw the isometric diamond (top face)
  ctx.fillStyle = GRASS_COLORS.top;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Draw stroke when zoomed in enough (matching city game behavior)
  if (zoom >= 0.6) {
    ctx.strokeStyle = GRASS_COLORS.stroke;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

// Water tile colors (fallback if texture not loaded)
const WATER_COLORS = {
  base: '#0ea5e9',
  stroke: '#0284c7',
};

function drawWaterTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number,
  waterImage: HTMLImageElement | null,
  zoom: number = 1
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Check which adjacent tiles are also water for blending
  const adjacentWater = {
    north: gridX > 0 && grid[gridY]?.[gridX - 1]?.terrain === 'water',
    east: gridY > 0 && grid[gridY - 1]?.[gridX]?.terrain === 'water',
    south: gridX < gridSize - 1 && grid[gridY]?.[gridX + 1]?.terrain === 'water',
    west: gridY < gridSize - 1 && grid[gridY + 1]?.[gridX]?.terrain === 'water',
  };
  
  // Count adjacent water tiles
  const adjacentCount = (adjacentWater.north ? 1 : 0) + (adjacentWater.east ? 1 : 0) + 
                       (adjacentWater.south ? 1 : 0) + (adjacentWater.west ? 1 : 0);
  
  if (waterImage && waterImage.complete && waterImage.naturalWidth > 0) {
    // Use water texture (same approach as city game)
    const tileCenterX = x + w / 2;
    const tileCenterY = y + h / 2;
    
    // Random subcrop of water texture based on tile position for variety
    const imgW = waterImage.naturalWidth || waterImage.width;
    const imgH = waterImage.naturalHeight || waterImage.height;
    
    // Deterministic "random" offset based on tile position
    const seedX = ((gridX * 7919 + gridY * 6271) % 1000) / 1000;
    const seedY = ((gridX * 4177 + gridY * 9311) % 1000) / 1000;
    
    // Take a subcrop - use 35% of the image, offset randomly for variety
    const cropScale = 0.35;
    const cropW = imgW * cropScale;
    const cropH = imgH * cropScale;
    const maxOffsetX = imgW - cropW;
    const maxOffsetY = imgH - cropH;
    const srcX = seedX * maxOffsetX;
    const srcY = seedY * maxOffsetY;
    
    // Create a clipping path - expand toward adjacent WATER tiles only
    const expand = w * 0.4;
    
    // Calculate expanded corners based on water adjacency
    const topY = y - (adjacentWater.north && adjacentWater.east ? expand * 0.5 : 0);
    const rightX = x + w + ((adjacentWater.east && adjacentWater.south) ? expand * 0.5 : 0);
    const bottomY = y + h + ((adjacentWater.south && adjacentWater.west) ? expand * 0.5 : 0);
    const leftX = x - ((adjacentWater.west && adjacentWater.north) ? expand * 0.5 : 0);
    
    const topExpand = (adjacentWater.north && adjacentWater.east) ? expand * 0.3 : 0;
    const rightExpand = (adjacentWater.east && adjacentWater.south) ? expand * 0.3 : 0;
    const bottomExpand = (adjacentWater.south && adjacentWater.west) ? expand * 0.3 : 0;
    const leftExpand = (adjacentWater.west && adjacentWater.north) ? expand * 0.3 : 0;
    
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + w / 2, topY - topExpand);
    ctx.lineTo(rightX + rightExpand, y + h / 2);
    ctx.lineTo(x + w / 2, bottomY + bottomExpand);
    ctx.lineTo(leftX - leftExpand, y + h / 2);
    ctx.closePath();
    ctx.clip();
    
    const aspectRatio = cropH / cropW;
    const savedAlpha = ctx.globalAlpha;
    
    // Jitter for variety
    const jitterX = (seedX - 0.5) * w * 0.3;
    const jitterY = (seedY - 0.5) * h * 0.3;
    
    // Simplified rendering based on zoom and adjacency
    if (zoom < 0.5) {
      // Simplified single-pass water at low zoom
      const destWidth = w * 1.15;
      const destHeight = destWidth * aspectRatio;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(
        waterImage,
        srcX, srcY, cropW, cropH,
        Math.round(tileCenterX - destWidth / 2),
        Math.round(tileCenterY - destHeight / 2),
        Math.round(destWidth),
        Math.round(destHeight)
      );
    } else if (adjacentCount >= 2) {
      // Two passes: large soft outer, smaller solid core
      const outerScale = 2.0 + adjacentCount * 0.3;
      const outerWidth = w * outerScale;
      const outerHeight = outerWidth * aspectRatio;
      ctx.globalAlpha = 0.4;
      ctx.drawImage(
        waterImage,
        srcX, srcY, cropW, cropH,
        Math.round(tileCenterX - outerWidth / 2 + jitterX * 0.5),
        Math.round(tileCenterY - outerHeight / 2 + jitterY * 0.5),
        Math.round(outerWidth),
        Math.round(outerHeight)
      );
      
      // Core pass - solid center
      const coreWidth = w * 1.2;
      const coreHeight = coreWidth * aspectRatio;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(
        waterImage,
        srcX, srcY, cropW, cropH,
        Math.round(tileCenterX - coreWidth / 2 + jitterX),
        Math.round(tileCenterY - coreHeight / 2 + jitterY),
        Math.round(coreWidth),
        Math.round(coreHeight)
      );
    } else {
      // Single tile or edge - simple draw
      const destWidth = w * 1.15;
      const destHeight = destWidth * aspectRatio;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(
        waterImage,
        srcX, srcY, cropW, cropH,
        Math.round(tileCenterX - destWidth / 2 + jitterX),
        Math.round(tileCenterY - destHeight / 2 + jitterY),
        Math.round(destWidth),
        Math.round(destHeight)
      );
    }
    
    ctx.globalAlpha = savedAlpha;
    ctx.restore();
  } else {
    // Fallback: solid color water if texture not loaded
    ctx.fillStyle = WATER_COLORS.base;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
    ctx.fill();
    
    // Draw stroke when zoomed in enough
    if (zoom >= 0.6) {
      ctx.strokeStyle = WATER_COLORS.stroke;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }
}

function drawPathTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number
) {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Check adjacent paths for connections
  const hasPath = (gx: number, gy: number) => {
    if (gx < 0 || gy < 0 || gx >= gridSize || gy >= gridSize) return false;
    return grid[gy][gx].path || grid[gy][gx].queue;
  };

  const north = hasPath(gridX - 1, gridY);
  const east = hasPath(gridX, gridY - 1);
  const south = hasPath(gridX + 1, gridY);
  const west = hasPath(gridX, gridY + 1);

  // Draw grass base first
  drawGrassTile(ctx, x, y, 1);

  // Path dimensions
  const pathWidth = w * 0.32;

  // Edge midpoints (matching road system)
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;

  // Direction vectors from center to each edge
  const northDx = (northEdgeX - cx) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const northDy = (northEdgeY - cy) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const eastDx = (eastEdgeX - cx) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const eastDy = (eastEdgeY - cy) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const southDx = (southEdgeX - cx) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const southDy = (southEdgeY - cy) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const westDx = (westEdgeX - cx) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  const westDy = (westEdgeY - cy) / Math.hypot(westEdgeX - cx, westEdgeY - cy);

  // Get perpendicular vector (like road system)
  const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });

  // Path color (stone/concrete)
  ctx.fillStyle = '#9ca3af';

  // Edge stop distance
  const edgeStop = 0.95;
  const halfWidth = pathWidth * 0.5;

  // Draw path segments to connected neighbors
  if (north) {
    const stopX = cx + (northEdgeX - cx) * edgeStop;
    const stopY = cy + (northEdgeY - cy) * edgeStop;
    const perp = getPerp(northDx, northDy);
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }

  if (east) {
    const stopX = cx + (eastEdgeX - cx) * edgeStop;
    const stopY = cy + (eastEdgeY - cy) * edgeStop;
    const perp = getPerp(eastDx, eastDy);
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }

  if (south) {
    const stopX = cx + (southEdgeX - cx) * edgeStop;
    const stopY = cy + (southEdgeY - cy) * edgeStop;
    const perp = getPerp(southDx, southDy);
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }

  if (west) {
    const stopX = cx + (westEdgeX - cx) * edgeStop;
    const stopY = cy + (westEdgeY - cy) * edgeStop;
    const perp = getPerp(westDx, westDy);
    ctx.beginPath();
    ctx.moveTo(cx + perp.nx * halfWidth, cy + perp.ny * halfWidth);
    ctx.lineTo(stopX + perp.nx * halfWidth, stopY + perp.ny * halfWidth);
    ctx.lineTo(stopX - perp.nx * halfWidth, stopY - perp.ny * halfWidth);
    ctx.lineTo(cx - perp.nx * halfWidth, cy - perp.ny * halfWidth);
    ctx.closePath();
    ctx.fill();
  }

  // Center diamond intersection
  const centerSize = pathWidth * 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy - centerSize);
  ctx.lineTo(cx + centerSize, cy);
  ctx.lineTo(cx, cy + centerSize);
  ctx.lineTo(cx - centerSize, cy);
  ctx.closePath();
  ctx.fill();

  // Path edge stroke
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawQueueTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gridX: number,
  gridY: number,
  grid: Tile[][],
  gridSize: number
) {
  // Draw path first
  drawPathTile(ctx, x, y, gridX, gridY, grid, gridSize);
  
  // Add queue railings following the path edges
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Check adjacent paths for connections (same logic as path)
  const hasPath = (gx: number, gy: number) => {
    if (gx < 0 || gy < 0 || gx >= gridSize || gy >= gridSize) return false;
    return grid[gy][gx].path || grid[gy][gx].queue;
  };

  const north = hasPath(gridX - 1, gridY);
  const east = hasPath(gridX, gridY - 1);
  const south = hasPath(gridX + 1, gridY);
  const west = hasPath(gridX, gridY + 1);

  // Edge midpoints
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;

  // Direction vectors from center to each edge
  const northDx = (northEdgeX - cx) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const northDy = (northEdgeY - cy) / Math.hypot(northEdgeX - cx, northEdgeY - cy);
  const eastDx = (eastEdgeX - cx) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const eastDy = (eastEdgeY - cy) / Math.hypot(eastEdgeX - cx, eastEdgeY - cy);
  const southDx = (southEdgeX - cx) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const southDy = (southEdgeY - cy) / Math.hypot(southEdgeX - cx, southEdgeY - cy);
  const westDx = (westEdgeX - cx) / Math.hypot(westEdgeX - cx, westEdgeY - cy);
  const westDy = (westEdgeY - cy) / Math.hypot(westEdgeX - cx, westEdgeY - cy);

  // Get perpendicular vector
  const getPerp = (dx: number, dy: number) => ({ nx: -dy, ny: dx });

  // Path dimensions (must match drawPathTile)
  const pathWidth = w * 0.32;
  const halfWidth = pathWidth * 0.5;
  const railInset = halfWidth * 0.75; // Position rails along path edges
  const edgeStop = 0.95;

  // Queue styling
  const postSize = 1.5;
  ctx.fillStyle = '#374151';

  // Draw queue railings parallel to path edges for each connected direction
  const drawQueueRailsForSegment = (
    dirDx: number, 
    dirDy: number, 
    edgeX: number, 
    edgeY: number
  ) => {
    const perp = getPerp(dirDx, dirDy);
    const stopX = cx + (edgeX - cx) * edgeStop;
    const stopY = cy + (edgeY - cy) * edgeStop;

    // Two rails - one on each side of the path, parallel to path direction
    for (const side of [-1, 1]) {
      const railOffX = perp.nx * railInset * side;
      const railOffY = perp.ny * railInset * side;

      // Rail endpoints
      const startX = cx + railOffX;
      const startY = cy + railOffY;
      const endX = stopX + railOffX;
      const endY = stopY + railOffY;

      // Draw posts at both ends
      ctx.beginPath();
      ctx.arc(startX, startY, postSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(endX, endY, postSize, 0, Math.PI * 2);
      ctx.fill();

      // Draw rope/chain between posts
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  };

  // Draw rails for each connected path segment
  if (north) drawQueueRailsForSegment(northDx, northDy, northEdgeX, northEdgeY);
  if (east) drawQueueRailsForSegment(eastDx, eastDy, eastEdgeX, eastEdgeY);
  if (south) drawQueueRailsForSegment(southDx, southDy, southEdgeX, southEdgeY);
  if (west) drawQueueRailsForSegment(westDx, westDy, westEdgeX, westEdgeY);

  ctx.setLineDash([]);
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  spriteSheets: Map<string, HTMLCanvasElement>,
  buildingType: string,
  x: number,
  y: number
) {
  const info = getSpriteInfo(buildingType);
  if (!info) return false;
  
  const { sheet, sprite } = info;
  const sheetCanvas = spriteSheets.get(sheet.id);
  if (!sheetCanvas) return false;
  
  const rect = getSpriteRect(sheet, sprite, sheetCanvas.width, sheetCanvas.height);
  const scale = sprite.scale || 1.0;
  
  // Calculate destination size BASED ON TILE SIZE (like city game does)
  // Base width is TILE_WIDTH * 1.2, then apply sprite-specific scale
  const baseWidth = TILE_WIDTH * 1.2;
  const destWidth = baseWidth * scale;
  
  // Maintain aspect ratio from the source sprite
  const aspectRatio = rect.sh / rect.sw;
  const destHeight = destWidth * aspectRatio;
  
  // Scale offsets proportionally: old sprites were ~400px, new are ~77px (TILE_WIDTH * 1.2)
  // So offsets need to be scaled down by approximately destWidth / rect.sw
  const offsetScale = destWidth / rect.sw;
  const offsetX = (sprite.offsetX || 0) * offsetScale;
  const offsetY = (sprite.offsetY || 0) * offsetScale;
  
  // Position sprite: center horizontally, anchor to bottom of tile with offset
  const drawX = x + (TILE_WIDTH - destWidth) / 2 + offsetX;
  // Anchor to tile bottom and push up by sprite height, then apply vertical offset
  const drawY = y + TILE_HEIGHT - destHeight + offsetY;
  
  ctx.drawImage(
    sheetCanvas,
    rect.sx, rect.sy, rect.sw, rect.sh,
    drawX, drawY, destWidth, destHeight
  );
  
  return true;
}

function drawTrackSegment(
  ctx: CanvasRenderingContext2D,
  trackPiece: Tile['trackPiece'],
  x: number,
  y: number,
  tick: number
) {
  if (!trackPiece) return;
  
  const { type, direction, startHeight, endHeight, chainLift } = trackPiece;
  
  if (type === 'straight_flat' || type === 'lift_hill_start' || type === 'lift_hill_middle' || type === 'lift_hill_end') {
    drawStraightTrack(ctx, x, y, direction, startHeight);
  } else if (type === 'turn_left_flat' || type === 'turn_right_flat') {
    drawCurvedTrack(ctx, x, y, direction, type === 'turn_right_flat', startHeight);
  } else if (type === 'slope_up_small' || type === 'slope_down_small') {
    drawSlopeTrack(ctx, x, y, direction, startHeight, endHeight);
  } else if (type === 'loop_vertical') {
    drawLoopTrack(ctx, x, y, direction, Math.max(3, endHeight + 3));
  } else {
    // Default fallback to straight for unimplemented pieces
    drawStraightTrack(ctx, x, y, direction, startHeight);
  }
  
  if (chainLift) {
    drawChainLift(ctx, x, y, direction, startHeight, endHeight, tick);
  }
}

const TRACK_DIR_VECTORS: Record<string, { x: number; y: number }> = {
  north: { x: -TILE_WIDTH / 2, y: -TILE_HEIGHT / 2 },
  east: { x: TILE_WIDTH / 2, y: -TILE_HEIGHT / 2 },
  south: { x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 },
  west: { x: -TILE_WIDTH / 2, y: TILE_HEIGHT / 2 },
};

function bezierPoint(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }, t: number) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function getTrackPoint(
  trackPiece: NonNullable<Tile['trackPiece']>,
  centerX: number,
  centerY: number,
  t: number
) {
  const dirVec = TRACK_DIR_VECTORS[trackPiece.direction];
  const heightOffset = trackPiece.startHeight + (trackPiece.endHeight - trackPiece.startHeight) * t;
  const elevatedCenterY = centerY - heightOffset * HEIGHT_UNIT;
  
  if (trackPiece.type === 'turn_left_flat' || trackPiece.type === 'turn_right_flat') {
    const turnRight = trackPiece.type === 'turn_right_flat';
    const length = Math.sqrt(dirVec.x * dirVec.x + dirVec.y * dirVec.y);
    const dir = { x: dirVec.x / length, y: dirVec.y / length };
    const radius = TILE_WIDTH * 0.4;
    const turnMult = turnRight ? 1 : -1;
    const perp = { x: -dir.y * turnMult, y: dir.x * turnMult };
    
    const p0 = { x: centerX - dir.x * radius, y: elevatedCenterY - dir.y * radius };
    const p3 = { x: centerX + perp.x * radius, y: elevatedCenterY + perp.y * radius };
    const p1 = { x: p0.x + dir.x * radius * 0.5, y: p0.y + dir.y * radius * 0.5 };
    const p2 = { x: p3.x - perp.x * radius * 0.5, y: p3.y - perp.y * radius * 0.5 };
    
    return bezierPoint(p0, p1, p2, p3, t);
  }
  
  if (trackPiece.type === 'loop_vertical') {
    const radius = TILE_WIDTH * 0.12;
    const angle = t * Math.PI * 2;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: elevatedCenterY - Math.sin(angle) * radius * 0.6,
    };
  }
  
  // Straight or slope segments
  const start = {
    x: centerX - dirVec.x * 0.4,
    y: elevatedCenterY - dirVec.y * 0.4,
  };
  const end = {
    x: centerX + dirVec.x * 0.4,
    y: elevatedCenterY + dirVec.y * 0.4,
  };
  
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

// Direction angles for isometric view (matching train system)
const DIRECTION_ANGLES: Record<string, number> = {
  north: Math.atan2(-TILE_HEIGHT / 2, -TILE_WIDTH / 2),
  south: Math.atan2(TILE_HEIGHT / 2, TILE_WIDTH / 2),
  east: Math.atan2(-TILE_HEIGHT / 2, TILE_WIDTH / 2),
  west: Math.atan2(TILE_HEIGHT / 2, -TILE_WIDTH / 2),
};

function drawCoasterCar(ctx: CanvasRenderingContext2D, x: number, y: number, direction: string) {
  const angle = DIRECTION_ANGLES[direction] ?? 0;
  
  // Car dimensions (similar to train cars but slightly smaller)
  const carLength = 14;
  const carWidth = 4;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, carLength * 0.45, carWidth * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Main body (red)
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(-carLength * 0.45, -carWidth);
  ctx.lineTo(carLength * 0.35, -carWidth);
  ctx.lineTo(carLength * 0.45, -carWidth * 0.5);
  ctx.lineTo(carLength * 0.45, carWidth * 0.5);
  ctx.lineTo(carLength * 0.35, carWidth);
  ctx.lineTo(-carLength * 0.45, carWidth);
  ctx.closePath();
  ctx.fill();
  
  // Darker back section
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(-carLength * 0.45, -carWidth * 0.8, carLength * 0.25, carWidth * 1.6);
  
  // Yellow stripe/highlight
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(-carLength * 0.15, -carWidth * 0.9, carLength * 0.4, carWidth * 0.3);
  ctx.fillRect(-carLength * 0.15, carWidth * 0.6, carLength * 0.4, carWidth * 0.3);
  
  // Front detail
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.arc(carLength * 0.3, 0, carWidth * 0.4, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

// =============================================================================
// COMPONENT
// =============================================================================

interface CoasterGridProps {
  selectedTile: { x: number; y: number } | null;
  setSelectedTile: (tile: { x: number; y: number } | null) => void;
  navigationTarget?: { x: number; y: number } | null;
  onNavigationComplete?: () => void;
  onViewportChange?: (viewport: {
    offset: { x: number; y: number };
    zoom: number;
    canvasSize: { width: number; height: number };
  }) => void;
}

export function CoasterGrid({
  selectedTile,
  setSelectedTile,
  navigationTarget,
  onNavigationComplete,
  onViewportChange,
}: CoasterGridProps) {
  const { state, latestStateRef, placeAtTile, bulldozeTile, placeTrackLine } = useCoaster();
  const { grid, gridSize, selectedTool, tick } = state;
  
  // Check if current tool supports drag-to-draw
  const isTrackDragTool = useMemo(() => TRACK_DRAG_TOOLS.includes(selectedTool), [selectedTool]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [offset, setOffset] = useState({ x: 620, y: 160 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [spriteSheets, setSpriteSheets] = useState<Map<string, HTMLCanvasElement>>(new Map());
  const [waterImage, setWaterImage] = useState<HTMLImageElement | null>(null);
  
  // Track drag state (for drag-to-draw track/path)
  const [isTrackDragging, setIsTrackDragging] = useState(false);
  const [trackDragStartTile, setTrackDragStartTile] = useState<{ x: number; y: number } | null>(null);
  const [trackDragDirection, setTrackDragDirection] = useState<'h' | 'v' | null>(null);
  const [trackDragPreviewTiles, setTrackDragPreviewTiles] = useState<{ x: number; y: number }[]>([]);
  const placedTrackTilesRef = useRef<Set<string>>(new Set());
  
  // Load sprite sheets
  useEffect(() => {
    const loadSheets = async () => {
      const newSheets = new Map<string, HTMLCanvasElement>();
      
      for (const sheet of COASTER_SPRITE_PACK.sheets) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              const filtered = filterBackgroundColor(img);
              newSheets.set(sheet.id, filtered);
              resolve();
            };
            img.onerror = reject;
            img.src = sheet.src;
          });
        } catch (e) {
          console.error(`Failed to load sprite sheet ${sheet.id}:`, e);
        }
      }
      
      setSpriteSheets(newSheets);
    };
    
    loadSheets();
  }, []);
  
  // Load water texture
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setWaterImage(img);
    img.onerror = () => console.error('Failed to load water texture');
    img.src = WATER_ASSET_PATH;
  }, []);
  
  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Report viewport changes
  useEffect(() => {
    onViewportChange?.({ offset, zoom, canvasSize });
  }, [offset, zoom, canvasSize, onViewportChange]);
  
  // Navigate to target
  useEffect(() => {
    if (navigationTarget) {
      const { screenX, screenY } = gridToScreen(
        navigationTarget.x,
        navigationTarget.y,
        0,
        0
      );
      setOffset({
        x: canvasSize.width / 2 - screenX * zoom,
        y: canvasSize.height / 2 - screenY * zoom,
      });
      onNavigationComplete?.();
    }
  }, [navigationTarget, canvasSize, zoom, onNavigationComplete]);
  
  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    
    // Clear
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply transforms
    ctx.save();
    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(offset.x / zoom, offset.y / zoom);
    
    // Calculate visible bounds for culling
    const viewLeft = -offset.x / zoom - TILE_WIDTH;
    const viewTop = -offset.y / zoom - TILE_HEIGHT;
    const viewRight = canvasSize.width / zoom - offset.x / zoom + TILE_WIDTH;
    const viewBottom = canvasSize.height / zoom - offset.y / zoom + TILE_HEIGHT;
    
    const guestsByTile = new Map<string, typeof state.guests>();
    state.guests.forEach(guest => {
      const key = `${guest.tileX},${guest.tileY}`;
      const existing = guestsByTile.get(key);
      if (existing) {
        existing.push(guest);
      } else {
        guestsByTile.set(key, [guest]);
      }
    });
    
    const carsByTile = new Map<string, { x: number; y: number; direction: string }[]>();
    state.coasters.forEach(coaster => {
      if (coaster.track.length === 0 || coaster.trackTiles.length === 0) return;
      coaster.trains.forEach(train => {
        train.cars.forEach(car => {
          const trackIndex = Math.floor(car.trackProgress) % coaster.track.length;
          const t = car.trackProgress - Math.floor(car.trackProgress);
          const trackTile = coaster.trackTiles[trackIndex];
          const trackPiece = coaster.track[trackIndex];
          if (!trackTile || !trackPiece) return;

          const { screenX, screenY } = gridToScreen(trackTile.x, trackTile.y, 0, 0);
          const centerX = screenX + TILE_WIDTH / 2;
          const centerY = screenY + TILE_HEIGHT / 2;
          const pos = getTrackPoint(trackPiece, centerX, centerY, t);

          const key = `${trackTile.x},${trackTile.y}`;
          const existing = carsByTile.get(key);
          const carData = { ...pos, direction: trackPiece.direction };
          if (existing) {
            existing.push(carData);
          } else {
            carsByTile.set(key, [carData]);
          }
        });
      });
    });
    
    // Draw tiles (back to front for proper depth)
    for (let sum = 0; sum < gridSize * 2 - 1; sum++) {
      for (let x = 0; x <= sum; x++) {
        const y = sum - x;
        if (x >= gridSize || y >= gridSize || y < 0) continue;
        
        const { screenX, screenY } = gridToScreen(x, y, 0, 0);
        
        // Culling
        if (screenX < viewLeft || screenX > viewRight ||
            screenY < viewTop || screenY > viewBottom) continue;
        
const tile = grid[y][x];

        // Draw based on tile type
        if (tile.terrain === 'water') {
          drawWaterTile(ctx, screenX, screenY, x, y, grid, gridSize, waterImage, zoom);
        } else if (tile.queue) {
          drawQueueTile(ctx, screenX, screenY, x, y, grid, gridSize);
        } else if (tile.path) {
          drawPathTile(ctx, screenX, screenY, x, y, grid, gridSize);
        } else {
          drawGrassTile(ctx, screenX, screenY, zoom);
        }
        
        // Draw coaster track if present
        if (tile.trackPiece) {
          drawTrackSegment(ctx, tile.trackPiece, screenX, screenY, tick);
        }
        
        // Draw building sprite if present
        const buildingType = tile.building?.type;
        if (buildingType && buildingType !== 'empty' && buildingType !== 'grass' && 
            buildingType !== 'water' && buildingType !== 'path' && buildingType !== 'queue') {
          drawSprite(ctx, spriteSheets, buildingType, screenX, screenY);
        }
        
        // Draw guests on this tile
        const guests = guestsByTile.get(`${x},${y}`);
        if (guests) {
          guests.forEach(guest => {
            drawGuest(ctx, guest, tick);
          });
        }

        // Draw coaster cars on this tile
        const cars = carsByTile.get(`${x},${y}`);
        if (cars) {
          cars.forEach(car => {
            drawCoasterCar(ctx, car.x, car.y, car.direction);
          });
        }
        
        // Selection highlight
        if (selectedTile && selectedTile.x === x && selectedTile.y === y) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
          ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
          ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
          ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
          ctx.closePath();
          ctx.stroke();
        }
        
        // Track drag preview highlight (blue tint for preview tiles)
        const isPreviewTile = trackDragPreviewTiles.some(t => t.x === x && t.y === y);
        if (isPreviewTile && isTrackDragging) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
          ctx.beginPath();
          ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
          ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
          ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
          ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
          ctx.closePath();
          ctx.fill();
        }
        
        // Hover highlight
        if (hoveredTile && hoveredTile.x === x && hoveredTile.y === y && selectedTool !== 'select' && !isPreviewTile) {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
          ctx.beginPath();
          ctx.moveTo(screenX + TILE_WIDTH / 2, screenY);
          ctx.lineTo(screenX + TILE_WIDTH, screenY + TILE_HEIGHT / 2);
          ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT);
          ctx.lineTo(screenX, screenY + TILE_HEIGHT / 2);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    
    ctx.restore();
  }, [grid, gridSize, offset, zoom, canvasSize, tick, selectedTile, hoveredTile, selectedTool, spriteSheets, waterImage, state.guests, state.coasters, trackDragPreviewTiles, isTrackDragging]);
  
  // Helper to calculate tiles in a line from start to end (with direction locking)
  const calculateLineTiles = useCallback((
    start: { x: number; y: number },
    end: { x: number; y: number },
    direction: 'h' | 'v' | null
  ): { x: number; y: number }[] => {
    const tiles: { x: number; y: number }[] = [];
    
    // Lock to direction
    let targetX = end.x;
    let targetY = end.y;
    if (direction === 'h') {
      targetY = start.y;
    } else if (direction === 'v') {
      targetX = start.x;
    }
    
    // Calculate step direction
    const dx = targetX - start.x;
    const dy = targetY - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    
    if (steps === 0) {
      tiles.push({ x: start.x, y: start.y });
      return tiles;
    }
    
    const stepX = dx / steps;
    const stepY = dy / steps;
    
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(start.x + stepX * i);
      const y = Math.round(start.y + stepY * i);
      if (x >= 0 && y >= 0 && x < gridSize && y < gridSize) {
        // Avoid duplicates
        if (tiles.length === 0 || tiles[tiles.length - 1].x !== x || tiles[tiles.length - 1].y !== y) {
          tiles.push({ x, y });
        }
      }
    }
    
    return tiles;
  }, [gridSize]);
  
  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button or left click + Alt/Option key = force pan mode
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      e.preventDefault();
      return;
    }
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get the tile under the mouse
    const { gridX, gridY } = screenToGrid(
      mouseX / zoom,
      mouseY / zoom,
      offset.x / zoom,
      offset.y / zoom
    );
    
    const isValidTile = gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize;
    
    // If clicking outside the grid, start panning
    if (!isValidTile) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }
    
    // If it's a track drag tool and we're on a valid tile, start track dragging
    if (isTrackDragTool && isValidTile) {
      setIsTrackDragging(true);
      setTrackDragStartTile({ x: gridX, y: gridY });
      setTrackDragDirection(null);
      setTrackDragPreviewTiles([{ x: gridX, y: gridY }]);
      placedTrackTilesRef.current.clear();
      placedTrackTilesRef.current.add(`${gridX},${gridY}`);
      // Place immediately on first click
      placeAtTile(gridX, gridY);
    } else if (selectedTool === 'select') {
      // Select tool just selects, doesn't pan
      setSelectedTile({ x: gridX, y: gridY });
    } else if (selectedTool === 'bulldoze') {
      // Bulldoze immediately on click
      bulldozeTile(gridX, gridY);
    } else {
      // Other tools (shops, decorations, etc.) - place on click
      placeAtTile(gridX, gridY);
    }
  }, [offset, zoom, gridSize, isTrackDragTool, selectedTool, placeAtTile, bulldozeTile, setSelectedTile]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Get the tile under the mouse
    const { gridX, gridY } = screenToGrid(
      mouseX / zoom,
      mouseY / zoom,
      offset.x / zoom,
      offset.y / zoom
    );
    
    // Update hovered tile
    if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
      setHoveredTile({ x: gridX, y: gridY });
    } else {
      setHoveredTile(null);
    }
    
    if (isTrackDragging && trackDragStartTile) {
      // Track dragging mode
      const dx = Math.abs(gridX - trackDragStartTile.x);
      const dy = Math.abs(gridY - trackDragStartTile.y);
      
      // Lock direction after moving at least 1 tile
      let direction = trackDragDirection;
      if (!direction && (dx > 0 || dy > 0)) {
        direction = dx >= dy ? 'h' : 'v';
        setTrackDragDirection(direction);
      }
      
      // Calculate tiles along the locked axis
      const lineTiles = calculateLineTiles(trackDragStartTile, { x: gridX, y: gridY }, direction);
      setTrackDragPreviewTiles(lineTiles);
      
      // Place track on new tiles as we drag
      for (const tile of lineTiles) {
        const key = `${tile.x},${tile.y}`;
        if (!placedTrackTilesRef.current.has(key)) {
          placedTrackTilesRef.current.add(key);
          placeAtTile(tile.x, tile.y);
        }
      }
    } else if (isDragging) {
      // View panning mode
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, isTrackDragging, dragStart, offset, zoom, gridSize, trackDragStartTile, trackDragDirection, calculateLineTiles, placeAtTile]);
  
  const handleMouseUp = useCallback(() => {
    if (isTrackDragging) {
      // Finish track dragging
      setIsTrackDragging(false);
      setTrackDragStartTile(null);
      setTrackDragDirection(null);
      setTrackDragPreviewTiles([]);
      placedTrackTilesRef.current.clear();
      return;
    }
    
    // End view panning
    setIsDragging(false);
  }, [isTrackDragging]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * zoomFactor));
    
    // Zoom toward mouse position
    const zoomRatio = newZoom / zoom;
    setOffset({
      x: mouseX - (mouseX - offset.x) * zoomRatio,
      y: mouseY - (mouseY - offset.y) * zoomRatio,
    });
    setZoom(newZoom);
  }, [zoom, offset]);
  
  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        className="block cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setIsTrackDragging(false);
          setTrackDragStartTile(null);
          setTrackDragDirection(null);
          setTrackDragPreviewTiles([]);
          placedTrackTilesRef.current.clear();
          setHoveredTile(null);
        }}
        onWheel={handleWheel}
      />
    </div>
  );
}
