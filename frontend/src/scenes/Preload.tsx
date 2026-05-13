import Phaser from 'phaser';

export class Preload extends Phaser.Scene {
  constructor() {
    super({ key: 'Preload' });
  }

  preload() {
    // Update HTML overlay text during load
    this.load.on('progress', (value: number) => {
      const textElem = document.getElementById('loadingText');
      if (textElem) {
        textElem.innerText = `${Math.floor(value * 100)}%`;
      }
    });

    // Hide HTML overlay once load is complete
    this.load.on('complete', () => {
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => overlay.remove(), 600);
      }
    });

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

    // Premium UI Assets
    this.load.image('btn_spin', 'images/ui/btn_spin.png');
    this.load.svg('icon_sound', 'icons/sound.svg', { width: 32, height: 32 });
    this.load.svg('icon_sound_off', 'icons/sound-off.svg', { width: 32, height: 32 });
    this.load.svg('icon_settings', 'icons/settings.svg', { width: 32, height: 32 });
    this.load.svg('icon_lightning', 'icons/lightning.svg', { width: 32, height: 32 });
    this.load.svg('icon_auto', 'icons/auto.svg', { width: 32, height: 32 });
    this.load.svg('icon_spin', 'icons/spin.svg', { width: 32, height: 32 });
    this.load.svg('icon_info', 'icons/info.svg', { width: 32, height: 32 });
    this.load.svg('icon_fullscreen', 'icons/fullscreen.svg', { width: 32, height: 32 });

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
