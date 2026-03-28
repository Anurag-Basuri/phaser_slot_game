/**
 * Sweet Cluster 1000 — Game Configuration
 * 
 * Bet system mirrors Pragmatic Play's Sugar Rush 1000:
 * - Coin values: 0.01 → 0.50
 * - Bet levels:  1 → 10
 * - Total bet = coinValue × betLevel × 20 (fixed lines multiplier)
 * - Min bet: 0.20, Max bet: 100.00
 */

// Sugar Rush-style bet presets (total bet amounts)
export const BET_PRESETS = [
  0.20, 0.40, 0.60, 0.80, 1.00,
  2.00, 3.00, 4.00, 5.00,
  10.00, 15.00, 20.00, 25.00, 30.00,
  40.00, 50.00, 75.00, 100.00,
];

export default {
  money: 100000,
  moneyWin: 0,
  win: 0,

  // Default bet (index into BET_PRESETS)
  betAmount: 1.00,     // current active bet
  defaultBetIndex: 4,  // BET_PRESETS[4] = 1.00

  // Ante Bet: costs 25% more per spin, doubles scatter chance
  anteBetEnabled: false,
  anteBetCostMultiplier: 1.25,       // 25% extra cost
  anteBetScatterMultiplier: 2.0,     // 2x scatter chance when ante is on

  // Sweet Cluster 1000 paytable: 7 symbols × 11 cluster tiers (5 through 15+)
  // Values are multipliers of the bet amount
  // Validated RTP: ~96% via Monte Carlo simulations
  payvalues: [
    [0.12, 0.16, 0.19, 0.25, 0.31, 0.62, 0.93, 1.55, 3.10, 6.20, 12.40],    // ID 0: Red Gummy Bear (lowest)
    [0.16, 0.19, 0.25, 0.31, 0.46, 0.78, 1.24, 1.86, 3.72, 7.44, 15.50],    // ID 1: Yellow Star
    [0.19, 0.25, 0.31, 0.46, 0.62, 0.93, 1.55, 2.17, 4.96, 9.30, 18.60],    // ID 2: Purple Jelly Bean
    [0.25, 0.31, 0.46, 0.62, 0.78, 1.24, 1.86, 3.10, 6.20, 12.40, 24.80],   // ID 3: Green Candy
    [0.31, 0.46, 0.62, 0.78, 0.93, 1.86, 2.79, 6.20, 12.40, 24.80, 37.20],  // ID 4: Pink Heart
    [0.46, 0.62, 0.78, 0.93, 1.24, 2.48, 3.72, 7.75, 18.60, 37.20, 62.00],  // ID 5: Orange Slice
    [0.62, 0.93, 1.09, 1.24, 1.55, 3.10, 4.65, 9.30, 21.70, 43.40, 93.00],  // ID 6: Blue Gumdrop (highest)
  ],

  // Symbol spawn weights (higher = more common). Must sum to 100.
  symbolWeights: [18, 17, 16, 14, 13, 12, 10],

  // Scatter (free spin trigger) probability per cell
  scatterChance: 0.02,           // Base: 2.0%
  scatterChanceAnte: 0.04,      // With Ante Bet: 4.0%

  // Free spins awarded by scatter count
  freeSpinsByScatter: { 3: 10, 4: 15, 5: 20, 6: 25, 7: 30 } as Record<number, number>,

  gridSize: 7,
  checkClick: false,
  symbolSize: 100,
  cascadeDelay: 150,
  clusterExplodeDuration: 300,

  // Max win cap
  maxWinMultiplier: 25000,
};
