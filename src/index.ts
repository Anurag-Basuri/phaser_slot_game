import Phaser from 'phaser';

import config from './config';

/**
 * Sweet Cluster 1000 — Main Entry Point
 * Initializes the Phaser game engine and hides the HTML loading overlay.
 */

// Remove loading overlay once Phaser canvas renders
const hideLoader = () => {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    setTimeout(() => overlay.remove(), 600);
  }
};

const game = new Phaser.Game({
  ...config,
  callbacks: {
    postBoot: hideLoader,
  },
});

export default game;
