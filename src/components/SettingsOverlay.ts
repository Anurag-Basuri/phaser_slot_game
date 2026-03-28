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

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.build();
  }

  private build() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.container = this.scene.add.container(0, 0).setDepth(48).setVisible(false);

    // Dark overlay
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x050a1a, 0.9);
    bg.fillRect(0, 0, w, h);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    this.container.add(bg);

    // Panel
    const panelW = Math.min(420, w * 0.85);
    const panelH = 400;
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x0d1225, 0.98);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 18);
    panel.lineStyle(2, 0x1a2244, 0.8);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 18);
    // Header accent
    panel.fillStyle(0x00d2ff, 0.06);
    panel.fillRoundedRect(panelX, panelY, panelW, 55, { tl: 18, tr: 18, bl: 0, br: 0 });
    this.container.add(panel);

    // Title
    this.container.add(this.scene.add.text(w / 2, panelY + 28, '⚙  SETTINGS', {
      fontSize: '24px', color: '#aabbdd', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Close button  
    const closeBtn = this.scene.add.text(panelX + panelW - 30, panelY + 18, '✕', {
      fontSize: '24px', color: '#556688',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff4466'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#556688'));
    this.container.add(closeBtn);

    let yPos = panelY + 80;
    const labelStyle = { fontSize: '16px', color: '#99aabb' };
    const rowH = 50;

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

    yPos += rowH + 30;

    // Game info
    this.container.add(this.scene.add.text(w / 2, yPos, 'Sweet Cluster 1000', {
      fontSize: '16px', color: '#ff00cc', fontStyle: 'bold',
    }).setOrigin(0.5));
    yPos += 24;
    this.container.add(this.scene.add.text(w / 2, yPos, 'RTP: 96.00%  •  Max Win: 25,000×', {
      fontSize: '12px', color: '#445566',
    }).setOrigin(0.5));
    yPos += 18;
    this.container.add(this.scene.add.text(w / 2, yPos, 'v1.0.0  •  High Volatility', {
      fontSize: '11px', color: '#334455',
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
      toggleBg.fillStyle(isOn ? 0x22cc66 : 0x333355, 1);
      toggleBg.fillRoundedRect(toggleX, yPos + 5, 44, 22, 11);
      // Knob
      toggleBg.fillStyle(0xffffff, 0.9);
      toggleBg.fillCircle(isOn ? toggleX + 34 : toggleX + 10, yPos + 16, 8);
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
