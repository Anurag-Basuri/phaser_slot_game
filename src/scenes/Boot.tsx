import Phaser from 'phaser';

import { Audio } from '../components';
import config from '../config';

export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create() {
    const audio = new Audio(this);
    audio.musicBackgroundDefault.play();
    
    // Simple Play Screen
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x1a0f2e).setOrigin(0,0);
    
    const playBtn = this.add.rectangle(this.scale.width/2, this.scale.height/2, 300, 100, 0xff006a)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(4, 0xffffff);
        
    this.add.text(this.scale.width/2, this.scale.height/2, 'PLAY SUGAR RUSH', { fontSize: '30px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    
    playBtn.on('pointerdown', () => {
        audio.musicBackgroundDefault.stop();
        this.scene.start('Game');
    });
  }
}
