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
  // 11 tiers (5 symbols ... 15+)
  payvalues: [
    [0.2, 0.25, 0.3, 0.4, 0.5, 1, 1.5, 2.5, 5, 10, 20],      // ID 0: Lowest
    [0.25, 0.3, 0.4, 0.5, 0.75, 1.25, 2, 3, 6, 12, 25],      // ID 1
    [0.3, 0.4, 0.5, 0.75, 1, 1.5, 2.5, 3.5, 8, 15, 30],      // ID 2
    [0.4, 0.5, 0.75, 1, 1.25, 2, 3, 5, 10, 20, 40],          // ID 3
    [0.5, 0.75, 1, 1.25, 1.5, 3, 4.5, 10, 20, 40, 60],       // ID 4
    [0.75, 1, 1.25, 1.5, 2, 4, 6, 12.5, 30, 60, 100],        // ID 5
    [1, 1.5, 1.75, 2, 2.5, 5, 7.5, 15, 35, 70, 150],         // ID 6: Highest (Pink Candy eq)
  ],

  gridSize: 7, // 7x7 Grid
  checkClick: false,
  symbolSize: 100, // HD size grid
  cascadeDelay: 150, 
  clusterExplodeDuration: 300, 
  
  i: 0,
  hsv: Phaser.Display.Color.HSVColorWheel(),
};
