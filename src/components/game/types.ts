// Rendering types for isometric games
// This file re-exports types for backward compatibility.
// New code should import directly from:
// - @/core/types for shared rendering infrastructure
// - @/games/isocity/types for IsoCity-specific entities

// ============================================================================
// Core Rendering Types (shared across all games)
// ============================================================================

export {
  TILE_WIDTH,
  TILE_HEIGHT,
  HEIGHT_RATIO,
  KEY_PAN_SPEED,
  type CardinalDirection,
  type Particle,
  type PhysicsParticle,
  type DirectionMeta as CoreDirectionMeta,
} from '@/core/types';

// ============================================================================
// IsoCity Entity Types (game-specific)
// ============================================================================

// Re-export all IsoCity entities for backward compatibility
export {
  // Direction types
  type CarDirection,
  type DirectionMeta,
  // Ground vehicles
  type Car,
  type EmergencyVehicleType,
  type EmergencyVehicleState,
  type EmergencyVehicle,
  // Aircraft
  type AirplaneState,
  type PlaneType,
  type ContrailParticle,
  type Airplane,
  type SeaplaneState,
  type Seaplane,
  type HelicopterState,
  type RotorWashParticle,
  type Helicopter,
  // Pedestrians
  type PedestrianDestType,
  type PedestrianState,
  type PedestrianActivity,
  type RecreationAreaType,
  type Pedestrian,
  // Water vehicles
  type BoatState,
  type WakeParticle,
  type TourWaypoint,
  type Boat,
  type BargeState,
  type Barge,
  // Trains
  type CarriageType,
  type TrainType,
  type TrainSmokeParticle,
  type TrainCarriage,
  type Train,
  // Visual effects
  type SmogParticle,
  type FactorySmog,
  type FireworkState,
  type FireworkParticle,
  type Firework,
  // Service overlays
  type OverlayMode,
} from '@/games/isocity/types';

// ============================================================================
// Rendering State Types
// ============================================================================

// World render state - uses IsoCity Tile type
export type WorldRenderState = {
  grid: import('@/types/game').Tile[][];
  gridSize: number;
  offset: { x: number; y: number };
  zoom: number;
  speed: number;
  canvasSize: { width: number; height: number };
};
