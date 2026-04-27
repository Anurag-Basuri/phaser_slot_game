import Phaser from 'phaser';

/**
 * Boot Scene — Sugar Rush 1000 style premium title screen.
 * Uses the actual candy-land background image for authentic Pragmatic Play aesthetic.
 */
export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // === CANDY LAND BACKGROUND (actual image — no more programmatic gradients) ===
    const bg = this.add.image(w / 2, h / 2, 'game_bg');
    const bgScaleX = w / bg.width;
    const bgScaleY = h / bg.height;
    bg.setScale(Math.max(bgScaleX, bgScaleY));

    // Subtle vignette overlay for text readability over bright background
    const vignette = this.add.graphics();
    // Center-transparent radial vignette (darker at edges, clearer at center)
    vignette.fillStyle(0x000000, 0.25);
    vignette.fillRect(0, 0, w, h);
    // Clear out center for visibility of background
    vignette.fillStyle(0x000000, 0.0);
    vignette.fillCircle(w / 2, h * 0.4, Math.min(w, h) * 0.5);

    // === FLOATING CANDY BACKGROUND PARTICLES ===
    for (let i = 0; i < 8; i++) {
      const x = Phaser.Math.Between(Math.floor(w * 0.05), Math.floor(w * 0.95));
      const y = Phaser.Math.Between(Math.floor(h * 0.15), Math.floor(h * 0.85));
      const candy = this.add.sprite(x, y, `candy_${i % 7}`);
      candy.setScale(Phaser.Math.FloatBetween(0.12, 0.22)).setAlpha(0.25);
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

    // === CENTRAL GLOW (adjusted for bright background) ===
    const centerGlow = this.add.graphics();
    centerGlow.fillStyle(0xffffff, 0.12);
    centerGlow.fillCircle(w / 2, h * 0.38, Math.min(350, w * 0.35));
    centerGlow.fillStyle(0xffccee, 0.08);
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
    
    // Stack multiple texts to create a thick 3D extrusion/bevel effect
    const titleShadow = this.add.text(w / 2, h * 0.28 + 8, 'SUGAR RUSH', {
      fontSize: `${titleFontSize}px`, fontFamily: '"Luckiest Guy", cursive, sans-serif', color: '#660033'
    }).setOrigin(0.5).setAlpha(0).setScale(0.5);

    const titleBack = this.add.text(w / 2, h * 0.28 + 4, 'SUGAR RUSH', {
      fontSize: `${titleFontSize}px`, fontFamily: '"Luckiest Guy", cursive, sans-serif', color: '#cc0066',
      stroke: '#ffffff', strokeThickness: Math.max(8, titleFontSize * 0.15)
    }).setOrigin(0.5).setAlpha(0).setScale(0.5);

    const titleMain = this.add.text(w / 2, h * 0.28, 'SUGAR RUSH', {
      fontSize: `${titleFontSize}px`,
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ff66b3', // fallback
      fontStyle: 'bold',
      stroke: '#ffffff',
      strokeThickness: Math.max(4, titleFontSize * 0.06),
    }).setOrigin(0.5).setAlpha(0).setScale(0.5);
    
    // Apply gradient
    const grad1 = titleMain.context.createLinearGradient(0, 0, 0, titleMain.height);
    grad1.addColorStop(0, '#ff99cc');
    grad1.addColorStop(0.5, '#ff3399');
    grad1.addColorStop(1, '#e60073');
    titleMain.setFill(grad1);

    // === TITLE — "1000" ===
    const numFontSize = Math.min(120, w * 0.15);
    
    const numShadow = this.add.text(w / 2, h * 0.42 + 10, '1000', {
      fontSize: `${numFontSize}px`, fontFamily: '"Luckiest Guy", cursive, sans-serif', color: '#990000'
    }).setOrigin(0.5).setAlpha(0).setScale(0.3);

    const numBack = this.add.text(w / 2, h * 0.42 + 5, '1000', {
      fontSize: `${numFontSize}px`, fontFamily: '"Luckiest Guy", cursive, sans-serif', color: '#ff6600',
      stroke: '#ff0066', strokeThickness: Math.max(12, numFontSize * 0.1)
    }).setOrigin(0.5).setAlpha(0).setScale(0.3);

    const title1000 = this.add.text(w / 2, h * 0.42, '1000', {
      fontSize: `${numFontSize}px`,
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffe600',
      fontStyle: 'bold',
      stroke: '#ffffff',
      strokeThickness: Math.max(4, numFontSize * 0.04),
    }).setOrigin(0.5).setAlpha(0).setScale(0.3);

    const grad2 = title1000.context.createLinearGradient(0, 0, 0, title1000.height);
    grad2.addColorStop(0, '#ffff66');
    grad2.addColorStop(0.5, '#ffcc00');
    grad2.addColorStop(1, '#ff9900');
    title1000.setFill(grad2);

    // === SUBTITLE ===
    const subFontSize = Math.min(18, w * 0.025);
    const subtitle = this.add.text(w / 2, h * 0.54, '7×7 Cluster Pays  •  Cascading Reels  •  Up to 25,000× Win', {
      fontSize: `${subFontSize}px`,
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#333333',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setAlpha(0);

    // === ENTRANCE ANIMATIONS ===
    this.tweens.add({
      targets: [titleShadow, titleBack, titleMain],
      alpha: 1, scale: 1, y: `-=${h * 0.02}`,
      duration: 800, ease: 'Back.easeOut',
    });
    
    // Continuous subtle float for "SUGAR RUSH"
    this.tweens.add({
      targets: [titleShadow, titleBack, titleMain],
      y: `-=8`,
      yoyo: true, repeat: -1,
      duration: 2500, ease: 'Sine.easeInOut',
      delay: 800
    });

    this.tweens.add({
      targets: [numShadow, numBack, title1000],
      alpha: 1, scale: 1, y: `-=${h * 0.02}`,
      duration: 800, delay: 250, ease: 'Back.easeOut',
    });
    
    this.tweens.add({
      targets: subtitle,
      alpha: 1, duration: 500, delay: 600,
    });

    // === "1000" GLOW PULSE ===
    this.tweens.add({
      targets: [numShadow, numBack, title1000],
      scale: { from: 1, to: 1.05 },
      yoyo: true, repeat: -1,
      duration: 1800, ease: 'Sine.easeInOut', delay: 1200,
    });

    // === PREMIUM PLAY BUTTON ===
    const btnW = Math.min(300, w * 0.45);
    const btnH = Math.min(75, h * 0.09);
    const btnY = h * 0.64;
    const btnX = w / 2;
    const btnRadius = Math.min(35, btnH * 0.5); // Fully rounded pill

    // Button container for easy scaling
    const btnContainer = this.add.container(btnX, btnY).setAlpha(0);

    // Outer glow
    const btnGlow = this.add.graphics();
    btnGlow.fillStyle(0xff006a, 0.4);
    btnGlow.fillRoundedRect(-btnW / 2 - 15, -btnH / 2 - 15, btnW + 30, btnH + 30, btnRadius + 10);
    btnContainer.add(btnGlow);

    // Button background layered
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x000000, 0.5);
    btnBg.fillRoundedRect(-btnW / 2, -btnH / 2 + 6, btnW, btnH, btnRadius); // shadow
    btnBg.fillStyle(0xff006a, 1);
    btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnRadius); // base
    btnBg.fillStyle(0xff3388, 1);
    btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH * 0.5, btnRadius); // top gloss
    btnBg.fillStyle(0xffffff, 0.25);
    btnBg.fillRoundedRect(-btnW / 2 + 5, -btnH / 2 + 3, btnW - 10, btnH * 0.2, btnRadius - 2); // crisp highlight
    btnBg.lineStyle(3, 0xffffff, 0.9);
    btnBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnRadius); // rim
    btnContainer.add(btnBg);

    // Button text
    const playFontSize = Math.min(32, btnH * 0.45);
    const playText = this.add.text(0, 0, '▶  PLAY', {
      fontSize: `${playFontSize}px`,
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
      shadow: { offsetX: 0, offsetY: 3, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5);
    btnContainer.add(playText);

    // Hit area inside container
    const playBtn = this.add.rectangle(0, 0, btnW, btnH, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    btnContainer.add(playBtn);

    // Animate button entrance
    this.tweens.add({
      targets: btnContainer,
      alpha: 1, y: btnY - 10,
      duration: 600, delay: 900, ease: 'Back.easeOut'
    });

    // Hover pop & float
    this.tweens.add({
      targets: btnGlow,
      alpha: { from: 0.4, to: 0.8 },
      scale: { from: 1, to: 1.05 },
      yoyo: true, repeat: -1,
      duration: 1200, ease: 'Sine.easeInOut',
    });

    playBtn.on('pointerover', () => {
      this.tweens.add({ targets: btnContainer, scale: 1.08, duration: 150, ease: 'Back.easeOut' });
      btnBg.lineStyle(4, 0xffff00, 1); // gold rim on hover
      btnBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnRadius);
    });

    playBtn.on('pointerout', () => {
      this.tweens.add({ targets: btnContainer, scale: 1, duration: 150, ease: 'Back.easeIn' });
      btnBg.clear();
      btnBg.fillStyle(0x000000, 0.5).fillRoundedRect(-btnW / 2, -btnH / 2 + 6, btnW, btnH, btnRadius);
      btnBg.fillStyle(0xff006a, 1).fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnRadius);
      btnBg.fillStyle(0xff3388, 1).fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH * 0.5, btnRadius);
      btnBg.fillStyle(0xffffff, 0.25).fillRoundedRect(-btnW / 2 + 5, -btnH / 2 + 3, btnW - 10, btnH * 0.2, btnRadius - 2);
      btnBg.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnRadius);
    });

    playBtn.on('pointerdown', () => {
      this.tweens.add({ targets: btnContainer, scale: 0.95, duration: 100, yoyo: true });
      
      // Smooth fade transition
      this.cameras.main.fade(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('Game');
      });
    });

    // === FOOTER INFO ===
    const footerFontSize = Math.min(13, w * 0.018);
    this.add.text(w / 2, h * 0.93, 'RTP: 96.53%  |  High Volatility  |  Cluster Pays  |  v1.0.0', {
      fontSize: `${footerFontSize}px`,
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5);

    // === PRAGMATIC PLAY STYLE BRANDING ===
    this.add.text(w / 2, h * 0.97, 'Powered by Stake Engine', {
      fontSize: `${Math.max(10, footerFontSize - 2)}px`,
      fontFamily: 'Arial, sans-serif',
      color: '#dddddd',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5);
  }
}
