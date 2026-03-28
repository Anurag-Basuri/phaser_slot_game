import Phaser from 'phaser';

import {
  Grid, Audio, PaytableOverlay, SettingsOverlay,
  WinCelebration, ConfirmDialog, FreeSpinsIntro
} from '../components';
import { LocalStorageKey } from '../constants';
import { getStakeEngine, StakeEngineClient } from '../engine';
import type { SpinEventData } from '../engine/StakeEngineClient';
import options, { BET_PRESETS } from '../options';

/**
 * Main Game Scene — Production-ready for Stake Engine.
 */
export class Game extends Phaser.Scene {
  audio!: Audio;
  grid!: Grid;
  paytable!: PaytableOverlay;
  settings!: SettingsOverlay;
  winCelebration!: WinCelebration;
  confirmDialog!: ConfirmDialog;
  freeSpinsIntro!: FreeSpinsIntro;

  private stakeEngine!: StakeEngineClient;

  // UI elements
  private bgImage!: Phaser.GameObjects.Image;
  private gridFrame!: Phaser.GameObjects.Graphics;
  private gridGlow!: Phaser.GameObjects.Graphics;
  private spinBtn!: Phaser.GameObjects.Image;
  private spinBtnBaseScale = 0.5;
  private btnAuto!: Phaser.GameObjects.Rectangle;
  private txtAuto!: Phaser.GameObjects.Text;
  private btnBetMinus!: Phaser.GameObjects.Graphics;
  private btnBetPlus!: Phaser.GameObjects.Graphics;
  private btnBetMinusHit!: Phaser.GameObjects.Rectangle;
  private btnBetPlusHit!: Phaser.GameObjects.Rectangle;
  private txtMoney!: Phaser.GameObjects.Text;
  private txtMoneyLabel!: Phaser.GameObjects.Text;
  private txtBet!: Phaser.GameObjects.Text;
  private txtBetLabel!: Phaser.GameObjects.Text;
  private bottomBar!: Phaser.GameObjects.Graphics;
  private txtFSRemaining!: Phaser.GameObjects.Text;
  private buySuper!: Phaser.GameObjects.Graphics;
  private buyRegular!: Phaser.GameObjects.Graphics;
  private buySuperHit!: Phaser.GameObjects.Rectangle;
  private buyRegularHit!: Phaser.GameObjects.Rectangle;
  private buySuperTxt1!: Phaser.GameObjects.Text;
  private buySuperTxt2!: Phaser.GameObjects.Text;
  private buyRegularTxt1!: Phaser.GameObjects.Text;
  private buyRegularTxt2!: Phaser.GameObjects.Text;
  private soundToggle!: Phaser.GameObjects.Text;
  private btnPaytable!: Phaser.GameObjects.Text;
  private btnSettings!: Phaser.GameObjects.Text;
  private btnFullscreen!: Phaser.GameObjects.Text;
  private txtLastWin!: Phaser.GameObjects.Text;
  private txtLastWinLabel!: Phaser.GameObjects.Text;
  private demoLabel!: Phaser.GameObjects.Text;
  // Ante Bet
  private anteBetBtn!: Phaser.GameObjects.Graphics;
  private anteBetHit!: Phaser.GameObjects.Rectangle;
  private anteBetTxt!: Phaser.GameObjects.Text;
  private anteBetIcon!: Phaser.GameObjects.Text;

  // State
  valueMoney = Number(localStorage.getItem(LocalStorageKey.Money) ?? options.money);
  betPresetIndex = options.defaultBetIndex;
  autoSpinActive = false;
  autoSpinTimer: Phaser.Time.TimerEvent | null = null;
  fsActive = false;
  soundEnabled = true;
  lastWin = 0;

  constructor() {
    super({ key: 'Game' });
  }

