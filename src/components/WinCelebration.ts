import Phaser from 'phaser';

/**
 * Win celebration system with tiered presentations.
 * 
 * Tiers (based on bet multiplier):
 *   Nice Win:   2x   - 10x
 *   Big Win:    10x  - 25x
 *   Mega Win:   25x  - 50x
 *   Epic Win:   50x  - 100x
 *   Ultra Win:  100x+
 * 
 * Supports:
 *   - Tap-to-skip (instant dismiss)
 *   - External skip() call from Game scene (spacebar, spin button)
 *   - Safe double-finish guard
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
    { name: 'NICE WIN!',  threshold: 2,   color: '#44ff88', stroke: '#006622', fontSize: 64 },
    { name: 'BIG WIN!',   threshold: 10,  color: '#ffaa44', stroke: '#663300', fontSize: 80 },
    { name: 'MEGA WIN!',  threshold: 25,  color: '#ff00cc', stroke: '#440044', fontSize: 96 },
    { name: 'EPIC WIN!',  threshold: 50,  color: '#ff4466', stroke: '#660022', fontSize: 96 },
    { name: 'ULTRA WIN!', threshold: 100, color: '#ffe600', stroke: '#664400', fontSize: 112 },
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** External skip — call from Game scene to instantly dismiss */
  public skip(): void {
    if (this._finishFn) this._finishFn();
  }

  /**
   * Show a win celebration if the amount qualifies.
   * @param winAmount Actual win amount
   * @param betAmount Current bet amount
   * @param onComplete Callback invoked when celebration finishes or is skipped
   */
  public show(winAmount: number, betAmount: number, onComplete: () => void): void {
    if (this._isVisible) return;

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

    // Dark overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(0, 0, w, h);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    this.container.add(overlay);

    // Tier text
    const tierText = this.scene.add.text(w / 2, h * 0.35, tier.name, {
      fontSize: `${tier.fontSize}px`,
      color: tier.color,
      fontStyle: 'bold',
      stroke: tier.stroke,
      strokeThickness: Math.floor(tier.fontSize * 0.12),
      align: 'center',
    }).setOrigin(0.5).setScale(0);
    this.container.add(tierText);

    // Win amount (counting up animation)
    const amountText = this.scene.add.text(w / 2, h * 0.55, '0.00', {
      fontSize: `${Math.floor(tier.fontSize * 0.7)}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8,
      align: 'center',
    }).setOrigin(0.5).setAlpha(0);
    this.container.add(amountText);

    // Animate tier text entrance
    activeTweens.push(this.scene.tweens.add({
      targets: tierText,
      scale: 1,
      duration: 600,
      ease: 'Back.easeOut',
    }));

    // Count up animation
    activeTweens.push(this.scene.tweens.add({
      targets: amountText,
      alpha: 1,
      duration: 300,
      delay: 400,
    }));

    const countDuration = Math.min(2000, multiplier * 30);
    let elapsed = 0;
    const countTimer = this.scene.time.addEvent({
      delay: 32,
      repeat: Math.floor(countDuration / 32),
      callback: () => {
        elapsed += 32;
        const progress = Math.min(elapsed / countDuration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentAmount = winAmount * eased;
        amountText.setText(currentAmount.toFixed(2));
        
        try {
          const audio = (this.scene as any).audio;
          if (audio && audio.playWinTick && progress < 1) {
            audio.playWinTick(progress, multiplier);
          }
        } catch { /* ignore */ }
        
        if (progress >= 1) {
          activeTweens.push(this.scene.tweens.add({
            targets: amountText,
            scale: { from: 1.4, to: 1 },
            duration: 500,
            ease: 'Bounce.easeOut'
          }));
        }
      },
    });
    activeTimers.push(countTimer);

    // Particle fountain for big wins — capped emitters for GPU safety
    const emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
    if (multiplier >= 10) {
      const colors = [0, 2, 5]; // 3 emitters max instead of 7
      const qty = Math.min(3, Math.max(1, Math.floor(multiplier / 25)));
      
      colors.forEach(c => {
        const emitter = this.scene.add.particles(w / 2, h + 50, `candy_${c}`, {
          speed: { min: 400, max: 1100 },
          angle: { min: 230, max: 310 },
          scale: { start: 0.6, end: 0.1 },
          lifespan: 4000,
          quantity: qty,
          gravityY: 700,
          frequency: 200, // Reduced from 80 to 200
          blendMode: 'ADD'
        });
        this.container.addAt(emitter, 1);
        emitters.push(emitter);
        
        const stopTimer = this.scene.time.delayedCall(countDuration, () => emitter.stop());
        activeTimers.push(stopTimer);
      });
    }

    // Glow pulse on tier text
    activeTweens.push(this.scene.tweens.add({
      targets: tierText,
      scale: { from: 1, to: 1.15 },
      yoyo: true,
      repeat: -1,
      duration: 350,
      ease: 'Sine.easeInOut'
    }));

    // Auto dismiss
    const totalDuration = Math.max(2500, countDuration + 1500);
    let isFinished = false;

    const finish = () => {
      if (isFinished) return;
      isFinished = true;
      this._finishFn = null;

      // Kill ALL tracked tweens (prevents orphan tweens on tierText, amountText, etc.)
      activeTweens.forEach(t => { if (t.isPlaying()) t.stop(); });
      activeTimers.forEach(t => t.remove());
      emitters.forEach(e => { e.stop(); e.destroy(); });

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

    const dismissTimer = this.scene.time.delayedCall(totalDuration, () => {
      activeTweens.push(this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 400,
        onComplete: finish,
      }));
    });
    activeTimers.push(dismissTimer);

    // Tap to skip
    overlay.on('pointerdown', () => {
      finish();
    });
  }
}
