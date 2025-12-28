/**
 * Core grid types shared across all games
 * 
 * These types represent the fundamental isometric grid system that can be
 * used by any game (IsoCity, Rise of Nations, etc.)
 */

// ============================================================================
// POSITION TYPES
// ============================================================================

/**
 * A position in grid/tile coordinates (integer x, y)
 */
export interface GridPosition {
  x: number;
  y: number;
}

/**
 * A position in screen/canvas coordinates (pixel x, y)
 */
export interface ScreenPosition {
  x: number;
  y: number;
}

/**
 * Rectangular bounds in grid coordinates
 */
export interface GridBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ============================================================================
// DIRECTION TYPES
// ============================================================================

/**
 * Cardinal directions for movement and orientation
 */
export type CardinalDirection = 'north' | 'east' | 'south' | 'west';

/**
 * Direction metadata for calculating movement vectors
 */
export interface DirectionMeta {
  /** Grid step for this direction */
  step: GridPosition;
  /** Screen-space movement vector */
  vec: { dx: number; dy: number };
  /** Angle in radians */
  angle: number;
  /** Normal vector perpendicular to movement */
  normal: { nx: number; ny: number };
}

// ============================================================================
// BASE TILE TYPES
// ============================================================================

/**
 * Base tile interface that all game-specific tiles should extend
 * Contains only the core properties needed for grid operations
 */
export interface BaseTile {
  x: number;
  y: number;
}

/**
 * Base building/structure interface that all game-specific buildings should extend
 */
export interface BaseBuilding {
  type: string;
}

// ============================================================================
// GRID UTILITY TYPES
// ============================================================================

/**
 * A 2D grid of tiles
 */
export type Grid<T extends BaseTile> = T[][];

/**
 * Path represented as a sequence of grid positions
 */
export type GridPath = GridPosition[];
