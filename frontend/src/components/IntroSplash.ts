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
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '58px',
      color: '#ffffff',
      stroke: '#ff006a',
      strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 6, color: '#000000', blur: 6, stroke: true, fill: true }
    }).setOrigin(0.5);
    this.container.add(title);
    this.container.setData('title', title);

    // Features
    const feat1 = this.scene.add.text(0, 0, '⭐ MULTIPLIER SPOTS UP TO 1024X', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '22px',
      color: '#ff0070',
    }).setOrigin(0.5);
    this.container.add(feat1);
    this.container.setData('feat1', feat1);

    const feat2 = this.scene.add.text(0, 0, '💰 25,000X MAX WIN', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '26px',
      color: '#00e676',
      stroke: '#004422',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.container.add(feat2);
    this.container.setData('feat2', feat2);

    // Continue Button
    const btnGfx = this.scene.add.graphics();
    this.container.add(btnGfx);
    this.container.setData('btnGfx', btnGfx);

    const btnTxt = this.scene.add.text(0, 0, 'CONTINUE', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '26px',
      color: '#ffffff',
      shadow: { offsetX: 0, offsetY: 2, color: '#004422', blur: 0, stroke: false, fill: true }
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
      this.scene.tweens.killTweensOf([btnGfx, btnTxt]);
      this.scene.tweens.add({ targets: [btnGfx, btnTxt], scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });
    btnHit.on('pointerout', () => {
      this.scene.tweens.killTweensOf([btnGfx, btnTxt]);
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
    const isMobile = w < 600;

    const overlay = this.container.getData('overlay') as Phaser.GameObjects.Graphics;
    overlay.clear();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, w, h);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);

    const cx = w / 2;
    const cy = h / 2;
    const modalW = Math.min(600, w * 0.95);
    const modalH = Math.min(380, h * 0.65);

    const bg = this.container.getData('bg') as Phaser.GameObjects.Graphics;
    bg.clear();
    
    // Comic drop shadow
    bg.fillStyle(0x3a0055, 1);
    bg.fillRoundedRect(cx - modalW / 2 + 12, cy - modalH / 2 + 12, modalW, modalH, 32);

    // Creamy candy base
    bg.fillGradientStyle(0xfff5f8, 0xfff5f8, 0xffe6f0, 0xffe6f0, 1);
    bg.fillRoundedRect(cx - modalW / 2, cy - modalH / 2, modalW, modalH, 32);

    // Hot pink thick border
    bg.lineStyle(8, 0xff0070, 1);
    bg.strokeRoundedRect(cx - modalW / 2, cy - modalH / 2, modalW, modalH, 32);

    // Inner rim highlight
    bg.lineStyle(4, 0xffffff, 1);
    bg.strokeRoundedRect(cx - modalW / 2 + 6, cy - modalH / 2 + 6, modalW - 12, modalH - 12, 26);

    // Responsive font sizes
    const titleFS = isMobile ? Math.min(36, modalW * 0.1) : Math.min(54, modalW * 0.12);
    const titleStroke = isMobile ? 6 : 8;
    const feat1FS = isMobile ? Math.min(16, modalW * 0.045) : 22;
    const feat2FS = isMobile ? Math.min(18, modalW * 0.05) : 26;
    const btnTxtFS = isMobile ? 22 : 28;

    const title = this.container.getData('title') as Phaser.GameObjects.Text;
    title.setPosition(cx, cy - modalH * 0.3);
    title.setFontSize(titleFS);
    title.setStroke('#ff006a', titleStroke);

    const feat1 = this.container.getData('feat1') as Phaser.GameObjects.Text;
    feat1.setPosition(cx, cy - modalH * 0.05);
    feat1.setFontSize(feat1FS);

    const feat2 = this.container.getData('feat2') as Phaser.GameObjects.Text;
    feat2.setPosition(cx, cy + modalH * 0.08);
    feat2.setFontSize(feat2FS);

    const btnY = cy + modalH * 0.32;
    const btnW = Math.min(260, modalW * 0.65);
    const btnH = Math.min(65, modalH * 0.2);
    const btnR = 20;

    const btnGfx = this.container.getData('btnGfx') as Phaser.GameObjects.Graphics;
    btnGfx.clear();
    btnGfx.setPosition(cx, btnY);
    
    // Massive Green Candy Button
    btnGfx.fillStyle(0x3a0055, 0.4);
    btnGfx.fillRoundedRect(-btnW / 2 + 4, -btnH / 2 + 6, btnW, btnH, btnR); // Shadow
    
    btnGfx.fillGradientStyle(0x00e676, 0x00e676, 0x00b359, 0x00b359, 1);
    btnGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR); // Body
    
    btnGfx.lineStyle(4, 0xffffff, 1);
    btnGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR); // Border

    const btnTxt = this.container.getData('btnTxt') as Phaser.GameObjects.Text;
    btnTxt.setPosition(cx, btnY);
    btnTxt.setFontSize(btnTxtFS);

    const btnHit = this.container.getData('btnHit') as Phaser.GameObjects.Rectangle;
    btnHit.setPosition(cx, btnY).setSize(btnW, btnH);
  }
}
