import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';

export class AutoPlayOverlay {
  private scene: GameScene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;

  private onStartCallback: ((spins: number, turbo: boolean, quick: boolean, skip: boolean) => void) | null = null;
  
  private turboSpin = false;
  private quickSpin = false;
  private skipScreens = false;
  private _isTurboDisabled = false;
  private spins = 50;
  private allowedSpins = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 150, 300, 500, 1000];

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

  public setCallbacks(onStart: (spins: number, turbo: boolean, quick: boolean, skip: boolean) => void) {
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
    panelBg.fillStyle(0x3a0055, 1);
    panelBg.fillRoundedRect(pX + 12, pY + 12, pW, pH, 32);

    // Main panel (Creamy off-white base)
    panelBg.fillGradientStyle(0xfff5f8, 0xfff5f8, 0xffe6f0, 0xffe6f0, 1);
    panelBg.fillRoundedRect(pX, pY, pW, pH, 32);

    // Thick Hot-Pink Border
    panelBg.lineStyle(8, 0xff0070, 1);
    panelBg.strokeRoundedRect(pX, pY, pW, pH, 32);
    
    // Inner rim (bright white)
    panelBg.lineStyle(4, 0xffffff, 1);
    panelBg.strokeRoundedRect(pX + 6, pY + 6, pW - 12, pH - 12, 26);

    panelBg.setInteractive(new Phaser.Geom.Rectangle(pX, pY, pW, pH), Phaser.Geom.Rectangle.Contains);
    this.container.add(panelBg);

    // Header Pill
    const headerW = 280;
    const headerH = 65;
    const headerX = w / 2 - headerW / 2;
    const headerY = pY - 20;
    const header = this.scene.add.graphics();
    header.fillStyle(0x3a0055, 1);
    header.fillRoundedRect(headerX + 6, headerY + 6, headerW, headerH, 32);
    header.fillGradientStyle(0xff0070, 0xff0070, 0xcc0055, 0xcc0055, 1);
    header.fillRoundedRect(headerX, headerY, headerW, headerH, 32);
    header.lineStyle(3, 0xffffff, 0.8);
    header.strokeRoundedRect(headerX + 3, headerY + 3, headerW - 6, headerH - 6, 29);
    this.container.add(header);

    // Close Button
    const closeBtnX = pX + pW - 10;
    const closeBtnY = pY + 10;
    const closeBtnGfx = this.scene.add.graphics();
    closeBtnGfx.fillStyle(0x3a0055, 1);
    closeBtnGfx.fillCircle(closeBtnX + 4, closeBtnY + 4, 26);
    closeBtnGfx.fillStyle(0xff3333, 1);
    closeBtnGfx.fillCircle(closeBtnX, closeBtnY, 26);
    closeBtnGfx.lineStyle(4, 0xffffff, 1);
    closeBtnGfx.strokeCircle(closeBtnX, closeBtnY, 26);
    this.container.add(closeBtnGfx);

    const closeBtn = this.scene.add.text(closeBtnX, closeBtnY, '✕', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 0, false, true).setInteractive({ useHandCursor: true });
    
    closeBtn.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      this.hide();
    });
    closeBtn.on('pointerover', () => closeBtn.setScale(1.1));
    closeBtn.on('pointerout', () => closeBtn.setScale(1));
    this.container.add(closeBtn);

    // Title
    const title = this.scene.add.text(w / 2, headerY + headerH / 2, 'AUTOPLAY', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5).setShadow(0, 3, '#000000', 0, false, true);
    this.container.add(title);
    
    // Separator line
    const sep = this.scene.add.graphics();
    sep.lineStyle(2, 0xffb3cc, 1);
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

    // Slider section
    const slideY = pY + 280;
    const slideTitle = this.scene.add.text(pX + pW / 2, slideY - 50, 'NUMBER OF SPINS', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '22px',
      color: '#ff0070',
    }).setOrigin(0.5);
    this.container.add(slideTitle);

    this.sliderX = pX + 50;
    this.sliderWidth = pW - 180;
    this.sliderTrackGfx = this.scene.add.graphics();
    this.container.add(this.sliderTrackGfx);

    this.txtSpinsCount = this.scene.add.text(pX + pW - 30, slideY, `${this.spins}`, {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '48px',
      color: '#00e676',
    }).setOrigin(1, 0.5).setShadow(0, 3, '#000000', 0, false, true);
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
    
    // Massive Green Candy Button
    startBtnGfx.fillStyle(0x3a0055, 0.4);
    startBtnGfx.fillRoundedRect(pX + 34, startY - 76, pW - 60, 60, 20); // Shadow
    
    startBtnGfx.fillGradientStyle(0x00e676, 0x00e676, 0x00b359, 0x00b359, 1);
    startBtnGfx.fillRoundedRect(pX + 30, startY - 80, pW - 60, 60, 20); // Body
    
    startBtnGfx.lineStyle(4, 0xffffff, 1);
    startBtnGfx.strokeRoundedRect(pX + 30, startY - 80, pW - 60, 60, 20); // Border

    this.container.add(startBtnGfx);

    const startHit = this.scene.add.rectangle(pX + pW/2, startY - 50, pW - 60, 60, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    
    startHit.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      this.hide();
      if (this.onStartCallback) {
        this.onStartCallback(this.spins, this.turboSpin, this.quickSpin, this.skipScreens);
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

    this.btnStartTxt = this.scene.add.text(pX + pW / 2, startY - 50, `START AUTOPLAY (${this.spins})`, {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '26px',
      color: '#ffffff',
    }).setOrigin(0.5).setShadow(0, 3, '#004422', 0, false, true);
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
      gfx.fillStyle(0x3a0055, 0.3);
      gfx.fillRoundedRect(x + 2, y + 2, size, size, 10);

      // Box body
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRoundedRect(x, y, size, size, 10);
      
      if (state) {
        // Active border
        gfx.lineStyle(3, 0x00e676, 1);
        gfx.strokeRoundedRect(x, y, size, size, 10);
        
        // Massive Cartoon Checkmark
        gfx.lineStyle(6, 0x00e676, 1);
        gfx.beginPath();
        gfx.moveTo(x + 8, y + size/2 + 2);
        gfx.lineTo(x + size/2 - 2, y + size - 8);
        gfx.lineTo(x + size + 4, y - 4); // Pops out of the box!
        gfx.strokePath();
      } else {
        // Inactive border
        gfx.lineStyle(3, 0xffaadd, 1);
        gfx.strokeRoundedRect(x, y, size, size, 10);
      }
    };
    draw();
    this.container.add(gfx);

    const txt = this.scene.add.text(x + size + 15, y + size/2, label, {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '16px',
      color: '#ff0070',
    }).setOrigin(0, 0.5).setLineSpacing(2);
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
    
    this.txtSpinsCount.setText(`${this.spins}`);
    this.btnStartTxt.setText(`START AUTOPLAY (${this.spins})`);
  }

  private drawSlider() {
    const idx = this.allowedSpins.indexOf(this.spins);
    const percent = idx / (this.allowedSpins.length - 1);
    const fillW = percent * this.sliderWidth;
    
    const y = this.sliderThumbHit.y;

    this.sliderTrackGfx.clear();
    // Background track (dark pill)
    this.sliderTrackGfx.fillStyle(0xffb3cc, 1);
    this.sliderTrackGfx.fillRoundedRect(this.sliderX, y - 8, this.sliderWidth, 16, 8);
    this.sliderTrackGfx.lineStyle(3, 0xff0070, 1);
    this.sliderTrackGfx.strokeRoundedRect(this.sliderX, y - 8, this.sliderWidth, 16, 8);
    
    // Filled track (neon gradient effect using multiple fills)
    this.sliderTrackGfx.fillStyle(0x00b359, 1);
    this.sliderTrackGfx.fillRoundedRect(this.sliderX, y - 8, fillW, 16, { tl: 8, bl: 8, tr: 0, br: 0 });
    this.sliderTrackGfx.fillStyle(0x00e676, 1);
    this.sliderTrackGfx.fillRoundedRect(this.sliderX, y - 5, fillW, 10, { tl: 5, bl: 5, tr: 0, br: 0 });

    const thumbX = this.sliderX + fillW;
    this.sliderThumbHit.setX(thumbX);
    
    this.sliderThumbGfx.clear();
    
    // Thumb shadow
    this.sliderThumbGfx.fillStyle(0x3a0055, 0.3);
    this.sliderThumbGfx.fillCircle(thumbX + 2, y + 4, 22);
    
    // Thumb body
    this.sliderThumbGfx.fillStyle(0x00e676, 1);
    this.sliderThumbGfx.fillCircle(thumbX, y, 22);
    
    // Thumb inner
    this.sliderThumbGfx.fillStyle(0xffffff, 1);
    this.sliderThumbGfx.fillCircle(thumbX, y, 14);
    
    // Inner white highlight
    this.sliderThumbGfx.lineStyle(4, 0xffffff, 1);
    this.sliderThumbGfx.strokeCircle(thumbX, y, 22);
  }
}
