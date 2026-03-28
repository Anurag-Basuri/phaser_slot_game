import Phaser from 'phaser';

export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // Candy land background
    this.add.image(w / 2, h / 2, 'candyland_bg').setDisplaySize(w, h);

    // Dark overlay with gradient-like feel
    const overlay = this.add.graphics();
    overlay.fillStyle(0x0a0f1c, 0.55);
    overlay.fillRect(0, 0, w, h);
    // Top/bottom gradient bars
    overlay.fillStyle(0x050a14, 0.7);
    overlay.fillRect(0, 0, w, h * 0.15);
    overlay.fillRect(0, h * 0.85, w, h * 0.15);

    // Floating candy particles in background
    for (let i = 0; i < 6; i++) {
      const x = Phaser.Math.Between(Math.floor(w * 0.1), Math.floor(w * 0.9));
      const y = Phaser.Math.Between(Math.floor(h * 0.2), Math.floor(h * 0.8));
      const candy = this.add.sprite(x, y, `candy_${i}`);
      candy.setScale(0.25).setAlpha(0.3);
      this.tweens.add({
        targets: candy,
        y: y - 30,
        rotation: Phaser.Math.FloatBetween(-0.2, 0.2),
        yoyo: true,
        repeat: -1,
        duration: Phaser.Math.Between(2000, 4000),
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 1500),
      });
    }

    // Title — "SWEET CLUSTER"
    const titleMain = this.add.text(w / 2, h * 0.30, 'SWEET CLUSTER', {
      fontSize: '68px', color: '#ff00cc', fontStyle: 'bold',
      stroke: '#ffffff', strokeThickness: 8
    }).setOrigin(0.5).setAlpha(0);

    // Title — "1000"
    const title1000 = this.add.text(w / 2, h * 0.42, '1000', {
      fontSize: '110px', color: '#ffe600', fontStyle: 'bold',
      stroke: '#ff0066', strokeThickness: 10
    }).setOrigin(0.5).setAlpha(0);

    // Subtitle
    const subtitle = this.add.text(w / 2, h * 0.52, '7×7 Cluster Pays  •  Cascading Reels  •  Up to 25,000× Win', {
      fontSize: '18px', color: '#99aabb', align: 'center'
    }).setOrigin(0.5).setAlpha(0);

    // Animate titles in
    this.tweens.add({
      targets: titleMain, alpha: 1, y: h * 0.28, duration: 800, ease: 'Power2',
    });
    this.tweens.add({
      targets: title1000, alpha: 1, y: h * 0.40, duration: 800, delay: 200, ease: 'Power2',
    });
    this.tweens.add({
      targets: subtitle, alpha: 1, duration: 600, delay: 500,
    });

    // Pulsing glow on "1000"
    this.tweens.add({
      targets: title1000,
      scale: { from: 1, to: 1.05 },
      yoyo: true,
      repeat: -1,
      duration: 1500,
      ease: 'Sine.easeInOut',
      delay: 1000,
    });

    // Play button with glow
    const btnGlow = this.add.graphics();
    btnGlow.fillStyle(0xff006a, 0.3);
    btnGlow.fillRoundedRect(w / 2 - 170, h * 0.62 - 52, 340, 100, 24);

    const playBtn = this.add.rectangle(w / 2, h * 0.62, 300, 80, 0xff006a)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(4, 0xffffff)
      .setAlpha(0);

    // Rounded corners via graphics
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0xff006a, 1);
    btnBg.fillRoundedRect(w / 2 - 150, h * 0.62 - 40, 300, 80, 16);
    btnBg.lineStyle(3, 0xffffff, 0.8);
    btnBg.strokeRoundedRect(w / 2 - 150, h * 0.62 - 40, 300, 80, 16);
    btnBg.setAlpha(0);

    const playText = this.add.text(w / 2, h * 0.62, '▶  PLAY', {
      fontSize: '34px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0);

    // Animate button in
    this.tweens.add({
      targets: [playBtn, btnBg, playText, btnGlow],
      alpha: 1,
      duration: 600,
      delay: 800,
    });

    // Hover effects
    playBtn.on('pointerover', () => {
      this.tweens.add({ targets: btnBg, scaleX: 1.05, scaleY: 1.05, duration: 150 });
      this.tweens.add({ targets: playText, scaleX: 1.05, scaleY: 1.05, duration: 150 });
    });
    playBtn.on('pointerout', () => {
      this.tweens.add({ targets: btnBg, scaleX: 1, scaleY: 1, duration: 150 });
      this.tweens.add({ targets: playText, scaleX: 1, scaleY: 1, duration: 150 });
    });

    playBtn.on('pointerdown', () => {
      // Transition animation
      this.tweens.add({
        targets: [titleMain, title1000, subtitle, playBtn, playText, btnBg, btnGlow],
        alpha: 0,
        duration: 400,
        onComplete: () => this.scene.start('Game'),
      });
    });

    // RTP info
    this.add.text(w / 2, h * 0.92, 'RTP: 96.00%  |  High Volatility  |  v1.0.0', {
      fontSize: '14px', color: '#556677', align: 'center'
    }).setOrigin(0.5);
  }
}
