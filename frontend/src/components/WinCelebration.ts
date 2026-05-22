import Phaser from 'phaser';
import { Theme } from '../constants/theme';

/**
 * PREMIUM Win celebration system with tiered presentations.
 *
 * Tiers (based on bet multiplier):
 *   Nice Win:   2x   - 10x   (Green)
 *   Big Win:    10x  - 25x   (Orange)
 *   Mega Win:   25x  - 50x   (Pink/Purple)
 *   Epic Win:   50x  - 100x  (Red)
 *   Ultra Win:  100x+        (Gold with shimmer)
 *
 * Features:
 *   - Smooth count-up animation for win amount
 *   - Particle fountain effects (scaled for performance)
 *   - Tier-specific visual styling and colors
 *   - Premium typography and shadows
 *   - Tap-to-skip and spacebar skip support
 *   - Safe cleanup with tween/timer tracking
 */
export class WinCelebration {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private _isVisible = false;
  private _finishFn: (() => void) | null = null;

  public get isVisible(): boolean {
    return this._isVisible;
  }

  private tierConfig = [
    {
      name: 'NICE WIN!',
      threshold: 2,
      bgColor: '#00cc88',
      glowColor: '#00ff99',
      textColor: '#ffffff',
      fontSize: 68,
      particleCount: 1,
      particleLife: 2000,
    },
    {
      name: 'BIG WIN!',
      threshold: 10,
      bgColor: '#ffaa00',
      glowColor: '#ffcc44',
      textColor: '#ffffff',
      fontSize: 80,
      particleCount: 2,
      particleLife: 3000,
    },
    {
      name: 'MEGA WIN!',
      threshold: 25,
      bgColor: '#ff006a',
      glowColor: '#ff4d94',
      textColor: '#ffffff',
      fontSize: 92,
      particleCount: 3,
      particleLife: 3500,
    },
    {
      name: 'EPIC WIN!',
      threshold: 50,
      bgColor: '#e60000',
      glowColor: '#ff3333',
      textColor: '#ffffff',
      fontSize: 100,
      particleCount: 4,
      particleLife: 4000,
    },
    {
      name: 'ULTRA WIN!',
      threshold: 100,
      bgColor: '#ffe600',
      glowColor: '#ffff77',
      textColor: '#000000',
      fontSize: 112,
      particleCount: 5,
      particleLife: 4500,
    },
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private createCoinTexture() {
    if (this.scene.textures.exists('gold_coin')) return;
    const g = this.scene.add.graphics();
    // Shadow edge
    g.fillStyle(0xcc7700, 1);
    g.fillCircle(16, 16, 16);
    // Base gold circle
    g.fillStyle(0xffaa00, 1);
    g.fillCircle(16, 15, 15);
    // Inner rim
    g.fillStyle(0xffcc00, 1);
    g.fillCircle(16, 15, 11);
    // Center star
    g.fillStyle(0xffffee, 1);
    g.beginPath();
    g.moveTo(16, 7);
    g.lineTo(18.5, 12);
    g.lineTo(24, 13);
    g.lineTo(19.5, 17);
    g.lineTo(21, 22.5);
    g.lineTo(16, 19.5);
    g.lineTo(11, 22.5);
    g.lineTo(12.5, 17);
    g.lineTo(8, 13);
    g.lineTo(13.5, 12);
    g.closePath();
    g.fillPath();
    // Sheen
    g.fillStyle(0xffffff, 0.4);
    g.beginPath();
    g.arc(16, 15, 15, Math.PI, Math.PI * 1.5);
    g.lineTo(16, 15);
    g.closePath();
    g.fillPath();
    g.generateTexture('gold_coin', 32, 32);
    g.destroy();
  }

  /** External skip — call from Game scene to instantly dismiss */
  public skip(): void {
    if (this._finishFn) this._finishFn();
  }

  /**
   * Show a premium win celebration with tier-based visuals and animations.
   * @param winAmount Actual win amount
   * @param betAmount Current bet amount
   * @param onComplete Callback invoked when celebration finishes or is skipped
   */
  public show(
    winAmount: number,
    betAmount: number,
    onComplete: () => void,
  ): void {
    if (this._isVisible) return;

    this.createCoinTexture();

    const multiplier = winAmount / betAmount;

    // Find appropriate tier
    let tier = null;
    for (let i = this.tierConfig.length - 1; i >= 0; i--) {
      if (multiplier >= this.tierConfig[i].threshold) {
        tier = this.tierConfig[i];
        break;
      }
    }

    if (!tier) {
      onComplete();
      return;
    }

    this._isVisible = true;

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.container = this.scene.add.container(0, 0).setDepth(40);

    // Track all tweens and timers for clean teardown
    const activeTweens: Phaser.Tweens.Tween[] = [];
    const activeTimers: Phaser.Time.TimerEvent[] = [];
    const emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

    // ═══════════════════════════════════════════════════
    // DARK OVERLAY WITH GRADIENT
    // ═══════════════════════════════════════════════════
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, w, h);
    overlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    this.container.add(overlay);

    // Glow effect behind win text
    const glowCircle = this.scene.add.graphics();
    const tierColorInt = parseInt(tier.glowColor.replace('#', '0x'));
    glowCircle.fillStyle(tierColorInt, 0.2);
    glowCircle.fillCircle(w / 2, h * 0.38, 280);
    glowCircle.fillStyle(tierColorInt, 0.08);
    glowCircle.fillCircle(w / 2, h * 0.38, 420);
    this.container.add(glowCircle);

    // ═══════════════════════════════════════════════════
    // PREMIUM WIN TIER TEXT
    // ═══════════════════════════════════════════════════
    const tierText = this.scene.add
      .text(w / 2, h * 0.32, tier.name, {
        resolution: 2,
        fontSize: `${tier.fontSize}px`,
        fontFamily: Theme.fonts.display,
        fontStyle: 'bold',
        color: tier.textColor,
        stroke: tier.bgColor,
        strokeThickness: Math.max(4, Math.floor(tier.fontSize * 0.1)),
        shadow: {
          offsetX: 0,
          offsetY: 8,
          color: '#000000',
          blur: 0,
          stroke: true,
          fill: true,
        },
        align: 'center',
      })
      .setOrigin(0.5)
      .setScale(0)
      .setAlpha(0);
    this.container.add(tierText);

    // Animate tier text with bounce
    activeTweens.push(
      this.scene.tweens.add({
        targets: tierText,
        scale: 1,
        alpha: 1,
        duration: 700,
        ease: Theme.animation.easeBounce,
        delay: 0,
      }),
    );

    // ═══════════════════════════════════════════════════
    // WIN AMOUNT DISPLAY (COUNTING UP)
    // ═══════════════════════════════════════════════════
    const amountText = this.scene.add
      .text(w / 2, h * 0.54, '$0.00', {
        resolution: 2,
        fontSize: `${Math.floor(tier.fontSize * 0.65)}px`,
        fontFamily: Theme.fonts.mono,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
        shadow: {
          offsetX: 0,
          offsetY: 4,
          color: '#000000',
          blur: 0,
          stroke: true,
          fill: true,
        },
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.5);
    this.container.add(amountText);

    // Fade in amount text
    activeTweens.push(
      this.scene.tweens.add({
        targets: amountText,
        alpha: 1,
        scale: 1,
        duration: 400,
        delay: 300,
        ease: 'Quad.easeOut',
      }),
    );

    // Count-up animation with cubic easing
    const countDuration = Math.min(2400, multiplier * 25);
    let elapsed = 0;
    let winSoundPlayed = false;
    const countTimer = this.scene.time.addEvent({
      delay: 16,
      repeat: Math.floor(countDuration / 16),
      callback: () => {
        elapsed += 16;
        const progress = Math.min(elapsed / countDuration, 1);
        // Cubic ease-out for smooth acceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentAmount = winAmount * eased;
        amountText.setText(`$${currentAmount.toFixed(2)}`);

        // Play tick sound with frequency and pitch based on progress
        try {
          const audio = (this.scene as any).audio;
          if (
            audio &&
            typeof audio.playWinTick === 'function' &&
            progress < 1
          ) {
            audio.playWinTick(progress, multiplier);
          }
        } catch {
          /* ignore audio errors */
        }

        // Final celebration bounce and massive avalanche sound
        if (progress >= 1 && !winSoundPlayed) {
          winSoundPlayed = true;
          activeTweens.push(
            this.scene.tweens.add({
              targets: amountText,
              scale: 1.3,
              yoyo: true,
              duration: 400,
              ease: Theme.animation.easeBounce,
            }),
          );

          try {
            const audio = (this.scene as any).audio;
            if (audio && typeof audio.playBigWinAvalanche === 'function') {
              audio.playBigWinAvalanche(multiplier);
            }
          } catch {
            /* ignore audio errors */
          }
        }
      },
    });
    activeTimers.push(countTimer);

    // ═══════════════════════════════════════════════════
    // PARTICLE FOUNTAIN EFFECT (GPU-OPTIMIZED)
    // ═══════════════════════════════════════════════════
    if (multiplier >= 2) {
      const symbolCount = Math.min(tier.particleCount, 5);
      const symbolIds = [0, 2, 4, 5, 6].slice(0, symbolCount);

      symbolIds.forEach((symbolId, index) => {
        const emitter = this.scene.add.particles(
          w / 2,
          h * 0.35,
          `candy_${symbolId}`,
          {
            speed: { min: 350, max: 950 },
            angle: { min: 200, max: 340 },
            scale: { start: 0.5, end: 0.05 },
            alpha: { start: 0.9, end: 0 },
            lifespan: tier.particleLife,
            quantity: 1,
            gravityY: 600,
            frequency: 150 - index * 25,
            blendMode: 'NORMAL',
            emitZone: {
              type: 'random' as const,
              source: new Phaser.Geom.Circle(0, 0, 50),
            } as any,
          },
        );
        this.container.addAt(emitter, 1);
        emitters.push(emitter);

        // Stop particles after count completes
        const stopTimer = this.scene.time.delayedCall(
          countDuration + 400,
          () => {
            emitter.stop();
            const killTimer = this.scene.time.delayedCall(
              tier.particleLife,
              () => emitter.destroy(),
            );
            activeTimers.push(killTimer);
          },
        );
        activeTimers.push(stopTimer);
      });

      // MASSIVE GOLD COIN SHOWER FOR MEGA/EPIC/ULTRA WINS
      if (multiplier >= 25) {
        const coinDensity = multiplier >= 100 ? 10 : multiplier >= 50 ? 20 : 35;
        const coinEmitter = this.scene.add.particles(
          0,
          -50,
          'gold_coin',
          {
            x: { min: 0, max: w },
            y: -50,
            speedY: { min: 400, max: 900 },
            speedX: { min: -80, max: 80 },
            accelerationY: 600,
            scale: { min: 0.6, max: 1.3 },
            alpha: { start: 1, end: 0.7 },
            rotate: { start: 0, end: 1080 }, // Tumbling/spinning effect over lifespan
            lifespan: 3500,
            quantity: 2,
            frequency: coinDensity,
            blendMode: 'NORMAL'
          }
        );
        this.container.add(coinEmitter);
        emitters.push(coinEmitter);
        
        // Stop coin shower slightly before the counter finishes, so they clear out
        const coinStopTimer = this.scene.time.delayedCall(
          countDuration, 
          () => {
            coinEmitter.stop();
            const killTimer = this.scene.time.delayedCall(3500, () => coinEmitter.destroy());
            activeTimers.push(killTimer);
          }
        );
        activeTimers.push(coinStopTimer);
      }
    }

    // ═══════════════════════════════════════════════════
    // ANIMATED GLOW PULSE
    // ═══════════════════════════════════════════════════
    activeTweens.push(
      this.scene.tweens.add({
        targets: glowCircle,
        alpha: { from: 0.2, to: 0.1 },
        yoyo: true,
        repeat: -1,
        duration: 400,
        ease: 'Sine.easeInOut',
      }),
    );

    // ═══════════════════════════════════════════════════
    // TIER TEXT PULSE & GLOW
    // ═══════════════════════════════════════════════════
    activeTweens.push(
      this.scene.tweens.add({
        targets: tierText,
        scale: { from: 1, to: 1.08 },
        yoyo: true,
        repeat: -1,
        duration: 500,
        ease: 'Sine.easeInOut',
        delay: 600,
      }),
    );

    // ═══════════════════════════════════════════════════
    // TAP-TO-SKIP TEXT & INTERACTION
    // ═══════════════════════════════════════════════════
    const skipText = this.scene.add
      .text(w / 2, h * 0.85, 'TAP TO CONTINUE', {
        resolution: 2,
        fontSize: '14px',
        fontFamily: Theme.fonts.sans,
        fontStyle: 'bold',
        color: Theme.colors.textMuted,
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.4);
    this.container.add(skipText);

    // Pulse skip text
    activeTweens.push(
      this.scene.tweens.add({
        targets: skipText,
        alpha: { from: 0.4, to: 0.8 },
        yoyo: true,
        repeat: -1,
        duration: 800,
        ease: 'Sine.easeInOut',
        delay: countDuration,
      }),
    );

    // ═══════════════════════════════════════════════════
    // AUTO DISMISS TIMER
    // ═══════════════════════════════════════════════════
    const totalDuration = Math.max(3500, countDuration + 1800);
    let isFinished = false;

    const finish = () => {
      if (isFinished) return;
      isFinished = true;
      this._finishFn = null;

      // Stop all animations and cleanup
      activeTweens.forEach((t) => {
        if (t && t.isPlaying?.()) t.stop();
      });
      activeTimers.forEach((t) => {
        if (t && t.paused === false) t.remove();
      });
      emitters.forEach((e) => {
        if (e && e.scene) {
          e.stop();
          this.scene.time.delayedCall(tier.particleLife + 100, () => {
            if (e && e.scene) e.destroy();
          });
        }
      });

      // Safe container destroy
      if (this.container && this.container.scene) {
        this.scene.tweens.killTweensOf(this.container);
        this.container.destroy();
      }
      this._isVisible = false;
      onComplete();
    };

    // Store for external skip
    this._finishFn = finish;

    // Auto-dismiss after duration
    const dismissTimer = this.scene.time.delayedCall(totalDuration, () => {
      activeTweens.push(
        this.scene.tweens.add({
          targets: this.container,
          alpha: 0,
          duration: 400,
          ease: 'Quad.easeIn',
          onComplete: finish,
        }),
      );
    });
    activeTimers.push(dismissTimer);

    // Tap to skip
    overlay.on('pointerdown', () => {
      finish();
    });
  }
}
