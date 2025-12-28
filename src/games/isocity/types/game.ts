// IsoCity game state type definitions
// Extends core base types with city-builder specific properties

import { BaseTile, BaseGameState, Bounds } from '@/core/types';
import { Building, Tool } from './buildings';
import { ZoneType } from './zones';
import { Stats, Budget, CityEconomy } from './economy';
import { ServiceCoverage } from './services';

/**
 * IsoCity Tile - extends BaseTile with city-builder specific properties
 */
export interface Tile extends BaseTile {
  zone: ZoneType;
  building: Building;
  landValue: number;
  pollution: number;
  crime: number;
  traffic: number;
  hasSubway: boolean;
  hasRailOverlay?: boolean; // Rail tracks overlaid on road (road base with rail tracks on top)
}

/**
 * City definition for multi-city maps
 */
export interface City {
  id: string;
  name: string;
  // Bounds of the city (inclusive tile coordinates)
  bounds: Bounds;
  // Economy stats (cached for performance)
  economy: CityEconomy;
  // City color for border rendering
  color: string;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  icon: string;
  timestamp: number;
}

export interface AdvisorMessage {
  name: string;
  icon: string;
  messages: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface HistoryPoint {
  year: number;
  month: number;
  population: number;
  money: number;
  happiness: number;
}

export interface AdjacentCity {
  id: string;
  name: string;
  direction: 'north' | 'south' | 'east' | 'west';
  connected: boolean;
  discovered: boolean; // City becomes discovered when a road reaches its edge
}

export interface WaterBody {
  id: string;
  name: string;
  type: 'lake' | 'ocean';
  tiles: { x: number; y: number }[];
  centerX: number;
  centerY: number;
}

/**
 * IsoCity GameState - extends BaseGameState with city-builder specific state
 * Implements the core game loop properties (id, grid, gridSize, speed, tick)
 * plus all city-building specific features.
 */
export interface GameState extends BaseGameState {
  // Override grid to use IsoCity-specific Tile type
  grid: Tile[][];
  // City identity
  cityName: string;
  // Time tracking (city-builder uses calendar time)
  year: number;
  month: number;
  day: number;
  hour: number; // 0-23 for day/night cycle
  // Player interaction
  selectedTool: Tool;
  // Economy
  taxRate: number;
  effectiveTaxRate: number; // Lagging tax rate that gradually moves toward taxRate (affects demand)
  stats: Stats;
  budget: Budget;
  // City services
  services: ServiceCoverage;
  // UI state
  notifications: Notification[];
  advisorMessages: AdvisorMessage[];
  history: HistoryPoint[];
  activePanel: 'none' | 'budget' | 'statistics' | 'advisors' | 'settings';
  // Game settings
  disastersEnabled: boolean;
  // World map features
  adjacentCities: AdjacentCity[];
  waterBodies: WaterBody[];
  gameVersion: number; // Increments when a new game starts - used to clear transient state like vehicles
  cities: City[]; // Cities in the map (for multi-city support)
}

// Saved city metadata for the multi-save system
export interface SavedCityMeta {
  id: string; // Same as GameState.id
  cityName: string;
  population: number;
  money: number;
  year: number;
  month: number;
  gridSize: number;
  savedAt: number; // timestamp
  roomCode?: string; // For multiplayer cities - allows rejoining
}
