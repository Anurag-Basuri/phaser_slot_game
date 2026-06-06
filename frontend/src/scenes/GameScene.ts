import Phaser from 'phaser';
import { Audio } from '../components/Audio';

/**
 * Typed interface for the Game scene.
 * 
 * Components that need access to scene-level services (e.g. audio)
 * should accept `GameScene` instead of `Phaser.Scene`. This eliminates
 * `(this.scene as any).audio` casts throughout the codebase.
 */
export interface GameScene extends Phaser.Scene {
  audio: Audio;
}