  async create() {
    // Initialize Stake Engine
    this.stakeEngine = getStakeEngine();

    if (!this.stakeEngine.isDemoMode()) {
      try {
        const auth = await this.stakeEngine.authenticate();
        this.valueMoney = StakeEngineClient.toDisplayAmount(auth.balance);

        if (auth.round) {
          console.log('[Game] Resuming pending round:', auth.round.roundId);
          this.handlePendingRound();
        }
      } catch (err) {
        console.error('[Game] Auth failed, falling back to demo:', err);
      }
    }

    this.audio = new Audio(this);
    this.winCelebration = new WinCelebration(this);
    this.confirmDialog = new ConfirmDialog(this);
    this.freeSpinsIntro = new FreeSpinsIntro(this);

    this.buildUI();
    this.wireInteractions();
    this.layoutAll();
    this.updateMoneyDisplay();
    this.updateBetDisplay();

    // Set active bet
    options.betAmount = BET_PRESETS[this.betPresetIndex];

    // Ambient grid glow animation
    this.tweens.add({
      targets: this.gridGlow,
      alpha: { from: 0.2, to: 0.5 },
      yoyo: true, repeat: -1, duration: 2000,
      ease: 'Sine.easeInOut',
    });

    // Initialize grid
    this.grid.init();

    // Start background music
    if (this.soundEnabled) {
      this.audio.musicBackgroundDefault.play();
    }

    // Resize handler
    this.scale.on('resize', () => {
      this.layoutAll();
      this.grid.repositionSprites();
    });

    // Keyboard support
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.paytable.isVisible() || this.settings.isVisible() || this.confirmDialog.isVisible()) return;
      if (!options.checkClick && !this.fsActive) {
        this.attemptSpin(0);
      }
    });
  }

  private buildUI() {
    const w = this.scale.width;
    const h = this.scale.height;

    // === BACKGROUND ===
    this.bgImage = this.add.image(w / 2, h / 2, 'candyland_bg').setDisplaySize(w, h).setDepth(0);

    // === GRID GLOW ===
    this.gridGlow = this.add.graphics().setDepth(0.5).setAlpha(0.4);

    // === GRID FRAME ===
    this.gridFrame = this.add.graphics().setDepth(1);

    // === GRID ===
    this.grid = new Grid(this);
    this.wireGridCallbacks();

    // === SPIN BUTTON ===
    this.spinBtn = this.add.image(0, 0, 'gumball_rocket_btn')
      .setInteractive({ useHandCursor: true })
      .setDepth(15);

    // === AUTO PLAY ===
    this.btnAuto = this.add.rectangle(0, 0, 1, 1, 0x0d1530, 0.9)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x3344aa, 0.8)
      .setDepth(15);
    this.txtAuto = this.add.text(0, 0, 'AUTO', {
      fontSize: '18px', color: '#8899cc', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(16);

    // === ANTE BET ===
    this.anteBetBtn = this.add.graphics().setDepth(14);
    this.anteBetHit = this.add.rectangle(0, 0, 1, 1).setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(16);
    this.anteBetIcon = this.add.text(0, 0, '⚡', { fontSize: '20px' }).setOrigin(0.5).setDepth(16);
    this.anteBetTxt = this.add.text(0, 0, 'ANTE BET', {
      fontSize: '11px', color: '#888', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(16);

    // === BUY BUTTONS ===
    this.buySuper = this.add.graphics().setDepth(14);
    this.buySuperHit = this.add.rectangle(0, 0, 1, 1).setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(16);
    this.buySuperTxt1 = this.add.text(0, 0, 'SUPER\nFREE SPINS', {
      fontSize: '13px', color: '#fff', fontStyle: 'bold', align: 'center',
      stroke: '#0044cc', strokeThickness: 3, lineSpacing: 2,
    }).setOrigin(0.5).setDepth(16);
    this.buySuperTxt2 = this.add.text(0, 0, '500×', {
      fontSize: '20px', color: '#ffe600', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(16);

    this.buyRegular = this.add.graphics().setDepth(14);
    this.buyRegularHit = this.add.rectangle(0, 0, 1, 1).setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(16);
    this.buyRegularTxt1 = this.add.text(0, 0, 'BUY\nFREE SPINS', {
      fontSize: '13px', color: '#fff', fontStyle: 'bold', align: 'center',
      stroke: '#aa0055', strokeThickness: 3, lineSpacing: 2,
    }).setOrigin(0.5).setDepth(16);
    this.buyRegularTxt2 = this.add.text(0, 0, '100×', {
      fontSize: '20px', color: '#ffe600', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(16);

    // === BOTTOM BAR ===
    this.bottomBar = this.add.graphics().setDepth(14);

    // Bet -/+ buttons (graphics-based for rounded look)
    this.btnBetMinus = this.add.graphics().setDepth(15);
    this.btnBetMinusHit = this.add.rectangle(0, 0, 44, 44).setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(17);
    this.btnBetPlus = this.add.graphics().setDepth(15);
    this.btnBetPlusHit = this.add.rectangle(0, 0, 44, 44).setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(17);

    // Text labels
    this.txtMoneyLabel = this.add.text(0, 0, 'BALANCE', {
      fontSize: '10px', color: '#556688', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(16);
    this.txtMoney = this.add.text(0, 0, '', {
      fontSize: '22px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(16);

    this.txtBetLabel = this.add.text(0, 0, 'BET', {
      fontSize: '10px', color: '#556688', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5).setDepth(16);
    this.txtBet = this.add.text(0, 0, '', {
      fontSize: '22px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5).setDepth(16);

    this.txtLastWinLabel = this.add.text(0, 0, 'WIN', {
      fontSize: '10px', color: '#556688', fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(16);
    this.txtLastWin = this.add.text(0, 0, '', {
      fontSize: '22px', color: '#44ff88', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(16);

    // === FREE SPINS COUNTER ===
    this.txtFSRemaining = this.add.text(0, 0, '', {
      fontSize: '36px', color: '#fff', align: 'center', fontStyle: 'bold',
      stroke: '#ea00ff', strokeThickness: 5
    }).setOrigin(0.5).setVisible(false).setDepth(20);

    // === TOOLBAR ===
    this.soundToggle = this.add.text(0, 0, '🔊', { fontSize: '22px' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(16);
    this.btnPaytable = this.add.text(0, 0, 'ℹ', { fontSize: '22px', color: '#00d2ff' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(16);
    this.btnSettings = this.add.text(0, 0, '⚙', { fontSize: '22px', color: '#aaaacc' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(16);
    this.btnFullscreen = this.add.text(0, 0, '⛶', { fontSize: '22px', color: '#778899' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(16);

    // === DEMO MODE LABEL ===
    this.demoLabel = this.add.text(10, 10, '', {
      fontSize: '12px', color: '#ff4466', fontStyle: 'bold',
      backgroundColor: '#0a0f1c90', padding: { x: 6, y: 3 },
    }).setDepth(50).setAlpha(0.7);

    if (this.stakeEngine.isDemoMode()) {
      this.demoLabel.setText('DEMO');
    }

    // === OVERLAYS ===
    this.paytable = new PaytableOverlay(this);
    this.settings = new SettingsOverlay(this);
    this.settings.setSoundCallback((enabled) => {
      this.soundEnabled = enabled;
      this.soundToggle.setText(enabled ? '🔊' : '🔇');
      this.sound.mute = !enabled;
    });
    this.settings.setTurboCallback?.((enabled: boolean) => {
      this.grid.turboMode = enabled;
    });
  }

  /** Proportional layout engine — handles portrait and landscape */
  private layoutAll() {
    const w = this.scale.width;
    const h = this.scale.height;
    const isPortrait = h > w * 1.1;

    this.bgImage.setPosition(w / 2, h / 2).setDisplaySize(w, h);

    const barH = Math.max(55, h * 0.065);
    let gridArea: number;
    let gridX: number;
    let gridY: number;

    if (isPortrait) {
      // --- PORTRAIT LAYOUT ---
      gridArea = w * 0.92;
      const cellSize = Math.floor(gridArea / options.gridSize);
      gridX = (w - cellSize * options.gridSize) / 2;
      gridY = h * 0.04;

      this.grid.cellSize = cellSize;
      this.grid.offsetX = gridX;
      this.grid.offsetY = gridY;

      const gridBottom = gridY + cellSize * 7;

      // Buy buttons: horizontal row
      const buyW = w * 0.42;
      const buyH = Math.min(h * 0.07, 65);
      const buyY = gridBottom + buyH / 2 + 12;
      this.drawBuyButton(this.buySuper, w * 0.26, buyY, buyW, buyH, 0x00d2ff);
      this.buySuperHit.setPosition(w * 0.26, buyY).setSize(buyW, buyH).setDisplaySize(buyW, buyH);
      this.buySuperTxt1.setPosition(w * 0.26, buyY - 10).setFontSize(11);
      this.buySuperTxt2.setPosition(w * 0.26, buyY + 14).setFontSize(16);

      this.drawBuyButton(this.buyRegular, w * 0.74, buyY, buyW, buyH, 0xff006a);
      this.buyRegularHit.setPosition(w * 0.74, buyY).setSize(buyW, buyH).setDisplaySize(buyW, buyH);
      this.buyRegularTxt1.setPosition(w * 0.74, buyY - 10).setFontSize(11);
      this.buyRegularTxt2.setPosition(w * 0.74, buyY + 14).setFontSize(16);

      // Ante Bet toggle
      const anteY = buyY + buyH / 2 + 30;
      this.drawAnteBetButton(w / 2, anteY, w * 0.5, 36);
      this.anteBetHit.setPosition(w / 2, anteY).setSize(w * 0.5, 36).setDisplaySize(w * 0.5, 36);
      this.anteBetIcon.setPosition(w / 2 - 55, anteY);
      this.anteBetTxt.setPosition(w / 2 + 10, anteY);

      // Spin button
      const spinY = anteY + 55 + h * 0.06;
      const spinScale = Math.min(0.30, (h * 0.14) / 500);
      this.spinBtn.setPosition(w / 2, spinY).setScale(spinScale);
      this.spinBtnBaseScale = spinScale;

      // Auto play
      this.btnAuto.setPosition(w / 2, spinY + h * 0.09).setSize(130, 36).setDisplaySize(130, 36);
      this.txtAuto.setPosition(w / 2, spinY + h * 0.09).setFontSize(15);

      // FS counter
      this.txtFSRemaining.setPosition(w / 2, gridY - 25).setFontSize(24);

    } else {
      // --- LANDSCAPE LAYOUT ---
      gridArea = Math.min(h * 0.82, w * 0.46);
      const cellSize = Math.floor(gridArea / options.gridSize);
      gridX = w * 0.28 - (cellSize * options.gridSize) / 2;
      gridY = (h - barH - cellSize * options.gridSize) / 2;

      this.grid.cellSize = cellSize;
      this.grid.offsetX = gridX;
      this.grid.offsetY = gridY;

      const gridRight = gridX + cellSize * 7;
      const gridCenterY = gridY + cellSize * 3.5;

      // Buy buttons: left column
      const buyW = Math.min(w * 0.10, 130);
      const buyH = h * 0.13;
      const buyX = gridX - buyW / 2 - 20;
      this.drawBuyButton(this.buySuper, buyX, gridCenterY - buyH - 8, buyW, buyH, 0x00d2ff);
      this.buySuperHit.setPosition(buyX, gridCenterY - buyH - 8).setSize(buyW, buyH).setDisplaySize(buyW, buyH);
      this.buySuperTxt1.setPosition(buyX, gridCenterY - buyH - 20).setFontSize(11);
      this.buySuperTxt2.setPosition(buyX, gridCenterY - buyH + 4).setFontSize(16);

      this.drawBuyButton(this.buyRegular, buyX, gridCenterY + 8, buyW, buyH, 0xff006a);
      this.buyRegularHit.setPosition(buyX, gridCenterY + 8).setSize(buyW, buyH).setDisplaySize(buyW, buyH);
      this.buyRegularTxt1.setPosition(buyX, gridCenterY - 4).setFontSize(11);
      this.buyRegularTxt2.setPosition(buyX, gridCenterY + 20).setFontSize(16);

      // Ante Bet toggle below buy buttons
      const anteY = gridCenterY + buyH + 35;
      this.drawAnteBetButton(buyX, anteY, buyW, 32);
      this.anteBetHit.setPosition(buyX, anteY).setSize(buyW, 32).setDisplaySize(buyW, 32);
      this.anteBetIcon.setPosition(buyX - buyW * 0.3, anteY).setFontSize(16);
      this.anteBetTxt.setPosition(buyX + 10, anteY).setFontSize(10);

      // Spin button
      const spinX = gridRight + (w - gridRight) / 2;
      const spinScale = Math.min(0.5, (w - gridRight - 40) / 500);
      this.spinBtn.setPosition(spinX, gridCenterY - h * 0.05).setScale(spinScale);
      this.spinBtnBaseScale = spinScale;

      // Auto play
      this.btnAuto.setPosition(spinX, gridCenterY + h * 0.22).setSize(150, 38).setDisplaySize(150, 38);
      this.txtAuto.setPosition(spinX, gridCenterY + h * 0.22).setFontSize(16);

      // FS counter
      this.txtFSRemaining.setPosition(spinX, gridCenterY - h * 0.3).setFontSize(32);
    }

    // Draw grid frame & glow
    const gPad = 12;
    const gW = this.grid.cellSize * 7 + gPad * 2;
    const gH = gW;
    const gX = this.grid.offsetX - gPad;
    const gY = this.grid.offsetY - gPad;

    this.gridGlow.clear();
    this.gridGlow.fillStyle(0x00d2ff, 0.12);
    this.gridGlow.fillRoundedRect(gX - 6, gY - 6, gW + 12, gH + 12, 18);

    this.gridFrame.clear();
    this.gridFrame.fillStyle(0x080e22, 0.80);
    this.gridFrame.fillRoundedRect(gX, gY, gW, gH, 14);
    this.gridFrame.lineStyle(3, 0x1a3366, 0.9);
    this.gridFrame.strokeRoundedRect(gX, gY, gW, gH, 14);
    this.gridFrame.lineStyle(1, 0x00d2ff, 0.25);
    this.gridFrame.strokeRoundedRect(gX + 3, gY + 3, gW - 6, gH - 6, 12);

    // Bottom bar
    this.bottomBar.clear();
    this.bottomBar.fillStyle(0x060b18, 0.97);
    this.bottomBar.fillRect(0, h - barH, w, barH);
    this.bottomBar.lineStyle(1, 0x1a2244, 0.7);
    this.bottomBar.lineBetween(0, h - barH, w, h - barH);

    const barCY = h - barH / 2;
    const fs = Math.max(13, Math.floor(barH * 0.30));
    const fsLabel = Math.max(8, Math.floor(barH * 0.18));

    // Balance section (left)
    this.txtMoneyLabel.setPosition(w * 0.02, barCY - fs * 0.55).setFontSize(fsLabel);
    this.txtMoney.setPosition(w * 0.02, barCY + fs * 0.25).setFontSize(fs);

    // Bet section (center)
    this.drawBetButton(this.btnBetMinus, w * 0.33, barCY, 36, false);
    this.btnBetMinusHit.setPosition(w * 0.33, barCY).setSize(44, 44).setDisplaySize(44, 44);
    this.drawBetButton(this.btnBetPlus, w * 0.57, barCY, 36, true);
    this.btnBetPlusHit.setPosition(w * 0.57, barCY).setSize(44, 44).setDisplaySize(44, 44);

    this.txtBetLabel.setPosition(w * 0.45, barCY - fs * 0.55).setFontSize(fsLabel);
    this.txtBet.setPosition(w * 0.45, barCY + fs * 0.25).setFontSize(fs);

    // Win section (right)
    this.txtLastWinLabel.setPosition(w * 0.98, barCY - fs * 0.55).setFontSize(fsLabel);
    this.txtLastWin.setPosition(w * 0.98, barCY + fs * 0.25).setFontSize(fs);

    // Toolbar (top-right)
    const tbY = 22;
    this.soundToggle.setPosition(w - 28, tbY);
    this.btnPaytable.setPosition(w - 62, tbY);
    this.btnSettings.setPosition(w - 96, tbY);
    this.btnFullscreen.setPosition(w - 130, tbY);
  }

  private drawBuyButton(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, bw: number, bh: number, color: number) {
    gfx.clear();
    const x = cx - bw / 2;
    const y = cy - bh / 2;
    gfx.fillStyle(color, 0.15);
    gfx.fillRoundedRect(x, y, bw, bh, 12);
    gfx.lineStyle(2, color, 0.8);
    gfx.strokeRoundedRect(x, y, bw, bh, 12);
  }

  private drawAnteBetButton(cx: number, cy: number, bw: number, bh: number) {
    this.anteBetBtn.clear();
    const x = cx - bw / 2;
    const y = cy - bh / 2;
    if (options.anteBetEnabled) {
      this.anteBetBtn.fillStyle(0xffaa00, 0.25);
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh, 8);
      this.anteBetBtn.lineStyle(2, 0xffaa00, 0.9);
      this.anteBetBtn.strokeRoundedRect(x, y, bw, bh, 8);
      this.anteBetTxt.setColor('#ffaa00');
    } else {
      this.anteBetBtn.fillStyle(0x222244, 0.5);
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh, 8);
      this.anteBetBtn.lineStyle(1, 0x444466, 0.5);
      this.anteBetBtn.strokeRoundedRect(x, y, bw, bh, 8);
      this.anteBetTxt.setColor('#666688');
    }
  }

  private drawBetButton(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number, isPlus: boolean) {
    gfx.clear();
    gfx.fillStyle(0x111833, 1);
    gfx.fillCircle(cx, cy, size / 2);
    gfx.lineStyle(2, 0x2244aa, 0.7);
    gfx.strokeCircle(cx, cy, size / 2);
    // Draw +/- sign
    gfx.lineStyle(2, 0xaabbee, 0.9);
    gfx.lineBetween(cx - 7, cy, cx + 7, cy);
    if (isPlus) {
      gfx.lineBetween(cx, cy - 7, cx, cy + 7);
    }
  }

  private wireInteractions() {
    // Spin button
    this.spinBtn.on('pointerdown', () => {
      if (this.anyOverlayOpen()) return;
      if (this.fsActive) return;

      // Click press effect
      this.tweens.add({
        targets: this.spinBtn,
        scaleX: this.spinBtnBaseScale * 0.9,
        scaleY: this.spinBtnBaseScale * 0.9,
        duration: 80,
        yoyo: true,
      });

      if (this.autoSpinActive) {
        this.stopAutoSpin();
      } else {
        this.attemptSpin(0);
      }
    });

    this.spinBtn.on('pointerover', () => {
      this.tweens.add({
        targets: this.spinBtn,
        scaleX: this.spinBtnBaseScale * 1.06,
        scaleY: this.spinBtnBaseScale * 1.06,
        duration: 150,
      });
    });
    this.spinBtn.on('pointerout', () => {
      this.tweens.add({
        targets: this.spinBtn,
        scaleX: this.spinBtnBaseScale,
        scaleY: this.spinBtnBaseScale,
        duration: 150,
      });
    });

    // Auto play
    this.btnAuto.on('pointerdown', () => {
      if (this.fsActive) return;
      this.autoSpinActive = !this.autoSpinActive;
      this.txtAuto.setText(this.autoSpinActive ? 'STOP' : 'AUTO');
      this.txtAuto.setColor(this.autoSpinActive ? '#ff4466' : '#8899cc');
      this.btnAuto.setStrokeStyle(2, this.autoSpinActive ? 0xff4466 : 0x3344aa, 0.8);
      if (this.autoSpinActive && !options.checkClick) {
        this.attemptSpin(0);
      }
    });

    // Bet controls
    this.btnBetMinusHit.on('pointerdown', () => this.changeBet(-1));
    this.btnBetPlusHit.on('pointerdown', () => this.changeBet(1));

    // Buy features (with confirmation)
    this.buySuperHit.on('pointerdown', () => this.requestPurchase(2, 500));
    this.buyRegularHit.on('pointerdown', () => this.requestPurchase(1, 100));

    // Ante Bet toggle
    this.anteBetHit.on('pointerdown', () => {
      if (options.checkClick || this.fsActive) return;
      options.anteBetEnabled = !options.anteBetEnabled;
      this.drawAnteBetButton(
        this.anteBetHit.x, this.anteBetHit.y,
        this.anteBetHit.width, this.anteBetHit.height
      );
      this.updateBetDisplay();
      if (this.soundEnabled) this.audio.audioButton.play();
    });

    // Sound toggle
    this.soundToggle.on('pointerdown', () => {
      this.soundEnabled = !this.soundEnabled;
      this.soundToggle.setText(this.soundEnabled ? '🔊' : '🔇');
      this.sound.mute = !this.soundEnabled;
    });

    // Paytable
    this.btnPaytable.on('pointerdown', () => {
      if (!this.settings.isVisible()) this.paytable.toggle();
    });

    // Settings
    this.btnSettings.on('pointerdown', () => {
      if (!this.paytable.isVisible()) this.settings.toggle();
    });

    // Fullscreen
    this.btnFullscreen.on('pointerdown', () => {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      } else {
        this.scale.startFullscreen();
      }
    });
  }

  private wireGridCallbacks() {
    this.grid.onWinCallback = (winAmount) => {
      const actualWin = winAmount;
      if (!this.fsActive) {
        this.valueMoney += actualWin;
        this.updateMoneyDisplay();
      }
      this.lastWin += actualWin;
      this.updateLastWinDisplay();

      if (this.soundEnabled) this.audio.audioWin.play();

      // Floating win text
      const cx = this.grid.offsetX + this.grid.cellSize * 3.5;
      const cy = this.grid.offsetY + this.grid.cellSize * 3.5;
      const winText = this.add.text(cx, cy, `+${actualWin.toFixed(2)}`, {
        fontSize: `${Math.max(28, this.grid.cellSize * 0.7)}px`,
        color: '#ffe600', fontStyle: 'bold', stroke: '#000', strokeThickness: 6
      }).setOrigin(0.5).setDepth(25);

      this.tweens.add({
        targets: winText, y: cy - this.grid.cellSize * 1.2, alpha: 0,
        duration: 1200, ease: 'Power1',
        onComplete: () => winText.destroy()
      });
    };

    this.grid.onFreeSpinsStart = (count) => {
      this.fsActive = true;
      this.txtFSRemaining.setText(`${count} FREE SPINS`).setVisible(true);

      // Switch to FS music
      if (this.soundEnabled) {
        this.audio.musicBackgroundDefault.stop();
        this.audio.musicDefault.play();
      }

      this.tweens.add({
        targets: this.txtFSRemaining,
        scale: { from: 1.3, to: 1 },
        duration: 400, ease: 'Back.easeOut',
      });
    };

    this.grid.onFreeSpinsEnd = (totalWin) => {
      this.fsActive = false;
      this.txtFSRemaining.setVisible(false);
      this.valueMoney += totalWin;
      this.updateMoneyDisplay();
      this.lastWin = totalWin;
      this.updateLastWinDisplay();

      // Switch back to normal music
      if (this.soundEnabled) {
        this.audio.musicDefault.stop();
        this.audio.musicBackgroundDefault.play();
      }

      const betAmount = this.getEffectiveBet();
      const celebDuration = this.winCelebration.show(totalWin, betAmount);

      const delay = Math.max(celebDuration, 600);
      this.time.delayedCall(delay, () => {
        const endText = this.add.text(
          this.scale.width / 2, this.scale.height / 2,
          `FREE SPINS TOTAL\n${totalWin.toFixed(2)}`,
          { fontSize: '64px', color: '#ffe600', align: 'center', fontStyle: 'bold', stroke: '#000', strokeThickness: 10 }
        ).setOrigin(0.5).setDepth(35).setScale(0);

        this.tweens.add({
          targets: endText, scale: 1, duration: 500, yoyo: true, hold: 2000, ease: 'Back.easeOut',
          onComplete: () => {
            endText.destroy();
            options.checkClick = false;
            this.stakeEngine.endRound();
            this.saveSpinRecord(totalWin, 'free_spins');
            if (this.autoSpinActive) this.attemptSpin(0);
          }
        });
      });
    };

    this.grid.onMaxWinCallback = (totalWin) => {
      // MAX WIN reached — show special celebration
      const maxText = this.add.text(
        this.scale.width / 2, this.scale.height * 0.35, 'MAX WIN!',
        { fontSize: '96px', color: '#ffe600', fontStyle: 'bold', stroke: '#ff0066', strokeThickness: 12 }
      ).setOrigin(0.5).setDepth(40).setScale(0);

      this.tweens.add({
        targets: maxText, scale: 1, duration: 600, ease: 'Back.easeOut',
        yoyo: true, hold: 3000,
        onComplete: () => maxText.destroy(),
      });
    };

    this.grid.onCompleteCallback = () => {
      if (this.fsActive) return;

      if (this.lastWin > 0) {
        const betAmount = this.getEffectiveBet();
        const celebDuration = this.winCelebration.show(this.lastWin, betAmount);

        this.time.delayedCall(Math.max(celebDuration, 100), () => {
          options.checkClick = false;
          this.stakeEngine.endRound();
          this.saveSpinRecord(this.lastWin, 'base');
          if (this.autoSpinActive) {
            this.autoSpinTimer = this.time.delayedCall(600, () => {
              if (this.autoSpinActive && !this.fsActive) this.attemptSpin(0);
            });
          }
        });
      } else {
        options.checkClick = false;
        this.stakeEngine.endRound();
        this.saveSpinRecord(0, 'base');
        if (this.autoSpinActive) {
          this.autoSpinTimer = this.time.delayedCall(600, () => {
            if (this.autoSpinActive && !this.fsActive) this.attemptSpin(0);
          });
        }
      }
    };
  }

  private anyOverlayOpen(): boolean {
    return this.paytable.isVisible() || this.settings.isVisible() || this.confirmDialog.isVisible();
  }

  private getEffectiveBet(): number {
    const baseBet = BET_PRESETS[this.betPresetIndex];
    return options.anteBetEnabled ? baseBet * options.anteBetCostMultiplier : baseBet;
  }

  updateMoneyDisplay() {
    this.txtMoney.setText(`${this.valueMoney.toFixed(2)}`);
    localStorage.setItem(LocalStorageKey.Money, String(this.valueMoney));
  }

  updateBetDisplay() {
    const effectiveBet = this.getEffectiveBet();
    const label = options.anteBetEnabled
      ? `${effectiveBet.toFixed(2)} ⚡`
      : `${effectiveBet.toFixed(2)}`;
    this.txtBet.setText(label);
  }

  updateLastWinDisplay() {
    if (this.lastWin > 0) {
      this.txtLastWin.setText(`${this.lastWin.toFixed(2)}`);
    } else {
      this.txtLastWin.setText('0.00');
    }
  }

  private requestPurchase(triggerType: number, betMultCost: number) {
    if (options.checkClick || this.fsActive || this.anyOverlayOpen()) return;

    const cost = this.getEffectiveBet() * betMultCost;
    const label = triggerType === 2 ? 'Super Free Spins' : 'Free Spins';

    if (this.valueMoney < cost) {
      this.showInsufficientBalance();
      return;
    }

    this.confirmDialog.show(
      `Buy ${label}?`,
      `Cost: ${cost.toFixed(2)}`,
      () => this.executePurchase(triggerType, cost),
      () => { /* cancelled */ }
    );
  }

  private async executePurchase(triggerType: number, cost: number) {
    options.checkClick = true;
    this.valueMoney -= cost;
    this.lastWin = 0;
    options.betAmount = this.getEffectiveBet();
    this.updateMoneyDisplay();
    this.updateLastWinDisplay();

    if (this.soundEnabled) this.audio.audioButton.play();

    try {
      const result = await this.stakeEngine.play(cost, triggerType);
      const spinEvent = result.events?.find(e => e.type === 'spin');
      const serverGrid = spinEvent ? (spinEvent.data as SpinEventData).grid : undefined;

      // Show free spins intro then start
      this.freeSpinsIntro.play(10, () => {
        this.grid.startSpin(triggerType, serverGrid);
      });
    } catch (err) {
      console.error('[Game] Buy feature error:', err);
      this.grid.startSpin(triggerType);
    }
  }

  async attemptSpin(triggerType: number) {
    if (options.checkClick || this.fsActive || this.anyOverlayOpen()) return;

    const cost = this.getEffectiveBet();
    if (this.valueMoney >= cost) {
      options.checkClick = true;
      this.valueMoney -= cost;
      this.lastWin = 0;
      options.betAmount = cost; // Set active bet for paytable calculations
      this.updateMoneyDisplay();
      this.updateLastWinDisplay();

      if (this.soundEnabled) {
        this.audio.audioReels.play();
      }

      // Store pending round for disconnect recovery
      localStorage.setItem('pending_bet', String(cost));

      try {
        const result = await this.stakeEngine.play(cost, triggerType);
        localStorage.setItem('pending_round', JSON.stringify(result));

        const spinEvent = result.events?.find(e => e.type === 'spin');
        const serverGrid = spinEvent ? (spinEvent.data as SpinEventData).grid : undefined;
        this.grid.startSpin(triggerType, serverGrid);
      } catch (err) {
        console.error('[Game] Play error:', err);
        this.grid.startSpin(triggerType); // Fallback to demo
      }
    } else {
      this.stopAutoSpin();
      this.showInsufficientBalance();
    }
  }

  private showInsufficientBalance() {
    const noFunds = this.add.text(this.scale.width / 2, this.scale.height / 2, 'INSUFFICIENT BALANCE', {
      fontSize: '28px', color: '#ff4466', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({
      targets: noFunds, alpha: 0, y: noFunds.y - 60, duration: 1500,
      onComplete: () => noFunds.destroy()
    });
  }

  changeBet(direction: number) {
    if (options.checkClick || this.fsActive) return;
    const newIndex = this.betPresetIndex + direction;
    if (newIndex >= 0 && newIndex < BET_PRESETS.length) {
      this.betPresetIndex = newIndex;
      options.betAmount = BET_PRESETS[this.betPresetIndex];
      this.updateBetDisplay();
      if (this.soundEnabled) this.audio.audioButton.play();
    }
  }

  stopAutoSpin() {
    this.autoSpinActive = false;
    this.txtAuto.setText('AUTO');
    this.txtAuto.setColor('#8899cc');
    this.btnAuto.setStrokeStyle(2, 0x3344aa, 0.8);
    if (this.autoSpinTimer) this.autoSpinTimer.remove();
  }

  private handlePendingRound() {
    const pendingData = localStorage.getItem('pending_round');
    if (pendingData) {
      try {
        const result = JSON.parse(pendingData);
        const payout = result.payout ? StakeEngineClient.toDisplayAmount(result.payout) : 0;
        if (payout > 0) {
          this.valueMoney += payout;
          this.updateMoneyDisplay();

          const popup = this.add.text(
            this.scale.width / 2, this.scale.height / 2,
            `Previous round:\nWIN ${payout.toFixed(2)}`,
            { fontSize: '32px', color: '#44ff88', fontStyle: 'bold', stroke: '#000', strokeThickness: 6, align: 'center' }
          ).setOrigin(0.5).setDepth(60);

          this.time.delayedCall(3000, () => popup.destroy());
        }
      } catch { /* ignore parse error */ }
      localStorage.removeItem('pending_round');
      localStorage.removeItem('pending_bet');
      this.stakeEngine.endRound();
    }
  }

  private saveSpinRecord(winAmount: number, feature: string) {
    localStorage.removeItem('pending_round');
    localStorage.removeItem('pending_bet');

    try {
      const historyRaw = localStorage.getItem('game_history') || '[]';
      const history = JSON.parse(historyRaw) as Array<{
        ts: number; bet: number; win: number; feature: string;
      }>;
      history.unshift({
        ts: Date.now(),
        bet: this.getEffectiveBet(),
        win: winAmount,
        feature,
      });
      // Keep last 50 spins
      if (history.length > 50) history.length = 50;
      localStorage.setItem('game_history', JSON.stringify(history));
    } catch { /* ignore */ }
  }
}
