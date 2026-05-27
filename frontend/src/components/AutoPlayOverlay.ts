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
    // Premium dark gradient panel with glowing border
    panelBg.fillStyle(0x0a0a0f, 0.95);
    panelBg.fillRoundedRect(pX, pY, pW, pH, 20);
    panelBg.lineStyle(2, 0x442266, 1);
    panelBg.strokeRoundedRect(pX, pY, pW, pH, 20);
    
    // Inner highlight
    panelBg.lineStyle(1, 0x6644aa, 0.5);
    panelBg.strokeRoundedRect(pX + 2, pY + 2, pW - 4, pH - 4, 18);

    panelBg.setInteractive(new Phaser.Geom.Rectangle(pX, pY, pW, pH), Phaser.Geom.Rectangle.Contains);
    this.container.add(panelBg);

    // Close Button
    const closeBtn = this.scene.add.text(pX + pW - 20, pY + 20, 'X', {
      resolution: 2, fontFamily: '"Poppins", sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: '100'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      this.hide();
    });
    this.container.add(closeBtn);

    // Title
    const title = this.scene.add.text(pX + pW / 2, pY + 35, 'AUTOPLAY', {
      resolution: 2, fontFamily: '"Montserrat", "Poppins", sans-serif',
      fontSize: '32px',
      color: '#ffcc00',
      stroke: '#441166',
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 4, color: '#000000', blur: 0, fill: true }
    }).setOrigin(0.5, 0);
    this.container.add(title);
    
    // Separator line
    const sep = this.scene.add.graphics();
    sep.lineStyle(2, 0x331155, 0.8);
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
      resolution: 2, fontFamily: '"Poppins", sans-serif',
      fontSize: '18px',
      color: '#aaaaee',
      fontStyle: '800',
      letterSpacing: 1.5
    }).setOrigin(0.5);
    this.container.add(slideTitle);

    this.sliderX = pX + 50;
    this.sliderWidth = pW - 180;
    this.sliderTrackGfx = this.scene.add.graphics();
    this.container.add(this.sliderTrackGfx);

    this.txtSpinsCount = this.scene.add.text(pX + pW - 30, slideY, `${this.spins}`, {
      resolution: 2, fontFamily: '"Montserrat", "Poppins", sans-serif',
      fontSize: '42px',
      color: '#00ff88',
      stroke: '#004422',
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true }
    }).setOrigin(1, 0.5);
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
    
    // Premium bright green button with 3D depth
    startBtnGfx.fillStyle(0x006622, 1);
    startBtnGfx.fillRoundedRect(pX + 30, startY - 76, pW - 60, 60, 12);
    startBtnGfx.fillStyle(0x00cc55, 1);
    startBtnGfx.fillRoundedRect(pX + 30, startY - 80, pW - 60, 60, 12);
    
    // Highlight
    startBtnGfx.fillStyle(0x44ff88, 0.4);
    startBtnGfx.fillRoundedRect(pX + 34, startY - 78, pW - 68, 15, 8);

    this.container.add(startBtnGfx);

    const startHit = this.scene.add.rectangle(pX + pW/2, startY - 50, pW - 60, 60, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    
    // Start button hover effects
    startHit.on('pointerover', () => startBtnGfx.setAlpha(0.8));
    startHit.on('pointerout', () => startBtnGfx.setAlpha(1));
    
    startHit.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      this.hide();
      if (this.onStartCallback) {
        this.onStartCallback(this.spins, this.turboSpin, this.quickSpin, this.skipScreens);
      }
    });
    this.container.add(startHit);

    this.btnStartTxt = this.scene.add.text(pX + pW / 2, startY - 50, `START AUTOPLAY (${this.spins})`, {
      resolution: 2, fontFamily: '"Montserrat", "Poppins", sans-serif',
      fontSize: '26px',
      color: '#ffffff',
      stroke: '#004422',
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 0, fill: true }
    }).setOrigin(0.5);
    this.container.add(this.btnStartTxt);

    this.drawSlider();
  }

  private createCheckbox(x: number, y: number, label: string, initial: boolean, onChange: (val: boolean) => void) {
    const size = 36;
    const gfx = this.scene.add.graphics();
    let state = initial;
    
    const draw = () => {
      gfx.clear();
      
      // Box background
      gfx.fillStyle(0x1a1a24, 1);
      gfx.fillRoundedRect(x, y, size, size, 8);
      
      if (state) {
        // Active border
        gfx.lineStyle(2, 0x00ff88, 1);
        gfx.strokeRoundedRect(x, y, size, size, 8);
        
        // Neon Checkmark
        gfx.lineStyle(4, 0x00ff88, 1);
        gfx.beginPath();
        gfx.moveTo(x + 8, y + size/2);
        gfx.lineTo(x + size/2 - 2, y + size - 10);
        gfx.lineTo(x + size - 8, y + 10);
        gfx.strokePath();
      } else {
        // Inactive border
        gfx.lineStyle(2, 0x333344, 1);
        gfx.strokeRoundedRect(x, y, size, size, 8);
      }
    };
    draw();
    this.container.add(gfx);

    const txt = this.scene.add.text(x + size + 10, y + size/2, label, {
      resolution: 2, fontFamily: '"Poppins", sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
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
    this.sliderTrackGfx.fillStyle(0x1a1a24, 1);
    this.sliderTrackGfx.fillRoundedRect(this.sliderX, y - 6, this.sliderWidth, 12, 6);
    this.sliderTrackGfx.lineStyle(2, 0x333344, 1);
    this.sliderTrackGfx.strokeRoundedRect(this.sliderX, y - 6, this.sliderWidth, 12, 6);
    
    // Filled track (neon gradient effect using multiple fills)
    this.sliderTrackGfx.fillStyle(0x008844, 1);
    this.sliderTrackGfx.fillRoundedRect(this.sliderX, y - 6, fillW, 12, { tl: 6, bl: 6, tr: 0, br: 0 });
    this.sliderTrackGfx.fillStyle(0x00ff88, 1);
    this.sliderTrackGfx.fillRoundedRect(this.sliderX, y - 4, fillW, 8, { tl: 4, bl: 4, tr: 0, br: 0 });

    const thumbX = this.sliderX + fillW;
    this.sliderThumbHit.setX(thumbX);
    
    this.sliderThumbGfx.clear();
    
    // Thumb shadow
    this.sliderThumbGfx.fillStyle(0x000000, 0.5);
    this.sliderThumbGfx.fillCircle(thumbX, y + 4, 18);
    
    // Thumb body
    this.sliderThumbGfx.fillStyle(0x00ff88, 1);
    this.sliderThumbGfx.fillCircle(thumbX, y, 18);
    
    // Thumb inner
    this.sliderThumbGfx.fillStyle(0x00cc55, 1);
    this.sliderThumbGfx.fillCircle(thumbX, y, 14);
    
    // Inner white highlight
    this.sliderThumbGfx.fillStyle(0xffffff, 1);
    this.sliderThumbGfx.fillCircle(thumbX, y, 8);
  }
}
