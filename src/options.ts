import Phaser from 'phaser';

import type { Sprite } from './components';

export default {
  money: 100000,
  txtSpin: 'SPIN',
  txtAutoSpin: 'AUTO',
  txtAuto: 5,
  moneyWin: 0,
  txtMaxBet: 'MAXBET',
  coin: 10,
  txtCoin: 'COIN',
  line: 1,
  txtLine: 'LINES',
  txtInfo: 'INFO',
  win: 0,
  // Sugar Rush uses 7 basic candy symbols.
  // Cluster payvalues: nested array where index corresponds to symbol ID (0 to 6)
  // Inner array index corresponds to cluster size minus 5 (since min cluster is 5).
  // e.g. payvalues[0][0] is payout for 5 of symbol 0.
  // We'll define payouts for sizes: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15+] (11 values)
  payvalues: [
    [20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 500],   // Pink Heart (Highest)
    [15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300],    // Yellow Star
    [10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200],     // Purple Bean
    [8, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150],       // Green Square
    [5, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100],         // Red Bear
    [4, 6, 8, 10, 15, 20, 25, 30, 40, 50, 75],           // Orange Slice
    [3, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50],            // Blue Gumdrop
  ],

  gridSize: 7, // 7x7 Grid
  checkClick: false,
  symbolSize: 80, // Size of each candy symbol in the grid
  cascadeDelay: 150, // ms delay before tumbling
  clusterExplodeDuration: 300, // ms
  
  i: 0,
  hsv: Phaser.Display.Color.HSVColorWheel(),
};
