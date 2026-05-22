import Phaser from 'phaser';

export class IntroSplash {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private isVisible = false;
  private onCompleteFn: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
    this.scene.scale.on('resize', this.resize, this);
  }

  private create() {
    this.container = this.scene.add.container(0, 0).setDepth(2000).setVisible(false);

    // Dark overlay
    const overlay = this.scene.add.graphics();
    this.container.add(overlay);
    this.container.setData('overlay', overlay);

    // Modal BG
    const bg = this.scene.add.graphics();
    this.container.add(bg);
    this.container.setData('bg', bg);

    // Title
    const title = this.scene.add.text(0, 0, 'SUGAR BLAST 1000', {
      resolution: 2, fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '48px',
      color: '#ff006a',
      stroke: '#ffffff',
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 4, color: '#000000', blur: 4, stroke: true, fill: true }
    }).setOrigin(0.5);
    this.container.add(title);
    this.container.setData('title', title);

    // Features
    const feat1 = this.scene.add.text(0, 0, '⭐ MULTIPLIER SPOTS UP TO 1024X', {
      resolution: 2, fontFamily: '"Poppins", sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: '800'
    }).setOrigin(0.5);
    this.container.add(feat1);
    this.container.setData('feat1', feat1);

    const feat2 = this.scene.add.text(0, 0, '💰 25,000X MAX WIN', {
      resolution: 2, fontFamily: '"Poppins", sans-serif',
      fontSize: '22px',
      color: '#ffe600',
      fontStyle: '800'
    }).setOrigin(0.5);
    this.container.add(feat2);
    this.container.setData('feat2', feat2);

    // Continue Button
    const btnGfx = this.scene.add.graphics();
    this.container.add(btnGfx);
    this.container.setData('btnGfx', btnGfx);

    const btnTxt = this.scene.add.text(0, 0, 'CONTINUE', {
      resolution: 2, fontFamily: '"Poppins", sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: '900',
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 2, stroke: true, fill: true }
    }).setOrigin(0.5);
    this.container.add(btnTxt);
    this.container.setData('btnTxt', btnTxt);

    const btnHit = this.scene.add.rectangle(0, 0, 240, 60, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    this.container.add(btnHit);
    this.container.setData('btnHit', btnHit);

    btnHit.on('pointerdown', () => {
      if (!this.isVisible) return;
      this.hide();
    });

    btnHit.on('pointerover', () => {
      this.scene.tweens.add({ targets: [btnGfx, btnTxt], scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    btnHit.on('pointerout', () => {
      this.scene.tweens.add({ targets: [btnGfx, btnTxt], scaleX: 1, scaleY: 1, duration: 100 });
    });
  }

  public show(onComplete: () => void) {
    if (this.isVisible) return;
    this.isVisible = true;
    this.onCompleteFn = onComplete;
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300
    });
    this.resize();
  }

  public hide() {
    this.isVisible = false;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.container.setVisible(false);
        if (this.onCompleteFn) this.onCompleteFn();
      }
    });
  }

  public resize() {
    if (!this.isVisible) return;
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    const overlay = this.container.getData('overlay') as Phaser.GameObjects.Graphics;
    overlay.clear();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, w, h);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);

    const cx = w / 2;
    const cy = h / 2;
    const modalW = Math.min(500, w * 0.95);
    const modalH = 320;

    const bg = this.container.getData('bg') as Phaser.GameObjects.Graphics;
    bg.clear();
    bg.fillStyle(0x1a0a2a, 0.95);
    bg.fillRoundedRect(cx - modalW / 2, cy - modalH / 2, modalW, modalH, 20);
    bg.lineStyle(3, 0xff006a, 1);
    bg.strokeRoundedRect(cx - modalW / 2, cy - modalH / 2, modalW, modalH, 20);

    const title = this.container.getData('title') as Phaser.GameObjects.Text;
    title.setPosition(cx, cy - 90);

    const feat1 = this.container.getData('feat1') as Phaser.GameObjects.Text;
    feat1.setPosition(cx, cy - 10);

    const feat2 = this.container.getData('feat2') as Phaser.GameObjects.Text;
    feat2.setPosition(cx, cy + 30);

    const btnY = cy + 100;
    const btnW = 200;
    const btnH = 50;

    const btnGfx = this.container.getData('btnGfx') as Phaser.GameObjects.Graphics;
    btnGfx.clear();
    btnGfx.fillGradientStyle(0xff006a, 0xff006a, 0xcc0044, 0xcc0044, 1);
    btnGfx.fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, btnH / 2);
    btnGfx.lineStyle(2, 0xffffff, 0.8);
    btnGfx.strokeRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, btnH / 2);

    const btnTxt = this.container.getData('btnTxt') as Phaser.GameObjects.Text;
    btnTxt.setPosition(cx, btnY);

    const btnHit = this.container.getData('btnHit') as Phaser.GameObjects.Rectangle;
    btnHit.setPosition(cx, btnY).setSize(btnW, btnH);
  }
}
