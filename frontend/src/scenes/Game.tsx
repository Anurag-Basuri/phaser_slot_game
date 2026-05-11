import Phaser from 'phaser';

import {
  Grid,
  Audio,
  PaytableOverlay,
  SettingsOverlay,
  WinCelebration,
  ConfirmDialog,
  FreeSpinsIntro,
  ErrorManager,
  AutoPlayOverlay,
  BetOverlay,
  BottomBarHUD,
  SpinControls,
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
  bottomBarHUD!: BottomBarHUD;
  spinControls!: SpinControls;

  private stakeEngine!: StakeEngineClient;
  private skipScreensActive = false;

  // UI elements
  private bgImage!: Phaser.GameObjects.Image;
  private gridPanel!: Phaser.GameObjects.Image;
  private logoWrapper!: Phaser.GameObjects.Container;
  private logoContainer!: Phaser.GameObjects.Container;
  private logoText1!: Phaser.GameObjects.Text;
  private logoText2!: Phaser.GameObjects.Text;
  private logoGlow!: Phaser.GameObjects.Graphics;
  private gridFrame!: Phaser.GameObjects.Graphics;
  private panelSuperGraphics!: Phaser.GameObjects.Graphics;
  private panelRegularGraphics!: Phaser.GameObjects.Graphics;

  private txtFSRemaining!: Phaser.GameObjects.Text;
  private buySuperHit!: Phaser.GameObjects.Rectangle;
  private buyRegularHit!: Phaser.GameObjects.Rectangle;
  private buySuperTxt1!: Phaser.GameObjects.Text;
  private buySuperTxt2!: Phaser.GameObjects.Text;
  private buyRegularTxt1!: Phaser.GameObjects.Text;
  private buyRegularTxt2!: Phaser.GameObjects.Text;
  private soundToggle!: Phaser.GameObjects.Graphics;
  private iconSound!: Phaser.GameObjects.Image;
  private btnPaytable!: Phaser.GameObjects.Graphics;
  private iconPaytable!: Phaser.GameObjects.Image;
  private btnSettings!: Phaser.GameObjects.Graphics;
  private iconSettings!: Phaser.GameObjects.Image;
  private btnFullscreen!: Phaser.GameObjects.Graphics;
  private iconFullscreen!: Phaser.GameObjects.Image;
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
          async () => {
            throw new Error('Replay invalid');
          },
          () => window.location.reload(),
        );
        return;
      }
    } else if (!this.stakeEngine.isDemoMode()) {
      try {
        const auth = await this.stakeEngine.authenticate();
        this.valueMoney = StakeEngineClient.toDisplayAmount(
          auth.balance.amount,
        );
        this.currency = auth.balance.currency;

        if (
          auth.config &&
          auth.config.betLevels &&
          auth.config.betLevels.length > 0
        ) {
          BET_PRESETS.length = 0;
          for (let i = 0; i < auth.config.betLevels.length; i++) {
            BET_PRESETS.push(
              StakeEngineClient.toDisplayAmount(auth.config.betLevels[i]),
            );
          }
          const defaultDisplay = StakeEngineClient.toDisplayAmount(
            auth.config.defaultBetLevel,
          );
          this.betPresetIndex = BET_PRESETS.indexOf(defaultDisplay);
          if (this.betPresetIndex === -1) this.betPresetIndex = 0;
          options.betAmount = BET_PRESETS[this.betPresetIndex];
        }

        if (auth.round) {
          this.handlePendingRound(auth.round);
        }
      } catch (err) {
        console.error('[Game] Auth failed:', err);
        const isAuthError = err instanceof StakeError && err.code === 'AUTH';
        if (isAuthError) {
          // Unrecoverable — session is invalid, must relaunch
          this.errorManager.showBlockingError(
            'SESSION EXPIRED',
            async () => {
              throw new Error('Session expired — cannot retry');
            },
            () => window.location.reload(),
          );
        } else {
          // Network error — allow retry
          this.errorManager.showBlockingError('CONNECTION FAILED', () =>
            this.resyncAfterError(),
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

    // === LOGO (Premium Sugar Blast 1000) ===
    this.logoWrapper = this.add.container(0, 0).setDepth(30);
    this.logoContainer = this.add.container(0, 0);
    this.logoWrapper.add(this.logoContainer);

    // Candy banner/ribbon behind the logo text
    const logoBanner = this.add.graphics();
    // Main ribbon body (candy pink)
    logoBanner.fillGradientStyle(0xff2277, 0xff0066, 0xcc0055, 0xaa0044, 1);
    logoBanner.fillRoundedRect(-190, -52, 380, 58, 12);
    // Ribbon fold left
    logoBanner.fillStyle(0x880033, 1);
    logoBanner.fillTriangle(-190, -52, -210, -42, -190, -32);
    logoBanner.fillTriangle(-190, 6, -210, -4, -190, -14);
    // Ribbon fold right
    logoBanner.fillTriangle(190, -52, 210, -42, 190, -32);
    logoBanner.fillTriangle(190, 6, 210, -4, 190, -14);
    // Ribbon gloss highlight
    logoBanner.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.3, 0.3, 0, 0);
    logoBanner.fillRoundedRect(-188, -50, 376, 22, { tl: 10, tr: 10, bl: 0, br: 0 } as any);
    // Gold trim on ribbon edges
    logoBanner.lineStyle(2, 0xffcc44, 0.8);
    logoBanner.strokeRoundedRect(-190, -52, 380, 58, 12);

    // Apply premium styling with gradient and thick border with shadow
    this.logoText1 = this.add
      .text(0, -22, 'SUGAR BLAST', {
        fontFamily: '"Lilita One", "Luckiest Guy", cursive, sans-serif',
        fontSize: '46px',
        fontStyle: 'normal',
        color: '#ffffff',
        stroke: '#ffffff',
        strokeThickness: 22,
      })
      .setOrigin(0.5, 0.5)
      .setShadow(0, 12, '#660022', 0, true, false);

    this.logoText1.updateText();
    const gradient1 = this.logoText1.context.createLinearGradient(0, 0, 0, this.logoText1.height);
    gradient1.addColorStop(0, '#ffffff');
    gradient1.addColorStop(0.25, '#ffaacc');
    gradient1.addColorStop(0.55, '#ff3388');
    gradient1.addColorStop(0.8, '#dd0055');
    gradient1.addColorStop(1, '#880033');
    this.logoText1.setFill(gradient1);

    // "1000" - golden candy number with a candy-drip shadow
    this.logoText2 = this.add
      .text(0, 36, '1000', {
        fontFamily: '"Slackey", "Chango", "Comic Sans MS", "Impact", sans-serif',
        fontSize: '62px',
        fontStyle: 'normal',
        color: '#ffffff',
        stroke: '#ffffff',
        strokeThickness: 22,
      })
      .setOrigin(0.5, 0.5)
      .setShadow(0, 12, '#774400', 0, true, false);

    this.logoText2.updateText();
    const gradient2 = this.logoText2.context.createLinearGradient(0, 0, 0, this.logoText2.height);
    gradient2.addColorStop(0, '#ffffff');
    gradient2.addColorStop(0.2, '#ffee88');
    gradient2.addColorStop(0.5, '#ffcc00');
    gradient2.addColorStop(0.8, '#ee8800');
    gradient2.addColorStop(1, '#aa5500');
    this.logoText2.setFill(gradient2);

    this.logoContainer.add([logoBanner, this.logoText1, this.logoText2]);

    // Buy buttons setup
    const btnStyle = {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontStyle: 'normal',
      align: 'center',
      strokeThickness: 0,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 0, fill: true },
    };

    // Super Buy
    this.panelSuperGraphics = this.add.graphics({ x: 0, y: 0 }).setDepth(20);
    this.buySuperHit = this.add
      .rectangle(0, 0, 100, 50, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(21);
    this.buySuperTxt1 = this.add
      .text(0, 0, 'SUPER', { ...btnStyle, color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(21);
    this.buySuperTxt2 = this.add
      .text(0, 0, '500X', {
        ...btnStyle,
        color: '#ffe600',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(21);

    // Regular Buy
    this.panelRegularGraphics = this.add.graphics({ x: 0, y: 0 }).setDepth(20);
    this.buyRegularHit = this.add
      .rectangle(0, 0, 100, 50, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(21);
    this.buyRegularTxt1 = this.add
      .text(0, 0, T('BUY', this.stakeEngine.isSocialMode()), {
        ...btnStyle,
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(21);
    this.buyRegularTxt2 = this.add
      .text(0, 0, '1000X', {
        ...btnStyle,
        color: '#ffe600',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(21);

    // Ante bet setup
    this.anteBetBtn = this.add.graphics().setDepth(20);
    this.anteBetHit = this.add
      .rectangle(0, 0, 100, 30, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(21);
    this.anteBetIcon = this.add
      .text(0, 0, '⚡', { fontFamily: '"Outfit", sans-serif' })
      .setOrigin(0.5)
      .setDepth(21);
    this.anteBetTxt = this.add
      .text(0, 0, T('ANTE BET', this.stakeEngine.isSocialMode()), {
        fontFamily: '"Inter", "Arial", sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)
      .setDepth(21);

    // Features Menu UI (for small screens)
    this.featuresMenuHitOverlay = this.add
      .rectangle(0, 0, w, h, 0x000000, 0.5)
      .setInteractive()
      .setDepth(60)
      .setVisible(false)
      .on('pointerdown', () => {
        this.isFeaturesMenuOpen = false;
        this.layoutAll();
      });

    this.featuresMenuPopupBg = this.add
      .graphics()
      .setDepth(61)
      .setVisible(false);

    this.btnFeaturesMenuGraphics = this.add.graphics().setDepth(20);
    this.btnFeaturesMenuHit = this.add
      .rectangle(0, 0, 50, 50, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(21)
      .on('pointerdown', () => {
        this.isFeaturesMenuOpen = !this.isFeaturesMenuOpen;
        this.layoutAll();
        this.audio.playSound('button');
      });
    this.btnFeaturesMenuIcon = this.add
      .text(0, 0, '⋮', {
        fontSize: '32px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);

    // === BOTTOM BAR & SPIN CONTROLS (created by new component classes) ===
    // BottomBarHUD and SpinControls are instantiated after overlays below

    // === FREE SPINS COUNTER ===
    this.txtFSRemaining = this.add
      .text(0, 0, '', {
        fontSize: '36px',
        color: '#ffffff',
        align: 'center',
        fontStyle: 'bold',
        fontFamily: '"Luckiest Guy", cursive, sans-serif',
        stroke: '#cc00ff',
        strokeThickness: 6,
        shadow: {
          offsetX: 0,
          offsetY: 3,
          color: '#8800cc',
          blur: 12,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth(20);

    // === TOOLBAR (Graphics-drawn icons instead of emoji) ===
    this.soundToggle = this.add.graphics().setDepth(50);
    this.btnPaytable = this.add.graphics().setDepth(50);
    this.btnSettings = this.add.graphics().setDepth(50);
    this.btnFullscreen = this.add.graphics().setDepth(50);
    this.iconSound = this.add
      .image(0, 0, 'icon_sound')
      .setDepth(51)
      .setOrigin(0.5);
    this.iconPaytable = this.add
      .image(0, 0, 'icon_info')
      .setDepth(51)
      .setOrigin(0.5);
    this.iconSettings = this.add
      .image(0, 0, 'icon_settings')
      .setDepth(51)
      .setOrigin(0.5);
    this.iconFullscreen = this.add
      .image(0, 0, 'icon_fullscreen')
      .setDepth(51)
      .setOrigin(0.5);
    // Make hit areas interactive
    [
      this.soundToggle,
      this.btnPaytable,
      this.btnSettings,
      this.btnFullscreen,
    ].forEach((btn) => {
      btn.setInteractive(
        new Phaser.Geom.Circle(0, 0, 24),
        Phaser.Geom.Circle.Contains,
      );
      (btn as any).input!.cursor = 'pointer';
    });

    // === OVERLAYS ===
    this.paytable = new PaytableOverlay(this);
    this.settings = new SettingsOverlay(this);
    this.autoPlayOverlay = new AutoPlayOverlay(this);
    this.betOverlay = new BetOverlay(this);
    this.bottomBarHUD = new BottomBarHUD(this);
    this.spinControls = new SpinControls(this);

    // Spin controls event wiring is handled centrally in wireInteractions()
    // to avoid double-binding. Only non-spin callbacks are wired here.
    this.bottomBarHUD.onBetTap(() => {
      if (this._spinLock || this.fsActive || this.anyOverlayOpen()) return;
      this.audio.playSound('button');
      this.betOverlay.syncState(
        this.betPresetIndex,
        options.anteBetEnabled,
        options.anteBetCostMultiplier,
      );
      this.betOverlay.toggle();
    });

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

      this.spinControls.hideAll();
      this.bottomBarHUD.hideAll();

      this.logoWrapper.setVisible(false);

      // spin controls already hidden above

      this.replayBtnHit = this.add
        .rectangle(0, 0, 240, 70, 0xff006a)
        .setStrokeStyle(3, 0xffffff, 1)
        .setInteractive({ useHandCursor: true })
        .setDepth(55)
        .on('pointerdown', () => this.executeReplay());
      this.replayBtnTxt = this.add
        .text(0, 0, '▶ START REPLAY', {
          fontSize: '24px',
          fontFamily: '"Luckiest Guy", cursive, sans-serif',
          color: '#fff',
        })
        .setOrigin(0.5)
        .setDepth(56);
    }
  }

  /** Proportional layout engine — handles all responsive modes */
  private layoutAll() {
    const w = this.scale.width;
    const h = this.scale.height;

    // === BACKGROUND ===
    const bgScaleX = w / this.bgImage.width;
    const bgScaleY = h / this.bgImage.height;
    this.bgImage
      .setPosition(w / 2, h / 2)
      .setScale(Math.max(bgScaleX, bgScaleY))
      .setVisible(true);

    // Determine layout mode
    const isPortrait = h > w;
    const isMobile = w < 768;
    const isStacked = isPortrait || w < 650;
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
      gridTotalSize = Math.min(w * 0.5, safeH * 0.88);
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

    // === PREMIUM CANDY MACHINE GRID FRAME ===
    this.gridFrame.clear();
    const f = this.gridFrame;

    const borderThickness = Math.max(10, gridTotalSize * 0.022);
    const framePadding = borderThickness + 4;
    const frameW = gridTotalSize + framePadding * 2;
    const frameH = gridTotalSize + framePadding * 2;
    const frameX = gridX - framePadding;
    const frameY = gridY - framePadding;
    const frameR = Math.max(16, gridTotalSize * 0.03);

    // --- Layer 1: Deep outer shadow ---
    f.fillStyle(0x000000, 0.45);
    f.fillRoundedRect(frameX + 4, frameY + 6, frameW, frameH, frameR + 2);

    // --- Layer 2: Thick glossy plastic rim (outer ring) ---
    // Bottom half (darker) for 3D depth
    f.fillGradientStyle(0xdd5599, 0xdd5599, 0x881144, 0x881144, 1);
    f.fillRoundedRect(frameX, frameY, frameW, frameH, frameR);

    // Top half highlight overlay (lighter plastic shine)
    f.fillGradientStyle(0xff88bb, 0xffaacc, 0xdd5599, 0xdd5599, 1);
    f.fillRoundedRect(frameX, frameY, frameW, frameH * 0.5, { tl: frameR, tr: frameR, bl: 0, br: 0 } as any);

    // Glass sheen on top edge of rim
    f.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.5, 0.5, 0, 0);
    f.fillRoundedRect(frameX + 4, frameY + 2, frameW - 8, borderThickness * 0.6, { tl: frameR - 2, tr: frameR - 2, bl: 0, br: 0 } as any);

    // --- Layer 3: Inner recess (dark well holding the grid) ---
    const innerX = frameX + borderThickness;
    const innerY = frameY + borderThickness;
    const innerW = frameW - borderThickness * 2;
    const innerH = frameH - borderThickness * 2;
    const innerR = Math.max(8, frameR - 4);

    // Dark inset shadow to create depth
    f.fillStyle(0x050208, 0.9);
    f.fillRoundedRect(innerX - 2, innerY - 2, innerW + 4, innerH + 4, innerR + 2);

    // Frosted dark purple plate behind symbols
    f.fillGradientStyle(0x1a0a28, 0x1a0a28, 0x0d0515, 0x0d0515, 0.75);
    f.fillRoundedRect(innerX, innerY, innerW, innerH, innerR);

    // Inner border for definition
    f.lineStyle(1.5, 0xff006a, 0.35);
    f.strokeRoundedRect(innerX, innerY, innerW, innerH, innerR);

    // --- Layer 4: Outer rim border & highlight ---
    f.lineStyle(2, 0xffccdd, 0.7);
    f.strokeRoundedRect(frameX, frameY, frameW, frameH, frameR);
    f.lineStyle(1, 0xffffff, 0.2);
    f.strokeRoundedRect(frameX + 1, frameY + 1, frameW - 2, frameH - 2, frameR - 1);

    // --- Layer 5: Glass glare diagonal across the grid ---
    f.beginPath();
    const glareW = gridTotalSize * 0.15;
    f.moveTo(gridX + gridTotalSize * 0.05, gridY);
    f.lineTo(gridX + gridTotalSize * 0.05 + glareW, gridY);
    f.lineTo(gridX, gridY + gridTotalSize * 0.3);
    f.lineTo(gridX, gridY + gridTotalSize * 0.15);
    f.closePath();
    f.fillStyle(0xffffff, 0.08);
    f.fillPath();

    // --- Layer 6: Decorative candy-bolt corner accents ---
    const boltR = Math.max(5, gridTotalSize * 0.012);
    const boltInset = borderThickness * 0.55;
    const boltPositions = [
      { x: frameX + boltInset, y: frameY + boltInset },
      { x: frameX + frameW - boltInset, y: frameY + boltInset },
      { x: frameX + boltInset, y: frameY + frameH - boltInset },
      { x: frameX + frameW - boltInset, y: frameY + frameH - boltInset },
    ];
    for (const bp of boltPositions) {
      // Bolt shadow
      f.fillStyle(0x000000, 0.4);
      f.fillCircle(bp.x + 1, bp.y + 2, boltR);
      // Bolt body — silver gradient
      f.fillGradientStyle(0xdddddd, 0xeeeeee, 0x999999, 0xaaaaaa, 1);
      f.fillCircle(bp.x, bp.y, boltR);
      // Bolt highlight
      f.fillStyle(0xffffff, 0.6);
      f.fillCircle(bp.x - boltR * 0.25, bp.y - boltR * 0.25, boltR * 0.4);
      // Bolt rim
      f.lineStyle(1, 0x777777, 0.5);
      f.strokeCircle(bp.x, bp.y, boltR);
    }

    // ==========================================
    // 2. BUY PANELS & ANTE BET
    // ==========================================
    const availableWidthForFeatures = gridX;
    const availableHeightForFeatures = safeH - (gridY + gridTotalSize);

    const useFeaturesMenu =
      isLandscapeMobile ||
      (isStacked && availableHeightForFeatures < 170) ||
      (!isStacked && availableWidthForFeatures < 160);

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
      // Glassmorphic toggle pill
      this.btnFeaturesMenuGraphics.fillStyle(0x000000, 0.5);
      this.btnFeaturesMenuGraphics.fillRoundedRect(
        toggleX - 22,
        toggleY - 22 + 3,
        44,
        44,
        14,
      );
      this.btnFeaturesMenuGraphics.fillGradientStyle(
        0xff006a,
        0xff006a,
        0x880033,
        0x880033,
        1,
      );
      this.btnFeaturesMenuGraphics.fillRoundedRect(
        toggleX - 22,
        toggleY - 22,
        44,
        44,
        14,
      );
      this.btnFeaturesMenuGraphics.fillGradientStyle(
        0xffffff,
        0xffffff,
        0xffffff,
        0xffffff,
        0.3,
        0.3,
        0,
        0,
      );
      this.btnFeaturesMenuGraphics.fillRoundedRect(
        toggleX - 20,
        toggleY - 20,
        40,
        18,
        { tl: 12, tr: 12, bl: 0, br: 0 } as any,
      );
      this.btnFeaturesMenuGraphics.lineStyle(2, 0xffffff, 0.6);
      this.btnFeaturesMenuGraphics.strokeRoundedRect(
        toggleX - 22,
        toggleY - 22,
        44,
        44,
        14,
      );
      this.btnFeaturesMenuIcon.setPosition(toggleX, toggleY);

      if (this.isFeaturesMenuOpen) {
        // Position inside popup
        this.featuresMenuHitOverlay
          .setVisible(true)
          .setPosition(w / 2, h / 2)
          .setSize(w, h);
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

        // Premium popup backdrop
        this.featuresMenuPopupBg.fillStyle(0x000000, 0.6);
        this.featuresMenuPopupBg.fillRoundedRect(
          popupX - popupW / 2 + 4,
          popupY - popupH / 2 + 6,
          popupW,
          popupH,
          22,
        );
        this.featuresMenuPopupBg.fillGradientStyle(
          0x1a0a24,
          0x1a0a24,
          0x0d0512,
          0x0d0512,
          0.98,
        );
        this.featuresMenuPopupBg.fillRoundedRect(
          popupX - popupW / 2,
          popupY - popupH / 2,
          popupW,
          popupH,
          20,
        );
        this.featuresMenuPopupBg.lineStyle(2, 0xff006a, 0.8);
        this.featuresMenuPopupBg.strokeRoundedRect(
          popupX - popupW / 2,
          popupY - popupH / 2,
          popupW,
          popupH,
          20,
        );
        this.featuresMenuPopupBg.lineStyle(1, 0xffffff, 0.15);
        this.featuresMenuPopupBg.strokeRoundedRect(
          popupX - popupW / 2 + 2,
          popupY - popupH / 2 + 2,
          popupW - 4,
          popupH - 4,
          18,
        );

        buyX = popupX;
        buyY1 = popupY - popupH / 2 + 20 + buyH / 2;
        buyY2 = buyY1 + buyH + buyGap;
        anteY = buyY2 + buyH / 2 + buyGap + anteH / 2;
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
    const featuresDepthBase =
      useFeaturesMenu && this.isFeaturesMenuOpen ? 62 : 20;

    this.panelSuperGraphics
      .setVisible(showFeatures)
      .setDepth(featuresDepthBase);
    this.buySuperHit.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.buySuperTxt1.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.buySuperTxt2.setVisible(showFeatures).setDepth(featuresDepthBase + 1);

    this.panelRegularGraphics
      .setVisible(showFeatures)
      .setDepth(featuresDepthBase);
    this.buyRegularHit.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.buyRegularTxt1
      .setVisible(showFeatures)
      .setDepth(featuresDepthBase + 1);
    this.buyRegularTxt2
      .setVisible(showFeatures)
      .setDepth(featuresDepthBase + 1);

    this.anteBetBtn.setVisible(showFeatures).setDepth(featuresDepthBase);
    this.anteBetHit.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.anteBetTxt.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.anteBetIcon.setVisible(showFeatures).setDepth(featuresDepthBase + 1);

    if (showFeatures) {
      this.drawBuyPanel(this.panelSuperGraphics, buyW, buyH, true);
      this.buySuperHit.setPosition(buyX, buyY1).setSize(buyW, buyH);
      this.panelSuperGraphics.setPosition(buyX, buyY1);
      this.updateBuyText(
        this.buySuperTxt1,
        this.buySuperTxt2,
        buyX,
        buyY1,
        buyH,
        'SUPER',
      );

      this.drawBuyPanel(this.panelRegularGraphics, buyW, buyH, false);
      this.buyRegularHit.setPosition(buyX, buyY2).setSize(buyW, buyH);
      this.panelRegularGraphics.setPosition(buyX, buyY2);
      this.updateBuyText(
        this.buyRegularTxt1,
        this.buyRegularTxt2,
        buyX,
        buyY2,
        buyH,
        'BUY',
      );

      this.anteBetHit.setPosition(buyX, anteY).setSize(anteW, anteH);
      this.anteBetBtn.setPosition(buyX, anteY);
      this.drawAnteBetButton(anteW, anteH);
      this.anteBetIcon
        .setPosition(buyX - 40, anteY)
        .setFontSize(22)
        .setOrigin(0.5);
      this.anteBetTxt
        .setPosition(buyX - 25, anteY)
        .setFontSize(16)
        .setOrigin(0, 0.5);
    }

    // ==========================================
    // 3. BOTTOM BAR & HUD (delegated to BottomBarHUD)
    // ==========================================
    this.bottomBarHUD.layout(w, h, barH, isStacked, isMobile);

    // ==========================================
    // 4. SPIN BUTTON GROUP (delegated to SpinControls)
    // ==========================================
    const { spinX, spinY, spinSize } = this.spinControls.layout(
      w,
      h,
      gridX,
      gridY,
      gridTotalSize,
      barH,
      isStacked,
      isLandscapeMobile,
    );
    this.updateSpinButtonState();
    this.updateAutoSpinDisplay();

    // ==========================================
    // 5. TOOLBAR ICONS (Top Left)
    // ==========================================
    this.btnSettings.setPosition(toolPad, toolY);
    this.btnPaytable.setPosition(toolPad + toolGap, toolY);
    this.soundToggle.setPosition(toolPad + toolGap * 2, toolY);
    this.btnFullscreen.setPosition(toolPad + toolGap * 3, toolY);

    // Reposition icon images on top of their parent toolbar buttons
    const targetSize = isMobile ? 20 : 24;
    [
      this.iconSettings,
      this.iconPaytable,
      this.iconSound,
      this.iconFullscreen,
    ].forEach((icon, i) => {
      icon
        .setPosition(toolPad + toolGap * i, toolY)
        .setDisplaySize(targetSize, targetSize);
      (icon as any)._baseScaleX = icon.scaleX;
      (icon as any)._baseScaleY = icon.scaleY;
    });
    this.drawToolbarIcons();

    // Recalculate margins for logo placement
    const rightMargin = w - gridX - gridTotalSize;
    const rightColCenter = gridX + gridTotalSize + rightMargin / 2;
    // ==========================================
    // 6. LOGO — responsive placement with premium glow
    // ==========================================
    // Increased base width to 460 to account for thick fonts and stroke, preventing overlap
    const LOGO_BASE_W = 460;
    const LOGO_BASE_H = 150;
    const MAX_LOGO_SCALE = 1.1; // Slightly reduced max scale
    const MIN_LOGO_SCALE = 0.35; // Hide if space requires scaling smaller than this

    let logoScale = 1;
    let logoX = 0;
    let logoY = 0;
    let showLogo = false;

    if (isStacked) {
      // Portrait: above the grid
      const availW = w * 0.9;
      const availH = gridY - 10;
      
      if (availH > 40) {
        const scaleW = availW / LOGO_BASE_W;
        const scaleH = availH / LOGO_BASE_H;
        logoScale = Math.min(scaleW, scaleH, MAX_LOGO_SCALE);
        
        if (logoScale >= MIN_LOGO_SCALE) {
          showLogo = true;
          logoX = w / 2;
          logoY = (gridY / 2) + 5; // Center vertically in top space
        }
      }
    } else if (isLandscapeMobile || rightMargin < 140) {
      // Tight landscape: above the grid
      const availW = w * 0.5;
      const availH = gridY - 5;

      if (availH > 30) {
        const scaleW = availW / LOGO_BASE_W;
        const scaleH = availH / LOGO_BASE_H;
        logoScale = Math.min(scaleW, scaleH, MAX_LOGO_SCALE);
        
        if (logoScale >= MIN_LOGO_SCALE) {
          showLogo = true;
          logoX = w / 2;
          logoY = gridY / 2;
        }
      }
    } else {
      // Desktop: right column between top of grid and spin button
      const availW = rightMargin * 0.9;
      const logoRegionTop = gridY;
      const logoRegionBot = spinY - spinSize / 2 - 20;
      const availH = logoRegionBot - logoRegionTop;

      if (availW > 100 && availH > 80) {
        const scaleW = availW / LOGO_BASE_W;
        const scaleH = availH / LOGO_BASE_H;
        logoScale = Math.min(scaleW, scaleH, MAX_LOGO_SCALE);

        if (logoScale >= MIN_LOGO_SCALE) {
          showLogo = true;
          // Fix to the right wall (with 20px padding) to maximize distance from the grid
          const actualLogoWidth = LOGO_BASE_W * logoScale;
          logoX = w - (actualLogoWidth / 2) - 20;
          logoY = logoRegionTop + availH * 0.25; 
        }
      }
    }

    if (showLogo) {
      this.logoWrapper.setVisible(true).setPosition(logoX, logoY).setScale(logoScale);
    } else {
      this.logoWrapper.setVisible(false);
    }

    // FS Counter
    this.txtFSRemaining
      .setPosition(w / 2, gridY - 30)
      .setFontSize(Math.min(42, w * 0.08));

    if (this.stakeEngine.isReplayMode()) {
      this.replayBtnHit.setPosition(w / 2, h / 2).setSize(240, 70);
      this.replayBtnTxt.setPosition(w / 2, h / 2).setFontSize(24);
    }
  }

  /** Draw glossy candy-arcade toolbar icons */
  private drawToolbarIcons() {
    const isMobile = this.scale.width < 768;
    const iconR = isMobile ? 16 : 20;
    const positions = [
      { obj: this.btnSettings, icon: this.iconSettings, type: 'settings' },
      { obj: this.btnPaytable, icon: this.iconPaytable, type: 'info' },
      {
        obj: this.soundToggle,
        icon: this.iconSound,
        type: this.musicEnabled || this.sfxEnabled ? 'sound_on' : 'sound_off',
      },
      {
        obj: this.btnFullscreen,
        icon: this.iconFullscreen,
        type: 'fullscreen',
      },
    ];
    for (const { obj, icon, type } of positions) {
      if (!obj) continue;
      obj.clear();
      const cx = 0,
        cy = 0;
      const radius = iconR + 2;
      const isSoundOff = type === 'sound_off';
      const accentColor = isSoundOff ? 0x553344 : 0xff006a;
      const rimColor = isSoundOff ? 0x664455 : 0xdd5599;

      // Drop shadow
      obj.fillStyle(0x000000, 0.5);
      obj.fillCircle(cx, cy + 3, radius + 3);

      // Thick colored candy rim (outer ring)
      obj.fillGradientStyle(rimColor, rimColor, isSoundOff ? 0x332233 : 0x881144, isSoundOff ? 0x332233 : 0x881144, 1);
      obj.fillCircle(cx, cy, radius + 3);

      // Glass sheen on rim top half
      obj.beginPath();
      obj.arc(cx, cy, radius + 3, Math.PI, 0, false);
      obj.closePath();
      obj.fillStyle(0xffffff, 0.25);
      obj.fillPath();

      // Inner dark circle (the button face)
      obj.fillGradientStyle(0x1a0a2e, 0x1a0a2e, 0x0d0518, 0x0d0518, 1);
      obj.fillCircle(cx, cy, radius);

      // Glass top hemisphere highlight on inner face
      obj.beginPath();
      obj.arc(cx, cy, radius, Math.PI, 0, false);
      obj.closePath();
      obj.fillStyle(0xffffff, 0.15);
      obj.fillPath();

      // Accent inner ring (pressed recess)
      obj.lineStyle(1.5, accentColor, isSoundOff ? 0.3 : 0.7);
      obj.strokeCircle(cx, cy, radius);

      // Subtle inner rim for depth
      obj.lineStyle(0.5, 0xffffff, 0.1);
      obj.strokeCircle(cx, cy, radius - 2);

      // Outer rim highlight
      obj.lineStyle(1, 0xffffff, 0.2);
      obj.strokeCircle(cx, cy, radius + 3);

      // Update icon state
      if (icon) {
        icon.setAlpha(isSoundOff ? 0.4 : 0.9);
      }
      if (type === 'sound_on' && this.iconSound)
        this.iconSound.setTexture('icon_sound');
      if (type === 'sound_off' && this.iconSound)
        this.iconSound.setTexture('icon_sound_off');
    }
  }

  private updateBuyText(
    txt1: Phaser.GameObjects.Text,
    txt2: Phaser.GameObjects.Text,
    x: number,
    y: number,
    h: number,
    type: string,
  ) {
    const fsTitle = Math.min(16, h * 0.20);
    const fsSub = Math.min(30, h * 0.36);
    const title = type === 'SUPER' ? 'SUPER\nFREE SPINS' : 'BUY\nFREE SPINS';
    txt1
      .setText(title)
      .setPosition(x, y - h * 0.15)
      .setFontSize(fsTitle)
      .setFontFamily('"Lilita One", "Luckiest Guy", cursive, sans-serif')
      .setLineSpacing(-2);
    txt1.setColor('#ffffff').setStroke('#000000', 3).setShadow(0, 2, '#000000', 4, true, true);
    txt2.setPosition(x, y + h * 0.28).setFontSize(fsSub);
    txt2
      .setFontFamily('"Lilita One", "Luckiest Guy", cursive, sans-serif')
      .setColor('#ffe600')
      .setStroke('#000000', 6)
      .setShadow(0, 3, '#000000', 0, true, true);
  }

  private drawBuyPanel(
    gfx: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    isSuper: boolean,
  ) {
    gfx.clear();
    const r = Math.min(h / 2, 28); // Pill-shaped: heavily rounded corners
    const accentTop = isSuper ? 0xffdd44 : 0xff4499;
    const accentBot = isSuper ? 0xcc7700 : 0xbb0044;
    const accentMid = isSuper ? 0xffaa00 : 0xff0066;

    // Outer soft glow
    gfx.fillStyle(accentMid, 0.18);
    gfx.fillRoundedRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, r + 4);

    // Drop shadow
    gfx.fillStyle(0x000000, 0.5);
    gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, r);

    // Main body gradient (vibrant candy)
    gfx.fillGradientStyle(accentTop, accentTop, accentBot, accentBot, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);

    // Curved glass hemisphere reflection on top half
    gfx.fillGradientStyle(
      0xffffff, 0xffffff, 0xffffff, 0xffffff,
      0.55, 0.55, 0.05, 0.05,
    );
    gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 2, w - 6, h * 0.4, {
      tl: r - 2, tr: r - 2, bl: 0, br: 0,
    } as any);

    // Bottom darkened recess for 3D depth
    gfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.3, 0.3);
    gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + h * 0.65, w - 4, h * 0.35 - 2, {
      tl: 0, tr: 0, bl: r - 2, br: r - 2,
    } as any);

    // Accent border
    gfx.lineStyle(2.5, accentMid, 0.9);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

    // Outer bright rim (candy shell edge)
    gfx.lineStyle(1.5, 0xffffff, 0.45);
    gfx.strokeRoundedRect(-w / 2 - 1.5, -h / 2 - 1.5, w + 3, h + 3, r + 1);
  }

  private drawAnteBetButton(bw: number, bh: number) {
    this.anteBetBtn.clear();
    const x = -bw / 2;
    const y = -bh / 2;
    const rad = bh / 2; // Pill shape

    if (options.anteBetEnabled) {
      // Active state - bright amber pill
      this.anteBetBtn.fillStyle(0x000000, 0.4);
      this.anteBetBtn.fillRoundedRect(x + 2, y + 4, bw, bh, rad);

      this.anteBetBtn.fillGradientStyle(
        0xffbb33, 0xffbb33, 0x885500, 0x885500, 1
      );
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh, rad);

      // Glass hemisphere
      this.anteBetBtn.fillGradientStyle(
        0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.45, 0.45, 0.05, 0.05
      );
      this.anteBetBtn.fillRoundedRect(x + 2, y + 1, bw - 4, bh * 0.4, {
        tl: rad - 1, tr: rad - 1, bl: 0, br: 0,
      } as any);

      this.anteBetBtn.lineStyle(2, 0xffeebb, 0.9);
      this.anteBetBtn.strokeRoundedRect(x, y, bw, bh, rad);

      this.anteBetTxt
        .setColor('#ffffff')
        .setShadow(0, 2, '#000000', 0, true, true);
      this.anteBetIcon
        .setColor('#ffffff')
        .setShadow(0, 0, '#ffcc00', 6, true, true);
    } else {
      // Inactive - Dark purple pill
      this.anteBetBtn.fillStyle(0x000000, 0.5);
      this.anteBetBtn.fillRoundedRect(x + 2, y + 4, bw, bh, rad);

      this.anteBetBtn.fillGradientStyle(
        0x2a1a3a, 0x2a1a3a, 0x110518, 0x110518, 0.95
      );
      this.anteBetBtn.fillRoundedRect(x, y, bw, bh, rad);

      // Glass hemisphere
      this.anteBetBtn.fillGradientStyle(
        0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.2, 0.2, 0, 0
      );
      this.anteBetBtn.fillRoundedRect(x + 2, y + 1, bw - 4, bh * 0.4, {
        tl: rad - 1, tr: rad - 1, bl: 0, br: 0,
      } as any);

      this.anteBetBtn.lineStyle(2, 0x442266, 1);
      this.anteBetBtn.strokeRoundedRect(x, y, bw, bh, rad);

      this.anteBetTxt
        .setColor('#8877aa')
        .setShadow(0, 0, '#000000', 0, false, false);
      this.anteBetIcon
        .setColor('#ff8844')
        .setShadow(0, 0, '#000', 0, false, false);
    }
  }

  private drawBetButton(
    gfx: Phaser.GameObjects.Graphics,
    targetX: number,
    targetY: number,
    size: number,
    isPlus: boolean,
  ) {
    gfx.clear();
    gfx.setPosition(targetX, targetY);
    const cx = 0;
    const cy = 0;
    const r = size / 2;

    // Drop shadow
    gfx.fillStyle(0x000000, 0.6);
    gfx.fillCircle(cx, cy + 4, r + 4);

    // Thick multi-layered gold bezel
    gfx.fillGradientStyle(0x774400, 0x553300, 0x996611, 0x664400, 1);
    gfx.fillCircle(cx, cy, r + 4);
    gfx.fillGradientStyle(0xffdd55, 0xffbb22, 0xcc8800, 0xaa5500, 1);
    gfx.fillCircle(cx, cy, r + 2);
    gfx.fillGradientStyle(0xaa6600, 0x884400, 0xffcc33, 0xdd9900, 1);
    gfx.fillCircle(cx, cy, r - 2);

    // Jewel Center (Spherical Candy Look)
    const candyR = r - 4;
    gfx.fillStyle(0x880022, 1);
    gfx.fillCircle(cx, cy, candyR);
    gfx.fillGradientStyle(0xcc0044, 0xaa0033, 0xff2266, 0xdd1144, 1);
    gfx.fillCircle(cx, cy - 1, candyR * 0.95);
    gfx.fillGradientStyle(0xff3377, 0xee1155, 0xff6699, 0xdd3366, 1);
    gfx.fillCircle(cx - 1, cy - 2, candyR * 0.85);

    // High-gloss crescent highlight at the top-left
    gfx.beginPath();
    gfx.arc(cx - 2, cy - 2, candyR * 0.7, Math.PI * 0.7, Math.PI * 1.8, false);
    gfx.arc(cx - 1, cy - 1, candyR * 0.7, Math.PI * 1.8, Math.PI * 0.7, true);
    gfx.closePath();
    gfx.fillStyle(0xffffff, 0.65);
    gfx.fillPath();

    // Icon (plus/minus) — thicker and drop shadowed
    const arm = size * 0.22;
    const thick = Math.max(3, size * 0.12);
    
    // Icon shadow (inset into the candy)
    gfx.fillStyle(0x550022, 0.8);
    if (isPlus) {
      gfx.fillRoundedRect(cx - thick / 2, cy - arm + 2, thick, arm * 2, 2);
      gfx.fillRoundedRect(cx - arm, cy - thick / 2 + 2, arm * 2, thick, 2);
    } else {
      gfx.fillRoundedRect(cx - arm, cy - thick / 2 + 2, arm * 2, thick, 2);
    }

    // Icon Body (White)
    gfx.fillStyle(0xffffff, 1);
    if (isPlus) {
      gfx.fillRoundedRect(cx - thick / 2, cy - arm, thick, arm * 2, 2);
      gfx.fillRoundedRect(cx - arm, cy - thick / 2, arm * 2, thick, 2);
    } else {
      gfx.fillRoundedRect(cx - arm, cy - thick / 2, arm * 2, thick, 2);
    }
  }

  /** Draw a fully procedural premium spin button — no PNG needed */
  private drawSpinButton(x: number, y: number, size: number) {
    const g = this.spinControls.spinGfx;
    if (!g || !g.clear) return;
    g.clear();
    const r = size / 2;

    // Drop shadow
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(x, y + 6, r + 8);

    // Thick multi-layered gold bezel
    // Layer 1: Outer dark gold edge
    g.fillGradientStyle(0x774400, 0x553300, 0x996611, 0x664400, 1);
    g.fillCircle(x, y, r + 6);
    // Layer 2: Main bright gold ring
    g.fillGradientStyle(0xffdd55, 0xffbb22, 0xcc8800, 0xaa5500, 1);
    g.fillCircle(x, y, r + 4);
    // Layer 3: Bezel inner slope (darker)
    g.fillGradientStyle(0xaa6600, 0x884400, 0xffcc33, 0xdd9900, 1);
    g.fillCircle(x, y, r - 2);

    // Jewel Center (Spherical Candy Look)
    const candyR = r - 6;
    // Base dark ruby color
    g.fillStyle(0x880022, 1);
    g.fillCircle(x, y, candyR);
    // Mid layer shifted up
    g.fillGradientStyle(0xcc0044, 0xaa0033, 0xff2266, 0xdd1144, 1);
    g.fillCircle(x, y - 2, candyR * 0.95);
    // Bright center shifted further up-left
    g.fillGradientStyle(0xff3377, 0xee1155, 0xff6699, 0xdd3366, 1);
    g.fillCircle(x - 2, y - 4, candyR * 0.85);

    // High-gloss crescent highlight at the top-left
    g.beginPath();
    g.arc(x - 4, y - 4, candyR * 0.7, Math.PI * 0.7, Math.PI * 1.8, false);
    g.arc(x - 2, y - 2, candyR * 0.7, Math.PI * 1.8, Math.PI * 0.7, true);
    g.closePath();
    g.fillStyle(0xffffff, 0.65);
    g.fillPath();

    // Secondary subtle highlight on bottom right
    g.beginPath();
    g.arc(x + 4, y + 4, candyR * 0.7, 0, Math.PI * 0.5, false);
    g.arc(x + 2, y + 2, candyR * 0.6, Math.PI * 0.5, 0, true);
    g.closePath();
    g.fillStyle(0xffffff, 0.25);
    g.fillPath();

    // Play triangle icon
    const triSize = candyR * 0.45;
    const triX = x + triSize * 0.15; // slight offset right for visual centering
    
    // Triangle shadow for depth
    g.fillStyle(0x550022, 0.8);
    g.beginPath();
    g.moveTo(triX - triSize * 0.5, y - triSize * 0.6 + 4);
    g.lineTo(triX + triSize * 0.65, y + 4);
    g.lineTo(triX - triSize * 0.5, y + triSize * 0.6 + 4);
    g.closePath();
    g.fillPath();

    // Triangle body
    g.fillStyle(0xffffff, 0.95);
    g.beginPath();
    g.moveTo(triX - triSize * 0.5, y - triSize * 0.6);
    g.lineTo(triX + triSize * 0.65, y);
    g.lineTo(triX - triSize * 0.5, y + triSize * 0.6);
    g.closePath();
    g.fillPath();

    // Sparkle dots on the gold ring
    const sparkleR = 2;
    g.fillStyle(0xffffff, 0.7);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
      const sx = x + Math.cos(angle) * (r + 1);
      const sy = y + Math.sin(angle) * (r + 1);
      g.fillCircle(sx, sy, sparkleR);
    }
  }

  /** Update spin button visual and all UI interactivity to reflect current state */
  private updateSpinButtonState() {
    this.updateUIInteractivity();
    if (!this.spinControls?.spinGfx) return;

    // Visual transformation: Play ▶ ↔ Stop ■ (Sugar Rush 1000 standard)
    if (this._spinLock || this.autoSpinActive) {
      // During a spin or autoplay: show the STOP button (crimson + square icon)
      this.spinControls.drawStopButton(0, 0, this.spinControls['_lastSpinSize'] || 100);
      this.spinControls.spinGfx.setAlpha(1);
    } else {
      // Idle: show the normal PLAY button (pink + triangle icon)
      this.spinControls.drawSpinButton(0, 0, this.spinControls['_lastSpinSize'] || 100);
      this.spinControls.spinGfx.setAlpha(1);
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
    this.spinControls.betMinusGfx.setAlpha(betDisabled ? 0.3 : 1);
    this.spinControls.betPlusGfx.setAlpha(betDisabled ? 0.3 : 1);
    if (betDisabled) {
      this.spinControls.betMinusHit.disableInteractive();
      this.spinControls.betPlusHit.disableInteractive();
    } else {
      this.spinControls.betMinusHit.setInteractive();
      this.spinControls.betPlusHit.setInteractive();
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
    this.iconSettings.setAlpha(menuDisabled ? 0.35 : 0.9);
    this.btnPaytable.setAlpha(menuDisabled ? 0.35 : 1);
    this.iconPaytable.setAlpha(menuDisabled ? 0.35 : 0.9);
    if (menuDisabled) {
      this.btnSettings.disableInteractive();
      this.btnPaytable.disableInteractive();
    } else {
      this.btnSettings.setInteractive(
        new Phaser.Geom.Circle(0, 0, 22),
        Phaser.Geom.Circle.Contains,
      );
      this.btnPaytable.setInteractive(
        new Phaser.Geom.Circle(0, 0, 22),
        Phaser.Geom.Circle.Contains,
      );
    }

    // ─── Sound toggle & Fullscreen → ALWAYS enabled ───
    this.soundToggle.setAlpha(1);
    this.btnFullscreen.setAlpha(1);
  }

  private wireInteractions() {
    // Spin button — game logic only (tactile feedback is handled by SpinControls)
    this.spinControls.spinHit.on('pointerdown', () => {
      this.handleUniversalAction();
    });

    // Auto play
    this.spinControls.autoHit.on('pointerdown', () => {
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

    // Bet controls — directly cycle through bet presets (Sugar Rush 1000 behavior)
    this.spinControls.betMinusHit.on('pointerdown', () => {
      if (this._spinLock || this.fsActive || this.autoSpinActive || this.anyOverlayOpen()) return;
      if (this.betPresetIndex > 0) {
        this.betPresetIndex--;
        options.betAmount = BET_PRESETS[this.betPresetIndex];
        this.updateBetDisplay();
        this.audio.playSound('button');
      }
    });
    this.spinControls.betPlusHit.on('pointerdown', () => {
      if (this._spinLock || this.fsActive || this.autoSpinActive || this.anyOverlayOpen()) return;
      if (this.betPresetIndex < BET_PRESETS.length - 1) {
        this.betPresetIndex++;
        options.betAmount = BET_PRESETS[this.betPresetIndex];
        this.updateBetDisplay();
        this.audio.playSound('button');
      }
    });

    // Premium Hover states builder
    const addHover = (hit: Phaser.GameObjects.GameObject, target: any) => {
      hit.on('pointerover', () => {
        const targets = Array.isArray(target) ? target : [target];
        targets.forEach((t) => {
          if (t._baseScaleX === undefined) {
            t._baseScaleX = t.scaleX;
            t._baseScaleY = t.scaleY;
          }
          this.tweens.add({
            targets: t,
            scaleX: t._baseScaleX * 1.1,
            scaleY: t._baseScaleY * 1.1,
            duration: 150,
            ease: 'Back.easeOut',
          });
        });
      });
      hit.on('pointerout', () => {
        const targets = Array.isArray(target) ? target : [target];
        targets.forEach((t) => {
          if (t._baseScaleX !== undefined) {
            this.tweens.add({
              targets: t,
              scaleX: t._baseScaleX,
              scaleY: t._baseScaleY,
              duration: 150,
              ease: 'Back.easeIn',
            });
          }
        });
      });
    };

    addHover(this.buySuperHit, [
      this.panelSuperGraphics,
      this.buySuperTxt1,
      this.buySuperTxt2,
    ]);
    addHover(this.buyRegularHit, [
      this.panelRegularGraphics,
      this.buyRegularTxt1,
      this.buyRegularTxt2,
    ]);
    addHover(this.anteBetHit, [
      this.anteBetBtn,
      this.anteBetTxt,
      this.anteBetIcon,
    ]);
    addHover(this.soundToggle, [this.soundToggle, this.iconSound]);
    addHover(this.btnPaytable, [this.btnPaytable, this.iconPaytable]);
    addHover(this.btnSettings, [this.btnSettings, this.iconSettings]);
    addHover(this.btnFullscreen, [this.btnFullscreen, this.iconFullscreen]);
    // Spin and Autoplay hover/press feedback is handled by SpinControls.setupTactileFeedback

    // Buy features (with confirmation) — also guard overlays
    this.buySuperHit.on('pointerdown', () => {
      if (this._spinLock || this.fsActive || this.anyOverlayOpen()) return;
      this.tweens.add({
        targets: [
          this.panelSuperGraphics,
          this.buySuperTxt1,
          this.buySuperTxt2,
        ],
        scaleX: 0.95,
        scaleY: 0.95,
        yoyo: true,
        duration: 80,
      });
      this.requestPurchase(2, 500);
    });
    this.buyRegularHit.on('pointerdown', () => {
      if (this._spinLock || this.fsActive || this.anyOverlayOpen()) return;
      this.tweens.add({
        targets: [
          this.panelRegularGraphics,
          this.buyRegularTxt1,
          this.buyRegularTxt2,
        ],
        scaleX: 0.95,
        scaleY: 0.95,
        yoyo: true,
        duration: 80,
      });
      this.requestPurchase(1, 1000);
    });

    // Ante Bet toggle
    this.anteBetHit.on('pointerdown', () => {
      if (this._spinLock || this.fsActive || this.anyOverlayOpen()) return;
      options.anteBetEnabled = !options.anteBetEnabled;
      this.audio.playSound('button');
      this.drawAnteBetButton(this.anteBetHit.width, this.anteBetHit.height);
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
    if (this.paytable.isVisible()) {
      this.paytable.hide();
      return;
    }
    if (this.settings.isVisible()) {
      this.settings.hide();
      return;
    }
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

  /** Update auto-spin button display — delegates to SpinControls (single render path) */
  private updateAutoSpinDisplay() {
    const spinX = this.spinControls['_lastSpinX'] || 0;
    const spinY = this.spinControls['_lastSpinY'] || 0;
    const spinSize = this.spinControls['_lastSpinSize'] || 100;
    this.spinControls.drawAutoButton(
      spinX, spinY, spinSize,
      this.autoSpinActive,
      this.autoSpinRemaining,
    );
  }

  private wireGridCallbacks() {
    this.grid.onWinCallback = (winAmount, symbolId) => {
      const actualWin = winAmount;
      if (!this.fsActive) {
        this.valueMoney += actualWin;
        this.updateMoneyDisplay();
        this.lastWin += actualWin;
        
        const symKey = symbolId !== undefined ? `candy_${symbolId}` : undefined;
        this.updateLastWinDisplay(symKey);
      }
      // During free spins, don't track lastWin per cascade —
      // the Grid's totalFreeSpinsWin is authoritative

      this.audio.playWin(actualWin / this.getEffectiveBet());

      // Floating win text
      const cx = this.grid.offsetX + this.grid.cellSize * 3.5;
      const cy = this.grid.offsetY + this.grid.cellSize * 3.5;
      const winText = this.add
        .text(cx, cy, `+${actualWin.toFixed(2)}`, {
          fontSize: `${Math.max(28, this.grid.cellSize * 0.7)}px`,
          color: '#ffe600',
          fontStyle: 'bold',
          stroke: '#000',
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setDepth(25);

      this.tweens.add({
        targets: winText,
        y: cy - this.grid.cellSize * 1.2,
        alpha: 0,
        duration: 1200,
        ease: 'Power1',
        onComplete: () => winText.destroy(),
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
        duration: 400,
        ease: 'Back.easeOut',
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
        const endText = this.add
          .text(
            this.scale.width / 2,
            this.scale.height / 2,
            `FREE SPINS TOTAL\n${totalWin.toFixed(2)}`,
            {
              fontSize: '64px',
              color: '#ffe600',
              align: 'center',
              fontStyle: 'bold',
              stroke: '#000',
              strokeThickness: 10,
            },
          )
          .setOrigin(0.5)
          .setDepth(35)
          .setScale(0);

        this.tweens.add({
          targets: endText,
          scale: 1,
          duration: 500,
          yoyo: true,
          hold: 2000,
          ease: 'Back.easeOut',
          onComplete: () => {
            endText.destroy();
            this._spinLock = false;
            if (this.stakeEngine.isReplayMode()) {
              this.replayBtnTxt.setText('PLAY AGAIN');
              this.replayBtnHit.setVisible(true);
              this.replayBtnTxt.setVisible(true);
              return;
            }

            this.stakeEngine
              .endRound()
              .catch((e) => console.warn('[Game] endRound error:', e));
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
          },
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
      const maxText = this.add
        .text(this.scale.width / 2, this.scale.height * 0.35, 'MAX WIN!', {
          fontSize: '96px',
          color: '#ffe600',
          fontStyle: 'bold',
          stroke: '#ff0066',
          strokeThickness: 12,
        })
        .setOrigin(0.5)
        .setDepth(40)
        .setScale(0);

      this.tweens.add({
        targets: maxText,
        scale: 1,
        duration: 600,
        ease: 'Back.easeOut',
        yoyo: true,
        hold: 3000,
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
        if (this.stakeEngine.isReplayMode()) {
          this.replayBtnTxt.setText('PLAY AGAIN');
          this.replayBtnHit.setVisible(true);
          this.replayBtnTxt.setVisible(true);
          return;
        }

        this.stakeEngine
          .endRound()
          .catch((e) => console.warn('[Game] endRound error:', e));
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

      if (
        this.lastWin >= this.getEffectiveBet() * 2 &&
        !this.skipScreensActive
      ) {
        this.winCelebration.show(
          this.lastWin,
          this.getEffectiveBet(),
          finishUp,
        );
      } else {
        finishUp();
      }
    };
  }

  private anyOverlayOpen(): boolean {
    return (
      this.paytable.isVisible() ||
      this.settings.isVisible() ||
      this.confirmDialog.isVisible() ||
      this.winCelebration.isVisible ||
      this.freeSpinsIntro.isVisible ||
      this.errorManager.isBlocking ||
      this.autoPlayOverlay.isVisible() ||
      this.betOverlay.isVisible()
    );
  }

  private getEffectiveBet(): number {
    const baseBet = BET_PRESETS[this.betPresetIndex];
    return options.anteBetEnabled
      ? baseBet * options.anteBetCostMultiplier
      : baseBet;
  }
  updateMoneyDisplay() {
    this.bottomBarHUD.updateMoneyDisplay(this.valueMoney, this.currency);
  }

  updateBetDisplay() {
    this.bottomBarHUD.updateBetDisplay(
      this.betPresetIndex,
      this.currency,
      options.anteBetEnabled,
    );
  }

  updateLastWinDisplay(symbolKey?: string) {
    const target = this.lastWin;
    
    // Update symbol icon in HUD
    this.bottomBarHUD.setWinSymbol(symbolKey);
    if (this._winCountTween) {
      this._winCountTween.stop();
    }

    // Kill any lingering pulse tweens
    this.tweens.killTweensOf([
      this.bottomBarHUD.txtLastWin,
      this.bottomBarHUD.txtLastWinLabel,
    ]);
    this.bottomBarHUD.txtLastWin.setScale(1);
    this.bottomBarHUD.txtLastWinLabel.setScale(1);

    // Hide win glow
    this.tweens.killTweensOf(this.bottomBarHUD.winPillGlow);
    this.bottomBarHUD.winPillGlow.setAlpha(0);

    if (target <= 0) {
      this._displayedWin = 0;
      this.bottomBarHUD.winSymbolIcon.setVisible(false);
      this.bottomBarHUD.txtLastWin.setText(
        DisplayBalance({ amount: 0, currency: this.currency }),
      );
      this.bottomBarHUD.txtLastWin
        .setColor('#44ff88')
        .setShadow(0, 0, '#000', 0, false, false);
      return;
    }

    const effectiveBet = this.getEffectiveBet();
    const isBigWin = target >= effectiveBet * 10;
    const start = this._displayedWin;
    const delta = target - start;
    const duration = Math.min(1500, Math.max(500, Math.abs(delta) * 15));

    // Golden glow text
    this.bottomBarHUD.txtLastWin
      .setColor('#ffea00')
      .setShadow(0, 2, '#ffaa00', 6, true, true);

    // Pulse text while counting
    this.tweens.add({
      targets: [
        this.bottomBarHUD.txtLastWin,
        this.bottomBarHUD.txtLastWinLabel,
      ],
      scaleX: 1.12,
      scaleY: 1.12,
      yoyo: true,
      repeat: -1,
      duration: 200,
      ease: 'Sine.easeInOut',
    });

    // Big win: glow the pill itself
    if (isBigWin) {
      const b = this.bottomBarHUD.getWinPillBounds();
      if (b) {
        this.bottomBarHUD.winPillGlow.clear();
        this.bottomBarHUD.winPillGlow.fillStyle(0xffaa00, 0.25);
        this.bottomBarHUD.winPillGlow.fillRoundedRect(
          b.x - 4,
          b.y - 4,
          b.w + 8,
          b.h + 8,
          (b.h + 8) / 2,
        );
        this.bottomBarHUD.winPillGlow.setAlpha(0);
        this.tweens.add({
          targets: this.bottomBarHUD.winPillGlow,
          alpha: { from: 0, to: 1 },
          yoyo: true,
          repeat: -1,
          duration: 400,
          ease: 'Sine.easeInOut',
        });
      }
    }

    this._winCountTween = this.tweens.addCounter({
      from: 0,
      to: 100,
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const progress = (tween.getValue?.() ?? 0) / 100;
        this._displayedWin = start + delta * progress;
        this.bottomBarHUD.txtLastWin.setText(
          DisplayBalance({
            amount: this._displayedWin,
            currency: this.currency,
          }),
        );
        // Keep icon position synced as text width changes
        if (this.bottomBarHUD.winSymbolIcon.visible) {
          this.bottomBarHUD.winSymbolIcon.x = this.bottomBarHUD.txtLastWin.x - this.bottomBarHUD.txtLastWin.width - 24;
        }
      },
      onComplete: () => {
        this._displayedWin = target;
        this.bottomBarHUD.txtLastWin.setText(
          DisplayBalance({ amount: target, currency: this.currency }),
        );

        // Stop pulsing
        this.tweens.killTweensOf([
          this.bottomBarHUD.txtLastWin,
          this.bottomBarHUD.txtLastWinLabel,
        ]);
        this.bottomBarHUD.txtLastWin.setScale(1);
        this.bottomBarHUD.txtLastWinLabel.setScale(1);

        // Final celebratory pop
        this.tweens.add({
          targets: this.bottomBarHUD.txtLastWin,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 250,
          yoyo: true,
          ease: 'Back.easeOut',
        });

        // Settle win glow
        if (isBigWin) {
          this.tweens.killTweensOf(this.bottomBarHUD.winPillGlow);
          this.tweens.add({
            targets: this.bottomBarHUD.winPillGlow,
            alpha: 0.5,
            duration: 600,
            ease: 'Sine.easeOut',
          });
        }

        // Settle text to green
        this.time.delayedCall(400, () => {
          this.bottomBarHUD.txtLastWin
            .setColor('#44ff88')
            .setShadow(0, 0, '#000', 0, false, false);
        });
      },
    });
  }

  private requestPurchase(triggerType: number, betMultCost: number) {
    if (this._spinLock || this.fsActive || this.anyOverlayOpen()) return;

    const baseBet = this.getEffectiveBet();
    const cost = baseBet * betMultCost;
    const label =
      triggerType === 2
        ? T('SUPER FREE SPINS', this.stakeEngine.isSocialMode())
        : T('BUY FREE SPINS', this.stakeEngine.isSocialMode());

    if (this.valueMoney < cost) {
      this.errorManager.showToast('INSUFFICIENT FUNDS', '#ff4466');
      return;
    }

    const formattedBase = DisplayBalance({
      amount: baseBet,
      currency: this.currency,
    });
    const formattedCost = DisplayBalance({
      amount: cost,
      currency: this.currency,
    });
    this.confirmDialog.show(
      label,
      `Bet: ${formattedBase}\nTotal Cost: ${formattedCost}`,
      () => this.executePurchase(triggerType, baseBet, cost),
      () => {
        /* cancelled */
      },
    );
  }

  private async executePurchase(
    triggerType: number,
    baseBet: number,
    totalCost: number,
  ) {
    this._spinLock = true;
    this.updateSpinButtonState();
    this.valueMoney -= totalCost;
    this.lastWin = 0;
    options.betAmount = BET_PRESETS[this.betPresetIndex];
    this.updateMoneyDisplay();
    this.updateLastWinDisplay();

    this.audio.playSound('button');

    this.grid.prepareSpin();

    try {
      // Send BASE bet to RGS — the mode ('bonus'/'super') tells server the multiplier
      const result = await this.stakeEngine.play(baseBet, triggerType);
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
        this.valueMoney = StakeEngineClient.toDisplayAmount(
          result.balance.amount,
        );
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
        this.txtFSRemaining
          .setText(`${this.grid.freeSpinsRemaining} FREE SPINS`)
          .setVisible(true);
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
    if (
      this._spinLock ||
      this._recovering ||
      this.fsActive ||
      this.anyOverlayOpen()
    )
      return;

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
          this.valueMoney = StakeEngineClient.toDisplayAmount(
            result.balance.amount,
          );
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
    this.updateBetDisplay(); // Update bet text with REAL COST now that replayData is fetched

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

  private handlePendingRound(round: any) {
    // SDK disconnect recovery flow:
    // On auth, the RGS returns any pending round in auth.round.
    const totalAmount = StakeEngineClient.toDisplayAmount(round.amount);

    // Stake Requirement: Restore player's previously selected bet amount on refresh.
    let bestDist = Infinity;
    let bestIdx = this.betPresetIndex;
    for (let i = 0; i < BET_PRESETS.length; i++) {
      const bp = BET_PRESETS[i];
      const distBase = Math.abs(totalAmount - bp);
      const distAnte = Math.abs(totalAmount - bp * 1.25);
      const distBonus = Math.abs(totalAmount - bp * 100);
      const distSuper = Math.abs(totalAmount - bp * 500);

      const minThis = Math.min(distBase, distAnte, distBonus, distSuper);
      if (minThis < bestDist) {
        bestDist = minThis;
        bestIdx = i;
      }
    }

    this.betPresetIndex = bestIdx;
    options.betAmount = BET_PRESETS[this.betPresetIndex];
    this.updateBetDisplay();

    console.log(
      `[Game] Pending round detected — restored bet amount to ${options.betAmount} (total cost: ${totalAmount})`,
    );
    this.stakeEngine
      .endRound()
      .catch((e) => console.warn('[Game] endRound error:', e));
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
        async () => {
          throw new Error('Session expired');
        },
        () => window.location.reload(),
      );
    } else {
      // Recoverable — show retry modal that resyncs balance
      this.errorManager.showBlockingError(headline, () =>
        this.resyncAfterError(),
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
        console.log(
          '[Game] Server reports pending round:',
          state.pendingRound.betID,
        );
        this.stakeEngine
          .endRound()
          .catch((e) => console.warn('[Game] endRound error:', e));
      }

      // Clean up — no local state to clear

      // Unlock the game
      this._spinLock = false;
      this._recovering = false;
      this.updateSpinButtonState();

      this.errorManager.showToast('Connection restored', '#44ff88');
      console.log(
        '[Game] Resync successful. Balance:',
        this.valueMoney.toFixed(2),
      );
    } catch (resyncErr) {
      this._recovering = false;
      console.error('[Game] Resync failed:', resyncErr);
      throw resyncErr; // Re-throw so the ErrorManager modal stays visible
    }
  }
}
