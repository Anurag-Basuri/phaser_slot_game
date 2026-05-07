import Phaser from 'phaser';

import {
  Grid, Audio, PaytableOverlay, SettingsOverlay,
  WinCelebration, ConfirmDialog, FreeSpinsIntro, ErrorManager,
  AutoPlayOverlay, BetOverlay
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
  autoPlayOverlay!: AutoPlayOverlay;
  betOverlay!: BetOverlay;

  private stakeEngine!: StakeEngineClient;
  private skipScreensActive = false;

  // UI elements
  private bgImage!: Phaser.GameObjects.Image;
  private gridPanel!: Phaser.GameObjects.Image;
  private logoText1!: Phaser.GameObjects.Text;
  private logoText2!: Phaser.GameObjects.Text;
  private gridFrame!: Phaser.GameObjects.Graphics;
  
  private spinBtnGraphics!: Phaser.GameObjects.Graphics;
  private panelSuperGraphics!: Phaser.GameObjects.Graphics;
  private panelRegularGraphics!: Phaser.GameObjects.Graphics;
  
  private spinBtnHit!: Phaser.GameObjects.Rectangle;
  private spinBtnLabel!: Phaser.GameObjects.Text;
  private spinBtnRadius = 50;
  private btnAutoHit!: Phaser.GameObjects.Rectangle;
  private btnAutoGraphics!: Phaser.GameObjects.Graphics;
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
  private soundToggle!: Phaser.GameObjects.Graphics;
  private btnPaytable!: Phaser.GameObjects.Graphics;
  private btnSettings!: Phaser.GameObjects.Graphics;
  private btnFullscreen!: Phaser.GameObjects.Graphics;
  private txtLastWin!: Phaser.GameObjects.Text;
  private txtLastWinLabel!: Phaser.GameObjects.Text;
  private demoLabel!: Phaser.GameObjects.Text;
  // Ante Bet
  private anteBetBtn!: Phaser.GameObjects.Graphics;
  private anteBetHit!: Phaser.GameObjects.Rectangle;
  private anteBetTxt!: Phaser.GameObjects.Text;
  private anteBetIcon!: Phaser.GameObjects.Text;

  // Features Menu (for small screens)
  private btnFeaturesMenuGraphics!: Phaser.GameObjects.Graphics;
  private btnFeaturesMenuHit!: Phaser.GameObjects.Rectangle;
  private btnFeaturesMenuIcon!: Phaser.GameObjects.Text;
  private featuresMenuPopupBg!: Phaser.GameObjects.Graphics;
  private featuresMenuHitOverlay!: Phaser.GameObjects.Rectangle;
  private isFeaturesMenuOpen = false;

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
  musicEnabled = true;
  sfxEnabled = true;
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
    
    // Initialize grid internals (mask, backgrounds) before layout
    this.grid.init();

    // Layout sets correct offsetX/offsetY/cellSize on the grid
    this.layoutAll();

    // NOW fill the grid with symbols — positions are correct
    this.grid.fillEmpty();

    this.updateMoneyDisplay();
    this.updateBetDisplay();

    // Set active bet
    options.betAmount = BET_PRESETS[this.betPresetIndex];

    // Start background music
    this.audio.playMusic('backgroundDefault');
    // Enforce initial mute state via Audio channels
    this.audio.setMusicMuted(!this.musicEnabled);
    this.audio.setSfxMuted(!this.sfxEnabled);

    // Resize handler — debounced to prevent frame spikes during drag
    this.scale.on('resize', () => {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this.layoutAll();
        this.grid.repositionSprites();
      }, 80);
    });

    // Keyboard support — both SPACE and ENTER start/stop the spin (official spec)
    this.input.keyboard?.on('keydown-SPACE', (e: KeyboardEvent) => {
      e.preventDefault();
      this.handleUniversalAction();
    });
    this.input.keyboard?.on('keydown-ENTER', (e: KeyboardEvent) => {
      e.preventDefault();
      this.handleUniversalAction();
    });
  }

  private buildUI() {
    const w = this.scale.width;
    const h = this.scale.height;

    // === BACKGROUND (actual candy-land panorama) ===
    this.bgImage = this.add.image(w / 2, h / 2, 'game_bg').setDepth(0);

    // === GRID PANEL (authentic Sugar Rush 1000 frame image) ===
    this.gridPanel = this.add.image(0, 0, 'grid_panel').setDepth(1);

    // === GRID ===
    this.grid = new Grid(this);
    this.wireGridCallbacks();

    // === GRID FRAME (subtle overlay for cell delineation) ===
    this.gridFrame = this.add.graphics({ x: 0, y: 0 }).setDepth(2);

    // === LOGO (top-right like real Sugar Rush 1000) ===
    this.logoText1 = this.add.text(0, 0, 'SUGAR RUSH', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ff007f',
      fontStyle: 'normal',
      stroke: '#ffffff',
      strokeThickness: 8,
      shadow: { offsetX: 3, offsetY: 5, color: '#cc0066', blur: 0, stroke: true, fill: true }
    }).setDepth(30).setOrigin(0.5, 0.5);

    this.logoText2 = this.add.text(0, 0, '1000', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffaa00',
      fontStyle: 'normal',
      stroke: '#ffffff',
      strokeThickness: 8,
      shadow: { offsetX: 3, offsetY: 5, color: '#cc5500', blur: 0, stroke: true, fill: true }
    }).setDepth(30).setOrigin(0.5, 0.5);

    // Buy buttons setup
    const btnStyle = { fontFamily: '"Luckiest Guy", cursive, sans-serif', fontStyle: 'normal', align: 'center', strokeThickness: 0, shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 0, fill: true } };
    
    // Super Buy
    this.panelSuperGraphics = this.add.graphics({ x: 0, y: 0 }).setDepth(20);
    this.buySuperHit = this.add.rectangle(0, 0, 100, 50, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(21);
    this.buySuperTxt1 = this.add.text(0, 0, 'SUPER', { ...btnStyle, color: '#ffffff' }).setOrigin(0.5).setDepth(21);
    this.buySuperTxt2 = this.add.text(0, 0, '500X', { ...btnStyle, color: '#ffe600', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(21);

    // Regular Buy
    this.panelRegularGraphics = this.add.graphics({ x: 0, y: 0 }).setDepth(20);
    this.buyRegularHit = this.add.rectangle(0, 0, 100, 50, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(21);
    this.buyRegularTxt1 = this.add.text(0, 0, T('BUY', this.stakeEngine.isSocialMode()), { ...btnStyle, color: '#ffffff' }).setOrigin(0.5).setDepth(21);
    this.buyRegularTxt2 = this.add.text(0, 0, '100X', { ...btnStyle, color: '#ffe600', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(21);

    // Ante bet setup
    this.anteBetBtn = this.add.graphics().setDepth(20);
    this.anteBetHit = this.add.rectangle(0, 0, 100, 30, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(21);
    this.anteBetIcon = this.add.text(0, 0, '⚡', { fontFamily: 'Arial' }).setOrigin(0.5).setDepth(21);
    this.anteBetTxt = this.add.text(0, 0, T('ANTE BET', this.stakeEngine.isSocialMode()), { fontFamily: '"Inter", "Arial", sans-serif', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0, 0.5).setDepth(21);

    // Features Menu UI (for small screens)
    this.featuresMenuHitOverlay = this.add.rectangle(0, 0, w, h, 0x000000, 0.5)
      .setInteractive()
      .setDepth(60)
      .setVisible(false)
      .on('pointerdown', () => {
        this.isFeaturesMenuOpen = false;
        this.layoutAll();
      });
    
    this.featuresMenuPopupBg = this.add.graphics().setDepth(61).setVisible(false);
    
    this.btnFeaturesMenuGraphics = this.add.graphics().setDepth(20);
    this.btnFeaturesMenuHit = this.add.rectangle(0, 0, 50, 50, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(21)
      .on('pointerdown', () => {
        this.isFeaturesMenuOpen = !this.isFeaturesMenuOpen;
        this.layoutAll();
        this.audio.playSound('button');
      });
    this.btnFeaturesMenuIcon = this.add.text(0, 0, '⋮', { fontSize: '32px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(21);

    // Spin button setup (Authentic Pragmatic Circular Style)
    this.spinBtnGraphics = this.add.graphics().setDepth(20);
    this.spinBtnHit = this.add.rectangle(0, 0, 150, 150, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(21);
    this.spinBtnLabel = this.add.text(0, 0, '', { fontFamily: '"Luckiest Guy", cursive, sans-serif' }).setOrigin(0.5).setDepth(21);

    // Auto Play setup
    this.btnAutoGraphics = this.add.graphics().setDepth(21);
    this.btnAutoHit = this.add.rectangle(0, 0, 100, 30, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(22);
    this.txtAuto = this.add.text(0, 0, 'AUTO', { fontFamily: '"Inter", "Arial", sans-serif', fontStyle: '900', color: '#ffffff', shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 0, fill: true } }).setOrigin(0.5).setDepth(21);

    // === BOTTOM BAR ===
    const tLabelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Inter", "Arial", sans-serif',
      fontStyle: '600',
      color: '#99aadd',
      letterSpacing: 1,
    };
    const tValStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Inter", "Arial", sans-serif',
      fontStyle: '800',
      color: '#ffffff',
    };
    
    // Bottom Bar Structural Graphic
    this.bottomBar = this.add.graphics().setDepth(45);
    
    this.txtMoneyLabel = this.add.text(0, 0, T('BALANCE', this.stakeEngine.isSocialMode()), tLabelStyle).setOrigin(0, 0.5).setDepth(50);
    this.txtMoney = this.add.text(0, 0, '', tValStyle).setOrigin(1, 0.5).setDepth(50);
    
    this.txtBetLabel = this.add.text(0, 0, T('BET', this.stakeEngine.isSocialMode()), tLabelStyle).setOrigin(0, 0.5).setDepth(50);
    this.txtBet = this.add.text(0, 0, '', tValStyle).setOrigin(1, 0.5).setDepth(50);
    
    this.txtLastWinLabel = this.add.text(0, 0, T('LAST WIN', this.stakeEngine.isSocialMode()), tLabelStyle).setOrigin(0, 0.5).setDepth(50);
    this.txtLastWin = this.add.text(0, 0, '', { ...tValStyle, color: '#ffdd55' }).setOrigin(1, 0.5).setDepth(50);
    
    this.demoLabel = this.add.text(0, 0, '', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif', color: '#ff4466'
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
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      stroke: '#cc00ff', strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 3, color: '#8800cc', blur: 12, fill: true }
    }).setOrigin(0.5).setVisible(false).setDepth(20);

    // === TOOLBAR (Graphics-drawn icons instead of emoji) ===
    this.soundToggle = this.add.graphics().setDepth(50);
    this.btnPaytable = this.add.graphics().setDepth(50);
    this.btnSettings = this.add.graphics().setDepth(50);
    this.btnFullscreen = this.add.graphics().setDepth(50);
    // Make hit areas interactive
    [this.soundToggle, this.btnPaytable, this.btnSettings, this.btnFullscreen].forEach(btn => {
      btn.setInteractive(new Phaser.Geom.Rectangle(-22, -22, 44, 44), Phaser.Geom.Rectangle.Contains);
      (btn as any).input!.cursor = 'pointer';
    });

    // === OVERLAYS ===
    this.paytable = new PaytableOverlay(this);
    this.settings = new SettingsOverlay(this);
    this.autoPlayOverlay = new AutoPlayOverlay(this);
    this.betOverlay = new BetOverlay(this);

    // Bet overlay callback — updates game bet index
    this.betOverlay.setCallback((newIndex) => {
      this.betPresetIndex = newIndex;
      options.betAmount = BET_PRESETS[this.betPresetIndex];
      this.updateBetDisplay();
      this.audio.playSound('button');
    });

    this.autoPlayOverlay.setCallbacks((spins, turbo, quick, skip) => {
      this.grid.turboMode = turbo || quick;
      this.skipScreensActive = skip;
      this.autoSpinActive = true;
      this.autoSpinRemaining = spins;
      this.updateAutoSpinDisplay();
      if (!this._spinLock) {
        this.attemptSpin(0);
      }
    });

    this.settings.setMusicCallback((enabled) => {
      this.musicEnabled = enabled;
      this.audio.setMusicMuted(!enabled);
      this.drawToolbarIcons();
    });
    this.settings.setSfxCallback((enabled) => {
      this.sfxEnabled = enabled;
      this.audio.setSfxMuted(!enabled);
      this.drawToolbarIcons();
    });
    this.settings.setTurboCallback?.((enabled: boolean) => {
      this.grid.turboMode = enabled;
    });

    if (this.stakeEngine.isReplayMode()) {
      this.panelSuperGraphics.setVisible(false);
      this.buySuperHit.setVisible(false);
      this.buySuperTxt1.setVisible(false);
      this.buySuperTxt2.setVisible(false);
      
      this.panelRegularGraphics.setVisible(false);
      this.buyRegularHit.setVisible(false);
      this.buyRegularTxt1.setVisible(false);
      this.buyRegularTxt2.setVisible(false);
      
      this.anteBetBtn.setVisible(false);
      this.anteBetHit.setVisible(false);
      this.anteBetIcon.setVisible(false);
      this.anteBetTxt.setVisible(false);
      
      this.btnAutoHit.setVisible(false);
      this.btnAutoGraphics.setVisible(false);
      this.txtAuto.setVisible(false);
      
      this.btnBetMinus.setVisible(false);
      this.btnBetMinusHit.setVisible(false);
      this.btnBetPlus.setVisible(false);
      this.btnBetPlusHit.setVisible(false);
      
      this.txtMoneyLabel.setVisible(false);
      this.txtMoney.setVisible(false);
      this.txtBetLabel.setVisible(false);
      this.txtBet.setVisible(false);

      this.logoText1.setVisible(false);
      this.logoText2.setVisible(false);

      this.spinBtnGraphics.setVisible(false);
      this.spinBtnHit.setVisible(false);
      this.spinBtnLabel.setVisible(false);

      this.replayBtnHit = this.add.rectangle(0, 0, 240, 70, 0xff006a)
        .setStrokeStyle(3, 0xffffff, 1)
        .setInteractive({ useHandCursor: true }).setDepth(55)
        .on('pointerdown', () => this.executeReplay());
      this.replayBtnTxt = this.add.text(0, 0, '▶ START REPLAY', {fontSize: '24px', fontFamily: '"Luckiest Guy", cursive, sans-serif', color: '#fff'}).setOrigin(0.5).setDepth(56);
    }
  }

  /** Proportional layout engine — handles all responsive modes */
  private layoutAll() {
    const w = this.scale.width;
    const h = this.scale.height;

    // === BACKGROUND ===
    const bgScaleX = w / this.bgImage.width;
    const bgScaleY = h / this.bgImage.height;
    this.bgImage.setPosition(w / 2, h / 2).setScale(Math.max(bgScaleX, bgScaleY)).setVisible(true);

    // Determine layout mode
    const isPortrait = h > w;
    const isMobile = w < 768;
    const isStacked = isPortrait || (w < 650);
    const isLandscapeMobile = !isPortrait && h < 500;

    // Height of the bottom bar
    const barH = isStacked ? Math.max(55, h * 0.08) : Math.max(45, h * 0.07);
    const safeH = h - barH;

    // Toolbar dimensions (used by multiple elements for alignment)
    const toolY = Math.max(25, safeH * 0.04);
    const toolPad = isMobile ? 25 : 35;
    const toolGap = isLandscapeMobile ? 38 : isMobile ? 42 : 50;

    // ==========================================
    // 1. GRID SCALING & POSITIONING
    // ==========================================
    let gridTotalSize: number;
    let gridX: number;
    let gridY: number;

    if (isStacked) {
      const topSpace = Math.max(100, h * 0.12);
      const bottomSpace = isPortrait ? Math.max(200, h * 0.22) : 100;
      const availableH = safeH - topSpace - bottomSpace;
      gridTotalSize = Math.min(w * 0.92, availableH);
      gridTotalSize = Math.max(gridTotalSize, 150); // minimum
      gridX = (w - gridTotalSize) / 2;
      gridY = topSpace + (availableH - gridTotalSize) / 2;
    } else if (isLandscapeMobile) {
      // Short landscape: grid takes center, maximize height
      gridTotalSize = Math.min(safeH * 0.92, w * 0.45);
      gridX = (w - gridTotalSize) / 2;
      gridY = (safeH - gridTotalSize) / 2;
    } else {
      // Desktop column mode
      gridTotalSize = Math.min(w * 0.50, safeH * 0.88);
      gridX = (w - gridTotalSize) / 2;
      gridY = (safeH - gridTotalSize) / 2 + 5;
    }

    this.grid.offsetX = gridX;
    this.grid.offsetY = gridY;
    this.grid.cellSize = gridTotalSize / 7;
    this.grid.drawCellBackgrounds();
    this.grid.repositionSprites();

    // === GRID PANEL IMAGE ===
    this.gridPanel.setVisible(false); // Hide the old background image

    // === PREMIUM CANDY MACHINE FRAME ===
    this.gridFrame.clear();
    const f = this.gridFrame;

    const pipeHeight = Math.max(20, gridTotalSize * 0.04);
    const sideWidth = Math.max(15, gridTotalSize * 0.03);
    const trayHeight = Math.max(50, gridTotalSize * 0.1);
    const frameW = gridTotalSize + sideWidth * 2;
    const frameH = gridTotalSize + pipeHeight + trayHeight;
    const frameX = gridX - sideWidth;
    const frameY = gridY - pipeHeight;

    // 1. Bottom Tray (Cyan metallic base)
    f.fillStyle(0x7ac9d9, 1);
    f.fillRoundedRect(frameX - 10, gridY + gridTotalSize, frameW + 20, trayHeight, 15);
    f.fillStyle(0xaae8f9, 0.5); // Highlight
    f.fillRoundedRect(frameX - 8, gridY + gridTotalSize + 2, frameW + 16, trayHeight * 0.2, 8);
    f.fillStyle(0x2b3b6b, 1); // Dark base
    f.fillRect(frameX - 5, gridY + gridTotalSize + trayHeight - 20, frameW + 10, 20);
    
    // Tray holes
    f.fillStyle(0x1a2542, 1);
    for(let i=0; i<7; i++) {
       let holeX = gridX + (i + 0.5) * (gridTotalSize/7);
       f.fillEllipse(holeX, gridY + gridTotalSize + trayHeight * 0.35, Math.min(25, gridTotalSize/7 * 0.6), 8);
    }

    // Capsule indents on dark base
    f.fillStyle(0x151d33, 1);
    for(let i=0; i<5; i++) {
       let capW = Math.min(40, frameW / 7);
       let spacing = (frameW - (capW * 5)) / 6;
       let capX = frameX + spacing + (capW + spacing) * i;
       f.fillRoundedRect(capX, gridY + gridTotalSize + trayHeight - 15, capW, 10, 5);
    }

    // 2. Side Pillars (Cyan)
    f.fillStyle(0x8bdcf0, 1);
    f.fillRect(frameX, gridY, sideWidth, gridTotalSize);
    f.fillRect(gridX + gridTotalSize, gridY, sideWidth, gridTotalSize);
    f.fillStyle(0x000000, 0.15); // shadow
    f.fillRect(frameX + sideWidth - 4, gridY, 4, gridTotalSize);
    f.fillRect(gridX + gridTotalSize, gridY, 4, gridTotalSize);

    // Rivets on side pillars
    f.fillStyle(0x4a8b9e, 1);
    for(let i=0; i<6; i++) {
       let ry = gridY + 20 + i * ((gridTotalSize - 40)/5);
       f.fillCircle(frameX + sideWidth/2, ry, sideWidth * 0.2);
       f.fillCircle(gridX + gridTotalSize + sideWidth/2, ry, sideWidth * 0.2);
    }

    // 3. Top Pipe (Cyan with stripes/frosting)
    f.fillStyle(0xaae8f9, 1);
    f.fillRoundedRect(frameX, frameY, frameW, pipeHeight, 10);
    f.fillStyle(0x000000, 0.1); // shadow
    f.fillRect(frameX, frameY + pipeHeight * 0.7, frameW, pipeHeight * 0.3);

    // Frosting drips
    f.fillStyle(0xffffff, 1);
    f.fillRoundedRect(frameX - 5, frameY - 5, frameW + 10, pipeHeight, 10);
    const dripHeights = [15, 25, 12, 30, 18, 14, 28, 16, 22, 10, 24, 15];
    for(let i=0; i<12; i++) {
       let dripX = frameX + 10 + i * ((frameW - 20)/11);
       let dripHeight = dripHeights[i] * (pipeHeight / 20);
       f.fillRoundedRect(dripX - 8, frameY + pipeHeight - 10, 16, dripHeight, 8);
    }
    
    // Sprinkles
    const colors = [0xff44aa, 0x44ffaa, 0xffaa44, 0x44aaff];
    const sprinklePos = [0.1, 0.15, 0.25, 0.3, 0.4, 0.45, 0.55, 0.6, 0.7, 0.75, 0.85, 0.9];
    for(let i=0; i<12; i++) {
       f.fillStyle(colors[i % colors.length], 1);
       let sx = frameX + sprinklePos[i] * frameW;
       let sy = frameY + (i % 2 === 0 ? 0 : 5);
       f.fillRoundedRect(sx, sy, 8, 4, 2);
    }

    // ==========================================
    // 2. BUY PANELS & ANTE BET
    // ==========================================
    const availableWidthForFeatures = gridX;
    const availableHeightForFeatures = safeH - (gridY + gridTotalSize);
    
    const useFeaturesMenu = isLandscapeMobile || (isStacked && availableHeightForFeatures < 170) || (!isStacked && availableWidthForFeatures < 160);

    let buyW = isStacked ? w * 0.42 : Math.min(200, gridX * 0.75);
    let buyH = isStacked ? 55 : Math.min(100, safeH * 0.14);
    let buyGap = isStacked ? 8 : 12;
    let anteW = buyW;
    let anteH = isStacked ? 40 : 45;

    let buyX: number = 0;
    let buyY1: number = 0;
    let buyY2: number = 0;
    let anteY: number = 0;

    if (useFeaturesMenu) {
      // Show the toggle button
      this.btnFeaturesMenuGraphics.setVisible(true).clear();
      this.btnFeaturesMenuHit.setVisible(true);
      this.btnFeaturesMenuIcon.setVisible(true);
      
      const toggleX = isLandscapeMobile ? 35 : w * 0.15;
      const toggleY = isLandscapeMobile ? safeH / 2 : toolY + 60;
      
      this.btnFeaturesMenuHit.setPosition(toggleX, toggleY).setSize(50, 50);
      this.btnFeaturesMenuGraphics.fillStyle(0xff006a, 1).fillRoundedRect(toggleX - 25, toggleY - 25, 50, 50, 15);
      this.btnFeaturesMenuGraphics.lineStyle(3, 0xffffff, 1).strokeRoundedRect(toggleX - 25, toggleY - 25, 50, 50, 15);
      this.btnFeaturesMenuIcon.setPosition(toggleX, toggleY);

      if (this.isFeaturesMenuOpen) {
        // Position inside popup
        this.featuresMenuHitOverlay.setVisible(true).setPosition(w/2, h/2).setSize(w, h);
        this.featuresMenuPopupBg.setVisible(true).clear();
        
        buyW = Math.min(220, w * 0.8);
        buyH = 60;
        anteW = buyW;
        anteH = 45;
        buyGap = 15;

        const popupW = buyW + 40;
        const popupH = buyH * 2 + anteH + buyGap * 3 + 20;
        const popupX = w / 2;
        const popupY = h / 2;

        this.featuresMenuPopupBg.fillStyle(0x1a0a24, 0.95).fillRoundedRect(popupX - popupW/2, popupY - popupH/2, popupW, popupH, 20);
        this.featuresMenuPopupBg.lineStyle(3, 0xff006a, 1).strokeRoundedRect(popupX - popupW/2, popupY - popupH/2, popupW, popupH, 20);

        buyX = popupX;
        buyY1 = popupY - popupH/2 + 20 + buyH/2;
        buyY2 = buyY1 + buyH + buyGap;
        anteY = buyY2 + buyH/2 + buyGap + anteH/2;

      } else {
        this.featuresMenuHitOverlay.setVisible(false);
        this.featuresMenuPopupBg.setVisible(false);
      }
    } else {
      // Normal placement
      this.isFeaturesMenuOpen = false;
      this.featuresMenuHitOverlay.setVisible(false);
      this.featuresMenuPopupBg.setVisible(false);
      this.btnFeaturesMenuGraphics.setVisible(false);
      this.btnFeaturesMenuHit.setVisible(false);
      this.btnFeaturesMenuIcon.setVisible(false);

      if (isStacked) {
        buyX = buyW / 2 + 10;
        const blockHeight = buyH * 2 + buyGap * 2 + anteH;
        const blockStartY = safeH - blockHeight - 15;
        buyY1 = blockStartY + buyH / 2;
        buyY2 = buyY1 + buyH + buyGap;
      } else {
        buyX = gridX / 2;
        buyX = Math.max(buyX, buyW / 2 + 10);
        const blockHeight = buyH * 2 + buyGap * 2 + anteH;
        const blockStartY = gridY + (gridTotalSize - blockHeight) / 2;
        buyY1 = blockStartY + buyH / 2;
        buyY2 = buyY1 + buyH + buyGap;
      }
      anteY = buyY2 + buyH / 2 + buyGap + anteH / 2 + 10;
    }

    const showFeatures = !useFeaturesMenu || this.isFeaturesMenuOpen;
    const featuresDepthBase = (useFeaturesMenu && this.isFeaturesMenuOpen) ? 62 : 20;

    this.panelSuperGraphics.setVisible(showFeatures).setDepth(featuresDepthBase);
    this.buySuperHit.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.buySuperTxt1.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.buySuperTxt2.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    
    this.panelRegularGraphics.setVisible(showFeatures).setDepth(featuresDepthBase);
    this.buyRegularHit.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.buyRegularTxt1.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.buyRegularTxt2.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    
    this.anteBetBtn.setVisible(showFeatures).setDepth(featuresDepthBase);
    this.anteBetHit.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.anteBetTxt.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.anteBetIcon.setVisible(showFeatures).setDepth(featuresDepthBase + 1);

    if (showFeatures) {
      this.drawBuyPanel(this.panelSuperGraphics, buyW, buyH, true);
      this.buySuperHit.setPosition(buyX, buyY1).setSize(buyW, buyH);
      this.panelSuperGraphics.setPosition(buyX, buyY1);
      this.updateBuyText(this.buySuperTxt1, this.buySuperTxt2, buyX, buyY1, buyH, 'SUPER');

      this.drawBuyPanel(this.panelRegularGraphics, buyW, buyH, false);
      this.buyRegularHit.setPosition(buyX, buyY2).setSize(buyW, buyH);
      this.panelRegularGraphics.setPosition(buyX, buyY2);
      this.updateBuyText(this.buyRegularTxt1, this.buyRegularTxt2, buyX, buyY2, buyH, 'BUY');
      
      this.anteBetHit.setPosition(buyX, anteY).setSize(anteW, anteH);
      this.anteBetBtn.setPosition(buyX, anteY);
      this.drawAnteBetButton(anteW, anteH);
      this.anteBetIcon.setPosition(buyX - 40, anteY).setFontSize(22).setOrigin(0.5);
      this.anteBetTxt.setPosition(buyX - 25, anteY).setFontSize(16).setOrigin(0, 0.5);
    }

    // ==========================================
    // 3. BOTTOM BAR & HUD
    // ==========================================
    this.bottomBar.clear();
    const bb = this.bottomBar;

    bb.fillStyle(0x0a0512, 1);
    bb.fillRect(0, h - barH, w, barH);
    bb.fillStyle(0xff006a, 0.40);
    bb.fillRect(0, h - barH, w, 2);

    const txtY = h - barH / 2;
    const sidePad = isMobile ? 10 : 30;
    const labelFS = Math.max(10, barH * 0.2);
    const valFS = Math.max(13, barH * 0.28);

    // ── BALANCE (left side) ──
    const balX = sidePad;
    this.txtMoneyLabel.setPosition(balX, txtY - 8).setFontSize(labelFS).setOrigin(0, 0.5);
    this.txtMoney.setPosition(balX, txtY + 8).setFontSize(valFS).setOrigin(0, 0.5);

    // ── BET (right side on mobile, center on desktop) ──
    const betX = isStacked ? w * 0.45 : w * 0.38;
    this.txtBetLabel.setPosition(betX, txtY - 8).setFontSize(labelFS).setOrigin(0, 0.5);
    this.txtBet.setPosition(betX, txtY + 8).setFontSize(valFS).setOrigin(0, 0.5);

    // ── LAST WIN (desktop only) ──
    const winX = w * 0.62;
    if (!isStacked && !isLandscapeMobile) {
        this.txtLastWinLabel.setVisible(true).setPosition(winX, txtY - 8).setFontSize(labelFS).setOrigin(0, 0.5);
        this.txtLastWin.setVisible(true).setPosition(winX, txtY + 8).setFontSize(valFS).setOrigin(0, 0.5);
    } else {
        this.txtLastWinLabel.setVisible(false);
        this.txtLastWin.setVisible(false);
    }

    // ==========================================
    // 4. SPIN BUTTON GROUP
    // ==========================================
    const rightMargin = w - gridX - gridTotalSize;
    const rightColCenter = gridX + gridTotalSize + rightMargin / 2;
    const spinSize = isStacked ? Math.max(60, w * 0.15) : isLandscapeMobile ? Math.min(80, rightMargin * 0.5) : Math.min(120, rightMargin * 0.55);
    
    const spinX = isStacked ? w - spinSize / 2 - 10 : rightColCenter;
    const spinY = isStacked ? safeH - spinSize / 2 - 25 : safeH * 0.55;
    
    this.spinBtnHit.setPosition(spinX, spinY).setSize(spinSize, spinSize);
    this.updateSpinButtonState();

    // Auto Play
    const autoY = spinY + spinSize / 2 + 15;
    this.btnAutoHit.setPosition(spinX, autoY).setSize(80, 28);
    this.txtAuto.setPosition(spinX, autoY).setFontSize(isLandscapeMobile ? 11 : 14).setDepth(23);
    this.updateAutoSpinDisplay();

    // Bet (+/-) Buttons
    // Scale bet buttons proportionally, getting bigger on large screens
    let bBtnSize = isStacked ? Math.max(30, Math.min(50, w * 0.08)) : Math.max(40, Math.min(70, rightMargin * 0.15));
    if (!isStacked) {
        const betBtnOffset = spinSize / 2 + bBtnSize / 2 + 15; // Increased gap
        // Clamp to screen edges
        const minusX = Math.max(bBtnSize, spinX - betBtnOffset);
        const plusX = Math.min(w - bBtnSize, spinX + betBtnOffset);
        this.btnBetMinusHit.setPosition(minusX, spinY).setSize(bBtnSize * 1.5, bBtnSize * 1.5);
        this.drawBetButton(this.btnBetMinus, minusX, spinY, bBtnSize, false);
        this.btnBetPlusHit.setPosition(plusX, spinY).setSize(bBtnSize * 1.5, bBtnSize * 1.5);
        this.drawBetButton(this.btnBetPlus, plusX, spinY, bBtnSize, true);
    } else {
        const mCenter = w - 80;
        const mOffset = 50;
        this.btnBetMinusHit.setPosition(mCenter - mOffset, txtY).setSize(bBtnSize * 1.5, bBtnSize * 1.5);
        this.drawBetButton(this.btnBetMinus, mCenter - mOffset, txtY, bBtnSize, false);
        this.btnBetPlusHit.setPosition(mCenter + mOffset, txtY).setSize(bBtnSize * 1.5, bBtnSize * 1.5);
        this.drawBetButton(this.btnBetPlus, mCenter + mOffset, txtY, bBtnSize, true);
    }

    // ==========================================
    // 5. TOOLBAR ICONS (Top Left)
    // ==========================================
    this.btnSettings.setPosition(toolPad, toolY);
    this.btnPaytable.setPosition(toolPad + toolGap, toolY);
    this.soundToggle.setPosition(toolPad + toolGap * 2, toolY);
    this.btnFullscreen.setPosition(toolPad + toolGap * 3, toolY);
    this.drawToolbarIcons();

    // ==========================================
    // 6. LOGO
    // ==========================================
    // Scale logo to fit in the right column without clipping, allowing much larger sizes
    const maxLogoWidth = rightMargin * 0.95;
    const logoFS1 = isStacked ? Math.min(45, w * 0.08) : Math.max(30, Math.min(100, maxLogoWidth * 0.15));
    const logoFS2 = isStacked ? Math.min(55, w * 0.10) : Math.max(40, Math.min(120, maxLogoWidth * 0.18));
    
    // Hide logo if there's fundamentally no space for it
    if (isLandscapeMobile || logoFS1 <= 25 || rightMargin < 120 || safeH < 450) {
      this.logoText1.setVisible(false);
      this.logoText2.setVisible(false);
    } else {
      this.logoText1.setVisible(true);
      this.logoText2.setVisible(true);

      const logoX = isStacked ? w / 2 : rightColCenter; 
      const logoY = isStacked ? toolY + 10 : Math.max(toolY + 20, gridY);
      
      this.logoText1.setPosition(logoX, logoY)
                    .setFontSize(logoFS1)
                    .setStroke('#ffffff', Math.max(6, logoFS1 * 0.25));
                    
      this.logoText2.setPosition(logoX, logoY + logoFS1 * 0.9)
                    .setFontSize(logoFS2)
                    .setStroke('#ffffff', Math.max(6, logoFS2 * 0.25));

      // Logo floating animation (only add once)
      if (!this.tweens.isTweening(this.logoText1)) {
        this.tweens.add({
          targets: [this.logoText1, this.logoText2],
          y: '+=3',
          yoyo: true,
          repeat: -1,
          duration: 2500,
          ease: 'Sine.easeInOut',
        });
      }
    }

    // FS Counter
    this.txtFSRemaining.setPosition(w / 2, gridY - 30).setFontSize(Math.min(42, w * 0.08));

    if (this.stakeEngine.isReplayMode()) {
      this.replayBtnHit.setPosition(w/2, h/2).setSize(240, 70);
      this.replayBtnTxt.setPosition(w/2, h/2).setFontSize(24);
    }
  }

  /** Draw vector toolbar icons into their own graphics objects */
  private drawToolbarIcons() {
    const iconR = 20;
    const positions = [
      { obj: this.btnSettings, type: 'settings' },
      { obj: this.btnPaytable, type: 'info' },
      { obj: this.soundToggle, type: (this.musicEnabled || this.sfxEnabled) ? 'sound_on' : 'sound_off' },
      { obj: this.btnFullscreen, type: 'fullscreen' },
    ];
    for (const { obj, type } of positions) {
      if (!obj) continue;
      obj.clear();
      const cx = 0, cy = 0;
      
      const size = iconR * 2.2;
      const r = 12; // corner radius
      const half = size / 2;

      // Drop shadow
      obj.fillStyle(0x000000, 0.4);
      obj.fillRoundedRect(cx - half + 2, cy - half + 4, size, size, r);
      
      // Base dark neon purple
      obj.fillStyle(0x1a0a24, 0.95);
      obj.fillRoundedRect(cx - half, cy - half, size, size, r);
      
      // Top glass highlight
      obj.fillStyle(0xffffff, 0.08);
      obj.fillRoundedRect(cx - half + 1, cy - half + 1, size - 2, size * 0.45, {tl: r-1, tr: r-1, bl: 0, br: 0} as any);
      
      // Glow/Accent Border
      const isSoundOff = type === 'sound_off';
      obj.lineStyle(2, isSoundOff ? 0x663355 : 0xaa22ff, 0.8);
      obj.strokeRoundedRect(cx - half, cy - half, size, size, r);
      
      // Inner rim highlight
      obj.lineStyle(1.5, 0xffffff, 0.1);
      obj.strokeRoundedRect(cx - half + 2, cy - half + 2, size - 4, size - 4, r - 2);

      // Icon strokes - make them gold/white and thicker
      const iconColor = isSoundOff ? 0x998899 : 0xffdd44;
      const strokeC = isSoundOff ? 0xaaaaaa : 0xffffff;
      
      obj.lineStyle(2.5, strokeC, 1);
      const s = iconR * 0.55; 

      if (type === 'settings') {
        // High-quality gear
        obj.lineStyle(3, strokeC, 1);
        obj.strokeCircle(cx, cy, s * 0.5);
        
        // 8 gear teeth
        obj.lineStyle(3.5, strokeC, 1);
        for(let i=0; i<8; i++) {
          const a = i * Math.PI / 4;
          const innerR = s * 0.5;
          const outerR = s * 0.85;
          obj.lineBetween(
            cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR,
            cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR
          );
        }
      } else if (type === 'info') {
        // stylized 'i'
        obj.fillStyle(strokeC, 1);
        obj.fillCircle(cx, cy - s * 0.6, s * 0.2);
        obj.fillRect(cx - s*0.15, cy - s * 0.2, s*0.3, s);
        // Base serif
        obj.fillRect(cx - s*0.35, cy + s * 0.8, s*0.7, s*0.2);
      } else if (type === 'sound_on') {
        // Simple double music note
        obj.fillStyle(iconColor, 1);
        // note heads
        obj.fillCircle(cx - s * 0.4, cy + s * 0.5, s * 0.35);
        obj.fillCircle(cx + s * 0.6, cy + s * 0.2, s * 0.35);
        
        // stems
        obj.fillRect(cx - s * 0.15, cy - s * 0.4, s * 0.25, s * 0.9);
        obj.fillRect(cx + s * 0.85, cy - s * 0.7, s * 0.25, s * 0.9);
        
        // beam
        obj.beginPath();
        obj.moveTo(cx - s * 0.15, cy - s * 0.4);
        obj.lineTo(cx + s * 1.1, cy - s * 0.7);
        obj.lineTo(cx + s * 1.1, cy - s * 0.35);
        obj.lineTo(cx - s * 0.15, cy - s * 0.05);
        obj.closePath();
        obj.fillPath();
      } else if (type === 'sound_off') {
        // Muted music note
        obj.fillStyle(iconColor, 1);
        obj.fillCircle(cx - s * 0.4, cy + s * 0.5, s * 0.35);
        obj.fillCircle(cx + s * 0.6, cy + s * 0.2, s * 0.35);
        
        obj.fillRect(cx - s * 0.15, cy - s * 0.4, s * 0.25, s * 0.9);
        obj.fillRect(cx + s * 0.85, cy - s * 0.7, s * 0.25, s * 0.9);
        
        obj.beginPath();
        obj.moveTo(cx - s * 0.15, cy - s * 0.4);
        obj.lineTo(cx + s * 1.1, cy - s * 0.7);
        obj.lineTo(cx + s * 1.1, cy - s * 0.35);
        obj.lineTo(cx - s * 0.15, cy - s * 0.05);
        obj.closePath();
        obj.fillPath();
        
        // Strike through
        obj.lineStyle(3, 0xff3366, 1);
        obj.lineBetween(cx - s * 0.8, cy - s * 0.8, cx + s * 1.0, cy + s * 0.8);
      } else if (type === 'fullscreen') {
        obj.lineStyle(2.5, strokeC, 1);
        const b = s * 0.8, t = s * 0.4;
        // TL
        obj.lineBetween(cx - b, cy - b + t, cx - b, cy - b);
        obj.lineBetween(cx - b, cy - b, cx - b + t, cy - b);
        // TR
        obj.lineBetween(cx + b - t, cy - b, cx + b, cy - b);
        obj.lineBetween(cx + b, cy - b, cx + b, cy - b + t);
        // BL
        obj.lineBetween(cx - b, cy + b - t, cx - b, cy + b);
        obj.lineBetween(cx - b, cy + b, cx - b + t, cy + b);
        // BR
        obj.lineBetween(cx + b - t, cy + b, cx + b, cy + b);
        obj.lineBetween(cx + b, cy + b - t, cx + b, cy + b);
        // inner arrows
        obj.lineBetween(cx - b, cy - b, cx - b*0.3, cy - b*0.3);
        obj.lineBetween(cx + b, cy - b, cx + b*0.3, cy - b*0.3);
        obj.lineBetween(cx - b, cy + b, cx - b*0.3, cy + b*0.3);
        obj.lineBetween(cx + b, cy + b, cx + b*0.3, cy + b*0.3);
      }
    }
  }

  private updateBuyText(txt1: Phaser.GameObjects.Text, txt2: Phaser.GameObjects.Text, x: number, y: number, h: number, type: string) {
    const fsTitle = Math.min(20, h * 0.20);
    const fsSub = Math.min(28, h * 0.32);
    const title = type === 'SUPER' ? 'SUPER\nFREE SPINS' : 'BUY\nFREE SPINS';
    txt1.setText(title).setPosition(x, y - h * 0.18).setFontSize(fsTitle).setLineSpacing(-2);
    txt2.setPosition(x, y + h * 0.22).setFontSize(fsSub);
  }

  private drawBuyPanel(gfx: Phaser.GameObjects.Graphics, w: number, h: number, isSuper: boolean) {
    gfx.clear();
    const r = 16;
    const accent = isSuper ? 0xffb700 : 0xff006a;
    const accentDark = isSuper ? 0x994400 : 0x660033;
    
    // Drop shadow
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, r);
    
    // Base solid background (bottom half color)
    gfx.fillStyle(accentDark, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);

    // Top half solid color
    gfx.fillStyle(accent, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h * 0.55, {tl: r, tr: r, bl: 0, br: 0} as any);

    // Inner bright glass highlight (Top rim)
    gfx.fillStyle(0xffffff, 0.25);
    gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h * 0.15, {tl: r-2, tr: r-2, bl: 0, br: 0} as any);

    // Outer thick colored border
    gfx.lineStyle(3, accent, 1);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    
    // Extra white outer ring for pop
    gfx.lineStyle(2, 0xffffff, 0.8);
    gfx.strokeRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, r + 2);
  }

  private drawAnteBetButton(bw: number, bh: number) {
    this.anteBetBtn.clear();
    const x = -bw / 2;
    const y = -bh / 2;
    const rad = bh / 2;

    if (options.anteBetEnabled) {
      // Premium Active
      this.anteBetBtn.fillStyle(0x000000, 0.4);
      this.anteBetBtn.fillRoundedRect(x + 2, y + 4, bw, bh, rad);
      
      this.anteBetBtn.fillStyle(0x4a1800, 1);
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh, rad);
      
      this.anteBetBtn.fillStyle(0xff8800, 0.3);
      this.anteBetBtn.fillRoundedRect(x + 2, y + 2, bw - 4, bh * 0.4, {tl: rad-2, tr: rad-2, bl: 0, br: 0} as any);
      
      this.anteBetBtn.lineStyle(2, 0xffa500, 1);
      this.anteBetBtn.strokeRoundedRect(x, y, bw, bh, rad);
      
      this.anteBetBtn.lineStyle(4, 0xff8800, 0.3);
      this.anteBetBtn.strokeRoundedRect(x - 2, y - 2, bw + 4, bh + 4, rad + 2);

      this.anteBetTxt.setColor('#ffffff').setShadow(0, 2, '#000000', 0, true, true);
      this.anteBetIcon.setColor('#ffaa00').setShadow(0, 0, '#ff6600', 4, true, true);
    } else {
      // Premium Inactive
      this.anteBetBtn.fillStyle(0x000000, 0.4);
      this.anteBetBtn.fillRoundedRect(x + 2, y + 4, bw, bh, rad);
      
      this.anteBetBtn.fillStyle(0x1a1528, 1);
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh, rad);
      
      this.anteBetBtn.fillStyle(0xffffff, 0.05);
      this.anteBetBtn.fillRoundedRect(x + 2, y + 2, bw - 4, bh * 0.4, {tl: rad-2, tr: rad-2, bl: 0, br: 0} as any);

      this.anteBetBtn.lineStyle(2, 0x332244, 1);
      this.anteBetBtn.strokeRoundedRect(x, y, bw, bh, rad);

      this.anteBetTxt.setColor('#777788').setShadow(0, 0, '#000000', 0, false, false);
      // Lightning bolt icon stays orange even when inactive (matches reference)
      this.anteBetIcon.setColor('#ff6633').setShadow(0, 0, '#000', 0, false, false);
    }
  }

  private drawBetButton(gfx: Phaser.GameObjects.Graphics, targetX: number, targetY: number, size: number, isPlus: boolean) {
    gfx.clear();
    gfx.setPosition(targetX, targetY);
    const cx = 0;
    const cy = 0;
    
    // Drop shadow
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillCircle(cx, cy + 3, size / 2);
    
    // Silver outer ring
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(cx, cy, size / 2);
    gfx.fillStyle(0xcccccc, 1);
    gfx.fillCircle(cx, cy, size / 2 - 2);
    
    // Pink inner circle
    gfx.fillStyle(0xff0066, 1);
    gfx.fillCircle(cx, cy, size / 2 - 4);
    gfx.fillStyle(0xff3388, 1);
    gfx.fillCircle(cx, cy, size / 2 - 6);
    
    // Inner glass
    gfx.fillStyle(0xffffff, 0.25);
    gfx.beginPath();
    gfx.arc(cx, cy - size * 0.15, size * 0.3, Math.PI, 0, false);
    gfx.fill();

    const arm = size * 0.25;
    gfx.lineStyle(3, 0xffffff, 1);
    gfx.lineBetween(cx - arm, cy, cx + arm, cy);
    if (isPlus) gfx.lineBetween(cx, cy - arm, cx, cy + arm);
  }

  /** Update spin button visual and all UI interactivity to reflect current state */
  private updateSpinButtonState() {
    this.updateUIInteractivity();
    const spinSize = this.spinBtnHit.width;
    const iconSize = spinSize * 0.4;
    
    this.spinBtnLabel.setVisible(false);
    const gfx = this.spinBtnGraphics;
    gfx.clear();
    gfx.setPosition(this.spinBtnHit.x, this.spinBtnHit.y);
    const cx = 0;
    const cy = 0;
    const r = spinSize / 2;

    if (this.autoSpinActive) {
      // === AUTO-SPIN STOP (Red) ===
      gfx.fillStyle(0x000000, 0.4);
      gfx.fillCircle(cx, cy + 6, r);
      
      gfx.fillStyle(0x660011, 1);
      gfx.fillCircle(cx, cy, r);
      gfx.fillStyle(0x991122, 1);
      gfx.fillCircle(cx, cy, r - 3);
      gfx.fillStyle(0xdd2244, 1);
      gfx.fillCircle(cx, cy, r - 6);
      
      // Gloss
      gfx.fillStyle(0xff6688, 0.35);
      gfx.beginPath();
      gfx.arc(cx, cy - r * 0.25, r * 0.55, Math.PI, 0, false);
      gfx.fill();
      
      // White stop square
      const sq = iconSize * 0.55;
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRoundedRect(cx - sq, cy - sq, sq * 2, sq * 2, 6);
    } else if (this._spinLock) {
      // === SPINNING (Muted green) ===
      gfx.fillStyle(0x000000, 0.4);
      gfx.fillCircle(cx, cy + 6, r);
      gfx.fillStyle(0x0a4420, 1);
      gfx.fillCircle(cx, cy, r);
      gfx.fillStyle(0x1a6633, 1);
      gfx.fillCircle(cx, cy, r - 3);
      gfx.fillStyle(0x228844, 1);
      gfx.fillCircle(cx, cy, r - 6);
      
      // Loading dots
      gfx.fillStyle(0xffffff, 0.8);
      gfx.fillCircle(cx - 16, cy, 6);
      gfx.fillCircle(cx, cy, 6);
      gfx.fillCircle(cx + 16, cy, 6);
    } else {
      // === READY (Premium Play Button) ===
      gfx.fillStyle(0x000000, 0.4);
      gfx.fillCircle(cx, cy + 6, r);
      
      // Outer silver/chrome ring
      gfx.fillStyle(0xeef1f5, 1);
      gfx.fillCircle(cx, cy, r);
      gfx.fillStyle(0xbac1cd, 1);
      gfx.fillCircle(cx, cy, r - 4);
      
      // Outer pink candy ring
      gfx.fillStyle(0xff3399, 1);
      gfx.fillCircle(cx, cy, r - 7);
      
      // Deep inner shadow ring
      gfx.fillStyle(0x990044, 1);
      gfx.fillCircle(cx, cy, r - 10);
      
      // Main vibrant gradient (simulated with concentric circles)
      gfx.fillStyle(0xff1177, 1);
      gfx.fillCircle(cx, cy, r - 12);
      gfx.fillStyle(0xff4499, 1);
      gfx.fillCircle(cx, cy, r - 16);
      gfx.fillStyle(0xff77bb, 1);
      gfx.fillCircle(cx, cy, r - 22);

      // Top glass highlight (Premium Gloss)
      gfx.fillStyle(0xffffff, 0.35);
      gfx.beginPath();
      gfx.arc(cx, cy - r * 0.3, r * 0.5, Math.PI, 0, false);
      gfx.fill();

      // Bottom glass reflection
      gfx.fillStyle(0xffffff, 0.15);
      gfx.beginPath();
      gfx.arc(cx, cy + r * 0.6, r * 0.3, 0, Math.PI, false);
      gfx.fill();

      // Bold White Play Triangle
      gfx.fillStyle(0xffffff, 1);
      const s = iconSize * 1.2;
      gfx.fillTriangle(
        cx - s * 0.25, cy - s * 0.5,
        cx - s * 0.25, cy + s * 0.5,
        cx + s * 0.65, cy
      );
    }
  }

  /**
   * Centralized UI interactivity manager — dims and disables controls
   * that should not be used during certain game states.
   * 
   * Rules:
   * - During spin: bet ±, buy panels, ante bet, settings, paytable → DISABLED
   * - During free spins: bet ±, buy panels, ante bet, autoplay open → DISABLED
   * - During autoplay: bet ±, buy panels, ante bet → DISABLED
   * - Sound toggle & fullscreen → ALWAYS ENABLED
   */
  private updateUIInteractivity() {
    const spinning = this._spinLock;
    const inFS = this.fsActive;
    const inAuto = this.autoSpinActive;
    const busy = spinning || inFS || inAuto;

    // ─── Bet +/- buttons ───
    const betDisabled = busy;
    this.btnBetMinus.setAlpha(betDisabled ? 0.3 : 1);
    this.btnBetPlus.setAlpha(betDisabled ? 0.3 : 1);
    // Disable pointer events by toggling interactive
    if (betDisabled) {
      this.btnBetMinusHit.disableInteractive();
      this.btnBetPlusHit.disableInteractive();
    } else {
      this.btnBetMinusHit.setInteractive();
      this.btnBetPlusHit.setInteractive();
    }

    // ─── Buy Free Spins panels ───
    const buyDisabled = busy;
    this.panelSuperGraphics.setAlpha(buyDisabled ? 0.3 : 1);
    this.panelRegularGraphics.setAlpha(buyDisabled ? 0.3 : 1);
    this.buySuperTxt1.setAlpha(buyDisabled ? 0.3 : 1);
    this.buySuperTxt2.setAlpha(buyDisabled ? 0.3 : 1);
    this.buyRegularTxt1.setAlpha(buyDisabled ? 0.3 : 1);
    this.buyRegularTxt2.setAlpha(buyDisabled ? 0.3 : 1);
    if (buyDisabled) {
      this.buySuperHit.disableInteractive();
      this.buyRegularHit.disableInteractive();
    } else {
      this.buySuperHit.setInteractive();
      this.buyRegularHit.setInteractive();
    }

    // ─── Ante Bet toggle ───
    const anteDisabled = busy;
    this.anteBetBtn.setAlpha(anteDisabled ? 0.3 : 1);
    this.anteBetTxt.setAlpha(anteDisabled ? 0.4 : 1);
    this.anteBetIcon.setAlpha(anteDisabled ? 0.4 : 1);
    if (anteDisabled) {
      this.anteBetHit.disableInteractive();
    } else {
      this.anteBetHit.setInteractive();
    }

    // ─── Settings & Paytable ─── (disabled during active spin only)
    const menuDisabled = spinning || inFS;
    this.btnSettings.setAlpha(menuDisabled ? 0.35 : 1);
    this.btnPaytable.setAlpha(menuDisabled ? 0.35 : 1);
    if (menuDisabled) {
      this.btnSettings.disableInteractive();
      this.btnPaytable.disableInteractive();
    } else {
      this.btnSettings.setInteractive(
        new Phaser.Geom.Circle(0, 0, 22), Phaser.Geom.Circle.Contains
      );
      this.btnPaytable.setInteractive(
        new Phaser.Geom.Circle(0, 0, 22), Phaser.Geom.Circle.Contains
      );
    }

    // ─── Sound toggle & Fullscreen → ALWAYS enabled ───
    this.soundToggle.setAlpha(1);
    this.btnFullscreen.setAlpha(1);
  }

  private wireInteractions() {
    this.spinBtnHit.on('pointerdown', () => {
      this.tweens.add({ targets: this.spinBtnGraphics, scaleX: 0.9, scaleY: 0.9, yoyo: true, duration: 80 });
      this.handleUniversalAction();
    });

    this.spinBtnHit.on('pointerover', () => {
      if (!this._spinLock) this.spinBtnLabel.setColor('#ccffdd');
    });
    this.spinBtnHit.on('pointerout', () => {
      this.updateSpinButtonState();
    });

    // Auto play
    this.btnAutoHit.on('pointerdown', () => {
      if (this.fsActive || this.anyOverlayOpen()) return;
      this.audio.playSound('button');
      if (!this.autoSpinActive) {
        // Check balance before opening overlay
        const cost = this.getEffectiveBet();
        if (this.valueMoney < cost) {
          this.errorManager.showToast('INSUFFICIENT FUNDS', '#ff4466');
          return;
        }
        this.autoPlayOverlay.show();
      } else {
        this.skipScreensActive = false;
        this.stopAutoSpin();
      }
    });

    // Bet controls — open the bet overlay panel
    this.btnBetMinusHit.on('pointerdown', () => {
      if (this.anyOverlayOpen()) return;
      this.audio.playSound('button');
      this.betOverlay.syncState(this.betPresetIndex, options.anteBetEnabled, options.anteBetCostMultiplier);
      this.betOverlay.toggle();
    });
    this.btnBetPlusHit.on('pointerdown', () => {
      if (this.anyOverlayOpen()) return;
      this.audio.playSound('button');
      this.betOverlay.syncState(this.betPresetIndex, options.anteBetEnabled, options.anteBetCostMultiplier);
      this.betOverlay.toggle();
    });

    // Premium Hover states builder
    const addHover = (hit: Phaser.GameObjects.GameObject, target: any) => {
      hit.on('pointerover', () => {
        this.tweens.add({ targets: target, scaleX: 1.1, scaleY: 1.1, duration: 150, ease: 'Back.easeOut' });
      });
      hit.on('pointerout', () => {
        this.tweens.add({ targets: target, scaleX: 1.0, scaleY: 1.0, duration: 150, ease: 'Back.easeIn' });
      });
    };

    addHover(this.buySuperHit, [this.panelSuperGraphics, this.buySuperTxt1, this.buySuperTxt2]);
    addHover(this.buyRegularHit, [this.panelRegularGraphics, this.buyRegularTxt1, this.buyRegularTxt2]);
    addHover(this.anteBetHit, [this.anteBetBtn, this.anteBetTxt, this.anteBetIcon]);
    addHover(this.soundToggle, this.soundToggle);
    addHover(this.btnPaytable, this.btnPaytable);
    addHover(this.btnSettings, this.btnSettings);
    addHover(this.btnFullscreen, this.btnFullscreen);
    addHover(this.spinBtnHit, this.spinBtnGraphics);
    addHover(this.btnAutoHit, this.btnAutoGraphics);

    // Buy features (with confirmation) — also guard overlays
    this.buySuperHit.on('pointerdown', () => {
      if (this._spinLock || this.fsActive || this.anyOverlayOpen()) return;
      this.tweens.add({ targets: [this.panelSuperGraphics, this.buySuperTxt1, this.buySuperTxt2], scaleX: 0.95, scaleY: 0.95, yoyo: true, duration: 80 });
      this.requestPurchase(2, 500);
    });
    this.buyRegularHit.on('pointerdown', () => {
      if (this._spinLock || this.fsActive || this.anyOverlayOpen()) return;
      this.tweens.add({ targets: [this.panelRegularGraphics, this.buyRegularTxt1, this.buyRegularTxt2], scaleX: 0.95, scaleY: 0.95, yoyo: true, duration: 80 });
      this.requestPurchase(1, 100);
    });

    // Ante Bet toggle
    this.anteBetHit.on('pointerdown', () => {
      if (this._spinLock || this.fsActive || this.anyOverlayOpen()) return;
      options.anteBetEnabled = !options.anteBetEnabled;
      this.audio.playSound('button');
      this.drawAnteBetButton(
        this.anteBetHit.width, this.anteBetHit.height
      );
      this.updateBetDisplay();
    });

    // Sound toggle (toggles BOTH music and sfx simultaneously)
    this.soundToggle.on('pointerdown', () => {
      if (this.anyOverlayOpen()) return;
      const anyOn = this.musicEnabled || this.sfxEnabled;
      this.musicEnabled = !anyOn;
      this.sfxEnabled = !anyOn;
      this.audio.setMusicMuted(anyOn);
      this.audio.setSfxMuted(anyOn);
      this.settings.syncState(!anyOn, !anyOn);
      this.drawToolbarIcons();
      // Only play the button sound if we just turned sounds ON
      if (!anyOn) this.audio.playSound('button');
    });

    // Paytable
    this.btnPaytable.on('pointerdown', () => {
      if (this.anyOverlayOpen()) return;
      this.audio.playSound('button');
      this.paytable.toggle();
    });

    // Settings
    this.btnSettings.on('pointerdown', () => {
      if (this.anyOverlayOpen()) return;
      this.audio.playSound('button');
      this.settings.toggle();
    });

    // Fullscreen
    this.btnFullscreen.on('pointerdown', () => {
      if (this.anyOverlayOpen()) return;
      this.audio.playSound('button');
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
    this.audio.playSound('button');
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



  /** Update auto-spin button display */
  private updateAutoSpinDisplay() {
    const w = this.btnAutoHit.width;
    const h = this.btnAutoHit.height;
    const gfx = this.btnAutoGraphics;
    
    gfx.clear();
    gfx.setPosition(this.btnAutoHit.x, this.btnAutoHit.y);
    const cx = 0;
    const cy = 0;

    // Common Drop Shadow
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillRoundedRect(cx - w/2, cy - h/2 + 4, w, h, h/2);

    if (this.autoSpinActive) {
      const label = this.autoSpinRemaining > 0 ? `STOP (${this.autoSpinRemaining})` : 'STOP';
      this.txtAuto.setText(label).setColor('#ff0066').setShadow(0,0,'#000',0,false);
      
      // Active State (Bright White / Pink)
      gfx.fillStyle(0xffffff, 1);
      gfx.fillRoundedRect(cx - w/2, cy - h/2, w, h, h/2);
      
      gfx.lineStyle(3, 0xff0066, 1);
      gfx.strokeRoundedRect(cx - w/2, cy - h/2, w, h, h/2);
      
      // Gloss highlight
      gfx.fillStyle(0xffffff, 0.8);
      gfx.fillRoundedRect(cx - w/2 + 3, cy - h/2 + 2, w - 6, h/2 - 2, (h/2 - 2));
    } else {
      this.txtAuto.setText('AUTOPLAY').setColor('#ffffff').setShadow(0,2,'#000000',0,true);
      
      // Inactive State (Deep Purple / Chrome)
      gfx.fillStyle(0x2a1144, 1);
      gfx.fillRoundedRect(cx - w/2, cy - h/2, w, h, h/2);
      
      gfx.fillStyle(0x442266, 1);
      gfx.fillRoundedRect(cx - w/2 + 2, cy - h/2 + 2, w - 4, h - 4, (h/2 - 2));
      
      gfx.lineStyle(2, 0xdd99ff, 1);
      gfx.strokeRoundedRect(cx - w/2, cy - h/2, w, h, h/2);
      
      // Gloss highlight
      gfx.fillStyle(0xffffff, 0.15);
      gfx.fillRoundedRect(cx - w/2 + 3, cy - h/2 + 2, w - 6, h/2 - 2, (h/2 - 2));
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
      
      const doSummary = () => {
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
      };

      if (!this.skipScreensActive) {
        this.winCelebration.show(totalWin, betAmount, doSummary);
      } else {
        doSummary();
      }
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

      if (this.lastWin >= this.getEffectiveBet() * 2 && !this.skipScreensActive) {
        this.winCelebration.show(this.lastWin, this.getEffectiveBet(), finishUp);
      } else {
        finishUp();
      }
    };
  }

  private anyOverlayOpen(): boolean {
    return this.paytable.isVisible() || this.settings.isVisible() || this.confirmDialog.isVisible() || this.winCelebration.isVisible || this.freeSpinsIntro.isVisible || this.errorManager.isBlocking || this.autoPlayOverlay.isVisible() || this.betOverlay.isVisible();
  }

  private getEffectiveBet(): number {
    const baseBet = BET_PRESETS[this.betPresetIndex];
    return options.anteBetEnabled ? baseBet * options.anteBetCostMultiplier : baseBet;
  }
  updateMoneyDisplay() {
    this.txtMoney.setText(DisplayBalance({ amount: this.valueMoney, currency: this.currency }));
  }

  updateBetDisplay() {
    const baseBet = BET_PRESETS[this.betPresetIndex];
    const effectiveBet = this.getEffectiveBet();
    const formattedEffective = DisplayBalance({ amount: effectiveBet, currency: this.currency });
    
    if (options.anteBetEnabled) {
      const formattedBase = DisplayBalance({ amount: baseBet, currency: this.currency });
      this.txtBet.setText(`${formattedBase} (REAL COST ${formattedEffective})`).setFontSize(16);
    } else {
      this.txtBet.setText(formattedEffective).setFontSize(24);
    }
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

    const baseBet = this.getEffectiveBet();
    const formattedBase = DisplayBalance({ amount: baseBet, currency: this.currency });
    const formattedCost = DisplayBalance({ amount: cost, currency: this.currency });
    this.confirmDialog.show(
      label,
      `Bet: ${formattedBase}\nReal Cost: ${formattedCost}`,
      () => this.executePurchase(triggerType, cost),
      () => { /* cancelled */ }
    );
  }

  private async executePurchase(triggerType: number, cost: number) {
    this._spinLock = true;
    this.updateSpinButtonState();
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
      const revealEvent = stateEvents.find((e: any) => e.type === 'reveal');

      let serverGrid: number[][] | undefined;
      if (revealEvent && revealEvent.board) {
        serverGrid = this.parseRevealBoard(revealEvent.board);
      } else {
        const spinEvent = stateEvents.find((e: any) => e.type === 'spin');
        serverGrid = spinEvent?.grid || spinEvent?.data?.grid;
      }
      
      // Update balance from server response (authoritative)
      if (result.balance && !this.stakeEngine.isDemoMode()) {
        this.valueMoney = StakeEngineClient.toDisplayAmount(result.balance.amount);
        this.updateMoneyDisplay();
      }

      // Show free spins intro, then configure FS state and inject grid
      // When buying, 3-7 scatters can hit randomly — determine FS count
      const scatterCount = Phaser.Math.Between(3, 7);
      const fsAwarded = options.freeSpinsByScatter[scatterCount] || 10;

      this.freeSpinsIntro.play(fsAwarded, () => {
        // Set up free spins state AFTER the intro finishes
        this.grid.freeSpinsRemaining = fsAwarded;
        if (triggerType === 2) {
          this.grid.isSuperFreeSpins = true;
          // Super Free Spins: x2 starting multipliers on ALL grid spots
          for (let r = 0; r < options.gridSize; r++) {
            for (let c = 0; c < options.gridSize; c++) {
              (this.grid as any).multipliers[r][c] = 2;
              (this.grid as any).drawMultiplierUI(r, c);
            }
          }
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

  /**
   * Parse a 'reveal' event board from the RGS into a number[][] of symbol IDs.
   * RGS format: board[row][col] = {symbol: "L3", id: 0, reel: col, row: row}
   * Frontend needs: number[][] where each value is the symbol ID (0-7).
   */
  private parseRevealBoard(board: any[][]): number[][] {
    const size = 7;
    const grid: number[][] = [];
    for (let r = 0; r < size; r++) {
      const row: number[] = [];
      for (let c = 0; c < size; c++) {
        const cell = board?.[r]?.[c];
        if (cell && typeof cell === 'object' && typeof cell.id === 'number') {
          row.push(cell.id);
        } else if (typeof cell === 'number') {
          row.push(cell); // Already a number (demo mode)
        } else {
          row.push(0); // Fallback
        }
      }
      grid.push(row);
    }
    return grid;
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

        // RGS returns round.state as the events array from our math engine.
        // The first 'reveal' event contains the board state.
        const stateEvents = result.round?.state || [];
        const revealEvent = stateEvents.find((e: any) => e.type === 'reveal');

        let serverGrid: number[][] | undefined;
        if (revealEvent && revealEvent.board) {
          // Production RGS: board is {symbol, id, reel, row}[][]
          serverGrid = this.parseRevealBoard(revealEvent.board);
        } else {
          // Demo mode fallback: look for legacy 'spin' event with flat grid
          const spinEvent = stateEvents.find((e: any) => e.type === 'spin');
          serverGrid = spinEvent?.grid || spinEvent?.data?.grid;
        }

        // Update balance from server response (authoritative)
        if (result.balance && !this.stakeEngine.isDemoMode()) {
          this.valueMoney = StakeEngineClient.toDisplayAmount(result.balance.amount);
          this.updateMoneyDisplay();
        }

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

    // Parse reveal event (production format: {symbol, id, reel, row}[][])
    const revealEvent = stateEvents.find((e: any) => e.type === 'reveal');
    let serverGrid: number[][] | undefined;
    if (revealEvent && revealEvent.board) {
      serverGrid = this.parseRevealBoard(revealEvent.board);
    } else {
      const spinEvent = stateEvents.find((e: any) => e.type === 'spin');
      serverGrid = spinEvent?.grid || spinEvent?.data?.grid;
    }
    
    // Reset Grid context
    this._spinLock = true;
    this.updateSpinButtonState();
    this.lastWin = 0;
    this.updateLastWinDisplay();
    
    this.audio.playReels();
    this.grid.prepareSpin();
    
    // Check if free spins trigger was embedded (SDK event format)
    const fsEvent = stateEvents.find((e: any) => e.type === 'fsTrigger');
    if (fsEvent) {
       this.grid.isSuperFreeSpins = fsEvent.triggerType === 'super';
       this.grid.freeSpinsRemaining = fsEvent.totalSpins || 0;
    }

    this.grid.injectServerResult(serverGrid);
  }

  private handlePendingRound() {
    // SDK disconnect recovery flow:
    // On auth, the RGS returns any pending round in auth.round.
    // If round.active is true, we should resume from round.event (last saved event index).
    // For now, we end the round immediately — a full resume implementation
    // would replay events from the saved index onward.
    console.log('[Game] Pending round detected — ending to reconcile balance.');
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
        console.log('[Game] Server reports pending round:', state.pendingRound.betID);
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
