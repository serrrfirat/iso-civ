/**
 * IsoCity Types Module
 * 
 * All IsoCity-specific types organized by domain.
 * This is the canonical source of IsoCity types.
 * 
 * Usage:
 *   import { GameState, Building, ZoneType } from '@/games/isocity/types';
 */

// Building types and constants
export * from './buildings';

// Zone types
export * from './zones';

// Economy types (budget, stats, taxes)
export * from './economy';

// Service types (police, fire, health, etc.)
export * from './services';

// Core game state types
export * from './game';
