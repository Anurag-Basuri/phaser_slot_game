import Phaser from 'phaser';

import {
  Grid, Audio, PaytableOverlay, SettingsOverlay,
  WinCelebration, ConfirmDialog, FreeSpinsIntro, ErrorManager
} from '../components';
import { getStakeEngine } from '../engine';
import { SpinEventData, StakeEngineClient } from '../engine/StakeEngineClient';
import { StakeError } from '../engine/StakeEngineClient';
import options, { BET_PRESETS } from '../options';
import { DisplayBalance } from '../helpers/Currency';
import { T } from '../helpers/I18n';

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
  // UI elements
  private bgImage!: Phaser.GameObjects.Image;
  private logoImage!: Phaser.GameObjects.Image;
  private chassisImage!: Phaser.GameObjects.Image;
  private rocketImage!: Phaser.GameObjects.Image;
  private panelRegularImage!: Phaser.GameObjects.Image;
  private panelSuperImage!: Phaser.GameObjects.Image;
  
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

  // Replay UI
  private replayBtnHit!: Phaser.GameObjects.Rectangle;
  private replayBtnTxt!: Phaser.GameObjects.Text;

  // State — balance always starts from options.money in demo, or from Stake Engine auth
  valueMoney = options.money;
  currency = 'USD';
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

    if (this.stakeEngine.isReplayMode()) {
      try {
        await this.stakeEngine.fetchReplay();
        this.valueMoney = 0; // Balance hidden in replay mode
        this.currency = 'USD';
      } catch (err) {
        this.errorManager.showBlockingError(
          'REPLAY FETCH FAILED',
          async () => { throw new Error('Replay invalid'); },
          () => window.location.reload()
        );
        return;
      }
    } else if (!this.stakeEngine.isDemoMode()) {
      try {
        const auth = await this.stakeEngine.authenticate();
        this.valueMoney = StakeEngineClient.toDisplayAmount(auth.balance.amount);
        this.currency = auth.balance.currency;

        if (auth.round) {
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

    // === GRID ===
    this.grid = new Grid(this);
    this.wireGridCallbacks();

    // === LOGO ===
    this.logoImage = this.add.image(0, 0, 'logo').setDepth(30).setOrigin(0.5);

    // === CHASSIS ===
    this.chassisImage = this.add.image(0, 0, 'chassis').setDepth(2).setOrigin(0.5);

    // Buy buttons setup
    const btnStyle = { fontFamily: 'Impact', fontStyle: 'bold', align: 'center', strokeThickness: 1 };
    
    // Super Buy
    this.panelSuperImage = this.add.image(0, 0, 'panel').setDepth(20).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.requestPurchase(2, 500));
    this.buySuperHit = this.add.rectangle(0, 0, 100, 50, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(21)
      .on('pointerdown', () => this.requestPurchase(2, 500));
    this.buySuperTxt1 = this.add.text(0, 0, 'SUPER', { ...btnStyle, color: '#ffffff' }).setOrigin(0.5).setDepth(21);
    this.buySuperTxt2 = this.add.text(0, 0, '500x', { ...btnStyle, color: '#ffe600', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(21);

    // Regular Buy
    this.panelRegularImage = this.add.image(0, 0, 'panel').setDepth(20).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.requestPurchase(1, 100));
    this.buyRegularHit = this.add.rectangle(0, 0, 100, 50, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(21)
      .on('pointerdown', () => this.requestPurchase(1, 100));
    this.buyRegularTxt1 = this.add.text(0, 0, T('BUY', this.stakeEngine.isSocialMode()), { ...btnStyle, color: '#ffffff' }).setOrigin(0.5).setDepth(21);
    this.buyRegularTxt2 = this.add.text(0, 0, '100x', { ...btnStyle, color: '#ffe600', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(21);

    // Ante bet setup
    this.anteBetBtn = this.add.graphics().setDepth(20);
    this.anteBetHit = this.add.rectangle(0, 0, 100, 30, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(21)
      .on('pointerdown', () => {
        options.anteBetEnabled = !options.anteBetEnabled;
        this.updateBetDisplay();
        this.audio.playSound('button');
      });
    this.anteBetIcon = this.add.text(0, 0, '⚡', { fontFamily: 'Arial' }).setOrigin(0.5).setDepth(21);
    this.anteBetTxt = this.add.text(0, 0, T('ANTE BET', this.stakeEngine.isSocialMode()), { fontFamily: 'Impact', color: '#ffffff' }).setOrigin(0, 0.5).setDepth(21);

    // Spin button setup
    this.rocketImage = this.add.image(0, 0, 'gumball_rocket_btn').setDepth(20);
    this.spinBtnHit = this.add.rectangle(0, 0, 150, 150, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(21)
      .on('pointerdown', () => {
          // Play click animation
          this.tweens.add({ targets: this.rocketImage, scaleX: this.rocketImage.scaleX * 0.9, scaleY: this.rocketImage.scaleY * 0.9, yoyo: true, duration: 100, ease: 'Quad.easeInOut' });
          this.handleUniversalAction();
      });
    this.spinBtnLabel = this.add.text(0, 0, '', { fontFamily: 'Impact, Arial Black, sans-serif' }).setOrigin(0.5).setDepth(21);

    // Auto Play setup
    this.btnAuto = this.add.rectangle(0, 0, 100, 30, 0x0a0618)
      .setStrokeStyle(1.5, 0x331144, 0.6)
      .setInteractive({ useHandCursor: true }).setDepth(21)
      .on('pointerdown', () => {
        if (this.fsActive || this.anyOverlayOpen()) return;
        if (!this.autoSpinActive) {
          const cost = this.getEffectiveBet();
          if (this.valueMoney < cost) { this.errorManager.showToast('INSUFFICIENT FUNDS', '#ff4466'); return; }
          
          this.confirmDialog.show(
            'AUTO PLAY',
            'Start 100 automatic spins?',
            () => {
              this.autoSpinActive = true;
              this.autoSpinRemaining = 100; // Hardcoded to 100 for now
              this.updateAutoSpinDisplay();
              if (!this._spinLock) this.time.delayedCall(50, () => { if (this.autoSpinActive && !this._spinLock) this.attemptSpin(0); });
            },
            () => { /* cancel */ }
          );
        } else {
          this.stopAutoSpin();
        }
      });
    this.txtAuto = this.add.text(0, 0, 'AUTO', { fontFamily: 'Arial', fontStyle: 'bold', color: '#bbaacc' }).setOrigin(0.5).setDepth(21);

    // === BOTTOM BAR ===
    const tLabelStyle = { fontFamily: 'Arial', fontStyle: 'bold', color: '#8877aa' };
    const tValStyle = { fontFamily: 'Verdana', fontStyle: 'bold', color: '#eeddff' };
    
    // Bottom Bar Structural Graphic
    this.bottomBar = this.add.graphics().setDepth(45);
    
    this.txtMoneyLabel = this.add.text(0, 0, T('BALANCE', this.stakeEngine.isSocialMode()), tLabelStyle).setDepth(50);
    this.txtMoney = this.add.text(0, 0, '', tValStyle).setDepth(50);
    
    this.txtBetLabel = this.add.text(0, 0, T('BET', this.stakeEngine.isSocialMode()), tLabelStyle).setOrigin(0.5).setDepth(50);
    this.txtBet = this.add.text(0, 0, '', tValStyle).setOrigin(0.5).setDepth(50);
    
    this.txtLastWinLabel = this.add.text(0, 0, T('LAST WIN', this.stakeEngine.isSocialMode()), tLabelStyle).setOrigin(1, 0.5).setDepth(50);
    this.txtLastWin = this.add.text(0, 0, '', { ...tValStyle, color: '#ffe600' }).setOrigin(1, 0.5).setDepth(50);
    
    this.demoLabel = this.add.text(0, 0, '', {
      fontFamily: 'Impact', color: '#ff4466'
    }).setOrigin(1, 0.5).setDepth(50).setAlpha(0.8);

    if (this.stakeEngine.isDemoMode()) {
      this.demoLabel.setText('DEMO');
    }

    // Bet -/+ buttons
    this.btnBetMinus = this.add.graphics().setDepth(50);
    this.btnBetMinusHit = this.add.rectangle(0, 0, 44, 44).setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(51);
    this.btnBetPlus = this.add.graphics().setDepth(50);
    this.btnBetPlusHit = this.add.rectangle(0, 0, 44, 44).setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(51);

    // === FREE SPINS COUNTER ===
    this.txtFSRemaining = this.add.text(0, 0, '', {
      fontSize: '36px', color: '#ffffff', align: 'center', fontStyle: 'bold',
      fontFamily: 'Impact, Arial Black, sans-serif',
      stroke: '#cc00ff', strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 3, color: '#8800cc', blur: 12, fill: true }
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

    if (this.stakeEngine.isReplayMode()) {
      this.panelSuperImage.setVisible(false);
      this.buySuperHit.setVisible(false);
      this.buySuperTxt1.setVisible(false);
      this.buySuperTxt2.setVisible(false);
      
      this.panelRegularImage.setVisible(false);
      this.buyRegularHit.setVisible(false);
      this.buyRegularTxt1.setVisible(false);
      this.buyRegularTxt2.setVisible(false);
      
      this.anteBetBtn.setVisible(false);
      this.anteBetHit.setVisible(false);
      this.anteBetIcon.setVisible(false);
      this.anteBetTxt.setVisible(false);
      
      this.btnAuto.setVisible(false);
      this.txtAuto.setVisible(false);
      
      this.btnBetMinus.setVisible(false);
      this.btnBetMinusHit.setVisible(false);
      this.btnBetPlus.setVisible(false);
      this.btnBetPlusHit.setVisible(false);
      
      this.txtMoneyLabel.setVisible(false);
      this.txtMoney.setVisible(false);
      this.txtBetLabel.setVisible(false);
      this.txtBet.setVisible(false);

      this.rocketImage.setVisible(false);
      this.spinBtnHit.setVisible(false);
      this.spinBtnLabel.setVisible(false);

      this.replayBtnHit = this.add.rectangle(0, 0, 240, 70, 0xff006a)
        .setStrokeStyle(3, 0xffffff, 1)
        .setInteractive({ useHandCursor: true }).setDepth(55)
        .on('pointerdown', () => this.executeReplay());
      this.replayBtnTxt = this.add.text(0, 0, '▶ START REPLAY', {fontSize: '24px', fontFamily: 'Impact', color: '#fff'}).setOrigin(0.5).setDepth(56);
    }
  }

  /** Proportional layout engine — handles three responsive modes */
  private layoutAll() {
    const w = this.scale.width;
    const h = this.scale.height;
    
    // Determine screen mode
    const isPortrait = h > w;
    const isMobile = w < 768; // Roughly tablet/mobile breakpoint
    const isMobilePortrait = isPortrait && isMobile;

    this.bgImage.setPosition(w / 2, h / 2).setDisplaySize(w, h);

    // Height of the bottom glassmorphism bar
    const barH = Math.max(50, h * 0.07);

    // Toolbar top-right background plate (Glassy capsule)
    const topBarW = Math.max(160, w * 0.18 + 40);
    const topBarH = Math.max(36, h * 0.05);
    const tbY = Math.max(15, h * 0.02) + topBarH / 2;
    const tbX = w - Math.max(15, w * 0.02) - topBarW / 2;
    
    // We draw the capsule inside gridGlow or bottomBar so it's behind the texts
    this.bottomBar.clear();
    this.bottomBar.fillStyle(0x0a0618, 0.65);
    this.bottomBar.fillRoundedRect(tbX - topBarW/2, tbY - topBarH/2, topBarW, topBarH, topBarH / 2);
    this.bottomBar.lineStyle(1, 0x331144, 0.7);
    this.bottomBar.strokeRoundedRect(tbX - topBarW/2, tbY - topBarH/2, topBarW, topBarH, topBarH / 2);

    const tbIconSize = Math.max(16, topBarH * 0.45);
    const tbGap = topBarW / 4;

    this.soundToggle.setPosition(tbX + tbGap * 1.5, tbY).setFontSize(tbIconSize).setOrigin(0.5);
    this.btnPaytable.setPosition(tbX + tbGap * 0.5, tbY).setFontSize(tbIconSize).setOrigin(0.5);
    this.btnSettings.setPosition(tbX - tbGap * 0.5, tbY).setFontSize(tbIconSize).setOrigin(0.5);
    this.btnFullscreen.setPosition(tbX - tbGap * 1.5, tbY).setFontSize(tbIconSize).setOrigin(0.5);

    let gridTotalSize = 0;

    if (isMobilePortrait) {
      // ==========================================
      // PORTRAIT (MOBILE) LAYOUT
      // ==========================================
      // Grid goes at top half. Controls at bottom half.
      const gridMaxW = w * 0.96;
      const gridMaxH = (h - barH) * 0.55;
      const cellSize = Math.floor(Math.min(gridMaxW, gridMaxH) / options.gridSize);
      gridTotalSize = cellSize * options.gridSize;
      
      const gridX = (w - gridTotalSize) / 2;
      const gridY = Math.max(tbY + 30, h * 0.06);

      this.grid.cellSize = cellSize;
      this.grid.offsetX = gridX;
      this.grid.offsetY = gridY;

      // Rest of the space for controls
      const controlStartY = gridY + gridTotalSize;
      const controlSpaceH = (h - barH) - controlStartY;

      // Buy Buttons - stack vertically on the left
      const buyW = Math.min(160, w * 0.40);
      const buyH = Math.min(50, controlSpaceH * 0.22);
      
      const buyX = Math.max(10, w * 0.05) + buyW / 2;
      const buyGap = Math.min(10, controlSpaceH * 0.05);
      
      const buySuperY = controlStartY + controlSpaceH * 0.2;
      const buyRegularY = buySuperY + buyH + buyGap;

      this.layoutBuyButton(this.panelSuperImage, this.buySuperHit, this.buySuperTxt1, this.buySuperTxt2, buyX, buySuperY, buyW, buyH, 'SUPER');
      this.layoutBuyButton(this.panelRegularImage, this.buyRegularHit, this.buyRegularTxt1, this.buyRegularTxt2, buyX, buyRegularY, buyW, buyH, 'BUY');

      // Ante Bet - bottom left
      const anteW = buyW;
      const anteH = Math.min(40, controlSpaceH * 0.15);
      const anteY = buyRegularY + buyH / 2 + buyGap * 2 + anteH / 2;
      
      this.layoutAnteBet(buyX, anteY, anteW, anteH);

      // Spin Button - large on the right
      const maxSpinR = controlSpaceH * 0.26;
      const absoluteMaxSpinR = Math.min(75, w * 0.22);
      const spinRadius = Math.max(40, Math.min(absoluteMaxSpinR, maxSpinR));
      const spinX = w - Math.max(15, w * 0.05) - spinRadius;
      const spinY = controlStartY + controlSpaceH / 2 - 10;

      this.layoutSpinButton(spinX, spinY, spinRadius);

      // Auto play - under spin button
      const autoW = Math.min(100, spinRadius * 2);
      const autoH = Math.min(36, controlSpaceH * 0.15);
      const autoY = spinY + spinRadius + autoH / 2 + buyGap;

      this.btnAuto.setPosition(spinX, autoY).setSize(autoW, autoH).setDisplaySize(autoW, autoH);
      this.txtAuto.setPosition(spinX, autoY).setFontSize(Math.min(15, autoH * 0.5));

      // Free Spins Label - above grid
      this.txtFSRemaining.setPosition(w / 2, Math.max(10, gridY - 25)).setFontSize(Math.min(22, w * 0.06));

    } else {
      // ==========================================
      // LANDSCAPE / DESKTOP LAYOUT
      // ==========================================
      const gridMaxW = isMobile ? w * 0.55 : w * 0.45;
      const gridMaxH = (h - barH) * 0.88;
      const cellSize = Math.floor(Math.min(gridMaxH, gridMaxW) / options.gridSize);
      gridTotalSize = cellSize * options.gridSize;

      const gridX = (w - gridTotalSize) / 2;
      const gridY = Math.max(tbY + 10, ((h - barH) - gridTotalSize) / 2);

      this.grid.cellSize = cellSize;
      this.grid.offsetX = gridX;
      this.grid.offsetY = gridY;

      // Left panel centers
      const leftSpace = gridX;
      const leftCenter = leftSpace / 2;

      // Right panel centers
      const rightSpaceStart = gridX + gridTotalSize;
      const rightSpaceWidth = w - rightSpaceStart;
      const rightCenter = rightSpaceStart + rightSpaceWidth / 2;

      const centerY = gridY + gridTotalSize / 2;

      // Buy Buttons - vertically stacked on left
      const buyW = Math.min(200, leftSpace * 0.85);
      const buyH = Math.min(60, (h - barH) * 0.12);
      const buyGap = Math.min(15, h * 0.02);

      const buySuperY = centerY - buyH - buyGap / 2;
      const buyRegularY = centerY + buyGap / 2;

      this.layoutBuyButton(this.panelSuperImage, this.buySuperHit, this.buySuperTxt1, this.buySuperTxt2, leftCenter, buySuperY, buyW, buyH, 'SUPER');
      this.layoutBuyButton(this.panelRegularImage, this.buyRegularHit, this.buyRegularTxt1, this.buyRegularTxt2, leftCenter, buyRegularY, buyW, buyH, 'BUY');

      // Ante bet under buy regular
      const anteY = buyRegularY + buyH / 2 + buyGap * 1.5 + 20;
      this.layoutAnteBet(leftCenter, anteY, buyW, Math.min(40, buyH * 0.8));

      // Spin button on right
      const spinRadius = Math.min(70, Math.max(45, rightSpaceWidth * 0.25));
      this.layoutSpinButton(rightCenter, centerY - 15, spinRadius);

      // Auto play under spin button
      this.btnAuto.setPosition(rightCenter, centerY + spinRadius + 30).setSize(120, 40).setDisplaySize(120, 40);
      this.txtAuto.setPosition(rightCenter, centerY + spinRadius + 30).setFontSize(16);

      // Free Spins Label
      this.txtFSRemaining.setPosition(w / 2, Math.max(20, gridY - 30)).setFontSize(28);

      if (this.stakeEngine.isReplayMode()) {
        this.replayBtnHit.setPosition(w / 2, centerY);
        this.replayBtnTxt.setPosition(w / 2, centerY);
      }
    }

    this.logoImage.setPosition(Math.max(100, w * 0.15), Math.max(50, h * 0.1)).setDisplaySize(Math.min(300, w * 0.35), Math.min(150, h * 0.18));
    this.chassisImage.setPosition(this.grid.offsetX + gridTotalSize / 2, this.grid.offsetY + gridTotalSize / 2).setDisplaySize(gridTotalSize * 1.05, gridTotalSize * 1.05);

    // ==========================================
    // BOTTOM BAR HUD PLATE
    // ==========================================
    const barCY = h - barH / 2;
    
    // Main dark base for the bottom bar
    this.bottomBar.fillStyle(0x060812, 0.97);
    this.bottomBar.fillRect(0, h - barH, w, barH);
    // Top edge highlight — subtle pink
    this.bottomBar.lineStyle(1.5, 0x331144, 0.8);
    this.bottomBar.lineBetween(0, h - barH, w, h - barH);
    this.bottomBar.lineStyle(1, 0xff00cc, 0.08);
    this.bottomBar.lineBetween(0, h - barH + 1, w, h - barH + 1);

    // Pill background dimensions 
    const pillH = barH * 0.65;
    const pillRadius = pillH / 2;
    
    const betW = Math.min(180, w * 0.25);
    const pillW = Math.min(200, (w - betW - 80) / 2);
    
    // Balance panel (left) — dark with purple tint
    const balX1 = Math.max(10, w * 0.02);
    this.bottomBar.fillStyle(0x0e0a1e, 0.7);
    this.bottomBar.fillRoundedRect(balX1, barCY - pillH/2, pillW, pillH, pillRadius);
    this.bottomBar.lineStyle(1, 0x2a1a3d, 0.9);
    this.bottomBar.strokeRoundedRect(balX1, barCY - pillH/2, pillW, pillH, pillRadius);

    // Win panel (right) — dark with purple tint
    const winX1 = w - balX1 - pillW;
    this.bottomBar.fillStyle(0x0e0a1e, 0.7);
    this.bottomBar.fillRoundedRect(winX1, barCY - pillH/2, pillW, pillH, pillRadius);
    this.bottomBar.lineStyle(1, 0x2a1a3d, 0.9);
    this.bottomBar.strokeRoundedRect(winX1, barCY - pillH/2, pillW, pillH, pillRadius);

    // Bet panel (center) — subtle magenta accent
    const betX1 = (w - betW) / 2;
    this.bottomBar.fillStyle(0x0e0a1e, 0.7);
    this.bottomBar.fillRoundedRect(betX1, barCY - pillH/2, betW, pillH, pillRadius);
    this.bottomBar.lineStyle(1, 0xff00cc, 0.2);
    this.bottomBar.strokeRoundedRect(betX1, barCY - pillH/2, betW, pillH, pillRadius);

    const fs = Math.min(20, Math.max(14, barH * 0.30));
    const fsLabel = Math.min(11, barH * 0.18);
    const textPad = pillRadius;

    // Balance Texts
    this.txtMoneyLabel.setPosition(balX1 + textPad, barCY).setFontSize(fsLabel).setOrigin(0, 0.5);
    this.txtMoney.setPosition(balX1 + pillW - textPad, barCY).setFontSize(fs).setOrigin(1, 0.5);

    // Bet Texts
    const betBtnSize = Math.min(30, Math.max(22, pillH * 0.7));
    this.drawBetButton(this.btnBetMinus, betX1 + betBtnSize, barCY, betBtnSize, false);
    this.btnBetMinusHit.setPosition(betX1 + betBtnSize, barCY).setSize(betBtnSize * 1.5, betBtnSize * 1.5).setDisplaySize(betBtnSize * 1.5, betBtnSize * 1.5);
    
    this.drawBetButton(this.btnBetPlus, betX1 + betW - betBtnSize, barCY, betBtnSize, true);
    this.btnBetPlusHit.setPosition(betX1 + betW - betBtnSize, barCY).setSize(betBtnSize * 1.5, betBtnSize * 1.5).setDisplaySize(betBtnSize * 1.5, betBtnSize * 1.5);

    this.txtBetLabel.setPosition(w * 0.5, barCY - pillH * 0.25).setFontSize(fsLabel);
    this.txtBet.setPosition(w * 0.5, barCY + pillH * 0.15).setFontSize(Math.max(14, fs));

    // Win Texts
    this.txtLastWinLabel.setPosition(winX1 + textPad, barCY).setFontSize(fsLabel).setOrigin(0, 0.5);
    this.txtLastWin.setPosition(winX1 + pillW - textPad, barCY).setFontSize(fs).setOrigin(1, 0.5);

    // DEMO label placement
    if (this.stakeEngine.isDemoMode()) {
      this.demoLabel.setPosition(winX1 - 10, barCY).setFontSize(14);
    }
  }

  // --- Layout Helpers ---

  private layoutBuyButton(
    img: Phaser.GameObjects.Image, hit: Phaser.GameObjects.Rectangle,
    txt1: Phaser.GameObjects.Text, txt2: Phaser.GameObjects.Text,
    cx: number, cy: number, w: number, h: number, title: string
  ) {
    img.setPosition(cx, cy).setDisplaySize(w, h);
    hit.setPosition(cx, cy).setSize(w, h).setDisplaySize(w, h);
    const fsTitle = Math.min(18, h * 0.28);
    const fsFreeSpins = Math.min(10, h * 0.16);
    const fsSub = Math.min(16, h * 0.28);

    const buyTitle = title === 'SUPER' ? T('SUPER FREE SPINS', this.stakeEngine.isSocialMode()) : T('BUY FREE SPINS', this.stakeEngine.isSocialMode());
    // Split text cleanly for the button formatting
    const multilineTitle = buyTitle.split(' ').join('\n');
    txt1.setText(multilineTitle)
        .setLineSpacing(-Math.max(2, h * 0.05))
        .setPosition(cx, cy - h * 0.15).setFontSize(fsTitle);

    txt2.setPosition(cx, cy + h * 0.25).setFontSize(fsSub);
  }

  private layoutAnteBet(cx: number, cy: number, w: number, h: number) {
    this.drawAnteBetButton(cx, cy, w, h);
    this.anteBetHit.setPosition(cx, cy).setSize(w, h).setDisplaySize(w, h);
    this.anteBetIcon.setPosition(cx - w * 0.35, cy).setFontSize(Math.min(16, h * 0.5));
    this.anteBetTxt.setPosition(cx - w * 0.2, cy).setFontSize(Math.min(13, w * 0.08));
  }

  private layoutSpinButton(cx: number, cy: number, radius: number) {
    this.rocketImage.setPosition(cx, cy).setDisplaySize(radius * 3.5, radius * 3.5);
    this.spinBtnHit.setPosition(cx, cy).setSize(radius * 2.2, radius * 2.2).setDisplaySize(radius * 2.2, radius * 2.2);
    this.spinBtnLabel.setPosition(cx, cy).setFontSize(Math.min(22, radius * 0.40));
    this.spinBtnRadius = radius;
  }



  private drawAnteBetButton(cx: number, cy: number, bw: number, bh: number) {
    this.anteBetBtn.clear();
    const x = cx - bw / 2;
    const y = cy - bh / 2;
    const rad = Math.min(12, bh * 0.35);

    // Shadow
    this.anteBetBtn.fillStyle(0x000000, 0.45);
    this.anteBetBtn.fillRoundedRect(x + 1, y + 4, bw, bh, rad);

    if (options.anteBetEnabled) {
      // Active state — amber/gold tint
      this.anteBetBtn.fillStyle(0x332800, 1);
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh, rad);
      this.anteBetBtn.fillStyle(0x665500, 0.5);
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh * 0.5, rad);
      this.anteBetBtn.lineStyle(2, 0xffaa00, 0.8);
      this.anteBetBtn.strokeRoundedRect(x, y, bw, bh, rad);

      this.anteBetTxt.setColor('#ffcc44');
      this.anteBetIcon.setColor('#ffaa00');
      this.anteBetIcon.setStroke('#000000', 4);
    } else {
      // Inactive state — muted dark
      this.anteBetBtn.fillStyle(0x0e0a1e, 0.8);
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh, rad);
      this.anteBetBtn.lineStyle(1, 0x2a1a3d, 0.6);
      this.anteBetBtn.strokeRoundedRect(x, y, bw, bh, rad);

      this.anteBetTxt.setColor('#776688');
      this.anteBetIcon.setColor('#776688');
      this.anteBetIcon.setStroke('#000000', 2);
    }
  }

  private drawBetButton(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number, isPlus: boolean) {
    gfx.clear();
    // Shadow
    gfx.fillStyle(0x000000, 0.35);
    gfx.fillCircle(cx, cy + 2, size / 2);
    // Dark fill
    gfx.fillStyle(0x0e0a1e, 1);
    gfx.fillCircle(cx, cy, size / 2);
    // Subtle inner glow — purple tint
    gfx.fillStyle(0x1a1230, 0.7);
    gfx.fillCircle(cx, cy - 2, size / 2 - 3);
    // Outer ring — magenta accent
    gfx.lineStyle(2, 0x882288, 0.7);
    gfx.strokeCircle(cx, cy, size / 2);
    // Draw +/- sign
    const armLen = Math.max(5, size * 0.18);
    gfx.lineStyle(2.5, 0xddccee, 0.95);
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
      this.spinBtnLabel.setColor('#88aa88');
    } else {
      this.spinBtnLabel.setText('▶▶▶');
      this.spinBtnLabel.setColor('#ffffff');
    }
  }

  /** Update auto-spin button display */
  private updateAutoSpinDisplay() {
    if (this.autoSpinActive) {
      const label = this.autoSpinRemaining > 0 ? `${this.autoSpinRemaining}` : '∞';
      this.txtAuto.setText(label);
      this.txtAuto.setColor('#ff4466');
      this.btnAuto.setStrokeStyle(2, 0xff4466, 0.8);
      this.btnAuto.setFillStyle(0x1a0a14, 1);
    } else {
      this.txtAuto.setText('AUTO');
      this.txtAuto.setColor('#bbaacc');
      this.btnAuto.setStrokeStyle(1.5, 0x331144, 0.6);
      this.btnAuto.setFillStyle(0x0a0618, 1);
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
    this.txtMoney.setText(DisplayBalance({ amount: this.valueMoney, currency: this.currency }));
  }

  updateBetDisplay() {
    const effectiveBet = this.getEffectiveBet();
    const formatted = DisplayBalance({ amount: effectiveBet, currency: this.currency });
    const label = options.anteBetEnabled
      ? `${formatted} ⚡`
      : formatted;
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
      this.txtLastWin.setText(DisplayBalance({ amount: 0, currency: this.currency }));
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
        this.txtLastWin.setText(DisplayBalance({ amount: this._displayedWin, currency: this.currency }));
        // Color intensifies as value rises
        if (this._displayedWin > 0) {
          this.txtLastWin.setColor('#44ff88');
        }
      },
      onComplete: () => {
        this._displayedWin = target;
        this.txtLastWin.setText(DisplayBalance({ amount: target, currency: this.currency }));
      },
    });
  }

  private requestPurchase(triggerType: number, betMultCost: number) {
    if (this._spinLock || this.fsActive || this.anyOverlayOpen()) return;

    const cost = this.getEffectiveBet() * betMultCost;
    const label = triggerType === 2 
      ? T('SUPER FREE SPINS', this.stakeEngine.isSocialMode()) 
      : T('BUY FREE SPINS', this.stakeEngine.isSocialMode());

    if (this.valueMoney < cost) {
      this.errorManager.showToast('INSUFFICIENT FUNDS', '#ff4466');
      return;
    }

    const formattedCost = DisplayBalance({ amount: cost, currency: this.currency });
    this.confirmDialog.show(
      label,
      `Cost: ${formattedCost}`,
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
      const stateEvents = result.round?.state || [];
      const spinEvent = stateEvents.find((e: any) => e.type === 'spin');
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

      try {
        const result = await this.stakeEngine.play(cost, triggerType);

        const stateEvents = result.round?.state || [];
        const spinEvent = stateEvents.find((e: any) => e.type === 'spin');
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

  // ==========================================
  // REPLAY EXECUTION
  // ==========================================
  private async executeReplay() {
    this.replayBtnHit.setVisible(false);
    this.replayBtnTxt.setVisible(false);
    
    // We fetch replayData state bypassing normal play triggers
    const replayData = await this.stakeEngine.fetchReplay();
    const stateEvents = replayData.state || [];
    const spinEvent = stateEvents.find((e: any) => e.type === 'spin');
    const serverGrid = spinEvent ? (spinEvent.data as SpinEventData).grid : undefined;
    
    // Reset Grid context
    this._spinLock = true;
    this.lastWin = 0;
    this.updateLastWinDisplay();
    
    this.audio.playReels();
    this.grid.prepareSpin();
    
    // Check if free spins trigger was embedded to seed early
    const fsEvent = stateEvents.find((e: any) => e.type === 'free_spins_awarded');
    if (fsEvent) {
       this.grid.isSuperFreeSpins = fsEvent.data.super;
       this.grid.freeSpinsRemaining = fsEvent.data.count;
    }

    this.grid.injectServerResult(serverGrid);
  }

  private handlePendingRound() {
    // Stateless — pending round recovery is handled server-side.
    // On auth, the Stake Engine returns any pending round in auth.round.
    // The server's resync endpoint handles balance reconciliation.
    this.stakeEngine.endRound().catch(e => console.warn('[Game] endRound error:', e));
  }

  private saveSpinRecord(_winAmount: number, _feature: string) {
    // Stateless — no local history tracking.
    // All game history is server-authoritative via Stake Engine.
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

      // Clean up — no local state to clear

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
