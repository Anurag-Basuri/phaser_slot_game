import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';

/**
 * Settings / Menu overlay with separate Music & SFX toggles, turbo mode, and quality options.
 * Overhauled to look premium, standardized, and perfectly responsive at all viewport sizes.
 */
export class SettingsOverlay {
  private scene: GameScene;
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

  constructor(scene: GameScene) {
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
    const panelW = isShort ? Math.min(600, w * 0.95) : Math.min(460, w * 0.9);
    const panelH = isShort ? Math.min(320, h * 0.95) : Math.min(520, h * 0.9);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    const panel = this.scene.add.graphics();
    
    // Main panel (Dark Navy)
    panel.fillStyle(0x0d1b2a, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 16);

    // Thin Orange Border
    panel.lineStyle(2, 0xff8c00, 0.8);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);

    panel.setInteractive(new Phaser.Geom.Rectangle(panelX, panelY, panelW, panelH), Phaser.Geom.Rectangle.Contains);
    this.container.add(panel);

    // Title text inside panel
    const titleText = this.scene.add.text(panelX + 30, panelY + 20, 'SETTINGS', { 
      fontSize: '28px', color: '#ffffff', fontFamily: '"Inter", "Roboto", "Arial", sans-serif', fontStyle: 'bold'
    }).setOrigin(0, 0);
    this.container.add(titleText);

    // Divider under title
    const titleGfx = this.scene.add.graphics();
    titleGfx.lineStyle(1, 0xff8c00, 0.6);
    titleGfx.lineBetween(panelX + 30, panelY + 55, panelX + panelW - 30, panelY + 55);
    this.container.add(titleGfx);

    // Sleek Close button
    const closeBtnX = panelX + panelW - 30;
    const closeBtnY = panelY + 35;
    const closeBtn = this.scene.add.text(closeBtnX, closeBtnY, '✕', { 
      fontSize: '24px', color: '#ffffff', fontFamily: '"Inter", "Roboto", "Arial", sans-serif'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      this.hide();
    });
    closeBtn.on('pointerover', () => closeBtn.setScale(1.1));
    closeBtn.on('pointerout', () => closeBtn.setScale(1));
    this.container.add(closeBtn);

