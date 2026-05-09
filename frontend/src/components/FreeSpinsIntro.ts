import Phaser from 'phaser';
import { Theme } from '../constants/theme';

/**
 * PREMIUM Free Spins Intro Cinematic Animation
 *
 * Plays when scatter symbols trigger the bonus round.
 * Features:
 *   - Animated scatter symbol arrivals
 *   - Premium text with gradient fills
 *   - Particle rain effect
 *   - Smooth count-up animation
 *   - Professional transitions
 *   - Tap-to-skip and external skip support
 */
export class FreeSpinsIntro {
  private scene: Phaser.Scene;
  private _isVisible = false;
  private _finishFn: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public get isVisible(): boolean {
    return this._isVisible;
  }

  /** External skip — call from Game scene to instantly dismiss */
  public skip(): void {
    if (this._finishFn) this._finishFn();
  }

  /**
   * Play the premium free spins intro cinematic.
   * @param spinsAwarded Number of free spins awarded
   * @param onComplete Callback when the intro finishes
   */
  public play(spinsAwarded: number, onComplete: () => void) {
    if (this._isVisible) return;
    this._isVisible = true;

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    const container = this.scene.add.container(0, 0).setDepth(45).setAlpha(0);
    const activeTweens: Phaser.Tweens.Tween[] = [];
    const activeTimers: Phaser.Time.TimerEvent[] = [];
    const emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

    // ═══════════════════════════════════════════════════
    // PREMIUM DARK OVERLAY
    // ═══════════════════════════════════════════════════
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.88);
    bg.fillRect(0, 0, w, h);
    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    container.add(bg);

    // Radial gradient glow effect (multiple rings for depth)
    const glow1 = this.scene.add.graphics();
    glow1.fillStyle(0xff006a, 0.25);
    glow1.fillCircle(w / 2, h * 0.42, 280);
    container.add(glow1);

    const glow2 = this.scene.add.graphics();
    glow2.fillStyle(0xff006a, 0.1);
    glow2.fillCircle(w / 2, h * 0.42, 380);
    container.add(glow2);

    const glow3 = this.scene.add.graphics();
    glow3.fillStyle(0xffaa00, 0.05);
    glow3.fillCircle(w / 2, h * 0.42, 500);
    container.add(glow3);

    // ═══════════════════════════════════════════════════
    // ANIMATED SCATTER SYMBOLS ARRIVAL
    // ═══════════════════════════════════════════════════
    const flyPositions = [
      { sx: -150, sy: h * 0.15, ex: w * 0.25, ey: h * 0.35, delay: 0 },
      { sx: w + 150, sy: h * 0.2, ex: w * 0.75, ey: h * 0.4, delay: 150 },
      { sx: w / 2, sy: -150, ex: w * 0.5, ey: h * 0.25, delay: 300 },
    ];

    flyPositions.forEach((pos) => {
      const scatter = this.scene.add.sprite(pos.sx, pos.sy, 'scatter');
      const scaleTarget = Math.min(0.4, 140 / Math.max(scatter.width, 1));
      scatter.setScale(0.05).setAlpha(0);
      container.add(scatter);

      // Bounce in animation
      activeTweens.push(
        this.scene.tweens.add({
          targets: scatter,
          x: pos.ex,
          y: pos.ey,
          scale: scaleTarget,
          alpha: 1,
          duration: 800,
          delay: pos.delay,
          ease: Theme.animation.easeBounce,
        }),
      );

      // Idle bob animation
      activeTweens.push(
        this.scene.tweens.add({
          targets: scatter,
          y: pos.ey - 15,
          yoyo: true,
          repeat: -1,
          duration: 600,
          ease: 'Sine.easeInOut',
          delay: pos.delay + 800,
        }),
      );

      // Rotation
      activeTweens.push(
        this.scene.tweens.add({
          targets: scatter,
          rotation: Phaser.Math.PI2,
          yoyo: true,
          repeat: -1,
          duration: 4000,
          ease: 'Linear',
          delay: pos.delay,
        }),
      );

      // Glow effect on each scatter
      const scatterGlow = this.scene.add.graphics();
      scatterGlow.fillStyle(0xff006a, 0.3);
      scatterGlow.fillCircle(pos.ex, pos.ey, 60);
      scatterGlow.setAlpha(0);
      container.addAt(scatterGlow, 1);

      activeTweens.push(
        this.scene.tweens.add({
          targets: scatterGlow,
          alpha: { from: 0.3, to: 0.1 },
          yoyo: true,
          repeat: -1,
          duration: 500,
          ease: 'Sine.easeInOut',
          delay: pos.delay + 800,
        }),
      );
    });

