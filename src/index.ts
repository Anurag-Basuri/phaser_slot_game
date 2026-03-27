import Phaser from 'phaser';

import config from './config';

export default class Game {
  constructor() {
    new Phaser.Game(config);
  }
}

const game = new Game();
