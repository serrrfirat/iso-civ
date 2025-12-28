// IsoCity service coverage type definitions

export interface ServiceCoverage {
  police: number[][];
  fire: number[][];
  health: number[][];
  education: number[][];
  power: boolean[][];
  water: boolean[][];
}

/**
 * Overlay modes for visualizing city services
 * Each mode highlights different service coverage on the map
 */
export type OverlayMode = 'none' | 'power' | 'water' | 'fire' | 'police' | 'health' | 'education' | 'subway';
