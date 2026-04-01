import Phaser from 'phaser';

/**
 * Advanced Audio manager — handles crossfading, dynamic pitching, and global sound states.
 */
export class Audio {
  private scene: Phaser.Scene;
  
  // Specific track references for complex logic
  private audioReels: Phaser.Sound.BaseSound;
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;

  // Track the music fade tweens so we don't accidentally stack tweens
  private fadeTweens: Phaser.Tweens.Tween[] = [];

  // Base configurations
  private musicVolume = 0.35;
  private sfxVolumeDefault = 0.5;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Global mute is handled natively by Phaser via `scene.sound.mute`
    // We instantiate long-lived sounds here
    this.audioReels = scene.sound.add('reels', { loop: true, volume: 0.5 });
  }

  /**
   * Crossfade to a new music track.
   * If a fade is already in progress, it interrupts and transitions smoothly.
   */
  public playMusic(key: string, crossfadeDuration: number = 1000) {
    if (this.currentMusicKey === key) return; // Already playing

    const previousMusic = this.currentMusic;
    
    // Start the new music immediately but at 0 volume
    const newMusic = this.scene.sound.add(key, { loop: true, volume: 0 });
    newMusic.play();
    
    this.currentMusic = newMusic;
    this.currentMusicKey = key;

    // Stop any existing fade tweens
    if (this.fadeTweens.length > 0) {
      this.fadeTweens.forEach(t => t.stop());
      this.fadeTweens = [];
    }

    // Set up crossfade tweens
    // Fade out old
    if (previousMusic) {
      this.fadeTweens.push(this.scene.tweens.add({
        targets: previousMusic,
        volume: 0,
        duration: crossfadeDuration,
        ease: 'Linear',
        onComplete: () => {
          previousMusic.stop();
          previousMusic.destroy();
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
  }

  /** Normal sound effect throwaway playback */
  public playSound(key: string, config?: Phaser.Types.Sound.SoundConfig) {
    this.scene.sound.play(key, { volume: this.sfxVolumeDefault, ...config });
  }

  /** Start reeling noise */
  public playReels() {
    if (!this.audioReels.isPlaying) {
      this.audioReels.play();
    }
  }

  /** Gracefully stop reeling noise with a quick 100ms fade */
  public stopReels() {
    if (this.audioReels.isPlaying) {
      this.scene.tweens.add({
        targets: this.audioReels,
        volume: 0,
        duration: 200,
        onComplete: () => {
          this.audioReels.stop();
          // Restore volume for next time
          (this.audioReels as any).setVolume(0.5);
        }
      });
    }
  }

  /** Play a dynamic cascade drop sound based on how deep into the cascade we are */
  public playCascadeDrop(depth: number) {
    // Increase pitch (detune) slightly for deeper cascades to build tension
    // 100 cents = 1 semitone. We pitch up 50 cents per cascade depth.
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
   * Dynamic ticking sound for the WinCelebration counter 
   * Changes pitch dynamically as the bar completes progress (0.0 -> 1.0)
   */
  public playWinTick(progress: number, multiplier: number) {
    // A rapid ticking uses the generic UI button sound pitched way up
    // The higher the ultimate multiplier, the faster we want base ticks to sound, but
    // we also shift pitch up as progress approaches 100%
    const baseDetune = Math.min(multiplier * 5, 500);
    const progressDetune = progress * 700; 
    
    // Scale volume down because it will tick rapidly (every 16ms or 30ms)
    // Avoid blowing out the speakers.
    this.playSound('button', { 
      volume: 0.08, 
      detune: 300 + baseDetune + progressDetune 
    });
  }

  public stopAll() {
    this.scene.sound.stopAll();
    this.currentMusic = null;
    this.currentMusicKey = null;
  }
}
