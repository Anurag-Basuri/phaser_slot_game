/**
 * Sweet Cluster 1000 — Game Configuration
 * 
 * Bet system mirrors Pragmatic Play's Sugar Rush 1000:
 * - Coin values: 0.01 → 0.50
 * - Bet levels:  1 → 10
 * - Total bet = coinValue × betLevel × 20 (fixed lines multiplier)
 * - Min bet: 0.20, Max bet: 240.00
 */

// Sugar Rush 1000–style bet presets (total bet amounts)
// Official range: $0.20 min → $240.00 max
export const BET_PRESETS = [
  0.20, 0.40, 0.60, 0.80, 1.00,
  2.00, 3.00, 4.00, 5.00,
  10.00, 15.00, 20.00, 25.00, 30.00,
  40.00, 50.00, 75.00, 100.00,
  125.00, 150.00, 175.00, 200.00, 240.00,
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

  // Official Sugar Rush 1000 paytable: 7 symbols × 11 cluster tiers (5 through 15+)
  // Values are multipliers of the bet amount (verified against Pragmatic Play reference)
  payvalues: [
    [0.40, 0.60, 0.80, 1.00, 1.00, 2.00, 3.00,  5.00, 10.00,  20.00,  40.00],  // ID 0: Orange Sherbet Ball
    [0.50, 0.60, 0.80, 1.00, 1.50, 2.50, 4.00,  6.00, 12.00,  24.00,  50.00],  // ID 1: Blue Spiral Lollipop
    [0.60, 0.80, 1.00, 1.50, 2.00, 3.00, 5.00,  7.00, 16.00,  30.00,  60.00],  // ID 2: Green Wrapped Toffee
    [0.80, 1.00, 1.50, 2.00, 2.50, 4.00, 6.00, 10.00, 20.00,  40.00,  80.00],  // ID 3: Yellow Star Candy
    [1.00, 1.50, 2.00, 2.50, 3.00, 6.00, 9.00, 20.00, 40.00,  80.00, 120.00],  // ID 4: Red Candy Cane
    [1.50, 2.00, 2.50, 3.00, 4.00, 8.00,12.00, 25.00, 60.00, 120.00, 200.00],  // ID 5: Purple Gumball
    [2.00, 3.00, 3.50, 4.00, 5.00,10.00,15.00, 30.00, 70.00, 140.00, 300.00],  // ID 6: Teal Rock Candy
  ],

  // Symbol spawn weights (higher = more common). Must sum to 100.
  symbolWeights: [19, 17, 16, 14, 13, 12, 9],

  // Scatter (free spin trigger) probability per cell
  scatterChance: 0.02,           // Base: 2.0%
  scatterChanceAnte: 0.04,      // With Ante Bet: 4.0%

  // Free spins awarded by scatter count
  freeSpinsByScatter: { 3: 10, 4: 12, 5: 15, 6: 20, 7: 30 } as Record<number, number>,

  gridSize: 7,
  symbolSize: 100,
  cascadeDelay: 150,
  clusterExplodeDuration: 300,

  // Max win cap
  maxWinMultiplier: 25000,
};
