import Phaser from 'phaser';

/**
 * Settings / Menu overlay with sound, turbo mode, and quality options.
 */
export class SettingsOverlay {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;
  private onSoundToggle: ((enabled: boolean) => void) | null = null;
  private onTurboToggle: ((enabled: boolean) => void) | null = null;
  private onQualityChange: ((quality: string) => void) | null = null;
  private soundEnabled = true;
  private turboMode = false;
  private _resizeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.build();

    // Debounced rebuild on resize so the panel stays centered
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
  }

  private build() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.container = this.scene.add.container(0, 0).setDepth(100).setVisible(false);

    // Dark overlay
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0515, 0.95);
    bg.fillRect(0, 0, w, h);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerdown', () => this.hide());
    this.container.add(bg);

    // Panel
    const panelW = Math.min(420, w * 0.85);
    const panelH = 400;
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    const panel = this.scene.add.graphics();
    // Drop shadow
    panel.fillStyle(0x000000, 0.6);
    panel.fillRoundedRect(panelX + 4, panelY + 6, panelW, panelH, 20);

    // Main background
    panel.fillStyle(0x150b24, 0.98);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);
    panel.lineStyle(3, 0xff006a, 0.8); // Pink border
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);

    // Header accent
    panel.fillStyle(0xffffff, 0.05);
    panel.fillRoundedRect(panelX, panelY, panelW, 60, { tl: 20, tr: 20, bl: 0, br: 0 } as any);
    panel.lineStyle(1, 0xffffff, 0.1);
    panel.lineBetween(panelX, panelY + 60, panelX + panelW, panelY + 60);
    this.container.add(panel);

    // Title
    this.container.add(this.scene.add.text(w / 2, panelY + 30, 'SETTINGS', {
      fontSize: '26px', color: '#ffffff', fontFamily: '"Luckiest Guy", cursive, sans-serif'
    }).setOrigin(0.5).setShadow(0, 2, '#ff006a', 4, true, true));

    // Close button  
    const closeBtn = this.scene.add.text(panelX + panelW - 35, panelY + 30, '✕', {
      fontSize: '24px', color: '#8899aa', fontFamily: '"Inter", Arial, sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff006a'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#8899aa'));
    this.container.add(closeBtn);

    let yPos = panelY + 90;
    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = { 
      fontSize: '18px', color: '#eef', fontFamily: '"Inter", Arial, sans-serif', fontStyle: 'bold'
    };
    const rowH = 55;

    // Sound toggle
    this.addSettingsRow(panelX, yPos, panelW, 'Sound', labelStyle, () => {
      this.soundEnabled = !this.soundEnabled;
      return this.soundEnabled;
    }, (isOn) => {
      if (this.onSoundToggle) this.onSoundToggle(isOn);
    });
    yPos += rowH;

    // Separator
    const sep1 = this.scene.add.graphics();
    sep1.lineStyle(1, 0x1a2244, 0.5);
    sep1.lineBetween(panelX + 20, yPos, panelX + panelW - 20, yPos);
    this.container.add(sep1);
    yPos += 10;

    // Turbo mode toggle
    this.addSettingsRow(panelX, yPos, panelW, 'Turbo Spins', labelStyle, () => {
      this.turboMode = !this.turboMode;
      return this.turboMode;
    }, (isOn) => {
      if (this.onTurboToggle) this.onTurboToggle(isOn);
    });
    yPos += rowH;

    // Separator
    const sep2 = this.scene.add.graphics();
    sep2.lineStyle(1, 0x1a2244, 0.5);
    sep2.lineBetween(panelX + 20, yPos, panelX + panelW - 20, yPos);
    this.container.add(sep2);
    yPos += 10;

    // Quality selector
    this.container.add(this.scene.add.text(panelX + 30, yPos + 8, 'Quality', labelStyle));
    const qualityOptions = ['HIGH', 'MEDIUM', 'LOW'];
    let currentQuality = 0;
    const qualityBtn = this.scene.add.text(panelX + panelW - 30, yPos + 8, qualityOptions[currentQuality], {
      fontSize: '16px', color: '#ffaa44', fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    qualityBtn.on('pointerdown', () => {
      currentQuality = (currentQuality + 1) % qualityOptions.length;
      qualityBtn.setText(qualityOptions[currentQuality]);
      if (this.onQualityChange) this.onQualityChange(qualityOptions[currentQuality]);
    });
    this.container.add(qualityBtn);

    yPos += rowH + 20;

    // Game info box
    const infoBox = this.scene.add.graphics();
    infoBox.fillStyle(0x0a0515, 0.6);
    infoBox.fillRoundedRect(panelX + 30, yPos - 15, panelW - 60, 95, 12);
    infoBox.lineStyle(1, 0xffffff, 0.05);
    infoBox.strokeRoundedRect(panelX + 30, yPos - 15, panelW - 60, 95, 12);
    this.container.add(infoBox);

    this.container.add(this.scene.add.text(w / 2, yPos, 'Sugar Rush 1000', {
      fontSize: '22px', color: '#ff006a', fontFamily: '"Luckiest Guy", cursive, sans-serif'
    }).setOrigin(0.5).setShadow(0, 2, '#000', 2, true, true));
    yPos += 28;
    this.container.add(this.scene.add.text(w / 2, yPos, 'RTP: 96.53%   •   Max Win: 25,000×', {
      fontSize: '14px', color: '#99aabb', fontFamily: '"Inter", Arial, sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5));
    yPos += 22;
    this.container.add(this.scene.add.text(w / 2, yPos, 'v1.0.0   •   High Volatility', {
      fontSize: '12px', color: '#778899', fontFamily: '"Inter", Arial, sans-serif'
    }).setOrigin(0.5));
  }

  private addSettingsRow(
    panelX: number, yPos: number, panelW: number,
    label: string, style: Phaser.Types.GameObjects.Text.TextStyle,
    toggleFn: () => boolean,
    callbackFn: (state: boolean) => void
  ) {
    this.container.add(this.scene.add.text(panelX + 30, yPos + 8, label, style));

    const toggleBg = this.scene.add.graphics();
    const toggleX = panelX + panelW - 70;
    let isOn = label === 'Sound' ? this.soundEnabled : this.turboMode;

    const drawToggle = () => {
      toggleBg.clear();
      toggleBg.fillStyle(isOn ? 0xff006a : 0x2a1a40, 1);
      toggleBg.fillRoundedRect(toggleX, yPos + 2, 50, 26, 13);
      if (isOn) {
        toggleBg.lineStyle(2, 0xff88ff, 0.8);
        toggleBg.strokeRoundedRect(toggleX, yPos + 2, 50, 26, 13);
      }
      // Knob
      toggleBg.fillStyle(0xffffff, 1);
      toggleBg.fillCircle(isOn ? toggleX + 37 : toggleX + 13, yPos + 15, 9);
      if (!isOn) {
        toggleBg.fillStyle(0x888888, 1);
        toggleBg.fillCircle(toggleX + 13, yPos + 15, 6);
      }
    };
    drawToggle();
    this.container.add(toggleBg);

    const hitArea = this.scene.add.rectangle(toggleX + 22, yPos + 16, 50, 28)
      .setInteractive({ useHandCursor: true }).setAlpha(0.001);
    hitArea.on('pointerdown', () => {
      isOn = toggleFn();
      drawToggle();
      callbackFn(isOn);
    });
    this.container.add(hitArea);
  }

  public setSoundCallback(cb: (enabled: boolean) => void) {
    this.onSoundToggle = cb;
  }

  public setTurboCallback(cb: (enabled: boolean) => void) {
    this.onTurboToggle = cb;
  }

  public isTurboMode(): boolean { return this.turboMode; }
  public show() {
    this.visible = true;
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 250 });
  }
  public hide() {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 200,
      onComplete: () => { this.container.setVisible(false); this.visible = false; },
    });
  }
  public isVisible(): boolean { return this.visible; }
  public toggle() {
    if (this.visible) this.hide(); else this.show();
  }
}
