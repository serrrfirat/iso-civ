/**
 * Core rendering types shared across all games
 * 
 * These types handle viewport, camera, and canvas rendering concepts
 * that are common to any isometric game.
 */

import { GridPosition, ScreenPosition, GridBounds } from './grid';

// Re-export grid types commonly used with rendering
export type { ScreenPosition, GridPosition, GridBounds };

// ============================================================================
// ISOMETRIC CONSTANTS
// ============================================================================

/**
 * Standard isometric tile dimensions
 * These can be overridden per-game if needed
 */
export const DEFAULT_TILE_WIDTH = 64;
export const DEFAULT_HEIGHT_RATIO = 0.60;
export const DEFAULT_TILE_HEIGHT = DEFAULT_TILE_WIDTH * DEFAULT_HEIGHT_RATIO;

// ============================================================================
// CAMERA/VIEWPORT TYPES
// ============================================================================

/**
 * Camera state for panning and zooming the view
 */
export interface CameraState {
  /** Offset from origin in screen pixels */
  offset: ScreenPosition;
  /** Current zoom level (1.0 = 100%) */
  zoom: number;
}

/**
 * Canvas/viewport dimensions
 */
export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Full viewport state combining camera and size
 */
export interface ViewportState extends CameraState {
  canvasSize: ViewportSize;
}

// ============================================================================
// RENDER STATE TYPES
// ============================================================================

/**
 * Base world render state that games extend with their specific grid types
 */
export interface BaseWorldRenderState {
  gridSize: number;
  offset: ScreenPosition;
  zoom: number;
  speed: number;
  canvasSize: ViewportSize;
}

// ============================================================================
// COORDINATE CONVERSION UTILITIES
// ============================================================================

/**
 * Convert grid coordinates to screen coordinates (isometric projection)
 */
export function gridToScreen(
  gridX: number,
  gridY: number,
  tileWidth: number = DEFAULT_TILE_WIDTH,
  tileHeight: number = DEFAULT_TILE_HEIGHT
): ScreenPosition {
  return {
    x: (gridX - gridY) * (tileWidth / 2),
    y: (gridX + gridY) * (tileHeight / 2),
  };
}

/**
 * Convert screen coordinates to grid coordinates (inverse isometric projection)
 */
export function screenToGrid(
  screenX: number,
  screenY: number,
  tileWidth: number = DEFAULT_TILE_WIDTH,
  tileHeight: number = DEFAULT_TILE_HEIGHT
): GridPosition {
  const x = (screenX / (tileWidth / 2) + screenY / (tileHeight / 2)) / 2;
  const y = (screenY / (tileHeight / 2) - screenX / (tileWidth / 2)) / 2;
  return { x: Math.floor(x), y: Math.floor(y) };
}

/**
 * Check if a grid position is within bounds
 */
export function isInBounds(pos: GridPosition, bounds: GridBounds): boolean {
  return pos.x >= bounds.minX && pos.x <= bounds.maxX && 
         pos.y >= bounds.minY && pos.y <= bounds.maxY;
}

/**
 * Check if a grid position is within a grid of given size (0 to size-1)
 */
export function isInGrid(pos: GridPosition, gridSize: number): boolean {
  return pos.x >= 0 && pos.x < gridSize && pos.y >= 0 && pos.y < gridSize;
}
