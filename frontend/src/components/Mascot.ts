import Phaser from 'phaser';

export class Mascot extends Phaser.GameObjects.Container {
  private bodyGraphics!: Phaser.GameObjects.Graphics;
  private isCelebrating = false;
  private isAnticipating = false;
  private idleTween!: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    this.initMascot();
  }

  private initMascot() {
    this.bodyGraphics = this.scene.add.graphics();
    this.add(this.bodyGraphics);

    this.drawBear();
    this.startIdle();
  }

  private drawBear() {
    this.bodyGraphics.clear();
    const g = this.bodyGraphics;

    const baseColor = 0xff3366; // Squishy red/pink
    const shadowColor = 0xcc0033;
    const highlightColor = 0xff99bb;

    // Draw Drop Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(0, 50, 80, 20);

    // Helper to draw shiny parts
    const drawShinyRect = (x: number, y: number, w: number, h: number, r: number) => {
      g.fillStyle(shadowColor, 1);
      g.fillRoundedRect(x + 2, y + 4, w, h, r);
      g.fillStyle(baseColor, 1);
      g.fillRoundedRect(x, y, w, h, r);
      g.fillStyle(highlightColor, 0.8);
      g.fillRoundedRect(x + w * 0.1, y + h * 0.1, w * 0.3, h * 0.2, Math.max(1, r - 4));
    };

    const drawShinyCircle = (x: number, y: number, radius: number) => {
      g.fillStyle(shadowColor, 1);
      g.fillCircle(x + 2, y + 4, radius);
      g.fillStyle(baseColor, 1);
      g.fillCircle(x, y, radius);
      g.fillStyle(highlightColor, 0.8);
      g.fillCircle(x - radius * 0.3, y - radius * 0.3, radius * 0.3);
    };

    // Legs
    drawShinyRect(-25, 20, 20, 30, 10);
    drawShinyRect(5, 20, 20, 30, 10);

    // Arms
    drawShinyRect(-35, -5, 20, 35, 10);
    drawShinyRect(15, -5, 20, 35, 10);

    // Body
    drawShinyRect(-30, -20, 60, 50, 20);

    // Ears
    drawShinyCircle(-20, -45, 12);
    drawShinyCircle(20, -45, 12);

    // Head
    drawShinyRect(-25, -50, 50, 40, 15);

    // Eyes
    g.fillStyle(0x220022, 1);
    g.fillCircle(-10, -35, 4);
    g.fillCircle(10, -35, 4);

    // Cheeks
    g.fillStyle(0xff6699, 0.6);
    g.fillCircle(-15, -28, 5);
    g.fillCircle(15, -28, 5);

    // Snout
    g.fillStyle(0xffbbcc, 1);
    g.fillEllipse(0, -25, 18, 12);
    g.fillStyle(0x220022, 1);
    g.fillCircle(0, -28, 3);
  }

  public startIdle() {
    if (this.idleTween) this.idleTween.stop();
    this.isCelebrating = false;
    this.isAnticipating = false;
    this.setScale(1);
    this.setAngle(0);

    this.idleTween = this.scene.tweens.add({
      targets: this,
      scaleY: 0.95,
      scaleX: 1.05,
      y: this.y + 4,
      yoyo: true,
      repeat: -1,
      duration: 1000,
      ease: 'Sine.easeInOut'
    });
  }

  public celebrate(tier: number = 1) {
    if (this.isCelebrating) return;
    this.isCelebrating = true;
    if (this.idleTween) this.idleTween.stop();

    // Spawn a starburst
    if (this.scene.textures.exists('gold_star')) {
      const stars = this.scene.add.particles(this.x, this.y, 'gold_star', {
        speed: { min: 100, max: 400 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.5, end: 0 },
        lifespan: 600,
        blendMode: 'ADD',
      });
      stars.setDepth(this.depth - 1);
      stars.explode(5 + tier * 5);
      this.scene.time.delayedCall(700, () => stars.destroy());
    }

    // Jump and Spin
    this.scene.tweens.chain({
      targets: this,
      tweens: [
        { scaleY: 0.8, scaleX: 1.2, duration: 100, y: this.y + 10, ease: 'Quad.easeOut' },
        { scaleY: 1.2, scaleX: 0.8, y: this.y - 60, duration: 250, ease: 'Quad.easeOut' },
        { angle: tier >= 3 ? 360 : 0, duration: 300, ease: 'Sine.easeInOut' },
        { scaleY: 0.8, scaleX: 1.2, y: this.y + 10, duration: 200, ease: 'Quad.easeIn' },
        { scaleY: 1, scaleX: 1, y: this.y, duration: 150, ease: 'Elastic.easeOut' }
      ],
      onComplete: () => {
        this.angle = 0;
        if (!this.isAnticipating) this.startIdle();
      }
    });
  }

  public anticipate() {
    if (this.isAnticipating) return;
    this.isAnticipating = true;
    this.isCelebrating = false;
    if (this.idleTween) this.idleTween.stop();

    // Shaking anticipation
    this.scene.tweens.add({
      targets: this,
      x: this.x + 2,
      y: this.y + 2,
      scaleX: 1.05,
      yoyo: true,
      repeat: -1,
      duration: 50,
      ease: 'Linear'
    });
  }

  public stopAnticipate() {
    if (!this.isAnticipating) return;
    this.isAnticipating = false;
    this.scene.tweens.killTweensOf(this);
    this.startIdle();
  }
}
