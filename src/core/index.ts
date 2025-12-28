// Core module index - shared isometric game infrastructure
// ============================================================================
// This module contains the foundational types and utilities that are shared
// across all isometric games built on this engine.
//
// Types exported here:
// - Grid types: BaseTile, BaseBuilding, BaseGameState, Coords, Bounds
// - Rendering: TILE_WIDTH, TILE_HEIGHT, CardinalDirection, Particle, etc.
// - Entities: BaseEntity, TileEntity, FreeEntity
//
// Games extend these base types with their specific mechanics:
// - IsoCity extends BaseTile with zone, building, landValue, etc.
// - A future RTS would extend BaseTile with terrain, resources, visibility
// ============================================================================

export * from './types';
