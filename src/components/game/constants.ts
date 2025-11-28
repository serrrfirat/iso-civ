import { BuildingType } from '@/types/game';
import { CarDirection, DirectionMeta, TILE_WIDTH, TILE_HEIGHT } from './types';

// Vehicle colors
export const CAR_COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc'];

// Pedestrian appearance colors
export const PEDESTRIAN_SKIN_COLORS = ['#fdbf7e', '#e0ac69', '#c68642', '#8d5524', '#613318'];
export const PEDESTRIAN_SHIRT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#1f2937'];

// Minimum zoom level to show pedestrians (zoomed in)
export const PEDESTRIAN_MIN_ZOOM = 0.5;

// Airplane system constants
export const AIRPLANE_MIN_POPULATION = 5000; // Minimum population required for airplane activity
export const AIRPLANE_COLORS = ['#ffffff', '#1e40af', '#dc2626', '#059669', '#7c3aed']; // Airline liveries
export const CONTRAIL_MAX_AGE = 3.0; // seconds
export const CONTRAIL_SPAWN_INTERVAL = 0.02; // seconds between contrail particles

// Helicopter system constants
export const HELICOPTER_MIN_POPULATION = 3000; // Minimum population required for helicopter activity
export const HELICOPTER_COLORS = ['#dc2626', '#ffffff', '#1e3a8a', '#f97316', '#059669']; // Red cross, white, navy, orange, green
export const ROTOR_WASH_MAX_AGE = 1.2; // seconds - shorter than plane contrails
export const ROTOR_WASH_SPAWN_INTERVAL = 0.04; // seconds between rotor wash particles

// Boat system constants
export const BOAT_COLORS = ['#ffffff', '#1e3a5f', '#8b4513', '#2f4f4f', '#c41e3a', '#1e90ff']; // Various boat hull colors
export const BOAT_MIN_ZOOM = 0.3; // Minimum zoom level to show boats
export const WAKE_MAX_AGE = 2.0; // seconds - how long wake particles last
export const WAKE_SPAWN_INTERVAL = 0.03; // seconds between wake particles

// Firework system constants
export const FIREWORK_BUILDINGS: BuildingType[] = ['baseball_stadium', 'amusement_park', 'marina_docks_small', 'pier_large'];
export const FIREWORK_COLORS = [
  '#ff4444', '#ff6b6b', // Reds
  '#44ff44', '#6bff6b', // Greens
  '#4444ff', '#6b6bff', // Blues
  '#ffff44', '#ffff6b', // Yellows
  '#ff44ff', '#ff6bff', // Magentas
  '#44ffff', '#6bffff', // Cyans
  '#ff8844', '#ffaa44', // Oranges
  '#ffffff', '#ffffee', // Whites
];
export const FIREWORK_PARTICLE_COUNT = 40; // Particles per explosion
export const FIREWORK_PARTICLE_SPEED = 120; // Initial particle velocity
export const FIREWORK_PARTICLE_MAX_AGE = 1.5; // seconds - how long particles last
export const FIREWORK_LAUNCH_SPEED = 180; // pixels per second upward
export const FIREWORK_SPAWN_INTERVAL_MIN = 0.3; // seconds between firework launches
export const FIREWORK_SPAWN_INTERVAL_MAX = 1.2; // seconds between firework launches
export const FIREWORK_SHOW_DURATION = 45; // seconds - how long a firework show lasts
export const FIREWORK_SHOW_CHANCE = 0.35; // 35% chance of fireworks on any given night

// Direction metadata helpers
function createDirectionMeta(step: { x: number; y: number }, vec: { dx: number; dy: number }): DirectionMeta {
  const length = Math.hypot(vec.dx, vec.dy) || 1;
  return {
    step,
    vec,
    angle: Math.atan2(vec.dy, vec.dx),
    normal: { nx: -vec.dy / length, ny: vec.dx / length },
  };
}

export const DIRECTION_META: Record<CarDirection, DirectionMeta> = {
  north: createDirectionMeta({ x: -1, y: 0 }, { dx: -TILE_WIDTH / 2, dy: -TILE_HEIGHT / 2 }),
  east: createDirectionMeta({ x: 0, y: -1 }, { dx: TILE_WIDTH / 2, dy: -TILE_HEIGHT / 2 }),
  south: createDirectionMeta({ x: 1, y: 0 }, { dx: TILE_WIDTH / 2, dy: TILE_HEIGHT / 2 }),
  west: createDirectionMeta({ x: 0, y: 1 }, { dx: -TILE_WIDTH / 2, dy: TILE_HEIGHT / 2 }),
};

export const OPPOSITE_DIRECTION: Record<CarDirection, CarDirection> = {
  north: 'south',
  east: 'west',
  south: 'north',
  west: 'east',
};
