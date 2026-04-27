import Phaser from 'phaser';

/**
 * Free Spins intro cinematic animation.
 * Plays when scatter symbols trigger the bonus round.
 * 
 * Supports:
 *   - Tap-to-skip (instant dismiss)
 *   - External skip() call from Game scene (spacebar, spin button)
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
   * Play the free spins intro cinematic.
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

    // Dark overlay (interactive for tap-to-skip)
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0020, 0.92);
    bg.fillRect(0, 0, w, h);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    container.add(bg);

    // Radial glow in center
    const glow = this.scene.add.graphics();
    glow.fillStyle(0xff00cc, 0.15);
    glow.fillCircle(w / 2, h * 0.42, 300);
    glow.fillStyle(0xea00ff, 0.1);
    glow.fillCircle(w / 2, h * 0.42, 200);
    container.add(glow);

    // Scatter symbols flying in from edges
    const flyPositions = [
      { sx: -100, sy: h * 0.2, ex: w * 0.3, ey: h * 0.38 },
      { sx: w + 100, sy: h * 0.15, ex: w * 0.7, ey: h * 0.35 },
      { sx: w / 2, sy: -100, ex: w * 0.5, ey: h * 0.30 },
    ];

    flyPositions.forEach((pos, i) => {
      const scatter = this.scene.add.sprite(pos.sx, pos.sy, 'scatter');
      const scaleTarget = Math.min(0.35, 120 / Math.max(scatter.width, 1));
      scatter.setScale(0.1).setAlpha(0);
      container.add(scatter);

      activeTweens.push(this.scene.tweens.add({
        targets: scatter,
        x: pos.ex, y: pos.ey,
        scale: scaleTarget,
        alpha: 1,
        duration: 600,
        delay: 200 + i * 150,
        ease: 'Back.easeOut',
      }));

      activeTweens.push(this.scene.tweens.add({
        targets: scatter,
        scale: scaleTarget * 1.2,
        yoyo: true,
        repeat: 2,
        duration: 300,
        delay: 900 + i * 150,
      }));
    });

    // "FREE SPINS" title
    const titleText = this.scene.add.text(w / 2, h * 0.50, 'FREE SPINS', {
      fontSize: '72px', color: '#ff00cc', fontStyle: 'bold',
      stroke: '#ffffff', strokeThickness: 8,
    }).setOrigin(0.5).setScale(0).setAlpha(0);
    container.add(titleText);

    activeTweens.push(this.scene.tweens.add({
      targets: titleText,
      scale: 1, alpha: 1,
      duration: 500,
      delay: 800,
      ease: 'Back.easeOut',
    }));

    // Spin count
    const countText = this.scene.add.text(w / 2, h * 0.62, '0', {
      fontSize: '96px', color: '#ffe600', fontStyle: 'bold',
      stroke: '#ff0066', strokeThickness: 8,
    }).setOrigin(0.5).setScale(0).setAlpha(0);
    container.add(countText);

    activeTweens.push(this.scene.tweens.add({
      targets: countText,
      scale: 1, alpha: 1,
      duration: 400,
      delay: 1200,
      ease: 'Back.easeOut',
    }));

    // Count up animation
    let currentCount = 0;
    activeTimers.push(this.scene.time.addEvent({
      delay: 80,
      repeat: spinsAwarded - 1,
      startAt: 1400,
      callback: () => {
        currentCount++;
        countText.setText(`${currentCount}`);
      },
    }));

    // Subtitle
    const subText = this.scene.add.text(w / 2, h * 0.76, 'Multipliers are persistent!', {
      fontSize: '20px', color: '#ccbbee',
    }).setOrigin(0.5).setAlpha(0);
    container.add(subText);

    activeTweens.push(this.scene.tweens.add({
      targets: subText,
      alpha: 1,
      duration: 400,
      delay: 1600,
    }));

    // "Tap to skip" hint
    const skipHint = this.scene.add.text(w / 2, h * 0.92, 'Tap to skip', {
      fontSize: '14px', color: '#665588',
    }).setOrigin(0.5).setAlpha(0);
    container.add(skipHint);
    activeTweens.push(this.scene.tweens.add({
      targets: skipHint, alpha: 0.8, duration: 600, delay: 1800,
    }));

    // Candy rain particles
    for (let i = 0; i < 8; i++) {
      const px = Phaser.Math.Between(Math.floor(w * 0.05), Math.floor(w * 0.95));
      const emitter = this.scene.add.particles(px, -20, `candy_${i % 7}`, {
        speed: { min: 50, max: 200 },
        angle: { min: 70, max: 110 },
        scale: { start: 0.2, end: 0.02 },
        lifespan: 3000,
        quantity: 1,
        gravityY: 120,
        frequency: 300,
        alpha: { start: 0.7, end: 0 },
      });
      container.add(emitter);
      emitters.push(emitter);
      activeTimers.push(this.scene.time.delayedCall(3500, () => emitter.stop()));
    }

    // Fade in container
    activeTweens.push(this.scene.tweens.add({
      targets: container, alpha: 1, duration: 300,
    }));

    let isFinished = false;

    const finish = () => {
      if (isFinished) return;
      isFinished = true;
      this._finishFn = null;

      // Kill all tracked tweens and timers
      activeTweens.forEach(t => { if (t.isPlaying()) t.stop(); });
      activeTimers.forEach(t => t.remove());
      emitters.forEach(e => { e.stop(); e.destroy(); });

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

    // Auto dismiss after 3.5s
    activeTimers.push(this.scene.time.delayedCall(3500, () => {
      activeTweens.push(this.scene.tweens.add({
        targets: container,
        alpha: 0,
        duration: 400,
        onComplete: () => finish(),
      }));
    }));
  }
}
