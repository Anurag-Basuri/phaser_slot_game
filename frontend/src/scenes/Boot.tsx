import Phaser from 'phaser';
import { Theme } from '../constants/theme';

/**
 * PREMIUM Boot Scene — Professional title screen with smooth animations
 * Features:
 *   - Responsive layout engine that adapts to any screen size instantly
 *   - Premium typography with 3D drop shadows and strokes
 *   - Dynamic particle system (sugar dust)
 *   - Staggered entrance animations
 *   - Glassmorphic UI pills for readability
 */
export class Boot extends Phaser.Scene {
  private bgBase!: Phaser.GameObjects.Image;
  private vignetteTop!: Phaser.GameObjects.Graphics;
  private vignetteBottom!: Phaser.GameObjects.Graphics;
  
  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  
  // Containers allow layout repositioning without breaking local tweens
  private titleContainer!: Phaser.GameObjects.Container;
  private titleShadow!: Phaser.GameObjects.Text;
  private titleMain!: Phaser.GameObjects.Text;
  
  private num1000Container!: Phaser.GameObjects.Container;
  private num1000Shadow!: Phaser.GameObjects.Text;
  private num1000Main!: Phaser.GameObjects.Text;
  
  private subtitleContainer!: Phaser.GameObjects.Container;
  private subtitlePill!: Phaser.GameObjects.Graphics;
  private subtitleTxt!: Phaser.GameObjects.Text;
  
  private btnContainer!: Phaser.GameObjects.Container;
  private btnGlow!: Phaser.GameObjects.Graphics;
  private btnBg!: Phaser.GameObjects.Graphics;
  private playText!: Phaser.GameObjects.Text;
  private playBtnHit!: Phaser.GameObjects.Rectangle;
  
  private footerRTP!: Phaser.GameObjects.Text;
  private footerCopy!: Phaser.GameObjects.Text;

  private _resizeTimer?: NodeJS.Timeout;
  private hasStarted = false;

  constructor() {
    super({ key: 'Boot' });
  }