    const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: isShort ? '16px' : '18px',
      color: '#ffffff',
      fontFamily: '"Inter", "Roboto", "Arial", sans-serif'
    };

    if (isShort) {
      // ─── LANDSCAPE / SHORT SCREEN: 2-Column Grid Layout ───
      const colW = (panelW - 60) / 2;
      const col1X = panelX + 20;
      const col2X = panelX + 40 + colW;
      
      let rowY = panelY + 65;
      const availableH = panelH - (rowY - panelY) - 90;
      const rowH = Math.min(55, availableH / 2.5);
      const rowGap = rowH * 0.2;

      this.addToggleRow(col1X, rowY, colW, rowH, '🎵 MUSIC', labelStyle, this.musicEnabled, (isOn) => {
        this.musicEnabled = isOn;
        if (this.onMusicToggle) this.onMusicToggle(isOn);
      });

      this.addToggleRow(col2X, rowY, colW, rowH, '🔊 SOUNDS', labelStyle, this.sfxEnabled, (isOn) => {
        this.sfxEnabled = isOn;
        if (this.onSfxToggle) this.onSfxToggle(isOn);
      });

      rowY += rowH + rowGap;

      this.addToggleRow(col1X, rowY, colW, rowH, '⚡ TURBO', labelStyle, this.turboMode, (isOn) => {
        this.turboMode = isOn;
        if (this.onTurboToggle) this.onTurboToggle(isOn);
      });

      this.addQualitySelector(col2X, rowY, colW, rowH, '✨ QUALITY', labelStyle, true);

      // Bottom Info
      const infoY = panelY + panelH - 45;
      const infoBox = this.scene.add.graphics();
      infoBox.fillStyle(0xffe6f0, 1);
      infoBox.fillRoundedRect(panelX + 20, infoY, panelW - 40, 30, 15);
      infoBox.lineStyle(2, 0xff0070, 0.4);
      infoBox.strokeRoundedRect(panelX + 20, infoY, panelW - 40, 30, 15);
      this.container.add(infoBox);

      const infoText = this.scene.add.text(w / 2, infoY + 15, 'Sugar Blast 1000  •  RTP: 96.53%  •  High Volatility', { 
        fontSize: '12px',
        color: '#ff0070',
        fontFamily: '"Luckiest Guy", cursive, sans-serif'
      }).setOrigin(0.5);
      this.container.add(infoText);

    } else {
      // ─── PORTRAIT / TALL SCREEN: 1-Column List Layout ───
      let rowY = panelY + 65;
      const rowW = panelW - 60;
      const rowX = panelX + 30;
      
      const availableH = panelH - (rowY - panelY) - 95; // 95 for info box + padding
      const rowH = Math.min(65, availableH / 4.5);
      const rowGap = rowH * 0.2;

      this.addToggleRow(rowX, rowY, rowW, rowH, '🎵 GAME MUSIC', labelStyle, this.musicEnabled, (isOn) => {
        this.musicEnabled = isOn;
        if (this.onMusicToggle) this.onMusicToggle(isOn);
      });
      rowY += rowH + rowGap;

      this.addToggleRow(rowX, rowY, rowW, rowH, '🔊 GAME SOUNDS', labelStyle, this.sfxEnabled, (isOn) => {
        this.sfxEnabled = isOn;
        if (this.onSfxToggle) this.onSfxToggle(isOn);
      });
      rowY += rowH + rowGap;

      this.addToggleRow(rowX, rowY, rowW, rowH, '⚡ TURBO SPINS', labelStyle, this.turboMode, (isOn) => {
        this.turboMode = isOn;
        if (this.onTurboToggle) this.onTurboToggle(isOn);
      });
      rowY += rowH + rowGap;

      this.addQualitySelector(rowX, rowY, rowW, rowH, '✨ GRAPHICS QUALITY', labelStyle, false);
      rowY += rowH + rowGap + 10;

      // Bottom Info Box
      const infoBox = this.scene.add.graphics();
      infoBox.fillStyle(0x000000, 0.4);
      infoBox.fillRoundedRect(panelX + 30, rowY, panelW - 60, 80, 20);
      infoBox.lineStyle(3, 0xff0070, 0.8);
      infoBox.strokeRoundedRect(panelX + 30, rowY, panelW - 60, 80, 20);
      this.container.add(infoBox);

      this.container.add(this.scene.add.text(w / 2, rowY + 25, 'SUGAR BLAST 1000', { 
        fontSize: '22px',
        color: '#ff0070',
        fontFamily: '"Luckiest Guy", cursive, sans-serif'
      }).setOrigin(0.5));

      this.container.add(this.scene.add.text(w / 2, rowY + 55, 'RTP: 96.53%   •   Max Win: 25,000×', { 
        fontSize: '14px',
        color: '#ff66a3',
        fontFamily: '"Luckiest Guy", cursive, sans-serif'
      }).setOrigin(0.5));
    }
  }

  private addToggleRow(
    tileX: number, tileY: number, tileW: number, tileH: number,
    label: string, labelStyle: Phaser.Types.GameObjects.Text.TextStyle,
    initialState: boolean,
    callbackFn: (state: boolean) => void
  ) {

    // Row backplate
    const backplate = this.scene.add.graphics();
    backplate.fillStyle(0x1a2436, 0.8);
    backplate.fillRoundedRect(tileX, tileY, tileW, tileH, 8);
    backplate.lineStyle(1, 0xff8c00, 0.4);
    backplate.strokeRoundedRect(tileX, tileY, tileW, tileH, 8);
    this.container.add(backplate);

    // Label text
    const labelTxt = this.scene.add.text(tileX + 20, tileY + tileH / 2 + 2, label, labelStyle).setOrigin(0, 0.5);
    this.container.add(labelTxt);

    // Toggle switch parameters (chunky jelly bean switch)
    const toggleW = 70;
    const toggleH = 36;
    const toggleX = tileX + tileW - toggleW - 15;
    const toggleY = tileY + (tileH - toggleH) / 2;

    const toggleGfx = this.scene.add.graphics();
    this.container.add(toggleGfx);

    let isOn = initialState;
    let progress = isOn ? 1 : 0;

    // Draw sliding switch graphics
    const drawToggle = (p: number) => {
      toggleGfx.clear();
      
      // Shadow
      toggleGfx.fillStyle(0x3a0055, 0.3);
      toggleGfx.fillRoundedRect(toggleX + 3, toggleY + 3, toggleW, toggleH, toggleH / 2);

      // Interpolate backgrounds (Red to Green)
      toggleGfx.fillStyle(0xff3366, (1 - p));
      toggleGfx.fillRoundedRect(toggleX, toggleY, toggleW, toggleH, toggleH / 2);
      
      toggleGfx.fillStyle(0x00e676, p);
      toggleGfx.fillRoundedRect(toggleX, toggleY, toggleW, toggleH, toggleH / 2);

      // Thick border
      toggleGfx.lineStyle(3, 0xffffff, 1);
      toggleGfx.strokeRoundedRect(toggleX, toggleY, toggleW, toggleH, toggleH / 2);

      // Smooth slide knob calculation
      const knobMinX = toggleX + toggleH / 2;
      const knobMaxX = toggleX + toggleW - toggleH / 2;
      const knobX = knobMinX + p * (knobMaxX - knobMinX);

      // Knob Shadow
      toggleGfx.fillStyle(0x000000, 0.3);
      toggleGfx.fillCircle(knobX, toggleY + toggleH / 2 + 3, toggleH / 2);

      // Massive white knob body
      toggleGfx.fillStyle(0xffffff, 1);
      toggleGfx.fillCircle(knobX, toggleY + toggleH / 2, toggleH / 2 + 2);
    };

    drawToggle(progress);

    // Invisible hit zone
    const hitArea = this.scene.add.rectangle(tileX + tileW / 2, tileY + tileH / 2, tileW, tileH)
      .setInteractive({ useHandCursor: true }).setAlpha(0.001);
    
    hitArea.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      isOn = !isOn;
      callbackFn(isOn);

      // Bouncy toggle knob tween
      const targetObj = { val: isOn ? 0 : 1 };
      this.scene.tweens.add({
        targets: targetObj,
        val: isOn ? 1 : 0,
        duration: 250,
        ease: 'Back.easeOut',
        onUpdate: () => {
          drawToggle(targetObj.val);
        }
      });
    });
    this.container.add(hitArea);
  }

  private addQualitySelector(
    tileX: number, tileY: number, tileW: number, tileH: number,
    label: string, labelStyle: Phaser.Types.GameObjects.Text.TextStyle,
    isShort: boolean
  ) {

    // Row backplate
    const backplate = this.scene.add.graphics();
    backplate.fillStyle(0x1a2436, 0.8);
    backplate.fillRoundedRect(tileX, tileY, tileW, tileH, 8);
    backplate.lineStyle(1, 0xff8c00, 0.4);
    backplate.strokeRoundedRect(tileX, tileY, tileW, tileH, 8);
    this.container.add(backplate);

    // Label text
    const labelTxt = this.scene.add.text(tileX + 20, tileY + tileH / 2 + 2, label, labelStyle).setOrigin(0, 0.5);
    this.container.add(labelTxt);

    // Segmented pill controller sizing
    const trackW = isShort ? 140 : 180;
    const trackH = 40;
    const trackX = tileX + tileW - trackW - 15;
    const trackY = tileY + (tileH - trackH) / 2;

    const trackBg = this.scene.add.graphics();
    trackBg.fillStyle(0xffb3cc, 1);
    trackBg.fillRoundedRect(trackX, trackY, trackW, trackH, trackH / 2);
    trackBg.lineStyle(3, 0xff0070, 1);
    trackBg.strokeRoundedRect(trackX, trackY, trackW, trackH, trackH / 2);
    this.container.add(trackBg);

    const capsuleGfx = this.scene.add.graphics();
    this.container.add(capsuleGfx);

    const optionsList = ['LOW', 'MED', 'HIGH'];
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

      // Drop shadow
      capsuleGfx.fillStyle(0x3a0055, 0.3);
      capsuleGfx.fillRoundedRect(capX + 2, capY + 2, capW, capH, capR);

      // Vibrant fill
      capsuleGfx.fillGradientStyle(0x00e5ff, 0x00e5ff, 0x00aacc, 0x00aacc, 1);
      capsuleGfx.fillRoundedRect(capX, capY, capW, capH, capR);
      
      // White border
      capsuleGfx.lineStyle(3, 0xffffff, 1);
      capsuleGfx.strokeRoundedRect(capX, capY, capW, capH, capR);
    };

    drawCapsule(selectedIdx);

    const labels: Phaser.GameObjects.Text[] = [];
    optionsList.forEach((opt, i) => {
      const displayOpt = opt;
      const optX = trackX + i * segW + segW / 2;
      const optY = trackY + trackH / 2 + 2;

      const txt = this.scene.add.text(optX, optY, displayOpt, { 
        fontFamily: '"Luckiest Guy", cursive, sans-serif',
        fontSize: isShort ? '14px' : '16px',
        color: i === selectedIdx ? '#ffffff' : '#ff0070'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      if (i === selectedIdx) {
        txt.setShadow(0, 2, '#000000', 0, false, true);
      }

      txt.on('pointerdown', () => {
        if (selectedIdx === i) return;
        (this.scene as GameScene).audio.playSound('button');
        
        const oldIdx = selectedIdx;
        selectedIdx = i;
        this.currentQuality = opt;
        if (this.onQualityChange) this.onQualityChange(opt);

        // Smoothly animate the capsule highlight sliding to index
        const targetObj = { val: oldIdx };
        this.scene.tweens.add({
          targets: targetObj,
          val: i,
          duration: 200,
          ease: 'Back.easeOut',
          onUpdate: () => {
            drawCapsule(targetObj.val);
          },
          onComplete: () => {
            labels.forEach((lbl, index) => {
              lbl.setColor(index === selectedIdx ? '#ffffff' : '#ff0070');
              if (index === selectedIdx) lbl.setShadow(0, 2, '#000000', 0, false, true);
              else lbl.setShadow(0,0,'',0,false,false);
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
    this.container.setY(40);
    this.scene.tweens.add({ 
      targets: this.container, 
      alpha: 1, 
      y: 0,
      duration: 300,
      ease: 'Back.easeOut'
    });
  }

  public hide() {
    this.scene.tweens.add({
      targets: this.container, 
      alpha: 0, 
      y: 30,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => { this.container.setVisible(false); this.visible = false; },
    });
  }

  public isVisible(): boolean { return this.visible; }
  
  public toggle() {
    if (this.visible) this.hide(); else this.show();
  }
}
