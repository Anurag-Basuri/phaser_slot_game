import Phaser from 'phaser';

import { Audio } from '../components';

export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // Candy land background
    this.add.image(w / 2, h / 2, 'candyland_bg').setDisplaySize(w, h);

    // Dark overlay
    this.add.rectangle(w / 2, h / 2, w, h, 0x0a0f1c, 0.6);

    // Title
    this.add.text(w / 2, h * 0.32, 'SWEET CLUSTER', {
      fontSize: '72px', color: '#ff00cc', fontStyle: 'bold',
      stroke: '#ffffff', strokeThickness: 10
    }).setOrigin(0.5);

    this.add.text(w / 2, h * 0.42, '1000', {
      fontSize: '120px', color: '#ffe600', fontStyle: 'bold',
      stroke: '#ff0066', strokeThickness: 12
    }).setOrigin(0.5);

    // Play button
    const playBtn = this.add.rectangle(w / 2, h * 0.62, 320, 90, 0xff006a)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(5, 0xffffff);

    this.add.text(w / 2, h * 0.62, '▶  PLAY', {
      fontSize: '36px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Hover effect
    playBtn.on('pointerover', () => playBtn.setFillStyle(0xff3388));
    playBtn.on('pointerout', () => playBtn.setFillStyle(0xff006a));

    playBtn.on('pointerdown', () => {
      this.scene.start('Game');
    });

    // Credits
    this.add.text(w / 2, h * 0.85, '7×7 Cluster Pays • Cascading Reels • Up to 25,000× Win', {
      fontSize: '22px', color: '#aaaabb', align: 'center'
    }).setOrigin(0.5);
  }
}
