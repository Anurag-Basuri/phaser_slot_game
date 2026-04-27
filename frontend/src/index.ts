import Phaser from 'phaser';

import config from './config';

/**
 * Sweet Cluster 1000 — Main Entry Point
 * Initializes the Phaser game engine and hides the HTML loading overlay.
 */

// The HTML loader overlay is left active.
// It will be updated and hidden by the Preload scene once assets finish loading.

const game = new Phaser.Game({
  ...config,
});

export default game;
