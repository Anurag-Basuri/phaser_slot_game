export default {
  money: 100000,
  moneyWin: 0,
  win: 0,
  betAmount: 10,

  // Sweet Cluster 1000 paytable: 7 symbols × 11 cluster tiers (5 through 15+)
  // Values are multipliers of the bet amount
  // Validated RTP: ~96.56% via 200K Monte Carlo simulations
  payvalues: [
    [0.38, 0.48, 0.57, 0.76, 0.95, 1.90, 2.85, 4.75, 9.50, 19.00, 38.00],    // ID 0: Red Gummy Bear (lowest)
    [0.48, 0.57, 0.76, 0.95, 1.43, 2.38, 3.80, 5.70, 11.40, 22.80, 47.50],    // ID 1: Yellow Star
    [0.57, 0.76, 0.95, 1.43, 1.90, 2.85, 4.75, 6.65, 15.20, 28.50, 57.00],    // ID 2: Purple Jelly Bean
    [0.76, 0.95, 1.43, 1.90, 2.38, 3.80, 5.70, 9.50, 19.00, 38.00, 76.00],    // ID 3: Green Candy
    [0.95, 1.43, 1.90, 2.38, 2.85, 5.70, 8.55, 19.00, 38.00, 76.00, 114.00],  // ID 4: Pink Heart
    [1.43, 1.90, 2.38, 2.85, 3.80, 7.60, 11.40, 23.75, 57.00, 114.00, 190.00],// ID 5: Orange Slice
    [1.90, 2.85, 3.33, 3.80, 4.75, 9.50, 14.25, 28.50, 66.50, 133.00, 285.00],// ID 6: Blue Gumdrop (highest)
  ],

  // Symbol spawn weights (higher = more common). Must sum to 100.
  symbolWeights: [18, 17, 16, 14, 13, 12, 10],

  // Scatter (free spin trigger) probability per cell: 2.0%
  scatterChance: 0.02,

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
