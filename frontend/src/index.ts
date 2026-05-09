import Phaser from 'phaser';

import config from './config';

/**
 * Sweet Cluster 1000 — Main Entry Point
 * Initializes the Phaser game engine and hides the HTML loading overlay.
 */

// The HTML loader overlay is left active.
// It will be updated and hidden by the Preload scene once assets finish loading.

// Wait for all CSS fonts (like Outfit and Luckiest Guy) to load
// to prevent Phaser from falling back to generic Arial on initial canvas draw.
document.fonts.ready.then(() => {
  const game = new Phaser.Game({
    ...config,
  });
});
