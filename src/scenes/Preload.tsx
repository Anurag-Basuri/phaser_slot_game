import Phaser from 'phaser';
import { render } from 'phaser-jsx';

import { Progress } from '../components';

export class Preload extends Phaser.Scene {
  constructor() {
    super({ key: 'Preload' });
  }

  preload() {
    render(<Progress />, this);

    // Candy symbols
    this.load.image('candy_0', 'images/candies/red_gummy_bear_1774634801481.png');
    this.load.image('candy_1', 'images/candies/yellow_star_candy_1774634822477.png');
    this.load.image('candy_2', 'images/candies/purple_jelly_bean_1774634857270.png');
    this.load.image('candy_3', 'images/candies/green_square_candy_1774634879482.png');
    this.load.image('candy_4', 'images/candies/pink_heart_candy_1774634904495.png');
    this.load.image('candy_5', 'images/candies/orange_slice_candy_1774634928914.png');
    this.load.image('candy_6', 'images/candies/blue_gumdrop_1774634952667.png');

    // Scene assets
    this.load.image('candyland_bg', 'images/candyland_bg.png');
    this.load.image('gumball_rocket_btn', 'images/gumball_rocket_btn.png');
    this.load.image('scatter', 'images/gumball_scatter.png');

    // Audio
    this.load.audio('backgroundDefault', 'audio/background-default.mp3');
    this.load.audio('reels', 'audio/reels.mp3');
    this.load.audio('reelStop', 'audio/reel_stop.mp3');
    this.load.audio('win', 'audio/win.mp3');
    this.load.audio('button', 'audio/button.mp3');
    this.load.audio('lose', 'audio/lose.mp3');
    this.load.audio('musicDefault', 'audio/music_default.mp3');
  }

  create() {
    this.scene.start('Boot');
  }
}
