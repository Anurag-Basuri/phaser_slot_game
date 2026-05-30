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

    // Dark overlay — clicking outside the modal dismisses it
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
      stroke: '#7b2ff2',
      strokeThickness: 10,
      shadow: { offsetX: 0, offsetY: 6, color: '#1a0033', blur: 0, stroke: true, fill: true },
      resolution: 2
    }).setOrigin(0.5);
    this.container.add(title);
    this.container.setData('title', title);

    // Divider line
    const divider = this.scene.add.graphics();
    this.container.add(divider);
    this.container.setData('divider', divider);

    // Features
    const feat1 = this.scene.add.text(0, 0, '⭐  MULTIPLIER SPOTS UP TO 1024X', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '22px',
      color: '#ffe066',
      shadow: { offsetX: 0, offsetY: 3, color: '#33004d', blur: 0, stroke: false, fill: true },
      resolution: 2
    }).setOrigin(0.5);
    this.container.add(feat1);
    this.container.setData('feat1', feat1);

    const feat2 = this.scene.add.text(0, 0, '💰  25,000X MAX WIN', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '26px',
      color: '#00ff88',
      stroke: '#003322',
      strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 3, color: '#001a11', blur: 0, stroke: false, fill: true },
      resolution: 2
    }).setOrigin(0.5);
    this.container.add(feat2);
    this.container.setData('feat2', feat2);

    // Continue Button
    const btnGfx = this.scene.add.graphics();
    this.container.add(btnGfx);
    this.container.setData('btnGfx', btnGfx);

    const btnTxt = this.scene.add.text(0, 0, 'CONTINUE', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#005522',
      strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 4, color: '#003311', blur: 0, stroke: false, fill: true },
      resolution: 2
    }).setOrigin(0.5);
    this.container.add(btnTxt);
    this.container.setData('btnTxt', btnTxt);

    const btnHit = this.scene.add.rectangle(0, 0, 260, 65, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    this.container.add(btnHit);
    this.container.setData('btnHit', btnHit);

    btnHit.on('pointerdown', () => {
      if (!this.isVisible) return;
      this.hide();
    });

    btnHit.on('pointerover', () => {
      this.scene.tweens.killTweensOf([btnGfx, btnTxt]);
      this.scene.tweens.add({ targets: [btnGfx, btnTxt], scaleX: 1.06, scaleY: 1.06, duration: 120, ease: 'Back.easeOut' });
    });
    btnHit.on('pointerout', () => {
      this.scene.tweens.killTweensOf([btnGfx, btnTxt]);
      this.scene.tweens.add({ targets: [btnGfx, btnTxt], scaleX: 1, scaleY: 1, duration: 120 });
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
      duration: 350,
      ease: 'Cubic.easeOut'
    });
    this.resize();
  }

  public hide() {
    this.isVisible = false;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 250,
      ease: 'Cubic.easeIn',
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

    // ── Dark overlay (click outside to continue) ──
    const overlay = this.container.getData('overlay') as Phaser.GameObjects.Graphics;
    overlay.clear();
    overlay.fillStyle(0x0a0015, 0.82);
    overlay.fillRect(0, 0, w, h);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    overlay.removeAllListeners();
    overlay.on('pointerdown', () => {
      if (this.isVisible) this.hide();
    });

    const cx = w / 2;
    const cy = h / 2;
    const modalW = Math.min(580, w * 0.92);
    const modalH = Math.min(400, h * 0.68);

    // ── Modal Background — Rich purple candy gradient ──
    const bg = this.container.getData('bg') as Phaser.GameObjects.Graphics;
    bg.clear();

    const mX = cx - modalW / 2;
    const mY = cy - modalH / 2;

    // Deep shadow
    bg.fillStyle(0x0a0015, 0.7);
    bg.fillRoundedRect(mX + 8, mY + 10, modalW, modalH, 28);

    // Main gradient body — deep purple to violet
    bg.fillGradientStyle(0x2d1052, 0x3a1866, 0x1a0a3a, 0x220e48, 1, 1, 1, 1);
    bg.fillRoundedRect(mX, mY, modalW, modalH, 28);

    // Glossy top reflection
    bg.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.12, 0.12, 0, 0);
    bg.fillRoundedRect(mX + 4, mY + 4, modalW - 8, modalH * 0.35, { tl: 24, tr: 24, bl: 0, br: 0 });

    // Thick golden candy border
    bg.lineStyle(6, 0xffc844, 1);
    bg.strokeRoundedRect(mX, mY, modalW, modalH, 28);

    // Inner white highlight rim
    bg.lineStyle(2, 0xffffff, 0.35);
    bg.strokeRoundedRect(mX + 5, mY + 5, modalW - 10, modalH - 10, 22);

    // ── Responsive font sizes ──
    const titleFS = isMobile ? Math.min(34, modalW * 0.09) : Math.min(52, modalW * 0.11);
    const titleStroke = isMobile ? 7 : 10;
    const feat1FS = isMobile ? Math.min(16, modalW * 0.044) : 21;
    const feat2FS = isMobile ? Math.min(18, modalW * 0.05) : 25;
    const btnTxtFS = isMobile ? 22 : 28;

    // ── Title ──
    const title = this.container.getData('title') as Phaser.GameObjects.Text;
    title.setPosition(cx, cy - modalH * 0.30);
    title.setFontSize(titleFS);
    title.setStroke('#7b2ff2', titleStroke);

    // ── Divider ──
    const divider = this.container.getData('divider') as Phaser.GameObjects.Graphics;
    divider.clear();
    const divY = cy - modalH * 0.14;
    const divHalfW = modalW * 0.3;
    divider.lineStyle(2, 0xffc844, 0.5);
    divider.lineBetween(cx - divHalfW, divY, cx + divHalfW, divY);
    // Diamond center ornament
    divider.fillStyle(0xffc844, 0.7);
    divider.fillRect(cx - 4, divY - 4, 8, 8);

    // ── Features ──
    const feat1 = this.container.getData('feat1') as Phaser.GameObjects.Text;
    feat1.setPosition(cx, cy - modalH * 0.02);
    feat1.setFontSize(feat1FS);

    const feat2 = this.container.getData('feat2') as Phaser.GameObjects.Text;
    feat2.setPosition(cx, cy + modalH * 0.12);
    feat2.setFontSize(feat2FS);

    // ── Continue Button ──
    const btnY = cy + modalH * 0.34;
    const btnW = Math.min(260, modalW * 0.6);
    const btnH = Math.min(62, modalH * 0.18);
    const btnR = 18;

    const btnGfx = this.container.getData('btnGfx') as Phaser.GameObjects.Graphics;
    btnGfx.clear();
    btnGfx.setPosition(cx, btnY);

    // Button shadow
    btnGfx.fillStyle(0x003311, 0.6);
    btnGfx.fillRoundedRect(-btnW / 2 + 3, -btnH / 2 + 5, btnW, btnH, btnR);

    // Button body gradient
    btnGfx.fillGradientStyle(0x00e676, 0x00e676, 0x00b050, 0x00b050, 1, 1, 1, 1);
    btnGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR);

    // Top highlight
    btnGfx.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.3, 0.3, 0, 0);
    btnGfx.fillRoundedRect(-btnW / 2 + 4, -btnH / 2 + 2, btnW - 8, btnH * 0.4, { tl: btnR - 2, tr: btnR - 2, bl: 0, br: 0 });

    // White border
    btnGfx.lineStyle(3, 0xffffff, 0.9);
    btnGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR);

    const btnTxt = this.container.getData('btnTxt') as Phaser.GameObjects.Text;
    btnTxt.setPosition(cx, btnY);
    btnTxt.setFontSize(btnTxtFS);

    const btnHit = this.container.getData('btnHit') as Phaser.GameObjects.Rectangle;
    btnHit.setPosition(cx, btnY).setSize(btnW + 20, btnH + 10);
  }
}
