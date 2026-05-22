import Phaser from 'phaser';

/**
 * Settings / Menu overlay with separate Music & SFX toggles, turbo mode, and quality options.
 * Overhauled to look premium, standardized, and perfectly responsive at all viewport sizes.
 */
export class SettingsOverlay {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;
  private onMusicToggle: ((enabled: boolean) => void) | null = null;
  private onSfxToggle: ((enabled: boolean) => void) | null = null;
  private onTurboToggle: ((enabled: boolean) => void) | null = null;
  private onQualityChange: ((quality: string) => void) | null = null;
  private musicEnabled = true;
  private sfxEnabled = true;
  private turboMode = false;
  private currentQuality = 'HIGH';
  private _resizeTimer: ReturnType<typeof setTimeout> | null = null;

  // Legacy compat — old code calls setSoundCallback
  private onSoundToggle: ((enabled: boolean) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.build();

    // Rebuild on resize so the panel remains perfectly centered and responsive
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
    const isMobile = w < 768;
    const isShort = h < 520; // Landscape mobile detection

    this.container = this.scene.add.container(0, 0).setDepth(100).setVisible(false);

    // Dark glass overlay backdrop
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x07030f, 0.85);
    bg.fillRect(0, 0, w, h);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerdown', () => this.hide());
    this.container.add(bg);

    // Responsive Panel sizing
    const panelW = isShort ? Math.min(560, w * 0.95) : Math.min(420, w * 0.9);
    const panelH = isShort ? Math.min(310, h * 0.95) : Math.min(490, h * 0.9);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    const panel = this.scene.add.graphics();
    
    // Outer drop shadow
    panel.fillStyle(0x000000, 0.4);
    panel.fillRoundedRect(panelX + 6, panelY + 8, panelW, panelH, 20);

