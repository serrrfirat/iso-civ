/**
 * Games Module
 * 
 * Re-exports all available games. Each game has its own types,
 * simulation logic, and rendering helpers.
 * 
 * Currently available:
 * - IsoCity: City builder simulation game
 * 
 * Coming soon:
 * - Rise of Nations style game: Age-based RTS with military and civilians
 */

// IsoCity - City builder game
export * as isocity from './isocity';

// Note: When adding new games, export them here:
// export * as riseofnations from './riseofnations';
