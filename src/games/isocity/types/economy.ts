/**
 * IsoCity Economy Types
 * 
 * Economy-related types for the city builder game.
 * Covers budgets, taxes, stats, and city economics.
 */

// ============================================================================
// STATS
// ============================================================================

export interface Stats {
  population: number;
  jobs: number;
  money: number;
  income: number;
  expenses: number;
  happiness: number;
  health: number;
  education: number;
  safety: number;
  environment: number;
  demand: {
    residential: number;
    commercial: number;
    industrial: number;
  };
}

// ============================================================================
// BUDGET
// ============================================================================

export interface BudgetCategory {
  name: string;
  funding: number;
  cost: number;
}

export interface Budget {
  police: BudgetCategory;
  fire: BudgetCategory;
  health: BudgetCategory;
  education: BudgetCategory;
  transportation: BudgetCategory;
  parks: BudgetCategory;
  power: BudgetCategory;
  water: BudgetCategory;
}

// ============================================================================
// CITY ECONOMY (for multi-city support)
// ============================================================================

/** Cached economy data for a city */
export interface CityEconomy {
  population: number;
  jobs: number;
  income: number;
  expenses: number;
  happiness: number;
  /** Timestamp of last calculation for cache invalidation */
  lastCalculated: number;
}

// ============================================================================
// HISTORY
// ============================================================================

export interface HistoryPoint {
  year: number;
  month: number;
  population: number;
  money: number;
  happiness: number;
}