    // ═══════════════════════════════════════════════════
    // "FREE SPINS" TITLE WITH GRADIENT
    // ═══════════════════════════════════════════════════
    const titleText = this.scene.add
      .text(w / 2, h * 0.5, 'FREE SPINS', {
        fontSize: '76px',
        fontFamily: Theme.fonts.display,
        fontStyle: 'bold',
        color: Theme.colors.textPrimary,
        stroke: Theme.colors.primary,
        strokeThickness: 6,
        shadow: {
          offsetX: 0,
          offsetY: 6,
          color: '#000000',
          blur: 0,
          stroke: true,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setScale(0)
      .setAlpha(0);
    container.add(titleText);

    activeTweens.push(
      this.scene.tweens.add({
        targets: titleText,
        scale: 1,
        alpha: 1,
        duration: 600,
        delay: 600,
        ease: Theme.animation.easeBounce,
      }),
    );

    // ═══════════════════════════════════════════════════
    // SPIN COUNT WITH ANIMATED COUNTER
    // ═══════════════════════════════════════════════════
    const countText = this.scene.add
      .text(w / 2, h * 0.63, '0', {
        fontSize: '104px',
        fontFamily: Theme.fonts.mono,
        fontStyle: 'bold',
        color: Theme.colors.secondary,
        stroke: '#ff6600',
        strokeThickness: 6,
        shadow: {
          offsetX: 0,
          offsetY: 5,
          color: '#000000',
          blur: 0,
          stroke: true,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setScale(0.3)
      .setAlpha(0);
    container.add(countText);

    activeTweens.push(
      this.scene.tweens.add({
        targets: countText,
        scale: 1,
        alpha: 1,
        duration: 500,
        delay: 1100,
        ease: Theme.animation.easeBounce,
      }),
    );

    // Smooth count-up animation
    let currentCount = 0;
    const countInterval = Math.max(50, 1200 / spinsAwarded);
    activeTimers.push(
      this.scene.time.addEvent({
        delay: countInterval,
        repeat: spinsAwarded - 1,
        startAt: 1200,
        callback: () => {
          currentCount++;
          countText.setText(`${currentCount}`);

          // Pulse effect on count update
          activeTweens.push(
            this.scene.tweens.add({
              targets: countText,
              scale: 1.2,
              yoyo: true,
              duration: 150,
            }),
          );

          // Play tick sound
          try {
            const audio = (this.scene as any).audio;
            if (audio && typeof audio.playSound === 'function') {
              audio.playSound('spin', 0.1);
            }
          } catch {
            /* ignore */
          }
        },
      }),
    );

    // ═══════════════════════════════════════════════════
    // SUBTITLE TEXT
    // ═══════════════════════════════════════════════════
    const subText = this.scene.add
      .text(w / 2, h * 0.76, 'MULTIPLIERS PERSIST!', {
        fontSize: '20px',
        fontFamily: Theme.fonts.sans,
        fontStyle: 'bold',
        color: Theme.colors.accent,
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    container.add(subText);

    activeTweens.push(
      this.scene.tweens.add({
        targets: subText,
        alpha: 1,
        duration: 400,
        delay: 1700,
        ease: 'Quad.easeOut',
      }),
    );

    // ═══════════════════════════════════════════════════
    // TAP TO SKIP HINT
    // ═══════════════════════════════════════════════════
    const skipHint = this.scene.add
      .text(w / 2, h * 0.9, 'TAP TO CONTINUE', {
        fontSize: '13px',
        fontFamily: Theme.fonts.sans,
        color: Theme.colors.textMuted,
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.3);
    container.add(skipHint);

    activeTweens.push(
      this.scene.tweens.add({
        targets: skipHint,
        alpha: { from: 0.3, to: 0.7 },
        yoyo: true,
        repeat: -1,
        duration: 900,
        ease: 'Sine.easeInOut',
        delay: 1800,
      }),
    );

    // ═══════════════════════════════════════════════════
    // PARTICLE RAIN EFFECT (GPU OPTIMIZED)
    // ═══════════════════════════════════════════════════
    const particleColors = [0, 2, 4, 5];
    particleColors.forEach((colorId, index) => {
      const px = w * (0.2 + index * 0.2);
      const emitter = this.scene.add.particles(px, -30, `candy_${colorId}`, {
        speed: { min: 80, max: 240 },
        angle: { min: 75, max: 105 },
        scale: { start: 0.25, end: 0.02 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 3500,
        quantity: 0.5,
        gravityY: 150,
        frequency: 350,
        emitZone: {
          type: 'random' as const,
          source: new Phaser.Geom.Rectangle(-30, 0, 60, 0),
        } as any,
      });
      container.add(emitter);
      emitters.push(emitter);

      const stopTimer = this.scene.time.delayedCall(3200, () => {
        emitter.stop();
        const killTimer = this.scene.time.delayedCall(3500, () => {
          if (emitter && emitter.scene) emitter.destroy();
        });
        activeTimers.push(killTimer);
      });
      activeTimers.push(stopTimer);
    });

    // ═══════════════════════════════════════════════════
    // PULSING GLOW ANIMATION
    // ═══════════════════════════════════════════════════
    activeTweens.push(
      this.scene.tweens.add({
        targets: [glow1, glow2],
        alpha: { from: 0.2, to: 0.1 },
        yoyo: true,
        repeat: -1,
        duration: 600,
        ease: 'Sine.easeInOut',
      }),
    );

    // ═══════════════════════════════════════════════════
    // FADE IN CONTAINER
    // ═══════════════════════════════════════════════════
    activeTweens.push(
      this.scene.tweens.add({
        targets: container,
        alpha: 1,
        duration: 400,
        ease: 'Quad.easeOut',
      }),
    );

    // ═══════════════════════════════════════════════════
    // AUTO DISMISS TIMER
    // ═══════════════════════════════════════════════════
    let isFinished = false;

    const finish = () => {
      if (isFinished) return;
      isFinished = true;
      this._finishFn = null;

      // Kill all tracked animations
      activeTweens.forEach((t) => {
        if (t && t.isPlaying?.()) t.stop();
      });
      activeTimers.forEach((t) => {
        if (t && t.paused === false) t.remove();
      });
      emitters.forEach((e) => {
        if (e && e.scene) {
          e.stop();
          this.scene.time.delayedCall(3500, () => {
            if (e && e.scene) e.destroy();
          });
        }
      });

      // Safe container destroy
      if (container && container.scene) {
        this.scene.tweens.killTweensOf(container);
        container.destroy();
      }
      this._isVisible = false;
      onComplete();
    };

    // Store for external skip
    this._finishFn = finish;

    // Tap to skip
    bg.on('pointerdown', () => {
      finish();
    });

    // Auto dismiss after total duration
    const totalDuration = 4000;
    activeTimers.push(
      this.scene.time.delayedCall(totalDuration, () => {
        activeTweens.push(
          this.scene.tweens.add({
            targets: container,
            alpha: 0,
            duration: 400,
            ease: 'Quad.easeIn',
            onComplete: () => finish(),
          }),
        );
      }),
    );
  }
}
