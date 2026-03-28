export default {
  money: 100000,
  moneyWin: 0,
  win: 0,
  betAmount: 10,

  // Sugar Rush 1000 paytable: 7 symbols × 11 cluster tiers (5 through 15+)
  // Values are multipliers of the bet amount
  payvalues: [
    [0.2, 0.25, 0.3, 0.4, 0.5, 1, 1.5, 2.5, 5, 10, 20],       // ID 0: Orange Bear (lowest)
    [0.25, 0.3, 0.4, 0.5, 0.75, 1.25, 2, 3, 6, 12, 25],        // ID 1: Purple Bear
    [0.3, 0.4, 0.5, 0.75, 1, 1.5, 2.5, 3.5, 8, 15, 30],        // ID 2: Red Bear
    [0.4, 0.5, 0.75, 1, 1.25, 2, 3, 5, 10, 20, 40],             // ID 3: Green Candy
    [0.5, 0.75, 1, 1.25, 1.5, 3, 4.5, 10, 20, 40, 60],          // ID 4: Purple Candy
    [0.75, 1, 1.25, 1.5, 2, 4, 6, 12.5, 30, 60, 100],           // ID 5: Orange Candy
    [1, 1.5, 1.75, 2, 2.5, 5, 7.5, 15, 35, 70, 150],            // ID 6: Pink Candy (highest)
  ],

  // Symbol spawn weights (higher = more common). Must sum to 100.
  symbolWeights: [18, 17, 16, 14, 13, 12, 10],

  // Scatter (free spin trigger) probability per cell: ~2%
  scatterChance: 0.02,

  // Free spins awarded by scatter count
  freeSpinsByScatter: { 3: 10, 4: 15, 5: 20, 6: 25, 7: 30 } as Record<number, number>,

  gridSize: 7,
  checkClick: false,
  symbolSize: 100,
  cascadeDelay: 150,
  clusterExplodeDuration: 300,
};
