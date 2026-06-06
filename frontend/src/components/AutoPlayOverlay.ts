import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';

export class AutoPlayOverlay {
  private scene: GameScene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;

  private onStartCallback: ((spins: number, turbo: boolean, quick: boolean, skip: boolean, stopOnFeature: boolean) => void) | null = null;
  
  private turboSpin = false;
  private quickSpin = false;
  private skipScreens = false;
  private stopOnFeature = true;
  private _isTurboDisabled = false;
  private spins = 50;
  private allowedSpins = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 150, 300, 500, 1000, 0];

  private txtSpinsCount!: Phaser.GameObjects.Text;
  private btnStartTxt!: Phaser.GameObjects.Text;
  private sliderThumbHit!: Phaser.GameObjects.Rectangle;
  private sliderThumbGfx!: Phaser.GameObjects.Graphics;
  private sliderTrackGfx!: Phaser.GameObjects.Graphics;
  
  private _resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private sliderWidth = 0;
  private sliderX = 0;
  private draggingSlider = false;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.build();

    this.scene.scale.on('resize', () => {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        const wasVisible = this.visible;
        if (this.container?.scene) {
          this.container.removeAll(true);
          this.container.destroy();
        }
        this.build();
        if (wasVisible) {
          this.container.setVisible(true);
          this.container.setAlpha(1);
          this.visible = true;
        }
      }, 100);
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.draggingSlider) {
        this.updateSliderFromPointer(pointer.x);
      }
    });

    this.scene.input.on('pointerup', () => {
      this.draggingSlider = false;
    });
  }

  public setCallbacks(onStart: (spins: number, turbo: boolean, quick: boolean, skip: boolean, stopOnFeature: boolean) => void) {
    this.onStartCallback = onStart;
  }

  public show(isTurboDisabled: boolean = false) {
    if (this.visible) return;
    this._isTurboDisabled = isTurboDisabled;
    
    // If turbo is disabled by jurisdiction, force toggles off
    if (isTurboDisabled) {
      this.turboSpin = false;
      this.quickSpin = false;
    }

    // Always rebuild on show to ensure compliance flags and layout are fresh
    if (this.container?.scene) {
      this.container.removeAll(true);
      this.container.destroy();
    }
    this.build();

    this.visible = true;
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Power2'
    });
  }

  public hide() {
    if (!this.visible) return;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.visible = false;
        this.container.setVisible(false);
      }
    });
  }

  public isVisible() {
    return this.visible;
  }

  private build() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.container = this.scene.add.container(0, 0).setDepth(150).setVisible(false);

    // Dark background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, w, h);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerdown', () => this.hide());
    this.container.add(bg);

    // Responsive panel sizing
    const isMobile = w < 768;
    const isTablet = w >= 768 && w < 1024;
    const pW = isMobile ? w * 0.95 : isTablet ? w * 0.8 : Math.min(600, w * 0.9);
    const pH = Math.min(500, h * 0.85);
    const pX = (w - pW) / 2;
    const pY = (h - pH) / 2;

    const panelBg = this.scene.add.graphics();
    // Hard comic-book drop shadow
    panelBg.fillStyle(0x0a0015, 0.7);
    panelBg.fillRoundedRect(pX + 8, pY + 8, pW, pH, 32);

    // Main panel (Deep purple candy gradient)
    panelBg.fillGradientStyle(0x3a1055, 0x1e0e40, 0x2a1455, 0x1a0533, 1);
    panelBg.fillRoundedRect(pX, pY, pW, pH, 32);

    // Thick Hot-Pink Border
    panelBg.lineStyle(6, 0xff66aa, 1);
    panelBg.strokeRoundedRect(pX, pY, pW, pH, 32);
    
    // Inner rim (bright white)
    panelBg.lineStyle(2, 0xffffff, 0.35);
    panelBg.strokeRoundedRect(pX + 5, pY + 5, pW - 10, pH - 10, 26);

    panelBg.setInteractive(new Phaser.Geom.Rectangle(pX, pY, pW, pH), Phaser.Geom.Rectangle.Contains);
    this.container.add(panelBg);

    // Header Pill
    const headerW = 280;
    const headerH = 65;
    const headerX = w / 2 - headerW / 2;
    const headerY = pY - 20;
    const header = this.scene.add.graphics();
    header.fillStyle(0x0a0015, 0.6);
    header.fillRoundedRect(headerX + 4, headerY + 6, headerW, headerH, 32);
    header.fillGradientStyle(0xff66aa, 0xff0070, 0xcc0055, 0xaa0044, 1);
    header.fillRoundedRect(headerX, headerY, headerW, headerH, 32);
    header.lineStyle(3, 0xffffff, 0.9);
    header.strokeRoundedRect(headerX + 3, headerY + 3, headerW - 6, headerH - 6, 29);
    this.container.add(header);

    // Close Button
    const closeBtnX = pX + pW - 10;
    const closeBtnY = pY + 10;
    const closeBtnGfx = this.scene.add.graphics();
    closeBtnGfx.fillStyle(0x0a0015, 0.6);
    closeBtnGfx.fillCircle(closeBtnX + 3, closeBtnY + 4, 26);
    closeBtnGfx.fillGradientStyle(0xff3333, 0xee1111, 0xcc0000, 0xaa0000, 1);
    closeBtnGfx.fillCircle(closeBtnX, closeBtnY, 26);
    closeBtnGfx.lineStyle(4, 0xffffff, 1);
    closeBtnGfx.strokeCircle(closeBtnX, closeBtnY, 26);
    this.container.add(closeBtnGfx);

    const closeBtn = this.scene.add.text(closeBtnX, closeBtnY, '✕', {
      fontFamily: '"Poppins", sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      resolution: 2
    }).setOrigin(0.5).setShadow(0, 2, '#660000', 0, false, true).setInteractive({ useHandCursor: true });
    
    closeBtn.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      this.hide();
    });
    closeBtn.on('pointerover', () => closeBtn.setScale(1.1));
    closeBtn.on('pointerout', () => closeBtn.setScale(1));
    this.container.add(closeBtn);

    // Title
    const title = this.scene.add.text(w / 2, headerY + headerH / 2, 'AUTOPLAY', {
      fontFamily: '"Poppins", sans-serif',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#441177',
      strokeThickness: 6,
      resolution: 2
    }).setOrigin(0.5).setShadow(0, 4, '#1a0033', 0, false, true);
    this.container.add(title);
    
    // Separator line
    const sep = this.scene.add.graphics();
    sep.lineStyle(2, 0xff66aa, 0.4);
    sep.lineBetween(pX + 40, pY + 90, pX + pW - 40, pY + 90);
    this.container.add(sep);

    // Checkboxes
    let currentX = pX + 20;
    let currentY = pY + 110;
    const boxW = isMobile ? (pW / 2 - 20) : (pW / 3);

    let cb1: any = null;
    let cb2: any = null;

    if (!this._isTurboDisabled) {
      cb1 = this.createCheckbox(currentX, currentY, 'TURBO\nSPIN', this.turboSpin, (val) => {
        this.turboSpin = val;
        if (val) {
          this.quickSpin = false;
          if (cb2) cb2.setState(false);
        }
      });
      
      currentX += boxW;
      
      cb2 = this.createCheckbox(currentX, currentY, 'QUICK\nSPIN', this.quickSpin, (val) => {
        this.quickSpin = val;
        if (val) {
          this.turboSpin = false;
          if (cb1) cb1.setState(false);
        }
      });
      
      currentX += boxW;
      // If mobile, wrap the 3rd box to the next line
      if (isMobile) {
        currentX = pX + 20;
        currentY += 60;
      }
    }

    const cb3 = this.createCheckbox(currentX, currentY, 'SKIP\nSCREENS', this.skipScreens, (val) => this.skipScreens = val);
    currentX += boxW;
    const cb4 = this.createCheckbox(currentX, currentY, 'STOP ON\nFEATURE', this.stopOnFeature, (val) => this.stopOnFeature = val);

    // Slider section
    const slideY = pY + 330;
    const slideTitle = this.scene.add.text(pX + pW / 2, slideY - 80, 'NUMBER OF SPINS', {
      fontFamily: '"Poppins", sans-serif',
      fontSize: '22px',
      color: '#ffc844',
      resolution: 2
    }).setOrigin(0.5).setShadow(0, 2, '#3a0055', 0, false, true);
    this.container.add(slideTitle);

    // Quick Picks
    const presets = [10, 50, 100, 250, 1000, 0];
    const qpW = (pW - 40) / presets.length;
    let qpX = pX + 20;
    presets.forEach((val) => {
      const qpBtn = this.scene.add.graphics();
      qpBtn.fillStyle(0x2a1455, 1);
      qpBtn.fillRoundedRect(qpX, slideY - 50, qpW - 6, 32, 8);
      qpBtn.lineStyle(2, 0xff66aa, 0.6);
      qpBtn.strokeRoundedRect(qpX, slideY - 50, qpW - 6, 32, 8);
      
      const qpTxt = this.scene.add.text(qpX + (qpW - 6) / 2, slideY - 34, val === 0 ? '∞' : `${val}`, {
        fontFamily: '"Poppins", sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        resolution: 2
      }).setOrigin(0.5).setShadow(0, 2, '#1a0033', 0, false, true);
      
      const qpHit = this.scene.add.rectangle(qpX + (qpW - 6)/2, slideY - 34, qpW - 6, 32, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
        
      qpHit.on('pointerdown', () => {
        this.scene.audio.playSound('button');
        this.spins = val;
        this.txtSpinsCount.setText(val === 0 ? '∞' : `${val}`);
        this.btnStartTxt.setText(`START AUTOPLAY (${val === 0 ? '∞' : val})`);
        this.drawSlider();
      });
      
      this.container.add([qpBtn, qpTxt, qpHit]);
      qpX += qpW;
    });

    this.sliderX = pX + 50;
    this.sliderWidth = pW - 180;
    this.sliderTrackGfx = this.scene.add.graphics();
    this.container.add(this.sliderTrackGfx);

    this.txtSpinsCount = this.scene.add.text(pX + pW - 30, slideY, this.spins === 0 ? '∞' : `${this.spins}`, {
      fontFamily: '"Poppins", sans-serif',
      fontSize: '48px',
      color: '#00ff88',
      stroke: '#003311',
      strokeThickness: 6,
      resolution: 2
    }).setOrigin(1, 0.5).setShadow(0, 4, '#000000', 0, false, true);
    this.container.add(this.txtSpinsCount);

    this.sliderThumbGfx = this.scene.add.graphics();
    this.container.add(this.sliderThumbGfx);

    this.sliderThumbHit = this.scene.add.rectangle(0, slideY, 60, 60, 0xffffff, 0)
      .setInteractive({ useHandCursor: true, draggable: true });
    
    this.sliderThumbHit.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.draggingSlider = true;
      this.updateSliderFromPointer(ptr.x);
    });

    this.container.add(this.sliderThumbHit);

    // Start Button
    const startY = pY + pH - 30;
    const startBtnGfx = this.scene.add.graphics();
    const btnW = pW - 60;
    const btnH = 60;
    
    // Draw relative to 0,0 for proper scaling origin
    startBtnGfx.fillStyle(0x0a0015, 0.6);
    startBtnGfx.fillRoundedRect(-btnW/2 + 4, -btnH/2 + 4, btnW, btnH, 20); // Shadow
    
    startBtnGfx.fillGradientStyle(0x33ff99, 0x00e676, 0x00cc66, 0x00994d, 1);
    startBtnGfx.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 20); // Body
    
    startBtnGfx.lineStyle(4, 0xffffff, 1);
    startBtnGfx.strokeRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 20); // Border

    startBtnGfx.setPosition(pX + pW/2, startY - 50);
    this.container.add(startBtnGfx);

    const startHit = this.scene.add.rectangle(pX + pW/2, startY - 50, pW - 60, 60, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    
    startHit.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      this.hide();
      if (this.onStartCallback) {
        this.onStartCallback(this.spins, this.turboSpin, this.quickSpin, this.skipScreens, this.stopOnFeature);
      }
    });
    
    // Bouncy scale on hover
    startHit.on('pointerover', () => {
      this.scene.tweens.killTweensOf([startBtnGfx, this.btnStartTxt]);
      this.scene.tweens.add({ targets: [startBtnGfx, this.btnStartTxt], scale: 1.03, duration: 150, ease: 'Back.easeOut' });
    });
    startHit.on('pointerout', () => {
      this.scene.tweens.killTweensOf([startBtnGfx, this.btnStartTxt]);
      this.scene.tweens.add({ targets: [startBtnGfx, this.btnStartTxt], scale: 1, duration: 150, ease: 'Back.easeIn' });
    });
    
    this.container.add(startHit);

    this.btnStartTxt = this.scene.add.text(pX + pW / 2, startY - 50, `START AUTOPLAY (${this.spins === 0 ? '∞' : this.spins})`, {
      fontFamily: '"Poppins", sans-serif',
      fontSize: '26px',
      color: '#ffffff',
      stroke: '#004422',
      strokeThickness: 5,
      resolution: 2
    }).setOrigin(0.5).setShadow(0, 4, '#1a0033', 0, false, true);
    this.container.add(this.btnStartTxt);

    this.drawSlider();
  }

  private createCheckbox(x: number, y: number, label: string, initial: boolean, onChange: (val: boolean) => void) {
    const size = 36;
    const gfx = this.scene.add.graphics();
    let state = initial;
    
    const draw = () => {
      gfx.clear();
      
      // Box shadow
      gfx.fillStyle(0x0a0015, 0.4);
      gfx.fillRoundedRect(x + 2, y + 4, size, size, 10);

      // Box body
      gfx.fillStyle(0x2a1455, 1);
      gfx.fillRoundedRect(x, y, size, size, 10);
      
      if (state) {
        // Active border
        gfx.lineStyle(3, 0x00ff88, 1);
        gfx.strokeRoundedRect(x, y, size, size, 10);
        
        // Massive Cartoon Checkmark
        gfx.lineStyle(5, 0x00ff88, 1);
        gfx.beginPath();
        gfx.moveTo(x + 8, y + size/2 + 2);
        gfx.lineTo(x + size/2 - 2, y + size - 8);
        gfx.lineTo(x + size + 6, y - 6); // Pops out of the box!
        gfx.strokePath();
      } else {
        // Inactive border
        gfx.lineStyle(2, 0xff66aa, 0.5);
        gfx.strokeRoundedRect(x, y, size, size, 10);
      }
    };
    draw();
    this.container.add(gfx);

    const txt = this.scene.add.text(x + size + 15, y + size/2, label, {
      fontFamily: '"Poppins", sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      resolution: 2
    }).setOrigin(0, 0.5).setLineSpacing(2).setShadow(0, 2, '#3a0055', 0, false, true);
    this.container.add(txt);

    const hit = this.scene.add.rectangle(x + size, y + size/2, size*3, size+10, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      state = !state;
      draw();
      onChange(state);
    });
    this.container.add(hit);

    return {
      setState: (val: boolean) => {
        state = val;
        draw();
      }
    };
  }

  private updateSliderFromPointer(px: number) {
    let localX = px - this.sliderX;
    if (localX < 0) localX = 0;
    if (localX > this.sliderWidth) localX = this.sliderWidth;
    
    const percent = localX / this.sliderWidth;
    
    // Find closest allowed spin value
    const exactIndex = percent * (this.allowedSpins.length - 1);
    const closestIndex = Math.round(exactIndex);
    
    this.spins = this.allowedSpins[closestIndex];
    this.drawSlider();
    
    this.txtSpinsCount.setText(this.spins === 0 ? '∞' : `${this.spins}`);
    this.btnStartTxt.setText(`START AUTOPLAY (${this.spins === 0 ? '∞' : this.spins})`);
  }

  private drawSlider() {
    const idx = this.allowedSpins.indexOf(this.spins);
    const percent = idx / (this.allowedSpins.length - 1);
    const fillW = percent * this.sliderWidth;
    
    const y = this.sliderThumbHit.y;

    this.sliderTrackGfx.clear();
    // Background track (dark pill)
    this.sliderTrackGfx.fillStyle(0x2a1455, 1);
    this.sliderTrackGfx.fillRoundedRect(this.sliderX, y - 8, this.sliderWidth, 16, 8);
    this.sliderTrackGfx.lineStyle(3, 0xff66aa, 0.6);
    this.sliderTrackGfx.strokeRoundedRect(this.sliderX, y - 8, this.sliderWidth, 16, 8);
    
    // Filled track (neon gradient effect using multiple fills)
    this.sliderTrackGfx.fillGradientStyle(0xff3388, 0xff0055, 0xee0044, 0xcc0033, 1);
    this.sliderTrackGfx.fillRoundedRect(this.sliderX, y - 8, fillW, 16, { tl: 8, bl: 8, tr: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);
    this.sliderTrackGfx.fillStyle(0xff66aa, 1);
    this.sliderTrackGfx.fillRoundedRect(this.sliderX, y - 5, fillW, 10, { tl: 5, bl: 5, tr: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);

    const thumbX = this.sliderX + fillW;
    this.sliderThumbHit.setX(thumbX);
    
    this.sliderThumbGfx.clear();
    
    // Thumb shadow
    this.sliderThumbGfx.fillStyle(0x0a0015, 0.5);
    this.sliderThumbGfx.fillCircle(thumbX + 2, y + 4, 22);
    
    // Thumb body
    this.sliderThumbGfx.fillGradientStyle(0xffc844, 0xffbb33, 0xee9900, 0xcc7700, 1);
    this.sliderThumbGfx.fillCircle(thumbX, y, 22);
    
    // Thumb inner
    this.sliderThumbGfx.fillStyle(0xfff5dd, 1);
    this.sliderThumbGfx.fillCircle(thumbX, y, 14);
    
    // Inner white highlight
    this.sliderThumbGfx.lineStyle(4, 0xffffff, 1);
    this.sliderThumbGfx.strokeCircle(thumbX, y, 22);
  }
}
