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
 */
export class WinCelebration {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private _isVisible = false;

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
    this.scene.tweens.add({
      targets: tierText,
      scale: 1,
      duration: 600,
      ease: 'Back.easeOut',
    });

    // Count up animation
    this.scene.tweens.add({
      targets: amountText,
      alpha: 1,
      duration: 300,
      delay: 400,
    });

    const countDuration = Math.min(2000, multiplier * 30);
    let elapsed = 0;
    const countTimer = this.scene.time.addEvent({
      delay: 16,
      repeat: Math.floor(countDuration / 16),
      callback: () => {
        elapsed += 16;
        const progress = Math.min(elapsed / countDuration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
        const currentAmount = winAmount * eased;
        amountText.setText(currentAmount.toFixed(2));
      },
    });

    // Particle shower for big wins
    if (multiplier >= 10) {
      for (let i = 0; i < Math.min(12, Math.floor(multiplier / 5)); i++) {
        const px = Phaser.Math.Between(Math.floor(w * 0.05), Math.floor(w * 0.95));
        const emitter = this.scene.add.particles(px, -20, `candy_${Phaser.Math.Between(0, 6)}`, {
          speed: { min: 80, max: 350 },
          angle: { min: 60, max: 120 },
          scale: { start: 0.35, end: 0.05 },
          lifespan: 3000,
          quantity: 1,
          gravityY: 180,
          frequency: 200,
        });
        this.container.add(emitter);
        this.scene.time.delayedCall(3500, () => emitter.stop());
      }
    }

    // Glow pulse on tier text
    this.scene.tweens.add({
      targets: tierText,
      scale: { from: 1, to: 1.1 },
      yoyo: true,
      repeat: 3,
      duration: 400,
      delay: 700,
    });

    // Auto dismiss
    const totalDuration = Math.max(2500, countDuration + 1500);
    let isFinished = false;

    const finish = () => {
      if (isFinished) return;
      isFinished = true;
      countTimer.remove();
      this.scene.tweens.killTweensOf(this.container);
      this.container.destroy();
      this._isVisible = false;
      onComplete();
    };

    const dismissTimer = this.scene.time.delayedCall(totalDuration, () => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 400,
        onComplete: finish,
      });
    });

    // Tap to skip
    overlay.on('pointerdown', () => {
      dismissTimer.remove();
      finish();
    });
  }
}
