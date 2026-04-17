import Phaser from 'phaser';

import {
  Grid, Audio, PaytableOverlay, SettingsOverlay,
  WinCelebration, ConfirmDialog, FreeSpinsIntro, ErrorManager
} from '../components';
import { LocalStorageKey } from '../constants';
import { getStakeEngine, StakeEngineClient } from '../engine';
import type { SpinEventData } from '../engine/StakeEngineClient';
import { StakeError } from '../engine/StakeEngineClient';
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
  errorManager!: ErrorManager;

  private stakeEngine!: StakeEngineClient;

  // UI elements
  private bgImage!: Phaser.GameObjects.Image;
  private gridFrame!: Phaser.GameObjects.Graphics;
  private gridGlow!: Phaser.GameObjects.Graphics;
  private spinBtnGfx!: Phaser.GameObjects.Graphics;
  private spinGlowRing!: Phaser.GameObjects.Graphics;
  private spinBtnHit!: Phaser.GameObjects.Rectangle;
  private spinBtnLabel!: Phaser.GameObjects.Text;
  private spinBtnRadius = 50;
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
  autoSpinRemaining = 0; // 0 = infinite when autoSpinActive
  autoSpinTimer: Phaser.Time.TimerEvent | null = null;
  fsActive = false;
  soundEnabled = true;
  lastWin = 0;
  private _winCountTween?: Phaser.Tweens.Tween;
  private _displayedWin = 0;

  // Spin lock — prevents double-trigger across pointer + keyboard
  private _spinLock = false;
  private _recovering = false; // True while resync is in progress
  private _resizeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super({ key: 'Game' });
  }

  async create() {
    // Initialize Stake Engine
    this.stakeEngine = getStakeEngine();

    // ErrorManager must be created before auth so showBlockingError is available
    this.errorManager = new ErrorManager(this);

    if (!this.stakeEngine.isDemoMode()) {
      try {
        const auth = await this.stakeEngine.authenticate();
        this.valueMoney = StakeEngineClient.toDisplayAmount(auth.balance);

        if (auth.round) {
          console.log('[Game] Resuming pending round:', auth.round.roundId);
          this.handlePendingRound();
        }
      } catch (err) {
        console.error('[Game] Auth failed:', err);
        const isAuthError = err instanceof StakeError && err.code === 'AUTH';
        if (isAuthError) {
          // Unrecoverable — session is invalid, must relaunch
          this.errorManager.showBlockingError(
            'SESSION EXPIRED',
            async () => { throw new Error('Session expired — cannot retry'); },
            () => window.location.reload(),
          );
        } else {
          // Network error — allow retry
          this.errorManager.showBlockingError(
            'CONNECTION FAILED',
            () => this.resyncAfterError(),
          );
        }
        return; // Halt boot sequence
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
      alpha: { from: 0.15, to: 0.45 },
      yoyo: true, repeat: -1, duration: 2500,
      ease: 'Sine.easeInOut',
    });

    // Spin button ambient glow pulse
    this.tweens.add({
      targets: this.spinGlowRing,
      alpha: { from: 0.25, to: 0.7 },
      yoyo: true, repeat: -1, duration: 1200,
      ease: 'Sine.easeInOut',
    });

    // Initialize grid
    this.grid.init();

    // Start background music
    this.audio.playMusic('backgroundDefault');
    // Enforce initial mute state
    this.sound.mute = !this.soundEnabled;

    // Resize handler — debounced to prevent frame spikes during drag
    this.scale.on('resize', () => {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this.layoutAll();
        this.grid.repositionSprites();
      }, 80);
    });

    // Keyboard support
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.handleUniversalAction();
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

    // === SPIN GLOW RING ===
    this.spinGlowRing = this.add.graphics().setDepth(14).setAlpha(0.5);

    // === GRID ===
    this.grid = new Grid(this);
    this.wireGridCallbacks();

    // === SPIN BUTTON (drawn, not the giant gumball image) ===
    this.spinBtnGfx = this.add.graphics().setDepth(15);
    this.spinBtnHit = this.add.rectangle(0, 0, 120, 120)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.001).setDepth(17);
    this.spinBtnLabel = this.add.text(0, 0, 'SPIN', {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold', stroke: '#005522', strokeThickness: 5
    }).setOrigin(0.5).setDepth(17);

    // === AUTO PLAY ===
    this.btnAuto = this.add.rectangle(0, 0, 1, 1, 0x0d1530, 1) // fully opaque
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(3, 0xffffff, 1) // thick white border
      .setDepth(15);
    this.txtAuto = this.add.text(0, 0, 'AUTO', {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(16);

    // === ANTE BET ===
    this.anteBetBtn = this.add.graphics().setDepth(14);
    this.anteBetHit = this.add.rectangle(0, 0, 1, 1).setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(16);
    this.anteBetIcon = this.add.text(0, 0, '⚡', { fontSize: '20px', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(16);
    this.anteBetTxt = this.add.text(0, 0, 'ANTE BET', {
      fontSize: '12px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(16);

    // === BUY BUTTONS ===
    this.buySuper = this.add.graphics().setDepth(14);
    this.buySuperHit = this.add.rectangle(0, 0, 1, 1).setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(16);
    this.buySuperTxt1 = this.add.text(0, 0, 'SUPER\nFREE SPINS', {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold', align: 'center',
      stroke: '#000000', strokeThickness: 5, lineSpacing: 2,
    }).setOrigin(0.5).setDepth(16);
    this.buySuperTxt2 = this.add.text(0, 0, '500×', {
      fontSize: '22px', color: '#ffe600', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5
    }).setOrigin(0.5).setDepth(16);

    this.buyRegular = this.add.graphics().setDepth(14);
    this.buyRegularHit = this.add.rectangle(0, 0, 1, 1).setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(16);
    this.buyRegularTxt1 = this.add.text(0, 0, 'BUY\nFREE SPINS', {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold', align: 'center',
      stroke: '#000000', strokeThickness: 5, lineSpacing: 2,
    }).setOrigin(0.5).setDepth(16);
    this.buyRegularTxt2 = this.add.text(0, 0, '100×', {
      fontSize: '22px', color: '#ffe600', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 5
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
    this.soundToggle = this.add.text(0, 0, '🔊', { fontSize: '28px', color: '#ffffff', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(16);
    this.btnPaytable = this.add.text(0, 0, 'ℹ', { fontSize: '28px', color: '#ffffff', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(16);
    this.btnSettings = this.add.text(0, 0, '⚙', { fontSize: '28px', color: '#ffffff', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(16);
    this.btnFullscreen = this.add.text(0, 0, '⛶', { fontSize: '28px', color: '#ffffff', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(16);

    // === DEMO MODE LABEL ===
    this.demoLabel = this.add.text(10, 10, '', {
      fontSize: '18px', color: '#ff2244', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 3,
      backgroundColor: '#000000', padding: { x: 8, y: 4 },
    }).setDepth(50).setAlpha(1);

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

    const barH = Math.max(50, h * 0.07);

    if (isPortrait) {
      // --- PORTRAIT LAYOUT ---
      const gridMaxH = (h - barH) * 0.56;
      const gridMaxW = w * 0.96;
      const cellSize = Math.floor(Math.min(gridMaxW, gridMaxH) / options.gridSize);
      const gridTotalW = cellSize * options.gridSize;
      const gridTotalH = cellSize * options.gridSize;
      
      const gridX = (w - gridTotalW) / 2;
      const gridY = Math.max(40, h * 0.08);

      this.grid.cellSize = cellSize;
      this.grid.offsetX = gridX;
      this.grid.offsetY = gridY;

      const bottomSpaceStart = gridY + gridTotalH;
      const bottomSpaceHeight = (h - barH) - bottomSpaceStart;
      
      const buyW = w * 0.44;
      const buyH = Math.min(50, Math.max(30, bottomSpaceHeight * 0.12));
      const buyY = bottomSpaceStart + buyH / 2 + Math.max(5, bottomSpaceHeight * 0.04);
      
      const fBuy1 = Math.min(12, buyW * 0.12);
      const fBuy2 = Math.min(18, buyW * 0.20);
      
      this.drawBuyButton(this.buySuper, w * 0.26, buyY, buyW, buyH, 0x00d2ff);
      this.buySuperHit.setPosition(w * 0.26, buyY).setSize(buyW, buyH).setDisplaySize(buyW, buyH);
      this.buySuperTxt1.setPosition(w * 0.26, buyY - buyH*0.15).setFontSize(fBuy1);
      this.buySuperTxt2.setPosition(w * 0.26, buyY + buyH*0.25).setFontSize(fBuy2);

      this.drawBuyButton(this.buyRegular, w * 0.74, buyY, buyW, buyH, 0xff006a);
      this.buyRegularHit.setPosition(w * 0.74, buyY).setSize(buyW, buyH).setDisplaySize(buyW, buyH);
      this.buyRegularTxt1.setPosition(w * 0.74, buyY - buyH*0.15).setFontSize(fBuy1);
      this.buyRegularTxt2.setPosition(w * 0.74, buyY + buyH*0.25).setFontSize(fBuy2);

      const anteH = Math.min(36, bottomSpaceHeight * 0.09);
      const anteW = w * 0.50;
      const anteY = buyY + buyH / 2 + anteH / 2 + Math.max(10, bottomSpaceHeight * 0.03);
      
      this.drawAnteBetButton(w / 2, anteY, anteW, anteH);
      this.anteBetHit.setPosition(w / 2, anteY).setSize(anteW, anteH).setDisplaySize(anteW, anteH);
      this.anteBetIcon.setPosition(w / 2 - anteW * 0.35, anteY).setFontSize(Math.min(16, anteH * 0.6));
      this.anteBetTxt.setPosition(w / 2 + 10, anteY).setFontSize(Math.min(13, anteW * 0.10));

      const maxSpinR = bottomSpaceHeight * 0.22;
      const absoluteMaxSpinR = Math.min(65, w * 0.18);
      const spinRadius = Math.max(30, Math.min(absoluteMaxSpinR, maxSpinR));
      const spinY = anteY + anteH/2 + spinRadius + Math.max(10, bottomSpaceHeight * 0.06);

      this.drawSpinButton(w / 2, spinY, spinRadius);
      this.drawSpinGlow(w / 2, spinY, spinRadius);
      this.spinBtnHit.setPosition(w / 2, spinY).setSize(spinRadius * 2.2, spinRadius * 2.2).setDisplaySize(spinRadius * 2.2, spinRadius * 2.2);
      this.spinBtnLabel.setPosition(w / 2, spinY).setFontSize(Math.min(22, spinRadius * 0.45));
      this.spinBtnRadius = spinRadius;

      const autoY = h - barH - Math.max(15, bottomSpaceHeight * 0.05);
      const autoW = Math.min(120, w * 0.3);
      const autoH = Math.min(32, bottomSpaceHeight * 0.08);
      this.btnAuto.setPosition(w / 2, autoY).setSize(autoW, autoH).setDisplaySize(autoW, autoH);
      this.txtAuto.setPosition(w / 2, autoY).setFontSize(Math.min(14, autoH * 0.5));

      this.txtFSRemaining.setPosition(w / 2, Math.max(15, gridY - 20)).setFontSize(Math.min(26, h * 0.035));

    } else {
      // --- LANDSCAPE LAYOUT ---
      const gridMaxW = w * 0.50;
      const gridMaxH = (h - barH) * 0.90;
      const cellSize = Math.floor(Math.min(gridMaxH, gridMaxW) / options.gridSize);
      const gridTotalW = cellSize * options.gridSize;
      const gridTotalH = cellSize * options.gridSize;

      const gridX = (w - gridTotalW) / 2;
      const gridY = Math.max(12, ((h - barH) - gridTotalH) / 2);

      this.grid.cellSize = cellSize;
      this.grid.offsetX = gridX;
      this.grid.offsetY = gridY;

      const leftPanelCenter = gridX / 2;
      const rightPanelCenter = gridX + gridTotalW + gridX / 2;
      const gridCenterY = gridY + gridTotalH / 2;

      const buyW = Math.max(90, gridX * 0.75);
      const buyH = Math.max(45, (h - barH) * 0.12);

      this.drawBuyButton(this.buySuper, leftPanelCenter, gridCenterY - buyH * 0.8, buyW, buyH, 0x00d2ff);
      this.buySuperHit.setPosition(leftPanelCenter, gridCenterY - buyH * 0.8).setSize(buyW, buyH).setDisplaySize(buyW, buyH);
      this.buySuperTxt1.setPosition(leftPanelCenter, gridCenterY - buyH * 0.8 - 12).setFontSize(Math.min(12, buyH * 0.22));
      this.buySuperTxt2.setPosition(leftPanelCenter, gridCenterY - buyH * 0.8 + 8).setFontSize(Math.min(16, buyH * 0.35));

      this.drawBuyButton(this.buyRegular, leftPanelCenter, gridCenterY + buyH * 0.8, buyW, buyH, 0xff006a);
      this.buyRegularHit.setPosition(leftPanelCenter, gridCenterY + buyH * 0.8).setSize(buyW, buyH).setDisplaySize(buyW, buyH);
      this.buyRegularTxt1.setPosition(leftPanelCenter, gridCenterY + buyH * 0.8 - 12).setFontSize(Math.min(12, buyH * 0.22));
      this.buyRegularTxt2.setPosition(leftPanelCenter, gridCenterY + buyH * 0.8 + 8).setFontSize(Math.min(16, buyH * 0.35));

      const anteY = gridCenterY + buyH * 1.6 + 20;
      this.drawAnteBetButton(leftPanelCenter, anteY, buyW, 30);
      this.anteBetHit.setPosition(leftPanelCenter, anteY).setSize(buyW, 30).setDisplaySize(buyW, 30);
      this.anteBetIcon.setPosition(leftPanelCenter - buyW * 0.3, anteY).setFontSize(14);
      this.anteBetTxt.setPosition(leftPanelCenter + 10, anteY).setFontSize(11);

      const spinRadius = Math.min(55, gridX * 0.35);
      this.drawSpinButton(rightPanelCenter, gridCenterY, spinRadius);
      this.drawSpinGlow(rightPanelCenter, gridCenterY, spinRadius);
      this.spinBtnHit.setPosition(rightPanelCenter, gridCenterY).setSize(spinRadius * 2.2, spinRadius * 2.2).setDisplaySize(spinRadius * 2.2, spinRadius * 2.2);
      this.spinBtnLabel.setPosition(rightPanelCenter, gridCenterY).setFontSize(Math.min(22, spinRadius * 0.44));
      this.spinBtnRadius = spinRadius;

      this.btnAuto.setPosition(rightPanelCenter, gridCenterY + spinRadius + 35).setSize(130, 36).setDisplaySize(130, 36);
      this.txtAuto.setPosition(rightPanelCenter, gridCenterY + spinRadius + 35).setFontSize(15);

      this.txtFSRemaining.setPosition(w / 2, Math.max(15, gridY - 25)).setFontSize(28);
    }

    // Draw grid frame & glow — premium double-stroke with breathing gradient
    const gPad = 12;
    const gW = this.grid.cellSize * 7 + gPad * 2;
    const gH = gW;
    const gX = this.grid.offsetX - gPad;
    const gY = this.grid.offsetY - gPad;

    this.gridGlow.clear();
    // Multi-layer glow for depth
    this.gridGlow.fillStyle(0x6600cc, 0.06);
    this.gridGlow.fillRoundedRect(gX - 12, gY - 12, gW + 24, gH + 24, 22);
    this.gridGlow.fillStyle(0x00d2ff, 0.08);
    this.gridGlow.fillRoundedRect(gX - 6, gY - 6, gW + 12, gH + 12, 18);

    this.gridFrame.clear();
    // Dark panel fill
    this.gridFrame.fillStyle(0x060d1f, 0.92);
    this.gridFrame.fillRoundedRect(gX, gY, gW, gH, 14);
    // Outer stroke — strong border
    this.gridFrame.lineStyle(3, 0x1a2855, 1.0);
    this.gridFrame.strokeRoundedRect(gX, gY, gW, gH, 14);
    // Inner stroke — subtle cyan accent
    this.gridFrame.lineStyle(1, 0x00d2ff, 0.25);
    this.gridFrame.strokeRoundedRect(gX + 4, gY + 4, gW - 8, gH - 8, 10);

    // Bottom bar — glassmorphism
    this.bottomBar.clear();
    // Dark base
    this.bottomBar.fillStyle(0x040810, 0.96);
    this.bottomBar.fillRect(0, h - barH, w, barH);
    // Top edge highlight
    this.bottomBar.lineStyle(1, 0x1a2855, 0.9);
    this.bottomBar.lineBetween(0, h - barH, w, h - barH);
    // Subtle inner glow line
    this.bottomBar.lineStyle(1, 0x00d2ff, 0.08);
    this.bottomBar.lineBetween(0, h - barH + 1, w, h - barH + 1);
    // Vertical separators between balance, bet, and win sections
    const sepColor = 0x1a2855;
    this.bottomBar.lineStyle(1, sepColor, 0.5);
    this.bottomBar.lineBetween(w * 0.32, h - barH + 8, w * 0.32, h - 8);
    this.bottomBar.lineBetween(w * 0.68, h - barH + 8, w * 0.68, h - 8);

    const barCY = h - barH / 2;
    // Hide purely textual labels if screen is extremely narrow (< 450px)
    const showLabels = w >= 450;
    
    // Scale down text proportionally
    const fs = Math.min(22, Math.max(14, barH * 0.35));
    const fsLabel = Math.min(12, barH * 0.20);

    // Balance section (left 30%)
    this.txtMoneyLabel.setPosition(w * 0.04, barCY - (showLabels ? fs * 0.50 : 0)).setFontSize(fsLabel).setVisible(showLabels);
    this.txtMoney.setPosition(w * 0.04, barCY + (showLabels ? fs * 0.30 : 0)).setFontSize(fs).setOrigin(0, 0.5);

    // Bet section (center)
    const betBtnSize = Math.min(34, Math.max(24, barH * 0.55));
    // Squeeze the minus/plus buttons closer if screen is small
    const betCenterOffset = w < 400 ? w * 0.16 : w * 0.12;

    this.drawBetButton(this.btnBetMinus, (w / 2) - betCenterOffset, barCY, betBtnSize, false);
    this.btnBetMinusHit.setPosition((w / 2) - betCenterOffset, barCY).setSize(betBtnSize + 16, betBtnSize + 16).setDisplaySize(betBtnSize + 16, betBtnSize + 16);
    
    this.drawBetButton(this.btnBetPlus, (w / 2) + betCenterOffset, barCY, betBtnSize, true);
    this.btnBetPlusHit.setPosition((w / 2) + betCenterOffset, barCY).setSize(betBtnSize + 16, betBtnSize + 16).setDisplaySize(betBtnSize + 16, betBtnSize + 16);

    this.txtBetLabel.setPosition(w * 0.5, barCY - (showLabels ? fs * 0.50 : 0)).setFontSize(fsLabel).setVisible(showLabels);
    this.txtBet.setPosition(w * 0.5, barCY + (showLabels ? fs * 0.30 : 0)).setFontSize(fs).setOrigin(0.5, 0.5);

    // Win section (right 30%)
    this.txtLastWinLabel.setPosition(w * 0.96, barCY - (showLabels ? fs * 0.50 : 0)).setFontSize(fsLabel).setVisible(showLabels);
    this.txtLastWin.setPosition(w * 0.96, barCY + (showLabels ? fs * 0.30 : 0)).setFontSize(fs).setOrigin(1, 0.5);

    // Toolbar (top-right)
    const tbY = 18;
    const tbGap = Math.max(30, w * 0.04);
    this.soundToggle.setPosition(w - tbGap * 0.5, tbY).setFontSize(Math.min(24, Math.max(16, w * 0.03)));
    this.btnPaytable.setPosition(w - tbGap * 1.5, tbY).setFontSize(Math.min(24, Math.max(16, w * 0.03)));
    this.btnSettings.setPosition(w - tbGap * 2.5, tbY).setFontSize(Math.min(24, Math.max(16, w * 0.03)));
    this.btnFullscreen.setPosition(w - tbGap * 3.5, tbY).setFontSize(Math.min(24, Math.max(16, w * 0.03)));
  }

  private drawSpinButton(cx: number, cy: number, radius: number) {
    this.spinBtnGfx.clear();
    // Deep shadow
    this.spinBtnGfx.fillStyle(0x000000, 0.45);
    this.spinBtnGfx.fillCircle(cx + 1, cy + 5, radius);

    // Main green circle
    this.spinBtnGfx.fillStyle(0x00c853, 1);
    this.spinBtnGfx.fillCircle(cx, cy, radius);

    // Upper gloss highlight
    this.spinBtnGfx.fillStyle(0x69f0ae, 0.45);
    this.spinBtnGfx.fillCircle(cx, cy - radius * 0.25, radius * 0.6);

    // Outer bright stroke
    this.spinBtnGfx.lineStyle(3, 0xffffff, 0.9);
    this.spinBtnGfx.strokeCircle(cx, cy, radius);

    // Inner thin accent ring
    this.spinBtnGfx.lineStyle(1, 0xb9f6ca, 0.5);
    this.spinBtnGfx.strokeCircle(cx, cy, radius - 5);
  }

  private drawSpinGlow(cx: number, cy: number, radius: number) {
    this.spinGlowRing.clear();
    // Pulsing outer glow ring (opacity animated by the tween)
    this.spinGlowRing.fillStyle(0x00e676, 0.15);
    this.spinGlowRing.fillCircle(cx, cy, radius * 1.5);
    this.spinGlowRing.fillStyle(0x00e676, 0.08);
    this.spinGlowRing.fillCircle(cx, cy, radius * 1.9);
  }

  private drawBuyButton(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, bw: number, bh: number, color: number) {
    gfx.clear();
    const x = cx - bw / 2;
    const y = cy - bh / 2;

    // Deep shadow
    gfx.fillStyle(0x000000, 0.4);
    gfx.fillRoundedRect(x + 1, y + 4, bw, bh, 14);

    // Main fill — darker base shade
    const darkerColor = Phaser.Display.Color.ValueToColor(color).darken(20).color;
    gfx.fillStyle(darkerColor, 1);
    gfx.fillRoundedRect(x, y, bw, bh, 14);

    // Lighter top half for gradient effect
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(x, y, bw, bh * 0.55, 14);
    
    // Gloss highlight (very top)
    gfx.fillStyle(0xffffff, 0.18);
    gfx.fillRoundedRect(x + 4, y + 2, bw - 8, bh * 0.28, 10);

    // Outer stroke
    gfx.lineStyle(2, 0xffffff, 0.7);
    gfx.strokeRoundedRect(x, y, bw, bh, 14);

    // Inner subtle accent stroke
    gfx.lineStyle(1, 0xffffff, 0.12);
    gfx.strokeRoundedRect(x + 2, y + 2, bw - 4, bh - 4, 12);
  }

  private drawAnteBetButton(cx: number, cy: number, bw: number, bh: number) {
    this.anteBetBtn.clear();
    const x = cx - bw / 2;
    const y = cy - bh / 2;

    // Drop shadow
    this.anteBetBtn.fillStyle(0x000000, 0.5);
    this.anteBetBtn.fillRoundedRect(x, y + 4, bw, bh, 8);

    if (options.anteBetEnabled) {
      this.anteBetBtn.fillStyle(0xff9900, 1);
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh, 8);
      
      this.anteBetBtn.fillStyle(0xffffff, 0.2);
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh * 0.4, 8);

      this.anteBetBtn.lineStyle(3, 0xffffff, 1);
      this.anteBetBtn.strokeRoundedRect(x, y, bw, bh, 8);
      
      this.anteBetTxt.setColor('#ffffff');
      this.anteBetIcon.setStroke('#000000', 4);
    } else {
      this.anteBetBtn.fillStyle(0x334466, 1);
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh, 8);
      this.anteBetBtn.lineStyle(3, 0x8899aa, 1);
      this.anteBetBtn.strokeRoundedRect(x, y, bw, bh, 8);
      
      this.anteBetTxt.setColor('#ffffff');
      this.anteBetIcon.setStroke('#000000', 4);
    }
  }

  private drawBetButton(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number, isPlus: boolean) {
    gfx.clear();
    // Shadow
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillCircle(cx, cy + 2, size / 2);
    // Dark fill
    gfx.fillStyle(0x0d1530, 1);
    gfx.fillCircle(cx, cy, size / 2);
    // Subtle inner glow
    gfx.fillStyle(0x1a2855, 0.6);
    gfx.fillCircle(cx, cy - 2, size / 2 - 3);
    // Outer ring
    gfx.lineStyle(2, 0x3355aa, 0.8);
    gfx.strokeCircle(cx, cy, size / 2);
    // Draw +/- sign
    const armLen = Math.max(5, size * 0.18);
    gfx.lineStyle(2.5, 0xccddff, 0.95);
    gfx.lineBetween(cx - armLen, cy, cx + armLen, cy);
    if (isPlus) {
      gfx.lineBetween(cx, cy - armLen, cx, cy + armLen);
    }
  }

  private wireInteractions() {
    // Spin button — universal action button
    this.spinBtnHit.on('pointerdown', () => {
      this.handleUniversalAction();
    });

    this.spinBtnHit.on('pointerover', () => {
      if (!this._spinLock) this.spinBtnLabel.setColor('#ccffdd');
    });
    this.spinBtnHit.on('pointerout', () => {
      this.updateSpinButtonState();
    });

    // Auto play
    this.btnAuto.on('pointerdown', () => {
      if (this.fsActive || this.anyOverlayOpen()) return;
      if (!this.autoSpinActive) {
        // Check balance before starting auto-spin
        const cost = this.getEffectiveBet();
        if (this.valueMoney < cost) {
          this.errorManager.showToast('INSUFFICIENT FUNDS', '#ff4466');
          return;
        }
        this.autoSpinActive = true;
        this.autoSpinRemaining = 0; // infinite
        this.updateAutoSpinDisplay();
        // Decouple from click event to prevent double-fire if spin already in flight
        if (!this._spinLock) {
          this.time.delayedCall(50, () => {
            if (this.autoSpinActive && !this._spinLock) this.attemptSpin(0);
          });
        }
      } else {
        this.stopAutoSpin();
      }
    });

    // Bet controls — guard with overlay check so bet can't change during confirm dialog
    this.btnBetMinusHit.on('pointerdown', () => {
      if (this.anyOverlayOpen()) return;
      this.changeBet(-1);
    });
    this.btnBetPlusHit.on('pointerdown', () => {
      if (this.anyOverlayOpen()) return;
      this.changeBet(1);
    });

    // Buy features (with confirmation) — also guard overlays
    this.buySuperHit.on('pointerdown', () => {
      if (this.anyOverlayOpen()) return;
      this.requestPurchase(2, 500);
    });
    this.buyRegularHit.on('pointerdown', () => {
      if (this.anyOverlayOpen()) return;
      this.requestPurchase(1, 100);
    });

    // Ante Bet toggle
    this.anteBetHit.on('pointerdown', () => {
      if (this._spinLock || this.fsActive || this.anyOverlayOpen()) return;
      options.anteBetEnabled = !options.anteBetEnabled;
      this.drawAnteBetButton(
        this.anteBetHit.x, this.anteBetHit.y,
        this.anteBetHit.width, this.anteBetHit.height
      );
      this.updateBetDisplay();
      this.audio.playSound('button');
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

  /**
   * Universal action handler — spin button and spacebar both route here.
   * Priority: skip overlays > stop auto > spin
   */
  private handleUniversalAction() {
    // 1. Skip win celebration
    if (this.winCelebration.isVisible) {
      this.winCelebration.skip();
      return;
    }
    // 2. Skip free spins intro
    if (this.freeSpinsIntro.isVisible) {
      this.freeSpinsIntro.skip();
      return;
    }
    // 3. Close any overlay (paytable, settings)
    if (this.paytable.isVisible()) { this.paytable.hide(); return; }
    if (this.settings.isVisible()) { this.settings.hide(); return; }
    if (this.confirmDialog.isVisible()) return; // Don't dismiss confirm with space

    // 4. During free spins, don't allow manual action
    if (this.fsActive) return;

    // 5. Stop auto-spin
    if (this.autoSpinActive) {
      this.stopAutoSpin();
      return;
    }

    // 6. Normal spin
    if (!this._spinLock) {
      this.attemptSpin(0);
    }
  }

  /** Update spin button visual to reflect current state */
  private updateSpinButtonState() {
    if (this.autoSpinActive) {
      this.spinBtnLabel.setText('STOP');
      this.spinBtnLabel.setColor('#ff4466');
    } else if (this._spinLock) {
      this.spinBtnLabel.setText('⋯');
      this.spinBtnLabel.setColor('#556688');
    } else {
      this.spinBtnLabel.setText('SPIN');
      this.spinBtnLabel.setColor('#ffffff');
    }
  }

  /** Update auto-spin button display */
  private updateAutoSpinDisplay() {
    if (this.autoSpinActive) {
      const label = this.autoSpinRemaining > 0 ? `${this.autoSpinRemaining}` : '∞';
      this.txtAuto.setText(label);
      this.txtAuto.setColor('#ff4466');
      this.btnAuto.setStrokeStyle(3, 0xff4466, 1);
    } else {
      this.txtAuto.setText('AUTO');
      this.txtAuto.setColor('#ffffff');
      this.btnAuto.setStrokeStyle(3, 0xffffff, 1);
    }
  }

  private wireGridCallbacks() {
    this.grid.onWinCallback = (winAmount) => {
      const actualWin = winAmount;
      if (!this.fsActive) {
        this.valueMoney += actualWin;
        this.updateMoneyDisplay();
        this.lastWin += actualWin;
        this.updateLastWinDisplay();
      }
      // During free spins, don't track lastWin per cascade — 
      // the Grid's totalFreeSpinsWin is authoritative

      this.audio.playWin(actualWin / this.getEffectiveBet());

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
      this.audio.playMusic('musicDefault', 800);

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
      this.audio.playMusic('backgroundDefault', 1000);

      const betAmount = this.getEffectiveBet();
      this.winCelebration.show(totalWin, betAmount, () => {
        const endText = this.add.text(
          this.scale.width / 2, this.scale.height / 2,
          `FREE SPINS TOTAL\n${totalWin.toFixed(2)}`,
          { fontSize: '64px', color: '#ffe600', align: 'center', fontStyle: 'bold', stroke: '#000', strokeThickness: 10 }
        ).setOrigin(0.5).setDepth(35).setScale(0);

        this.tweens.add({
          targets: endText, scale: 1, duration: 500, yoyo: true, hold: 2000, ease: 'Back.easeOut',
          onComplete: () => {
            endText.destroy();
            this._spinLock = false;
            this.stakeEngine.endRound().catch(e => console.warn('[Game] endRound error:', e));
            this.saveSpinRecord(totalWin, 'free_spins');
            this.updateSpinButtonState();

            // Auto-spin continuation after FS
            if (this.autoSpinActive) {
              if (this.autoSpinRemaining > 0) {
                this.autoSpinRemaining--;
                this.updateAutoSpinDisplay();
                if (this.autoSpinRemaining === 0) {
                  this.stopAutoSpin();
                  return;
                }
              }
              const cost = this.getEffectiveBet();
              if (this.valueMoney < cost) {
                this.stopAutoSpin();
                this.errorManager.showToast('INSUFFICIENT FUNDS', '#ff4466');
                return;
              }
              this.autoSpinTimer = this.time.delayedCall(600, () => {
                if (this.autoSpinActive && !this.fsActive) this.attemptSpin(0);
              });
            }
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

    // Wire free spin next-spin callback (Bug 7: Game drives free spin flow)
    this.grid.onNextFreeSpinNeeded = () => {
      // Update FS counter display
      this.txtFSRemaining.setText(`${this.grid.freeSpinsRemaining} FREE SPINS`);
      // In demo mode, just do a local spin
      this.grid.prepareSpin();
      this.grid.injectServerResult();
    };

    this.grid.onCompleteCallback = () => {
      if (this.fsActive) return;

      const finishUp = () => {
        this._spinLock = false;
        this.stakeEngine.endRound().catch(e => console.warn('[Game] endRound error:', e));
        this.saveSpinRecord(this.lastWin, 'base');
        this.updateSpinButtonState();

        // Auto-spin continuation
        if (this.autoSpinActive) {
          // Decrement count if not infinite
          if (this.autoSpinRemaining > 0) {
            this.autoSpinRemaining--;
            this.updateAutoSpinDisplay();
            if (this.autoSpinRemaining === 0) {
              this.stopAutoSpin();
              return;
            }
          }
          // Check balance before continuing
          const cost = this.getEffectiveBet();
          if (this.valueMoney < cost) {
            this.stopAutoSpin();
            this.errorManager.showToast('INSUFFICIENT FUNDS', '#ff4466');
            return;
          }
          this.autoSpinTimer = this.time.delayedCall(600, () => {
            if (this.autoSpinActive && !this.fsActive) this.attemptSpin(0);
          });
        }
      };

      if (this.lastWin > 0) {
        const betAmount = this.getEffectiveBet();
        this.winCelebration.show(this.lastWin, betAmount, finishUp);
      } else {
        finishUp();
      }
    };
  }

  private anyOverlayOpen(): boolean {
    return this.paytable.isVisible() || this.settings.isVisible() || this.confirmDialog.isVisible() || this.winCelebration.isVisible || this.freeSpinsIntro.isVisible || this.errorManager.isBlocking;
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
    // Rolling counter animation instead of instant update
    const target = this.lastWin;
    if (this._winCountTween) {
      this._winCountTween.stop();
    }
    if (target <= 0) {
      this._displayedWin = 0;
      this.txtLastWin.setText('0.00');
      this.txtLastWin.setColor('#44ff88');
      return;
    }
    const start = this._displayedWin;
    const delta = target - start;
    const duration = Math.min(1200, Math.max(300, Math.abs(delta) * 15));
    let elapsed = 0;
    this._winCountTween = this.tweens.addCounter({
      from: 0,
      to: 100,
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const progress = (tween.getValue?.() ?? 0) / 100;
        this._displayedWin = start + delta * progress;
        this.txtLastWin.setText(this._displayedWin.toFixed(2));
        // Color intensifies as value rises
        if (this._displayedWin > 0) {
          this.txtLastWin.setColor('#44ff88');
        }
      },
      onComplete: () => {
        this._displayedWin = target;
        this.txtLastWin.setText(target.toFixed(2));
      },
    });
  }

  private requestPurchase(triggerType: number, betMultCost: number) {
    if (this._spinLock || this.fsActive || this.anyOverlayOpen()) return;

    const cost = this.getEffectiveBet() * betMultCost;
    const label = triggerType === 2 ? 'Super Free Spins' : 'Free Spins';

    if (this.valueMoney < cost) {
      this.errorManager.showToast('INSUFFICIENT FUNDS', '#ff4466');
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
    this._spinLock = true;
    this.valueMoney -= cost;
    this.lastWin = 0;
    options.betAmount = BET_PRESETS[this.betPresetIndex];
    this.updateMoneyDisplay();
    this.updateLastWinDisplay();

    this.audio.playSound('button');

    // Bug 6: Don't pass triggerType to prepareSpin — sweep now, configure FS after intro
    this.grid.prepareSpin();

    try {
      const result = await this.stakeEngine.play(cost, triggerType);
      const spinEvent = result.events?.find(e => e.type === 'spin');
      const serverGrid = spinEvent ? (spinEvent.data as SpinEventData).grid : undefined;

      // Show free spins intro, then configure FS state and inject grid
      this.freeSpinsIntro.play(10, () => {
        // Set up free spins state AFTER the intro finishes
        this.grid.freeSpinsRemaining = 10;
        if (triggerType === 2) {
          this.grid.isSuperFreeSpins = true;
          // Super: pre-seed center multipliers
          const seedPoints = [
            { r: 3, c: 3, m: 16 }, { r: 2, c: 3, m: 8 }, { r: 4, c: 3, m: 8 },
            { r: 3, c: 2, m: 8 }, { r: 3, c: 4, m: 8 },
            { r: 2, c: 2, m: 4 }, { r: 2, c: 4, m: 4 }, { r: 4, c: 2, m: 4 }, { r: 4, c: 4, m: 4 }
          ];
          seedPoints.forEach(p => {
            (this.grid as any).multipliers[p.r][p.c] = p.m;
            (this.grid as any).drawMultiplierUI(p.r, p.c);
          });
        }
        this.fsActive = true;
        this.txtFSRemaining.setText(`${this.grid.freeSpinsRemaining} FREE SPINS`).setVisible(true);
        this.audio.playMusic('musicDefault', 800);
        this.grid.injectServerResult(serverGrid);
      });
    } catch (err) {
      console.error('[Game] Buy feature error:', err);
      this.grid.abortSpin();
      this._spinLock = false;
      this.stopAutoSpin();

      // Do NOT blindly refund balance — resync with server
      this.handleSpinFailure(err);
    }
  }

  async attemptSpin(triggerType: number) {
    if (this._spinLock || this._recovering || this.fsActive || this.anyOverlayOpen()) return;

    const cost = this.getEffectiveBet();
    if (this.valueMoney >= cost) {
      this._spinLock = true;
      this.valueMoney -= cost;
      this.lastWin = 0;
      // Bug 8: Store the BASE bet, not the ante-adjusted cost, for payout calculation
      options.betAmount = BET_PRESETS[this.betPresetIndex];
      this.updateMoneyDisplay();
      this.updateLastWinDisplay();

      this.audio.playReels();

      this.grid.prepareSpin();
      this.updateSpinButtonState();

      // Store pending round for disconnect recovery
      localStorage.setItem('pending_bet', String(cost));

      try {
        const result = await this.stakeEngine.play(cost, triggerType);
        localStorage.setItem('pending_round', JSON.stringify(result));

        const spinEvent = result.events?.find(e => e.type === 'spin');
        const serverGrid = spinEvent ? (spinEvent.data as SpinEventData).grid : undefined;
        this.grid.injectServerResult(serverGrid);
      } catch (err) {
        console.error('[Game] Play error:', err);
        this.grid.abortSpin();
        this._spinLock = false;
        this.stopAutoSpin();

        // Do NOT blindly refund balance — resync with server
        this.handleSpinFailure(err);
        return;
      }
    } else {
      this.stopAutoSpin();
      this.errorManager.showToast('INSUFFICIENT FUNDS', '#ff4466');
    }
  }


  changeBet(direction: number) {
    if (this._spinLock || this.fsActive) return;
    const newIndex = this.betPresetIndex + direction;
    if (newIndex >= 0 && newIndex < BET_PRESETS.length) {
      this.betPresetIndex = newIndex;
      options.betAmount = BET_PRESETS[this.betPresetIndex];
      this.updateBetDisplay();
      this.audio.playSound('button');
    }
  }

  stopAutoSpin() {
    this.autoSpinActive = false;
    this.autoSpinRemaining = 0;
    this.updateAutoSpinDisplay();
    this.updateSpinButtonState();
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
      this.stakeEngine.endRound().catch(e => console.warn('[Game] endRound error:', e));
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

  /**
   * Handle a spin/purchase failure.
   * Instead of blindly refunding the local balance, show a blocking error
   * and attempt to resync with the server to get the authoritative balance.
   */
  private handleSpinFailure(err: unknown): void {
    // Close any overlays that might be open
    if (this.paytable.isVisible()) this.paytable.hide();
    if (this.settings.isVisible()) this.settings.hide();
    if (this.confirmDialog.isVisible()) this.confirmDialog.dismiss();

    const isAuth = err instanceof StakeError && err.code === 'AUTH';
    const headline = isAuth ? 'SESSION EXPIRED' : 'CONNECTION LOST';

    if (isAuth) {
      // Unrecoverable — session is dead
      this.errorManager.showBlockingError(
        headline,
        async () => { throw new Error('Session expired'); },
        () => window.location.reload(),
      );
    } else {
      // Recoverable — show retry modal that resyncs balance
      this.errorManager.showBlockingError(
        headline,
        () => this.resyncAfterError(),
      );
    }
  }

  /**
   * Resync with the RGS after a network failure.
   * Fetches the authoritative wallet balance and updates the local state.
   * On success, unlocks the game. On failure, the error modal stays visible.
   */
  private async resyncAfterError(): Promise<void> {
    this._recovering = true;
    console.log('[Game] Attempting resync with server...');

    try {
      const state = await this.stakeEngine.resync();

      // Server provided the true balance — overwrite local state
      this.valueMoney = state.balance;
      this.updateMoneyDisplay();

      // If there's a pending round the server knows about, end it
      if (state.pendingRound) {
        console.log('[Game] Server reports pending round:', state.pendingRound.roundId);
        this.stakeEngine.endRound().catch(e => console.warn('[Game] endRound error:', e));
      }

      // Clean up local pending state
      localStorage.removeItem('pending_round');
      localStorage.removeItem('pending_bet');

      // Unlock the game
      this._spinLock = false;
      this._recovering = false;
      this.updateSpinButtonState();

      this.errorManager.showToast('Connection restored', '#44ff88');
      console.log('[Game] Resync successful. Balance:', this.valueMoney.toFixed(2));
    } catch (resyncErr) {
      this._recovering = false;
      console.error('[Game] Resync failed:', resyncErr);
      throw resyncErr; // Re-throw so the ErrorManager modal stays visible
    }
  }
}
