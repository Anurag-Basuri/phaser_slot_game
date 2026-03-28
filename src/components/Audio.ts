import type Phaser from 'phaser';

/**
 * Audio manager — handles all game sounds with proper volume levels.
 */
export class Audio {
  audioButton;
  audioLose;
  audioReelStop;
  audioReels;
  audioWin;
  musicBackgroundDefault;
  musicDefault;

  constructor(scene: Phaser.Scene) {
    this.musicBackgroundDefault = scene.sound.add('backgroundDefault', {
      loop: true,
      volume: 0.35,
    });

    this.audioReels = scene.sound.add('reels', { volume: 0.5 });
    this.audioReelStop = scene.sound.add('reelStop', { volume: 0.25 });
    this.audioWin = scene.sound.add('win', { loop: false, volume: 0.6 });
    this.audioButton = scene.sound.add('button', { volume: 0.4 });
    this.audioLose = scene.sound.add('lose', { volume: 0.5 });

    this.musicDefault = scene.sound.add('musicDefault', {
      loop: true,
      volume: 0.4,
    });
  }

  stopAll() {
    this.audioWin.stop();
    this.audioReels.stop();
    this.musicDefault.stop();
    this.musicBackgroundDefault.stop();
  }
}