  create() {
    // ═══════════════════════════════════════════════════
    // BACKGROUND & VIGNETTES
    // ═══════════════════════════════════════════════════
    this.bgBase = this.add.image(0, 0, 'game_bg');
    
    // Dark gradients top and bottom guarantee text readability
    this.vignetteTop = this.add.graphics().setDepth(1);
    this.vignetteBottom = this.add.graphics().setDepth(1);
    
    // ═══════════════════════════════════════════════════
    // DYNAMIC PARTICLES
    // ═══════════════════════════════════════════════════
    this.createSugarDust();
    
    // ═══════════════════════════════════════════════════
    // TITLE UI ELEMENTS
    // ═══════════════════════════════════════════════════
    this.titleContainer = this.add.container(0, 0).setDepth(10);
    const titleShadowSettings = { offsetX: 0, offsetY: 4, color: '#000000', blur: 6, stroke: true, fill: true };
    this.titleShadow = this.add.text(0, 0, 'SUGAR BLAST', {
        resolution: 2,
        fontFamily: '"Luckiest Guy", cursive, sans-serif',
        fontStyle: 'bold',
        color: '#ff006a',
        stroke: '#ff006a',
        strokeThickness: 24,
        shadow: titleShadowSettings
    }).setOrigin(0.5);

    this.titleMain = this.add.text(0, 0, 'SUGAR BLAST', {
        resolution: 2,
        fontFamily: '"Luckiest Guy", cursive, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#ff006a',
        strokeThickness: 8,
        shadow: { offsetX: 0, offsetY: 6, color: '#000000', blur: 0, stroke: true, fill: true }
    }).setOrigin(0.5);
    this.titleContainer.add([this.titleShadow, this.titleMain]);
    
    // ═══════════════════════════════════════════════════
    // "1000" GRAPHIC
    // ═══════════════════════════════════════════════════
    this.num1000Container = this.add.container(0, 0).setDepth(10);
    this.num1000Shadow = this.add.text(0, 0, '1000', {
        resolution: 2,
        fontFamily: Theme.fonts.mono,
        fontStyle: 'bold',
        color: '#442200' // Darker backing
    }).setOrigin(0.5);
    
    this.num1000Main = this.add.text(0, 0, '1000', {
        resolution: 2,
        fontFamily: Theme.fonts.mono,
        fontStyle: 'bold',
        color: Theme.colors.secondary,
        stroke: '#ff8800',
        shadow: { offsetX: 0, offsetY: 8, color: '#000000', blur: 0, stroke: true, fill: true }
    }).setOrigin(0.5);
    this.num1000Container.add([this.num1000Shadow, this.num1000Main]);
    
    // ═══════════════════════════════════════════════════
    // SUBTITLE (Frosted Pill)
    // ═══════════════════════════════════════════════════
    this.subtitleContainer = this.add.container(0, 0).setDepth(10);
    this.subtitlePill = this.add.graphics();
    this.subtitleTxt = this.add.text(0, 0, '7×7 CLUSTER PAYS  •  CASCADING REELS  •  UP TO 25,000× WIN', {
        resolution: 2,
        fontFamily: Theme.fonts.sans,
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
    }).setOrigin(0.5);
    this.subtitleContainer.add([this.subtitlePill, this.subtitleTxt]);
    
    // ═══════════════════════════════════════════════════
    // PLAY BUTTON
    // ═══════════════════════════════════════════════════
    this.btnContainer = this.add.container(0, 0).setDepth(20);
    this.btnGlow = this.add.graphics();
    this.btnBg = this.add.graphics();
    this.playText = this.add.text(0, 0, '▶  PLAY', {
        resolution: 2,
        fontFamily: Theme.fonts.display,
        fontStyle: 'bold',
        color: Theme.colors.textPrimary,
        shadow: { offsetX: 0, offsetY: 3, color: '#000000', blur: 4, fill: true }
    }).setOrigin(0.5);
    this.playBtnHit = this.add.rectangle(0, 0, 100, 50, 0xffffff, 0).setInteractive({ useHandCursor: true });
    this.btnContainer.add([this.btnGlow, this.btnBg, this.playText, this.playBtnHit]);
    
    // ═══════════════════════════════════════════════════
    // FOOTERS
    // ═══════════════════════════════════════════════════
    this.footerRTP = this.add.text(0, 0, 'RTP: 96.50%  |  High Volatility  |  Cluster Pays', {
        resolution: 2,
        fontFamily: Theme.fonts.sans,
        color: '#cccccc', // Brighter for better contrast on dark bg
        align: 'center'
    }).setOrigin(0.5).setDepth(10);
    
    this.footerCopy = this.add.text(0, 0, '© 2026 Stake Engine  |  Version 1.0.0', {
        resolution: 2,
        fontFamily: Theme.fonts.sans,
        color: '#999999',
        align: 'center'
    }).setOrigin(0.5).setDepth(10);
    
    // ═══════════════════════════════════════════════════
    // INIT & EVENT BINDINGS
    // ═══════════════════════════════════════════════════
    this.triggerEntranceAnimations();
    this.setupButtonInteractions();
    
    // Initial Layout & Resize Listener
    this.layoutAll();
    
    const resizeListener = () => {
      if (!this.scene || !this.sys.isActive()) return;
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        if (!this.scene || !this.sys.isActive()) return;
        this.layoutAll();
      }, 50);
    };
    
    this.scale.on('resize', resizeListener);
    this.events.once('shutdown', () => {
      this.scale.off('resize', resizeListener);
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
    });
  }
  
  /**
   * Premium ambient background dust
   */
  private createSugarDust() {
    const textureName = 'boot_sugar_dust';
    if (!this.textures.exists(textureName)) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 4);
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(8, 8, 8);
      g.generateTexture(textureName, 16, 16);
      g.destroy();
    }
    
    this.dustEmitter = this.add.particles(0, 0, textureName, {
      x: { min: 0, max: this.scale.width },
      y: { min: this.scale.height, max: this.scale.height + 100 },
      quantity: 1,
      frequency: 150,
      lifespan: { min: 6000, max: 12000 },
      scale: { start: 0, end: 0.8, ease: 'Sine.easeInOut' },
      alpha: { start: 0, end: 0.5, ease: 'Sine.easeInOut' },
      speedY: { min: -15, max: -45 },
      speedX: { min: -15, max: 15 },
      blendMode: 'ADD',
      advance: 8000 // Pre-warm so particles are already filling the screen
    }).setDepth(2);
  }

  /**
   * Fully responsive layout engine. Adapts to any aspect ratio.
   */
  private layoutAll() {
    const w = this.scale.width;
    const h = this.scale.height;
    const isPortrait = h > w;

    // 1. Background Cover
    this.bgBase.setPosition(w/2, h/2);
    const scaleX = w / this.bgBase.width;
    const scaleY = h / this.bgBase.height;
    this.bgBase.setScale(Math.max(scaleX, scaleY));
    
    // 2. Particle Bounds
    if (this.dustEmitter) {
      this.dustEmitter.particleX = { min: 0, max: w } as Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType;
      this.dustEmitter.particleY = { min: h, max: h + 100 } as Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType;
    }
    
    // 3. Dark Vignettes (Top and bottom readability gradients)
    this.vignetteTop.clear();
    this.vignetteTop.fillGradientStyle(0x1a0525, 0x1a0525, 0x000000, 0x000000, 0.8, 0.8, 0, 0);
    this.vignetteTop.fillRect(0, 0, w, h * 0.45); // Taller top gradient for logo
    
    this.vignetteBottom.clear();
    this.vignetteBottom.fillGradientStyle(0x000000, 0x000000, 0x1a0525, 0x1a0525, 0, 0, 0.9, 0.9);
    this.vignetteBottom.fillRect(0, h * 0.65, w, h * 0.35); // Taller bottom gradient for text/button
    
    // 4. Title "SUGAR BLAST"
    const titleY = isPortrait ? h * 0.25 : h * 0.22;
    // Base size on width, but cap it so it doesn't get huge on landscape
    const actualTitleFS = Math.max(48, Math.min(110, w * 0.12, h * 0.18));
    this.titleContainer.setPosition(w/2, titleY);
    
    this.titleMain.setFontSize(`${actualTitleFS}px`);
    this.titleShadow.setFontSize(`${actualTitleFS}px`);
    this.titleShadow.setPosition(0, actualTitleFS * 0.08);

    // 5. Number "1000"
    const num1000FS = Math.max(70, Math.min(160, w * 0.20, h * 0.25));
    const num1000Y = titleY + actualTitleFS * 0.85;
    
    this.num1000Container.setPosition(w/2, num1000Y);
    this.num1000Main.setFontSize(`${num1000FS}px`);
    this.num1000Shadow.setFontSize(`${num1000FS}px`);
    
    // Dynamic thick stroke to emulate 3D
    this.num1000Main.setStroke('#ff8800', Math.max(6, num1000FS * 0.07));
    this.num1000Shadow.setPosition(0, num1000FS * 0.08);
    
    // 6. Subtitle (Frosted Pill)
    const subFS = Math.max(10, Math.min(16, w * 0.025));
    const subY = num1000Y + num1000FS * 0.65;
    
    this.subtitleContainer.setPosition(w/2, subY);
    this.subtitleTxt.setFontSize(`${subFS}px`);
    this.subtitleTxt.setWordWrapWidth(w * 0.85);
    
    // Draw Frosted Pill background precisely wrapping the text
    const subWidth = Math.min(w * 0.9, this.subtitleTxt.width + 40);
    const subHeight = this.subtitleTxt.height + 16;
    this.subtitlePill.clear();
    // Dark base
    this.subtitlePill.fillStyle(0x000000, 0.65);
    this.subtitlePill.fillRoundedRect(-subWidth/2, -subHeight/2, subWidth, subHeight, subHeight/2);
    // Colored border glow
    this.subtitlePill.lineStyle(2, 0xff006a, 0.7);
    this.subtitlePill.strokeRoundedRect(-subWidth/2, -subHeight/2, subWidth, subHeight, subHeight/2);
    
    // 7. Play Button
    const btnW = Math.max(220, Math.min(320, w * 0.45));
    const btnH = Math.max(65, Math.min(85, h * 0.12));
    const btnY = isPortrait ? h * 0.72 : h * 0.75;
    const btnRadius = btnH * 0.4;
    
    this.btnContainer.setPosition(w/2, btnY);
    this.playBtnHit.setPosition(0, 0).setSize(btnW, btnH);
    
    // Outer Additive Glow
    this.btnGlow.clear();
    this.btnGlow.fillStyle(0xff006a, 0.6);
    this.btnGlow.fillRoundedRect(-btnW/2 - 15, -btnH/2 - 15, btnW + 30, btnH + 30, btnRadius + 10);
    this.btnGlow.setBlendMode(Phaser.BlendModes.ADD);
    
    this.btnBg.clear();
    // Dark Drop Shadow
    this.btnBg.fillStyle(0x000000, 0.6);
    this.btnBg.fillRoundedRect(-btnW/2, -btnH/2 + 6, btnW, btnH, btnRadius);
    // Base Magenta
    this.btnBg.fillStyle(0xff006a, 1);
    this.btnBg.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH, btnRadius);
    // Glossy Top Highlight
    this.btnBg.fillStyle(0xff4d94, 0.9);
    this.btnBg.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH * 0.45, btnRadius);
    // Inner glass rim
    this.btnBg.fillStyle(0xffffff, 0.35);
    this.btnBg.fillRoundedRect(-btnW/2 + 4, -btnH/2 + 3, btnW - 8, btnH * 0.25, btnRadius - 2);
    // Bright White Stroke Border
    this.btnBg.lineStyle(2, 0xffffff, 0.9);
    this.btnBg.strokeRoundedRect(-btnW/2, -btnH/2, btnW, btnH, btnRadius);
    
    const playFS = Math.max(24, Math.min(38, btnH * 0.45));
    this.playText.setFontSize(`${playFS}px`);
    this.playText.setPosition(0, -2);
    
    // 8. Footers
    const footerFS = Math.max(10, Math.min(14, w * 0.022));
    this.footerRTP.setFontSize(`${footerFS}px`);
    this.footerCopy.setFontSize(`${Math.max(9, footerFS - 2)}px`);
    
    const baseBotSpace = Math.max(20, h * 0.04);
    this.footerCopy.setPosition(w/2, h - baseBotSpace);
    this.footerRTP.setPosition(w/2, h - baseBotSpace - footerFS * 1.8);
  }
  
  /**
   * Premium staggered entrance animations
   */
  private triggerEntranceAnimations() {
    // Hide initially
    this.titleContainer.setAlpha(0).setScale(0.6);
    this.num1000Container.setAlpha(0).setScale(0.4);
    this.subtitleContainer.setAlpha(0);
    this.btnContainer.setAlpha(0).setScale(0.8);
    
    // Staggered pop-in
    this.tweens.add({
      targets: this.titleContainer,
      alpha: 1,
      scale: 1,
      duration: 800,
      ease: Theme.animation.easeBounce,
      delay: 100
    });
    
    // Continuous subtle float for title text inside container
    this.tweens.add({
      targets: [this.titleShadow, this.titleMain],
      y: `-=12`,
      yoyo: true,
      repeat: -1,
      duration: 3000,
      ease: 'Sine.easeInOut',
      delay: 900
    });
    
    this.tweens.add({
      targets: this.num1000Container,
      alpha: 1,
      scale: 1,
      duration: 800,
      ease: Theme.animation.easeBounce,
      delay: 300
    });
    
    // Continuous heartbeat for 1000 text inside container
    this.tweens.add({
      targets: [this.num1000Shadow, this.num1000Main],
      scale: 1.05,
      yoyo: true,
      repeat: -1,
      duration: 2000,
      ease: 'Sine.easeInOut',
      delay: 1100
    });
    
    this.tweens.add({
      targets: this.subtitleContainer,
      alpha: 1,
      y: `+=10`, // Slight slide down
      duration: 600,
      ease: 'Cubic.easeOut',
      delay: 600
    });
    
    this.tweens.add({
      targets: this.btnContainer,
      alpha: 1,
      scale: 1,
      duration: 700,
      ease: Theme.animation.easeBounce,
      delay: 800
    });
    
    // Glowing heartbeat for play button
    this.tweens.add({
      targets: this.btnGlow,
      alpha: { from: 0.5, to: 1 },
      scale: { from: 1, to: 1.15 },
      yoyo: true,
      repeat: -1,
      duration: 1200,
      ease: 'Sine.easeInOut'
    });
  }
  
  private setupButtonInteractions() {
    this.playBtnHit.on('pointerover', () => {
      this.tweens.add({
        targets: this.btnBg,
        scale: 1.06,
        duration: 150,
        ease: 'Quad.easeOut'
      });
      this.tweens.add({
        targets: this.playText,
        scale: 1.1,
        duration: 150,
        ease: 'Quad.easeOut'
      });
    });
    
    this.playBtnHit.on('pointerout', () => {
      this.tweens.add({
        targets: [this.btnBg, this.playText],
        scale: 1,
        duration: 150,
        ease: 'Quad.easeOut'
      });
    });
    
    this.playBtnHit.on('pointerdown', () => {
      this.startGame();
    });

    // Spacebar mapping to play
    let spaceKey: Phaser.Input.Keyboard.Key | null = null;
    if (this.input.keyboard) {
      spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      spaceKey.on('down', () => {
        this.startGame();
      });
    }

    this.events.once('shutdown', () => {
      if (spaceKey) {
        spaceKey.removeAllListeners();
      }
    });
  }

  private startGame() {
    if (this.hasStarted) return;
    this.hasStarted = true;

    // Direct visual feedback on the button
    this.tweens.add({
      targets: [this.btnBg, this.playText],
      scale: 0.95,
      duration: 80,
      yoyo: true,
      onComplete: () => {
        // Smooth fade transition to the game
        this.cameras.main.fade(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('Game');
        });
      }
    });
  }
}