    // Main panel (dark premium background)
    panel.fillGradientStyle(0x130f24, 0x130f24, 0x0a0812, 0x0a0812, 0.98);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);

    // Header gradient (matches Paytable)
    const headerH = 60;
    panel.fillGradientStyle(0xff006a, 0xff3388, 0x130f24, 0x130f24, 0.2, 0.2, 0, 0);
    panel.fillRoundedRect(panelX, panelY, panelW, headerH, { tl: 20, tr: 20, bl: 0, br: 0 } as any);

    // Border
    panel.lineStyle(2, 0xff006a, 0.6);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);
    
    // Inner rim
    panel.lineStyle(1, 0xffffff, 0.05);
    panel.strokeRoundedRect(panelX + 2, panelY + 2, panelW - 4, panelH - 4, 18);
    panel.setInteractive(new Phaser.Geom.Rectangle(panelX, panelY, panelW, panelH), Phaser.Geom.Rectangle.Contains);
    this.container.add(panel);

    // Title text
    const titleText = this.scene.add.text(w / 2, panelY + headerH / 2 - 2, 'SETTINGS', { resolution: 2,
      fontSize: isShort ? '22px' : '26px',
      color: '#ffffff',
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontStyle: '800'
    }).setOrigin(0.5);
    this.container.add(titleText);

    // Circular neon close button (matches Paytable)
    const closeBtnX = panelX + panelW - 35;
    const closeBtnY = panelY + headerH / 2;
    const closeGfx = this.scene.add.graphics();
    
    closeGfx.fillStyle(0xff006a, 0.12);
    closeGfx.fillCircle(closeBtnX, closeBtnY, 16);
    closeGfx.lineStyle(1.5, 0xff006a, 0.5);
    closeGfx.strokeCircle(closeBtnX, closeBtnY, 16);
    this.container.add(closeGfx);

    const closeBtn = this.scene.add.text(closeBtnX, closeBtnY, '✕', { resolution: 2,
      fontSize: '22px',
      color: '#ffffff',
      fontFamily: '"Inter", "Arial", sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => {
      (this.scene as any).audio.playSound('button');
      this.hide();
    });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff4488'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ffffff'));
    this.container.add(closeBtn);

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      resolution: 2,
      fontSize: isShort ? '14px' : '16px',
      color: '#ffffff',
      fontFamily: '"Poppins", "Outfit", sans-serif',
      fontStyle: '800'
    };

    if (isShort) {
      // ─── LANDSCAPE / SHORT SCREEN: 2-Column Grid Layout ───
      const colW = (panelW - 60) / 2;
      const col1X = panelX + 20;
      const col2X = panelX + 40 + colW;
      
      let rowY = panelY + headerH + 18;
      const rowH = 46;
      const rowGap = 8;

      // Col 1, Row 1: Music
      this.addToggleRow(col1X, rowY, colW, '🎵 Music', labelStyle, this.musicEnabled, (isOn) => {
        this.musicEnabled = isOn;
        if (this.onMusicToggle) this.onMusicToggle(isOn);
      });

      // Col 2, Row 1: Sounds
      this.addToggleRow(col2X, rowY, colW, '🔊 Sounds', labelStyle, this.sfxEnabled, (isOn) => {
        this.sfxEnabled = isOn;
        if (this.onSfxToggle) this.onSfxToggle(isOn);
      });

      rowY += rowH + rowGap;

      // Col 1, Row 2: Turbo Spins
      this.addToggleRow(col1X, rowY, colW, '⚡ Turbo', labelStyle, this.turboMode, (isOn) => {
        this.turboMode = isOn;
        if (this.onTurboToggle) this.onTurboToggle(isOn);
      });

      // Col 2, Row 2: Quality (Segmented selector)
      this.addQualitySelector(col2X, rowY, colW, '✨ Quality', labelStyle, true);

      // Bottom Info (Compact Single-line)
      const infoY = panelY + panelH - 42;
      
      const infoBox = this.scene.add.graphics();
      infoBox.fillStyle(0x0d0a18, 0.5);
      infoBox.fillRoundedRect(panelX + 20, infoY, panelW - 40, 28, 8);
      infoBox.lineStyle(1, 0xffffff, 0.07);
      infoBox.strokeRoundedRect(panelX + 20, infoY, panelW - 40, 28, 8);
      this.container.add(infoBox);

      const infoText = this.scene.add.text(w / 2, infoY + 14, 'Sugar Blast 1000  •  RTP: 96.53%  •  v1.0.0  •  High Volatility', { resolution: 2,
        fontSize: '11px',
        color: '#99aabb',
        fontFamily: '"Outfit", "Inter", sans-serif',
        fontStyle: '800'
      }).setOrigin(0.5);
      this.container.add(infoText);

    } else {
      // ─── PORTRAIT / TALL SCREEN: 1-Column List Layout ───
      let rowY = panelY + headerH + 20;
      const rowW = panelW - 40;
      const rowX = panelX + 20;
      const rowH = 52;
      const rowGap = 10;

      // Game Music Row
      this.addToggleRow(rowX, rowY, rowW, '🎵 Game Music', labelStyle, this.musicEnabled, (isOn) => {
        this.musicEnabled = isOn;
        if (this.onMusicToggle) this.onMusicToggle(isOn);
      });
      rowY += rowH + rowGap;

      // Game Sounds Row
      this.addToggleRow(rowX, rowY, rowW, '🔊 Game Sounds', labelStyle, this.sfxEnabled, (isOn) => {
        this.sfxEnabled = isOn;
        if (this.onSfxToggle) this.onSfxToggle(isOn);
      });
      rowY += rowH + rowGap;

      // Turbo Spins Row
      this.addToggleRow(rowX, rowY, rowW, '⚡ Turbo Spins', labelStyle, this.turboMode, (isOn) => {
        this.turboMode = isOn;
        if (this.onTurboToggle) this.onTurboToggle(isOn);
      });
      rowY += rowH + rowGap;

      // Quality Selector Row
      this.addQualitySelector(rowX, rowY, rowW, '✨ Graphics Quality', labelStyle, false);
      rowY += rowH + rowGap + 8;

      // Bottom Info Box
      const infoBox = this.scene.add.graphics();
      infoBox.fillStyle(0x0d0a18, 0.5);
      infoBox.fillRoundedRect(panelX + 20, rowY, panelW - 40, 85, 12);
      infoBox.lineStyle(1, 0xffffff, 0.07);
      infoBox.strokeRoundedRect(panelX + 20, rowY, panelW - 40, 85, 12);
      this.container.add(infoBox);

      this.container.add(this.scene.add.text(w / 2, rowY + 18, 'Sugar Blast 1000', { resolution: 2,
        fontSize: '18px',
        color: '#ff006a',
        fontFamily: '"Outfit", "Inter", sans-serif',
        fontStyle: '900'
      }).setOrigin(0.5).setShadow(0, 1.5, '#000000', 2, true, true));

      this.container.add(this.scene.add.text(w / 2, rowY + 44, 'RTP: 96.53%   •   Max Win: 25,000×', { resolution: 2,
        fontSize: '13px',
        color: '#99aabb',
        fontFamily: '"Outfit", "Inter", sans-serif',
        fontStyle: '800'
      }).setOrigin(0.5));

      this.container.add(this.scene.add.text(w / 2, rowY + 65, 'v1.0.0   •   High Volatility', { resolution: 2,
        fontSize: '11px',
        color: '#778899',
        fontFamily: '"Outfit", "Inter", sans-serif',
        fontStyle: '700'
      }).setOrigin(0.5));
    }
  }

  private addToggleRow(
    tileX: number, tileY: number, tileW: number,
    label: string, labelStyle: Phaser.Types.GameObjects.Text.TextStyle,
    initialState: boolean,
    callbackFn: (state: boolean) => void
  ) {
    const tileH = labelStyle.fontSize === '14px' ? 38 : 44;

    // Row backplate
    const backplate = this.scene.add.graphics();
    backplate.fillStyle(0x0d0a18, 0.5);
    backplate.fillRoundedRect(tileX, tileY, tileW, tileH, 10);
    backplate.lineStyle(1, 0xffffff, 0.07);
    backplate.strokeRoundedRect(tileX, tileY, tileW, tileH, 10);
    this.container.add(backplate);

    // Label text
    const labelTxt = this.scene.add.text(tileX + 15, tileY + tileH / 2, label, labelStyle).setOrigin(0, 0.5);
    this.container.add(labelTxt);

    // Toggle switch parameters
    const toggleW = 44;
    const toggleH = 22;
    const toggleX = tileX + tileW - toggleW - 12;
    const toggleY = tileY + (tileH - toggleH) / 2;

    const toggleGfx = this.scene.add.graphics();
    this.container.add(toggleGfx);

    let isOn = initialState;
    let progress = isOn ? 1 : 0;

    // Draw sliding switch graphics
    const drawToggle = (p: number) => {
      toggleGfx.clear();
      
      // Interpolate backgrounds
      toggleGfx.fillStyle(0x000000, (1 - p) * 0.5);
      toggleGfx.fillRoundedRect(toggleX, toggleY, toggleW, toggleH, toggleH / 2);
      
      toggleGfx.fillStyle(0xff006a, p);
      toggleGfx.fillRoundedRect(toggleX, toggleY, toggleW, toggleH, toggleH / 2);

      if (p > 0) {
        toggleGfx.lineStyle(1.5, 0xff88ff, p * 0.7);
        toggleGfx.strokeRoundedRect(toggleX, toggleY, toggleW, toggleH, toggleH / 2);
      } else {
        toggleGfx.lineStyle(1, 0x4a3a60, 0.8);
        toggleGfx.strokeRoundedRect(toggleX, toggleY, toggleW, toggleH, toggleH / 2);
      }

      // Smooth slide knob calculation
      const knobMinX = toggleX + toggleH / 2;
      const knobMaxX = toggleX + toggleW - toggleH / 2;
      const knobX = knobMinX + p * (knobMaxX - knobMinX);

      // Shadow
      toggleGfx.fillStyle(0x000000, 0.3);
      toggleGfx.fillCircle(knobX, toggleY + toggleH / 2 + 1.5, toggleH / 2 - 2);

      // Knob body
      toggleGfx.fillStyle(0xffffff, 1);
      toggleGfx.fillCircle(knobX, toggleY + toggleH / 2, toggleH / 2 - 2);
    };

    drawToggle(progress);

    // Invisible hit zone
    const hitArea = this.scene.add.rectangle(tileX + tileW / 2, tileY + tileH / 2, tileW, tileH)
      .setInteractive({ useHandCursor: true }).setAlpha(0.001);
    
    hitArea.on('pointerdown', () => {
      (this.scene as any).audio.playSound('button');
      isOn = !isOn;
      callbackFn(isOn);

      // Springy toggle knob tween
      const targetObj = { val: isOn ? 0 : 1 };
      this.scene.tweens.add({
        targets: targetObj,
        val: isOn ? 1 : 0,
        duration: 160,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          drawToggle(targetObj.val);
        }
      });
    });
    this.container.add(hitArea);
  }

  private addQualitySelector(
    tileX: number, tileY: number, tileW: number,
    label: string, labelStyle: Phaser.Types.GameObjects.Text.TextStyle,
    isShort: boolean
  ) {
    const tileH = labelStyle.fontSize === '14px' ? 38 : 44;

    // Row backplate
    const backplate = this.scene.add.graphics();
    backplate.fillStyle(0x0d0a18, 0.5);
    backplate.fillRoundedRect(tileX, tileY, tileW, tileH, 10);
    backplate.lineStyle(1, 0xffffff, 0.07);
    backplate.strokeRoundedRect(tileX, tileY, tileW, tileH, 10);
    this.container.add(backplate);

    // Label text
    const labelTxt = this.scene.add.text(tileX + 15, tileY + tileH / 2, label, labelStyle).setOrigin(0, 0.5);
    this.container.add(labelTxt);

    // Segmented pill controller sizing
    const trackW = isShort ? 100 : 150;
    const trackH = 26;
    const trackX = tileX + tileW - trackW - 12;
    const trackY = tileY + (tileH - trackH) / 2;

    const trackBg = this.scene.add.graphics();
    trackBg.fillStyle(0x000000, 0.5);
    trackBg.fillRoundedRect(trackX, trackY, trackW, trackH, trackH / 2);
    trackBg.lineStyle(1, 0xffffff, 0.05);
    trackBg.strokeRoundedRect(trackX, trackY, trackW, trackH, trackH / 2);
    this.container.add(trackBg);

    const capsuleGfx = this.scene.add.graphics();
    this.container.add(capsuleGfx);

    const optionsList = ['LOW', 'MEDIUM', 'HIGH'];
    let selectedIdx = optionsList.indexOf(this.currentQuality);
    if (selectedIdx === -1) selectedIdx = 2; // Default to HIGH

    const segW = trackW / 3;

    // Redraw active sliding capsule highlight
    const drawCapsule = (idx: number) => {
      capsuleGfx.clear();
      const capX = trackX + idx * segW + 2;
      const capY = trackY + 2;
      const capW = segW - 4;
      const capH = trackH - 4;
      const capR = capH / 2;

      capsuleGfx.fillGradientStyle(0xff006a, 0xff006a, 0xcc0055, 0xcc0055, 1);
      capsuleGfx.fillRoundedRect(capX, capY, capW, capH, capR);
      capsuleGfx.lineStyle(1, 0xff88ff, 0.6);
      capsuleGfx.strokeRoundedRect(capX, capY, capW, capH, capR);
    };

    drawCapsule(selectedIdx);

    const labels: Phaser.GameObjects.Text[] = [];
    optionsList.forEach((opt, i) => {
      // Use abbreviations for compact 2-column layout
      const displayOpt = isShort ? (opt === 'MEDIUM' ? 'M' : opt === 'HIGH' ? 'H' : 'L') : (opt === 'MEDIUM' ? 'MED' : opt);
      const optX = trackX + i * segW + segW / 2;
      const optY = trackY + trackH / 2;

      const txt = this.scene.add.text(optX, optY, displayOpt, { resolution: 2,
        fontFamily: '"Outfit", "Inter", sans-serif',
        fontSize: isShort ? '10px' : '11px',
        fontStyle: '900',
        color: i === selectedIdx ? '#ffffff' : '#7f7fa0'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      txt.on('pointerdown', () => {
        if (selectedIdx === i) return;
        (this.scene as any).audio.playSound('button');
        
        const oldIdx = selectedIdx;
        selectedIdx = i;
        this.currentQuality = opt;
        if (this.onQualityChange) this.onQualityChange(opt);

        // Smoothly animate the capsule highlight sliding to index
        const targetObj = { val: oldIdx };
        this.scene.tweens.add({
          targets: targetObj,
          val: i,
          duration: 160,
          ease: 'Cubic.easeOut',
          onUpdate: () => {
            drawCapsule(targetObj.val);
          },
          onComplete: () => {
            labels.forEach((lbl, index) => {
              lbl.setColor(index === selectedIdx ? '#ffffff' : '#7f7fa0');
            });
          }
        });
      });

      this.container.add(txt);
      labels.push(txt);
    });
  }

  // ─── Public Callbacks ───────────────────────────────────────

  /** Legacy: old code that calls setSoundCallback will mute BOTH channels */
  public setSoundCallback(cb: (enabled: boolean) => void) {
    this.onSoundToggle = cb;
  }

  public setMusicCallback(cb: (enabled: boolean) => void) {
    this.onMusicToggle = cb;
  }

  public setSfxCallback(cb: (enabled: boolean) => void) {
    this.onSfxToggle = cb;
  }

  public setTurboCallback(cb: (enabled: boolean) => void) {
    this.onTurboToggle = cb;
  }

  public setQualityCallback(cb: (quality: string) => void) {
    this.onQualityChange = cb;
  }

  public syncState(musicEnabled: boolean, sfxEnabled: boolean, turboMode: boolean, quality: string) {
    this.musicEnabled = musicEnabled;
    this.sfxEnabled = sfxEnabled;
    this.turboMode = turboMode;
    this.currentQuality = quality;
  }

  public isTurboMode(): boolean { return this.turboMode; }

  public show() {
    if (this.container?.scene) {
      this.container.removeAll(true);
      this.container.destroy();
    }
    this.build();
    
    this.visible = true;
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 220 });
  }

  public hide() {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 180,
      onComplete: () => { this.container.setVisible(false); this.visible = false; },
    });
  }

  public isVisible(): boolean { return this.visible; }
  
  public toggle() {
    if (this.visible) this.hide(); else this.show();
  }
}
