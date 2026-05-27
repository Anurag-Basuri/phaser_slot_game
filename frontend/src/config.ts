import Phaser from 'phaser';

import { Boot, Game, Preload } from './scenes';

type Config = Phaser.Types.Core.GameConfig & {
  resolution?: number;
};

const config: Config = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },

  resolution: Math.max(window.devicePixelRatio, 2),
  autoRound: true,
  fps: {
    min: 30,
    target: 60,
  },
  backgroundColor: '#060b18',
  scene: [Preload, Boot, Game],
};

export default config;
