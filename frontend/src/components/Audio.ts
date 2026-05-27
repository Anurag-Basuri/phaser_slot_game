import Phaser from 'phaser';

/**
 * Advanced Audio manager — handles crossfading, dynamic pitching, and independent
 * Music / SFX volume channels.
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

  // Independent mute states
  private _musicMuted = false;
  private _sfxMuted = false;

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

  // ─── Mute API ───────────────────────────────────────────────

  /** Get current music mute state */
  public get musicMuted(): boolean { return this._musicMuted; }

  /** Get current SFX mute state */
  public get sfxMuted(): boolean { return this._sfxMuted; }

  /** Toggle music mute on/off. Returns the new state. */
  public setMusicMuted(muted: boolean) {
    this._musicMuted = muted;
    try {
      if (this.currentMusic) {
        if (muted) {
          (this.currentMusic as Phaser.Sound.WebAudioSound).setVolume?.(0);
        } else {
          (this.currentMusic as Phaser.Sound.WebAudioSound).setVolume?.(this.musicVolume);
        }
      }
    } catch { /* ignore */ }
  }

  /** Toggle SFX mute on/off. Returns the new state. */
  public setSfxMuted(muted: boolean) {
    this._sfxMuted = muted;
    // Reels are considered SFX — stop if currently playing
    try {
      if (muted && this.audioReels?.isPlaying) {
        this.audioReels.stop();
      }
    } catch { /* ignore */ }
  }

  // ─── Music ──────────────────────────────────────────────────

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

      // Fade in new — respect mute state
      const targetVol = this._musicMuted ? 0 : this.musicVolume;
      this.fadeTweens.push(this.scene.tweens.add({
        targets: newMusic,
        volume: targetVol,
        duration: crossfadeDuration,
        ease: 'Linear'
      }));
    } catch (err) {
      console.warn('[Audio] playMusic error:', err);
    }
  }

  // ─── SFX ────────────────────────────────────────────────────

  /** Normal sound effect throwaway playback */
  public playSound(key: string, config?: Phaser.Types.Sound.SoundConfig) {
    if (this._sfxMuted) return; // Skip if SFX muted
    try {
      this.scene.sound.play(key, { volume: this.sfxVolumeDefault, ...config });
    } catch (err) {
      console.warn('[Audio] playSound error:', err);
    }
  }

  /** Start reeling noise */
  public playReels() {
    if (this._sfxMuted) return; // Skip if SFX muted
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
              (this.audioReels as Phaser.Sound.WebAudioSound)?.setVolume?.(0.5);
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
    // Musical pitch increase per tumble (e.g., up a whole step each cascade)
    const stingerPitch = Math.min(depth * 200, 1200); // Max 1 octave up
    
    // Play the standard drop thud
    this.playSound('reelStop', { 
      volume: 0.25, 
      detune: Math.min(depth * 50, 300)
    });

    // Layer a musical stinger on top
    this.playSound('button', {
      volume: 0.35,
      detune: stingerPitch
    });
  }

  /** Dynamic main Win Sound based on multiplier (used for individual cascade wins) */
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

  /** Massive bell tolls and coin-clinking avalanche when WinCelebration finishes */
  public playBigWinAvalanche(multiplier: number) {
    let vol = 0.8;
    
    // Simulate massive bell toll by detuning 'win' down heavily and adding echo
    this.playSound('win', { volume: vol, detune: -1200 }); // Octave down for weight
    this.playSound('button', { volume: vol, detune: -500 });
    
    // Extra coin clinking avalanche for larger wins
    const clinkCount = multiplier >= 100 ? 8 : multiplier >= 50 ? 5 : multiplier >= 25 ? 3 : 1;
    for(let i = 0; i < clinkCount; i++) {
      this.scene.time.delayedCall(i * 150, () => {
        this.playSound('button', { volume: 0.4, detune: 600 + (Math.random() * 400) });
        this.playSound('win', { volume: 0.3, detune: 1200 }); // High pitched chime
      });
    }
  }

  /** 
   * Dynamic ticking sound for the WinCelebration counter.
   * Throttled to max 12.5 sounds/sec to prevent WebAudio buffer explosion.
   */
  public playWinTick(progress: number, multiplier: number) {
    if (this._sfxMuted) return; // Skip if SFX muted
    const now = performance.now();
    if (now - this._lastTickTime < Audio.TICK_THROTTLE_MS) return;
    this._lastTickTime = now;

    const baseDetune = Math.min(multiplier * 5, 500);
    const progressDetune = progress * 700; 
    
    this.playSound('button', { 
      volume: 0.08 + (progress * 0.1), // Tick gets slightly louder as it reaches the end
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
