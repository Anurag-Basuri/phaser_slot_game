import Phaser from 'phaser';

/**
 * Settings / Menu overlay for game configuration.
 */
export class SettingsOverlay {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;
  private onSoundToggle: ((enabled: boolean) => void) | null = null;
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
    const panelW = Math.min(400, w * 0.85);
    const panelH = 360;
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x0f1528, 0.95);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    panel.lineStyle(3, 0x00d2ff, 0.7);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);
    this.container.add(panel);

    // Title
    this.container.add(this.scene.add.text(w / 2, panelY + 30, '⚙ SETTINGS', {
      fontSize: '28px', color: '#00d2ff', fontStyle: 'bold',
    }).setOrigin(0.5, 0));

    // Close button
    const closeBtn = this.scene.add.text(panelX + panelW - 30, panelY + 15, '✕', {
      fontSize: '28px', color: '#ff4466',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    this.container.add(closeBtn);

    let yPos = panelY + 80;
    const labelStyle = { fontSize: '18px', color: '#ccccdd' };

    // Sound toggle
    this.container.add(this.scene.add.text(panelX + 30, yPos, 'Sound', labelStyle));
    const soundBtn = this.scene.add.text(panelX + panelW - 30, yPos, '🔊 ON', {
      fontSize: '18px', color: '#44ff88', fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    soundBtn.on('pointerdown', () => {
      this.soundEnabled = !this.soundEnabled;
      soundBtn.setText(this.soundEnabled ? '🔊 ON' : '🔇 OFF');
      soundBtn.setColor(this.soundEnabled ? '#44ff88' : '#ff4466');
      if (this.onSoundToggle) this.onSoundToggle(this.soundEnabled);
    });
    this.container.add(soundBtn);

    yPos += 50;

    // Turbo mode toggle
    this.container.add(this.scene.add.text(panelX + 30, yPos, 'Turbo Spins', labelStyle));
    const turboBtn = this.scene.add.text(panelX + panelW - 30, yPos, 'OFF', {
      fontSize: '18px', color: '#ff4466', fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    turboBtn.on('pointerdown', () => {
      this.turboMode = !this.turboMode;
      turboBtn.setText(this.turboMode ? 'ON' : 'OFF');
      turboBtn.setColor(this.turboMode ? '#44ff88' : '#ff4466');
    });
    this.container.add(turboBtn);

    yPos += 50;

    // Quality selector
    this.container.add(this.scene.add.text(panelX + 30, yPos, 'Quality', labelStyle));
    const qualityOptions = ['HIGH', 'MEDIUM', 'LOW'];
    let currentQuality = 0;
    const qualityBtn = this.scene.add.text(panelX + panelW - 30, yPos, qualityOptions[currentQuality], {
      fontSize: '18px', color: '#ffaa44', fontStyle: 'bold',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    qualityBtn.on('pointerdown', () => {
      currentQuality = (currentQuality + 1) % qualityOptions.length;
      qualityBtn.setText(qualityOptions[currentQuality]);
      if (this.onQualityChange) this.onQualityChange(qualityOptions[currentQuality]);
    });
    this.container.add(qualityBtn);

    yPos += 70;

    // Game info
    this.container.add(this.scene.add.text(w / 2, yPos, 'Sweet Cluster 1000', {
      fontSize: '16px', color: '#ff00cc', fontStyle: 'bold',
    }).setOrigin(0.5, 0));
    yPos += 24;
    this.container.add(this.scene.add.text(w / 2, yPos, 'RTP: 96.00%  •  Max Win: 25,000×', {
      fontSize: '13px', color: '#666688',
    }).setOrigin(0.5, 0));
    yPos += 20;
    this.container.add(this.scene.add.text(w / 2, yPos, 'v1.0.0', {
      fontSize: '12px', color: '#444466',
    }).setOrigin(0.5, 0));
  }

  public setSoundCallback(cb: (enabled: boolean) => void) {
    this.onSoundToggle = cb;
  }

  public isTurboMode(): boolean {
    return this.turboMode;
  }

  public show() {
    this.visible = true;
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container, alpha: 1, duration: 250,
    });
  }

  public hide() {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 200,
      onComplete: () => {
        this.container.setVisible(false);
        this.visible = false;
      },
    });
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public toggle() {
    if (this.visible) this.hide();
    else this.show();
  }
}
