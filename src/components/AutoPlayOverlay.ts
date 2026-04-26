import Phaser from 'phaser';

export class AutoPlayOverlay {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;

  private onStartCallback: ((spins: number, turbo: boolean, quick: boolean, skip: boolean) => void) | null = null;
  
  private turboSpin = false;
  private quickSpin = false;
  private skipScreens = false;
  private spins = 100;
  private allowedSpins = [10, 20, 30, 50, 70, 100, 500, 1000];

  private txtSpinsCount!: Phaser.GameObjects.Text;
  private btnStartTxt!: Phaser.GameObjects.Text;
  private sliderThumbHit!: Phaser.GameObjects.Rectangle;
  private sliderThumbGfx!: Phaser.GameObjects.Graphics;
  private sliderTrackGfx!: Phaser.GameObjects.Graphics;
  
  private _resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private sliderWidth = 0;
  private sliderX = 0;
  private draggingSlider = false;

  constructor(scene: Phaser.Scene) {
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

  public show() {
    if (this.visible) return;
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

    // Panel
    const isMobile = w < 768;
    const pW = isMobile ? w * 0.95 : 600;
    const pH = isMobile ? h * 0.7 : 500;
    const pX = (w - pW) / 2;
    const pY = (h - pH) / 2;

    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(0x0f0f11, 1);
    panelBg.fillRoundedRect(pX, pY, pW, pH, 16);
    panelBg.setInteractive(new Phaser.Geom.Rectangle(pX, pY, pW, pH), Phaser.Geom.Rectangle.Contains);
    this.container.add(panelBg);

    // Close Button
    const closeBtn = this.scene.add.text(pX + pW - 20, pY + 20, 'X', {
      fontFamily: '"Inter", sans-serif',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: '100'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    this.container.add(closeBtn);

    // Title
    const title = this.scene.add.text(pX + pW / 2, pY + 40, 'AUTOPLAY SETTINGS', {
      fontFamily: '"Inter", "Arial", sans-serif',
      fontSize: '24px',
      color: '#ffaa00',
      fontStyle: '900'
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Checkboxes row
    const cbY = pY + 120;
    const cbWidth = pW / 3;
    
    const cb1 = this.createCheckbox(pX + cbWidth * 0.1, cbY, 'TURBO\nSPIN', this.turboSpin, (val) => {
      this.turboSpin = val;
      if (val) {
        this.quickSpin = false;
        cb2.setState(false);
      }
    });
    const cb2 = this.createCheckbox(pX + cbWidth * 1.1, cbY, 'QUICK\nSPIN', this.quickSpin, (val) => {
      this.quickSpin = val;
      if (val) {
        this.turboSpin = false;
        cb1.setState(false);
      }
    });
    const cb3 = this.createCheckbox(pX + cbWidth * 2.1, cbY, 'SKIP\nSCREENS', this.skipScreens, (val) => this.skipScreens = val);

    // Slider section
    const slideY = pY + 260;
    const slideTitle = this.scene.add.text(pX + pW / 2, slideY - 40, 'NUMBER OF AUTOSPINS', {
      fontFamily: '"Inter", sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: '900'
    }).setOrigin(0.5);
    this.container.add(slideTitle);

    this.sliderX = pX + 50;
    this.sliderWidth = pW - 180;
    this.sliderTrackGfx = this.scene.add.graphics();
    this.container.add(this.sliderTrackGfx);

    this.txtSpinsCount = this.scene.add.text(pX + pW - 30, slideY, `${this.spins}`, {
      fontFamily: '"Inter", sans-serif',
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: '900'
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
    const startY = pY + pH - 20;
    const startBtnGfx = this.scene.add.graphics();
    startBtnGfx.fillStyle(0x00cc55, 1);
    startBtnGfx.fillRoundedRect(pX + 20, startY - 80, pW - 40, 60, 8);
    this.container.add(startBtnGfx);

    const startHit = this.scene.add.rectangle(pX + pW/2, startY - 50, pW - 40, 60, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    startHit.on('pointerdown', () => {
      this.hide();
      if (this.onStartCallback) {
        this.onStartCallback(this.spins, this.turboSpin, this.quickSpin, this.skipScreens);
      }
    });
    this.container.add(startHit);

    this.btnStartTxt = this.scene.add.text(pX + pW / 2, startY - 50, `START AUTOPLAY (${this.spins})`, {
      fontFamily: '"Inter", sans-serif',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: '900'
    }).setOrigin(0.5);
    this.container.add(this.btnStartTxt);

    this.drawSlider();
  }

  private createCheckbox(x: number, y: number, label: string, initial: boolean, onChange: (val: boolean) => void) {
    const size = 40;
    const gfx = this.scene.add.graphics();
    let state = initial;
    
    const draw = () => {
      gfx.clear();
      if (state) {
        gfx.fillStyle(0x00cc55, 1);
        gfx.fillRoundedRect(x, y, size, size, 6);
        // Checkmark
        gfx.lineStyle(3, 0xffffff, 1);
        gfx.beginPath();
        gfx.moveTo(x + 10, y + size/2);
        gfx.lineTo(x + size/2 - 2, y + size - 12);
        gfx.lineTo(x + size - 10, y + 10);
        gfx.strokePath();
      } else {
        gfx.lineStyle(2, 0x555555, 1);
        gfx.strokeRoundedRect(x, y, size, size, 6);
      }
    };
    draw();
    this.container.add(gfx);

    const txt = this.scene.add.text(x + size + 15, y + size/2, label, {
      fontFamily: '"Inter", sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setLineSpacing(5);
    this.container.add(txt);

    const hit = this.scene.add.rectangle(x + size, y + size/2, size*3, size+10, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
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
    // Background track
    this.sliderTrackGfx.fillStyle(0x333333, 1);
    this.sliderTrackGfx.fillRect(this.sliderX, y - 2, this.sliderWidth, 4);
    // Filled track
    this.sliderTrackGfx.fillStyle(0x00cc55, 1);
    this.sliderTrackGfx.fillRect(this.sliderX, y - 2, fillW, 4);

    const thumbX = this.sliderX + fillW;
    this.sliderThumbHit.setX(thumbX);
    
    this.sliderThumbGfx.clear();
    this.sliderThumbGfx.fillStyle(0x00cc55, 1);
    this.sliderThumbGfx.fillRoundedRect(thumbX - 15, y - 20, 30, 40, 4);
    // Triple lines
    this.sliderThumbGfx.fillStyle(0xffffff, 1);
    this.sliderThumbGfx.fillRect(thumbX - 6, y - 6, 2, 12);
    this.sliderThumbGfx.fillRect(thumbX - 1, y - 6, 2, 12);
    this.sliderThumbGfx.fillRect(thumbX + 4, y - 6, 2, 12);
  }
}
