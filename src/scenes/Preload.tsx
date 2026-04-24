import Phaser from 'phaser';
import { render } from 'phaser-jsx';

import { Progress } from '../components';

export class Preload extends Phaser.Scene {
  constructor() {
    super({ key: 'Preload' });
  }

  preload() {
    render(<Progress />, this);

    // Production candy symbols
    this.load.image('candy_0', 'images/candies/candy_0.png');
    this.load.image('candy_1', 'images/candies/candy_1.png');
    this.load.image('candy_2', 'images/candies/candy_2.png');
    this.load.image('candy_3', 'images/candies/candy_3.png');
    this.load.image('candy_4', 'images/candies/candy_4.png');
    this.load.image('candy_5', 'images/candies/candy_5.png');
    this.load.image('candy_6', 'images/candies/candy_6.png');

    // Wild and Scatter symbols
    this.load.image('wild', 'images/candies/wild.png');
    this.load.image('scatter', 'images/candies/scatter.png');

    // Scene background assets
    this.load.image('game_bg', 'images/user_bg_1.jpeg');
    this.load.image('grid_panel', 'images/user_bg_2.jpeg');

    // Audio (including previously unused lose.mp3)
    this.load.audio('backgroundDefault', 'audio/background-default.mp3');
    this.load.audio('reels', 'audio/reels.mp3');
    this.load.audio('reelStop', 'audio/reel_stop.mp3');
    this.load.audio('win', 'audio/win.mp3');
    this.load.audio('lose', 'audio/lose.mp3');
    this.load.audio('button', 'audio/button.mp3');
    this.load.audio('musicDefault', 'audio/music_default.mp3');
  }

  create() {
    this.scene.start('Boot');
  }
}
