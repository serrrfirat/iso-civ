/**
 * Core entity types shared across all games
 * 
 * These types represent moving objects (vehicles, units, etc.) that
 * exist in the game world but are not tied to the grid.
 */

import { GridPosition, ScreenPosition, CardinalDirection } from './grid';

// ============================================================================
// BASE ENTITY TYPES
// ============================================================================

/**
 * Base interface for any entity that moves in the world
 */
export interface BaseEntity {
  id: number;
}

/**
 * Entity that moves on grid tiles (cars, pedestrians, trains)
 */
export interface GridEntity extends BaseEntity {
  /** Current tile position */
  tileX: number;
  tileY: number;
  /** Movement direction */
  direction: CardinalDirection;
  /** Progress through current tile (0-1) */
  progress: number;
  /** Movement speed */
  speed: number;
}

/**
 * Entity that moves freely in screen space (planes, helicopters, boats)
 */
export interface FreeEntity extends BaseEntity {
  /** Screen position */
  x: number;
  y: number;
  /** Movement angle in radians */
  angle: number;
  /** Movement speed (pixels per second) */
  speed: number;
}

// ============================================================================
// PATH-FOLLOWING ENTITIES
// ============================================================================

/**
 * Entity that follows a predefined path
 */
export interface PathFollowingEntity extends GridEntity {
  /** Path to follow */
  path: GridPosition[];
  /** Current position in path */
  pathIndex: number;
}

// ============================================================================
// LIFECYCLE TYPES
// ============================================================================

/**
 * Entity with age/lifetime tracking
 */
export interface MortalEntity {
  /** Current age */
  age: number;
  /** Maximum age before despawn */
  maxAge: number;
}

// ============================================================================
// PARTICLE TYPES
// ============================================================================

/**
 * Base particle for effects (smoke, wake, contrails)
 */
export interface BaseParticle {
  x: number;
  y: number;
  age: number;
  opacity: number;
}

/**
 * Particle with velocity
 */
export interface MovingParticle extends BaseParticle {
  vx: number;
  vy: number;
  maxAge: number;
  size: number;
}
