/**
 * IsoCity Service Types
 * 
 * City services like police, fire, health, education, and utilities.
 */

export interface ServiceCoverage {
  police: number[][];
  fire: number[][];
  health: number[][];
  education: number[][];
  power: boolean[][];
  water: boolean[][];
}
