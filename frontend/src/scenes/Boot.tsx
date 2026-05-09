import Phaser from 'phaser';
import { Theme } from '../constants/theme';

/**
 * PREMIUM Boot Scene — Professional title screen with smooth animations
 * Features:
 *   - Premium typography using Google Fonts
 *   - Polished particle effects
 *   - Smooth entrance animations
 *   - Professional button design with hover effects
 *   - Cohesive color scheme
 */
export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // ═══════════════════════════════════════════════════
    // BACKGROUND (Candy-land image)
    // ═══════════════════════════════════════════════════
    const bg = this.add.image(w / 2, h / 2, 'game_bg');
    const bgScaleX = w / bg.width;
    const bgScaleY = h / bg.height;
    bg.setScale(Math.max(bgScaleX, bgScaleY));

    // Subtle vignette overlay for text readability
    const vignette = this.add.graphics();
    vignette.fillStyle(0x000000, 0.35);
    vignette.fillRect(0, 0, w, h);
    vignette.fillStyle(0x000000, 0.0);
    vignette.fillCircle(w / 2, h * 0.4, Math.min(w, h) * 0.48);

    // ═══════════════════════════════════════════════════
    // FLOATING CANDY PARTICLES (Background)
    // ═══════════════════════════════════════════════════
    for (let i = 0; i < 6; i++) {
      const x = Phaser.Math.Between(Math.floor(w * 0.08), Math.floor(w * 0.92));
      const y = Phaser.Math.Between(Math.floor(h * 0.12), Math.floor(h * 0.88));
      const candy = this.add.sprite(x, y, `candy_${i % 7}`);
      candy
        .setScale(Phaser.Math.FloatBetween(0.14, 0.24))
        .setAlpha(0.2)
        .setDepth(-1);
      this.tweens.add({
        targets: candy,
        y: y - Phaser.Math.Between(25, 60),
        rotation: Phaser.Math.FloatBetween(-0.2, 0.2),
        yoyo: true,
        repeat: -1,
        duration: Phaser.Math.Between(3000, 6000),
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 2500),
      });
    }

    // ═══════════════════════════════════════════════════
    // CENTRAL GLOW (Premium radial effect)
    // ═══════════════════════════════════════════════════
    const centerGlow1 = this.add.graphics();
    centerGlow1.fillStyle(0xff006a, 0.15);
    centerGlow1.fillCircle(w / 2, h * 0.38, Math.min(280, w * 0.32));

    const centerGlow2 = this.add.graphics();
    centerGlow2.fillStyle(0xff006a, 0.06);
    centerGlow2.fillCircle(w / 2, h * 0.38, Math.min(450, w * 0.52));

    this.tweens.add({
      targets: centerGlow1,
      alpha: { from: 0.15, to: 0.25 },
      yoyo: true,
      repeat: -1,
      duration: 2500,
      ease: 'Sine.easeInOut',
    });

    // ═══════════════════════════════════════════════════
    // PREMIUM TITLE — "SUGAR RUSH"
    // ═══════════════════════════════════════════════════
    const titleFontSize = Math.min(76, w * 0.095);

    // Stack layers for 3D depth effect
    const titleShadow = this.add
      .text(w / 2, h * 0.27 + 10, 'SUGAR RUSH', {
        fontSize: `${titleFontSize}px`,
        fontFamily: Theme.fonts.display,
        fontStyle: 'bold',
        color: '#6600aa',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.4)
      .setDepth(5);

    const titleMain = this.add
      .text(w / 2, h * 0.27, 'SUGAR RUSH', {
        fontSize: `${titleFontSize}px`,
        fontFamily: Theme.fonts.display,
        fontStyle: 'bold',
        color: Theme.colors.primary,
        stroke: '#ffffff',
        strokeThickness: Math.max(5, Math.floor(titleFontSize * 0.08)),
        shadow: {
          offsetX: 0,
          offsetY: 6,
          color: '#000000',
          blur: 0,
          stroke: true,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.4)
      .setDepth(6);

    // Animate entrance
    this.tweens.add({
      targets: [titleShadow, titleMain],
      alpha: 1,
      scale: 1,
      duration: 900,
      ease: Theme.animation.easeBounce,
      delay: 0,
    });

    // Continuous subtle float
    this.tweens.add({
      targets: [titleShadow, titleMain],
      y: `-=12`,
      yoyo: true,
      repeat: -1,
      duration: 3000,
      ease: 'Sine.easeInOut',
      delay: 900,
    });

    // ═══════════════════════════════════════════════════
    // PREMIUM TITLE — "1000"
    // ═══════════════════════════════════════════════════
    const numFontSize = Math.min(130, w * 0.165);

    const num1000Shadow = this.add
      .text(w / 2, h * 0.41 + 12, '1000', {
        fontSize: `${numFontSize}px`,
        fontFamily: Theme.fonts.mono,
        fontStyle: 'bold',
        color: '#664400',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.25)
      .setDepth(5);

    const num1000Main = this.add
      .text(w / 2, h * 0.41, '1000', {
        fontSize: `${numFontSize}px`,
        fontFamily: Theme.fonts.mono,
        fontStyle: 'bold',
        color: Theme.colors.secondary,
        stroke: '#ff8800',
        strokeThickness: Math.max(6, Math.floor(numFontSize * 0.06)),
        shadow: {
          offsetX: 0,
          offsetY: 7,
          color: '#000000',
          blur: 0,
          stroke: true,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setScale(0.25)
      .setDepth(6);

    // Animate entrance with bounce
    this.tweens.add({
      targets: [num1000Shadow, num1000Main],
      alpha: 1,
      scale: 1,
      duration: 800,
      ease: Theme.animation.easeBounce,
      delay: 200,
    });

    // Continuous pulse
    this.tweens.add({
      targets: [num1000Shadow, num1000Main],
      scale: { from: 1, to: 1.06 },
      yoyo: true,
      repeat: -1,
      duration: 2000,
      ease: 'Sine.easeInOut',
      delay: 1100,
    });

    // ═══════════════════════════════════════════════════
    // PREMIUM SUBTITLE
    // ═══════════════════════════════════════════════════
    const subFontSize = Math.min(18, w * 0.028);
    const subtitle = this.add
      .text(
        w / 2,
        h * 0.54,
        '7×7 CLUSTER PAYS  •  CASCADING REELS  •  UP TO 25,000× WIN',
        {
          fontSize: `${subFontSize}px`,
          fontFamily: Theme.fonts.sans,
          fontStyle: 'bold',
          color: Theme.colors.textSecondary,
          stroke: Theme.colors.bgDarkest,
          strokeThickness: 3,
          align: 'center',
          wordWrap: { width: w * 0.8 },
        },
      )
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(6);

    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      duration: 600,
      delay: 800,
    });

    // ═══════════════════════════════════════════════════
    // PREMIUM PLAY BUTTON
    // ═══════════════════════════════════════════════════
    const btnW = Math.min(320, w * 0.48);
    const btnH = Math.min(80, h * 0.1);
    const btnY = h * 0.66;
    const btnX = w / 2;
    const btnRadius = Math.min(40, btnH * 0.55);

    const btnContainer = this.add
      .container(btnX, btnY)
      .setAlpha(0)
      .setDepth(20);

    // Outer glow effect
    const btnGlow = this.add.graphics().setDepth(0);
    btnGlow.fillStyle(Theme.colors.primary, 0.5);
    btnGlow.fillRoundedRect(
      -btnW / 2 - 18,
      -btnH / 2 - 18,
      btnW + 36,
      btnH + 36,
      btnRadius + 12,
    );
    btnContainer.add(btnGlow);

    // Button background with layers
    const btnBg = this.add.graphics().setDepth(1);
    // Drop shadow
    btnBg.fillStyle(0x000000, 0.5);
    btnBg.fillRoundedRect(-btnW / 2, -btnH / 2 + 8, btnW, btnH, btnRadius);
    // Base color
    btnBg.fillStyle(Theme.colors.primary, 1);
    btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnRadius);
    // Top highlight (glossy effect)
    btnBg.fillStyle(Theme.colors.primaryLight, 0.9);
    btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH * 0.45, btnRadius);
    // Rim highlight
    btnBg.fillStyle(0xffffff, 0.3);
    btnBg.fillRoundedRect(
      -btnW / 2 + 6,
      -btnH / 2 + 4,
      btnW - 12,
      btnH * 0.22,
      btnRadius - 3,
    );
    // Border
    btnBg.lineStyle(2.5, Theme.colors.primaryLight, 0.95);
    btnBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnRadius);
    btnContainer.add(btnBg);

    // Button text
    const playFontSize = Math.min(36, btnH * 0.5);
    const playText = this.add
      .text(0, -2, '▶  PLAY', {
        fontSize: `${playFontSize}px`,
        fontFamily: Theme.fonts.display,
        fontStyle: 'bold',
        color: Theme.colors.textPrimary,
        shadow: {
          offsetX: 0,
          offsetY: 3,
          color: '#000000',
          blur: 4,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(2);
    btnContainer.add(playText);

    // Hit area
    const playBtn = this.add
      .rectangle(0, 0, btnW, btnH, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    btnContainer.add(playBtn);

    // Animate button entrance
    this.tweens.add({
      targets: btnContainer,
      alpha: 1,
      y: btnY - 12,
      duration: 700,
      delay: 1000,
      ease: Theme.animation.easeBounce,
    });

    // Pulsing glow animation
    this.tweens.add({
      targets: btnGlow,
      alpha: { from: 0.5, to: 0.85 },
      scale: { from: 1, to: 1.08 },
      yoyo: true,
      repeat: -1,
      duration: 1400,
      ease: 'Sine.easeInOut',
    });

    // Button hover effects
    playBtn.on('pointerover', () => {
      this.tweens.add({
        targets: btnContainer,
        scale: 1.08,
        duration: 200,
        ease: Theme.animation.easeOut,
      });
      this.tweens.add({
        targets: [playText],
        scale: 1.1,
        duration: 200,
        ease: Theme.animation.easeOut,
      });
    });

    playBtn.on('pointerout', () => {
      this.tweens.add({
        targets: btnContainer,
        scale: 1,
        duration: 200,
        ease: Theme.animation.easeOut,
      });
      this.tweens.add({
        targets: [playText],
        scale: 1,
        duration: 200,
        ease: Theme.animation.easeOut,
      });
    });

    playBtn.on('pointerdown', () => {
      this.tweens.add({
        targets: btnContainer,
        scale: 0.96,
        duration: 100,
        yoyo: true,
      });

      // Smooth fade-out transition
      this.cameras.main.fade(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('Game');
      });
    });

    // ═══════════════════════════════════════════════════
    // FOOTER INFORMATION
    // ═══════════════════════════════════════════════════
    const footerFontSize = Math.min(12, w * 0.016);
    this.add
      .text(
        w / 2,
        h * 0.91,
        'RTP: 95.30%  |  High Volatility  |  Cluster Pays',
        {
          fontSize: `${footerFontSize}px`,
          fontFamily: Theme.fonts.sans,
          color: Theme.colors.textMuted,
          stroke: Theme.colors.bgDarkest,
          strokeThickness: 2,
          align: 'center',
        },
      )
      .setOrigin(0.5)
      .setDepth(5);

    this.add
      .text(w / 2, h * 0.96, '© 2026 Stake Engine  |  Version 1.0.0', {
        fontSize: `${Math.max(10, footerFontSize - 2)}px`,
        fontFamily: Theme.fonts.sans,
        color: Theme.colors.textMuted,
        stroke: Theme.colors.bgDarkest,
        strokeThickness: 1,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(5);
  }
}
