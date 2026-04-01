import Phaser from 'phaser';

/**
 * Advanced Audio manager — handles crossfading, dynamic pitching, and global sound states.
 * All public methods are wrapped in try/catch to prevent audio failures from crashing the game.
 */
export class Audio {
  private scene: Phaser.Scene;
  
  // Specific track references for complex logic
  private audioReels: Phaser.Sound.BaseSound | null = null;
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;

  // Track the music fade tweens so we don't accidentally stack tweens
  private fadeTweens: Phaser.Tweens.Tween[] = [];

  // Base configurations
  private musicVolume = 0.35;
  private sfxVolumeDefault = 0.5;

  // Throttle for win tick sound (M2: prevent 62 buffer instances in 2 seconds)
  private _lastTickTime = 0;
  private static readonly TICK_THROTTLE_MS = 80;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Global mute is handled natively by Phaser via `scene.sound.mute`
    try {
      this.audioReels = scene.sound.add('reels', { loop: true, volume: 0.5 });
    } catch (err) {
      console.warn('[Audio] Failed to init reels audio:', err);
    }
  }

  /**
   * Crossfade to a new music track.
   * If a fade is already in progress, it interrupts and transitions smoothly.
   */
  public playMusic(key: string, crossfadeDuration: number = 1000) {
    if (this.currentMusicKey === key) return; // Already playing

    try {
      const previousMusic = this.currentMusic;
      
      // Start the new music immediately but at 0 volume
      const newMusic = this.scene.sound.add(key, { loop: true, volume: 0 });
      newMusic.play();
      
      this.currentMusic = newMusic;
      this.currentMusicKey = key;

      // Stop any existing fade tweens
      if (this.fadeTweens.length > 0) {
        this.fadeTweens.forEach(t => { try { t.stop(); } catch { /* ignore */ } });
        this.fadeTweens = [];
      }

      // Fade out old
      if (previousMusic) {
        this.fadeTweens.push(this.scene.tweens.add({
          targets: previousMusic,
          volume: 0,
          duration: crossfadeDuration,
          ease: 'Linear',
          onComplete: () => {
            try { previousMusic.stop(); previousMusic.destroy(); } catch { /* ignore */ }
          }
        }));
      }

      // Fade in new
      this.fadeTweens.push(this.scene.tweens.add({
        targets: newMusic,
        volume: this.musicVolume,
        duration: crossfadeDuration,
        ease: 'Linear'
      }));
    } catch (err) {
      console.warn('[Audio] playMusic error:', err);
    }
  }

  /** Normal sound effect throwaway playback */
  public playSound(key: string, config?: Phaser.Types.Sound.SoundConfig) {
    try {
      this.scene.sound.play(key, { volume: this.sfxVolumeDefault, ...config });
    } catch (err) {
      console.warn('[Audio] playSound error:', err);
    }
  }

  /** Start reeling noise */
  public playReels() {
    try {
      if (this.audioReels && !this.audioReels.isPlaying) {
        this.audioReels.play();
      }
    } catch (err) {
      console.warn('[Audio] playReels error:', err);
    }
  }

  /** Gracefully stop reeling noise with a quick fade */
  public stopReels() {
    try {
      if (this.audioReels && this.audioReels.isPlaying) {
        this.scene.tweens.add({
          targets: this.audioReels,
          volume: 0,
          duration: 200,
          onComplete: () => {
            try {
              this.audioReels?.stop();
              (this.audioReels as any)?.setVolume?.(0.5);
            } catch { /* ignore */ }
          }
        });
      }
    } catch (err) {
      console.warn('[Audio] stopReels error:', err);
    }
  }

  /** Play a dynamic cascade drop sound based on cascade depth */
  public playCascadeDrop(depth: number) {
    const detuneRaw = Math.min(depth * 50, 600); 
    this.playSound('reelStop', { 
      volume: 0.25, 
      detune: detuneRaw
    });
  }

  /** Dynamic main Win Sound based on multiplier */
  public playWin(multiplier: number) {
    let vol = 0.5;
    let pitch = 0;

    if (multiplier >= 100) { vol = 0.8; pitch = 400; }
    else if (multiplier >= 50) { vol = 0.7; pitch = 200; }
    else if (multiplier >= 25) { vol = 0.6; pitch = 100; }
    else if (multiplier >= 10) { vol = 0.55; pitch = 50; }
    else { vol = 0.45; pitch = 0; }

    this.playSound('win', { volume: vol, detune: pitch });
  }

  /** 
   * Dynamic ticking sound for the WinCelebration counter.
   * Throttled to max 12.5 sounds/sec to prevent WebAudio buffer explosion.
   */
  public playWinTick(progress: number, multiplier: number) {
    const now = performance.now();
    if (now - this._lastTickTime < Audio.TICK_THROTTLE_MS) return;
    this._lastTickTime = now;

    const baseDetune = Math.min(multiplier * 5, 500);
    const progressDetune = progress * 700; 
    
    this.playSound('button', { 
      volume: 0.08, 
      detune: 300 + baseDetune + progressDetune 
    });
  }

  public stopAll() {
    try {
      this.scene.sound.stopAll();
    } catch { /* ignore */ }
    this.currentMusic = null;
    this.currentMusicKey = null;
  }
}
