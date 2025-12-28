// Games module index
// ============================================================================
// This module contains game-specific types, configurations, and logic
// for different games that share the isometric rendering engine.
//
// Architecture:
// - @/core/ contains shared isometric infrastructure (grid, rendering, entities)
// - @/games/<game>/ contains game-specific implementations
// - Each game extends the core base types with its own mechanics
//
// Adding a new game:
// 1. Create @/games/<gamename>/types/ with game-specific types extending core
// 2. Create @/games/<gamename>/index.ts to export the types
// 3. Add the game export below
// ============================================================================

// Currently available games:
export * as isocity from './isocity';
