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
      resolution: 2, fontFamily: '"Outfit", "Inter", sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: '800',
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 3, stroke: false, fill: true }
    }).setOrigin(0.5);
    this.container.add(feat1);
    this.container.setData('feat1', feat1);

    const feat2 = this.scene.add.text(0, 0, '💰 25,000X MAX WIN', {
      resolution: 2, fontFamily: '"Outfit", "Inter", sans-serif',
      fontSize: '22px',
      color: '#ffe600',
      fontStyle: '900',
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 3, stroke: false, fill: true }
    }).setOrigin(0.5);
    this.container.add(feat2);
    this.container.setData('feat2', feat2);

    // Continue Button
    const btnGfx = this.scene.add.graphics();
    this.container.add(btnGfx);
    this.container.setData('btnGfx', btnGfx);

    const btnTxt = this.scene.add.text(0, 0, 'CONTINUE', {
      resolution: 2, fontFamily: '"Outfit", "Inter", sans-serif',
      fontSize: '26px',
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
    const isMobile = w < 600;

    const overlay = this.container.getData('overlay') as Phaser.GameObjects.Graphics;
    overlay.clear();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, w, h);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);

    const cx = w / 2;
    const cy = h / 2;
    const modalW = Math.min(520, w * 0.88);
    const modalH = Math.min(340, h * 0.55);

    const bg = this.container.getData('bg') as Phaser.GameObjects.Graphics;
    bg.clear();
    
    // Outer drop shadow
    bg.fillStyle(0x000000, 0.5);
    bg.fillRoundedRect(cx - modalW / 2 + 8, cy - modalH / 2 + 10, modalW, modalH, 24);

    // Premium dark gradient body
    bg.fillGradientStyle(0x130f24, 0x130f24, 0x0a0812, 0x0a0812, 0.98);
    bg.fillRoundedRect(cx - modalW / 2, cy - modalH / 2, modalW, modalH, 20);

    // Glowing border outline
    bg.lineStyle(2, 0xff006a, 0.6);
    bg.strokeRoundedRect(cx - modalW / 2, cy - modalH / 2, modalW, modalH, 20);

    // Inner rim highlight
    bg.lineStyle(1, 0xffffff, 0.08);
    bg.strokeRoundedRect(cx - modalW / 2 + 2, cy - modalH / 2 + 2, modalW - 4, modalH - 4, 18);

    // Responsive font sizes
    const titleFS = isMobile ? Math.min(32, modalW * 0.08) : Math.min(48, modalW * 0.10);
    const titleStroke = isMobile ? Math.max(3, titleFS * 0.12) : Math.max(5, titleFS * 0.14);
    const feat1FS = isMobile ? Math.min(14, modalW * 0.035) : Math.min(18, modalW * 0.04);
    const feat2FS = isMobile ? Math.min(16, modalW * 0.04) : Math.min(20, modalW * 0.045);
    const btnTxtFS = isMobile ? Math.min(20, modalW * 0.05) : Math.min(24, modalW * 0.055);

    const title = this.container.getData('title') as Phaser.GameObjects.Text;
    title.setPosition(cx, cy - modalH * 0.26);
    title.setFontSize(titleFS);
    title.setStroke('#ff006a', titleStroke);

    const feat1 = this.container.getData('feat1') as Phaser.GameObjects.Text;
    feat1.setPosition(cx, cy - modalH * 0.02);
    feat1.setFontSize(feat1FS);

    const feat2 = this.container.getData('feat2') as Phaser.GameObjects.Text;
    feat2.setPosition(cx, cy + modalH * 0.10);
    feat2.setFontSize(feat2FS);

    const btnY = cy + modalH * 0.33;
    const btnW = Math.min(220, modalW * 0.55);
    const btnH = Math.min(50, modalH * 0.16);
    const btnR = btnH / 2;

    const btnGfx = this.container.getData('btnGfx') as Phaser.GameObjects.Graphics;
    btnGfx.clear();
    
    // Outer drop shadow
    btnGfx.fillStyle(0x000000, 0.4);
    btnGfx.fillRoundedRect(cx - btnW / 2 + 4, btnY - btnH / 2 + 5, btnW, btnH, btnR);

    // Candy-pink gradient body
    btnGfx.fillGradientStyle(0xff006a, 0xff006a, 0xcc0055, 0xcc0055, 1);
    btnGfx.fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, btnR);

    // Inner top highlight (glassmorphic pill)
    btnGfx.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.35, 0.35, 0, 0);
    btnGfx.fillRoundedRect(cx - btnW / 2 + 2, btnY - btnH / 2 + 2, btnW - 4, btnH * 0.4, {
      tl: btnR - 2, tr: btnR - 2, bl: 0, br: 0
    } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);

    // Crisp white border
    btnGfx.lineStyle(2, 0xffffff, 0.9);
    btnGfx.strokeRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, btnR);

    const btnTxt = this.container.getData('btnTxt') as Phaser.GameObjects.Text;
    btnTxt.setPosition(cx, btnY);
    btnTxt.setFontSize(btnTxtFS);

    const btnHit = this.container.getData('btnHit') as Phaser.GameObjects.Rectangle;
    btnHit.setPosition(cx, btnY).setSize(btnW, btnH);
  }
}
