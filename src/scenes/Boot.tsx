import Phaser from 'phaser';

/**
 * Boot Scene — Sugar Rush 1000 style premium title screen.
 * Matches Pragmatic Play's candy-land aesthetic with vibrant animations.
 */
export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // === BRIGHT CANDY LAND BACKGROUND (fully programmatic) ===
    // Hide dark bg image — draw bright gradient instead
    const bg = this.add.image(w / 2, h / 2, 'candyland_bg').setDisplaySize(w, h).setVisible(false);
    
    const gradient = this.add.graphics();
    const steps = 25;
    const stepH = h / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      // Sky blue at top → pastel pink at bottom
      const r = Math.floor(0x87 + (0xff - 0x87) * t);
      const g = Math.floor(0xce + (0x99 - 0xce) * t);
      const b = Math.floor(0xfa + (0xcc - 0xfa) * t);
      const color = (r << 16) | (g << 8) | b;
      gradient.fillStyle(color, 1);
      gradient.fillRect(0, i * stepH, w, stepH + 1);
    }
    
    // Pink candy hills
    gradient.fillStyle(0xffaacc, 0.7);
    for (let i = 0; i < 7; i++) {
      const hx = (w / 6) * i;
      const hy = h * 0.78 + Math.sin(i * 1.3) * h * 0.06;
      gradient.fillCircle(hx, hy, w * 0.18);
    }
    gradient.fillStyle(0xff99bb, 0.6);
    for (let i = 0; i < 5; i++) {
      const hx = (w / 4) * i + w * 0.12;
      const hy = h * 0.88;
      gradient.fillCircle(hx, hy, w * 0.15);
    }
    gradient.fillStyle(0xffbbdd, 0.8);
    gradient.fillRect(0, h * 0.9, w, h * 0.1);
    
    // White fluffy clouds
    gradient.fillStyle(0xffffff, 0.5);
    gradient.fillCircle(w * 0.12, h * 0.08, 45);
    gradient.fillCircle(w * 0.15, h * 0.06, 35);
    gradient.fillCircle(w * 0.09, h * 0.07, 30);
    gradient.fillCircle(w * 0.8, h * 0.1, 40);
    gradient.fillCircle(w * 0.83, h * 0.08, 32);
    gradient.fillCircle(w * 0.45, h * 0.05, 28);
    gradient.fillCircle(w * 0.48, h * 0.04, 22);

    // === FLOATING CANDY BACKGROUND PARTICLES ===
    for (let i = 0; i < 8; i++) {
      const x = Phaser.Math.Between(Math.floor(w * 0.05), Math.floor(w * 0.95));
      const y = Phaser.Math.Between(Math.floor(h * 0.15), Math.floor(h * 0.85));
      const candy = this.add.sprite(x, y, `candy_${i % 7}`);
      candy.setScale(Phaser.Math.FloatBetween(0.15, 0.28)).setAlpha(0.2);
      this.tweens.add({
        targets: candy,
        y: y - Phaser.Math.Between(20, 50),
        rotation: Phaser.Math.FloatBetween(-0.15, 0.15),
        yoyo: true,
        repeat: -1,
        duration: Phaser.Math.Between(2500, 5000),
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    // === CENTRAL GLOW ===
    const centerGlow = this.add.graphics();
    centerGlow.fillStyle(0xff00cc, 0.08);
    centerGlow.fillCircle(w / 2, h * 0.38, Math.min(350, w * 0.35));
    centerGlow.fillStyle(0xff66aa, 0.05);
    centerGlow.fillCircle(w / 2, h * 0.38, Math.min(500, w * 0.50));
    this.tweens.add({
      targets: centerGlow,
      alpha: { from: 0.6, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 2000,
      ease: 'Sine.easeInOut',
    });

    // === TITLE — "SUGAR RUSH" ===
    const titleFontSize = Math.min(72, w * 0.09);
    const titleMain = this.add.text(w / 2, h * 0.28, 'SUGAR RUSH', {
      fontSize: `${titleFontSize}px`,
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ff3399',
      fontStyle: 'bold',
      stroke: '#ffffff',
      strokeThickness: Math.max(6, titleFontSize * 0.1),
      shadow: {
        offsetX: 0, offsetY: 4,
        color: '#990044', blur: 12, fill: true,
      },
    }).setOrigin(0.5).setAlpha(0).setScale(0.5);

    // === TITLE — "1000" ===
    const numFontSize = Math.min(120, w * 0.15);
    const title1000 = this.add.text(w / 2, h * 0.42, '1000', {
      fontSize: `${numFontSize}px`,
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffe600',
      fontStyle: 'bold',
      stroke: '#ff0066',
      strokeThickness: Math.max(8, numFontSize * 0.08),
      shadow: {
        offsetX: 0, offsetY: 6,
        color: '#cc0044', blur: 20, fill: true,
      },
    }).setOrigin(0.5).setAlpha(0).setScale(0.3);

    // === SUBTITLE ===
    const subFontSize = Math.min(18, w * 0.025);
    const subtitle = this.add.text(w / 2, h * 0.54, '7×7 Cluster Pays  •  Cascading Reels  •  Up to 25,000× Win', {
      fontSize: `${subFontSize}px`,
      fontFamily: 'Arial, sans-serif',
      color: '#bbaacc',
      align: 'center',
    }).setOrigin(0.5).setAlpha(0);

    // === ENTRANCE ANIMATIONS ===
    // Title swoops in with scale + fade
    this.tweens.add({
      targets: titleMain,
      alpha: 1,
      scale: 1,
      y: h * 0.26,
      duration: 700,
      ease: 'Back.easeOut',
    });
    // "1000" slams in after title
    this.tweens.add({
      targets: title1000,
      alpha: 1,
      scale: 1,
      y: h * 0.40,
      duration: 700,
      delay: 250,
      ease: 'Back.easeOut',
    });
    // Subtitle fades in
    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      duration: 500,
      delay: 600,
    });

    // === "1000" GLOW PULSE ===
    this.tweens.add({
      targets: title1000,
      scale: { from: 1, to: 1.06 },
      yoyo: true,
      repeat: -1,
      duration: 1800,
      ease: 'Sine.easeInOut',
      delay: 1200,
    });

    // === PLAY BUTTON ===
    const btnW = Math.min(300, w * 0.45);
    const btnH = Math.min(75, h * 0.09);
    const btnY = h * 0.64;
    const btnX = w / 2;
    const btnRadius = Math.min(16, btnH * 0.22);

    // Outer glow
    const btnGlow = this.add.graphics().setAlpha(0);
    btnGlow.fillStyle(0xff006a, 0.25);
    btnGlow.fillRoundedRect(btnX - btnW / 2 - 12, btnY - btnH / 2 - 12, btnW + 24, btnH + 24, btnRadius + 8);

    // Button background
    const btnBg = this.add.graphics().setAlpha(0);
    // Drop shadow
    btnBg.fillStyle(0x000000, 0.4);
    btnBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2 + 4, btnW, btnH, btnRadius);
    // Main gradient — pink/magenta
    btnBg.fillStyle(0xff006a, 1);
    btnBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, btnRadius);
    // Top highlight
    btnBg.fillStyle(0xff3388, 1);
    btnBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH * 0.5, btnRadius);
    // Glass edge
    btnBg.fillStyle(0xffffff, 0.15);
    btnBg.fillRoundedRect(btnX - btnW / 2 + 3, btnY - btnH / 2 + 3, btnW - 6, Math.max(4, btnH * 0.15), Math.max(2, btnRadius - 2));
    // Border
    btnBg.lineStyle(2.5, 0xffffff, 0.7);
    btnBg.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, btnRadius);

    // Hit area
    const playBtn = this.add.rectangle(btnX, btnY, btnW, btnH, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001);

    // Button text
    const playFontSize = Math.min(32, btnH * 0.45);
    const playText = this.add.text(btnX, btnY, '▶  PLAY', {
      fontSize: `${playFontSize}px`,
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
      shadow: {
        offsetX: 0, offsetY: 2,
        color: '#000000', blur: 4, fill: true,
      },
    }).setOrigin(0.5).setAlpha(0);

    // Animate button entrance
    this.tweens.add({
      targets: [btnBg, btnGlow, playText],
      alpha: 1,
      duration: 500,
      delay: 900,
    });

    // Glow pulse on button
    this.tweens.add({
      targets: btnGlow,
      alpha: { from: 0.4, to: 0.8 },
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut',
      delay: 1500,
    });

    // Hover effects
    playBtn.on('pointerover', () => {
      this.tweens.add({ targets: [btnBg, playText], scaleX: 1.04, scaleY: 1.04, duration: 120 });
    });
    playBtn.on('pointerout', () => {
      this.tweens.add({ targets: [btnBg, playText], scaleX: 1, scaleY: 1, duration: 120 });
    });

    // Click handler
    playBtn.on('pointerdown', () => {
      this.tweens.killAll();
      this.tweens.add({
        targets: [titleMain, title1000, subtitle, btnBg, playText, btnGlow, centerGlow, gradient],
        alpha: 0,
        duration: 350,
        onComplete: () => this.scene.start('Game'),
      });
    });

    // === FOOTER INFO ===
    const footerFontSize = Math.min(13, w * 0.018);
    this.add.text(w / 2, h * 0.93, 'RTP: 96.53%  |  High Volatility  |  Cluster Pays  |  v1.0.0', {
      fontSize: `${footerFontSize}px`,
      fontFamily: 'Arial, sans-serif',
      color: '#443355',
      align: 'center',
    }).setOrigin(0.5);

    // === PRAGMATIC PLAY STYLE BRANDING ===
    this.add.text(w / 2, h * 0.97, 'Powered by Stake Engine', {
      fontSize: `${Math.max(10, footerFontSize - 2)}px`,
      fontFamily: 'Arial, sans-serif',
      color: '#332244',
      align: 'center',
    }).setOrigin(0.5);
  }
}
