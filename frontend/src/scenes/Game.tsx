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
  BackgroundManager,
  IntroSplash,
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
  introSplash!: IntroSplash;

  private stakeEngine!: StakeEngineClient;
  private skipScreensActive = false;

  // UI elements
  private backgroundManager!: BackgroundManager;
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
  private featuresMenuTitleTxt!: Phaser.GameObjects.Text;
  private featuresMenuCloseBtn!: Phaser.GameObjects.Text;
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

    let pendingRound: any = null; // Store pending round to execute after UI is built

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
          pendingRound = auth.round;
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
    this.introSplash = new IntroSplash(this);
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
    const gameResizeListener = () => {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this.layoutAll();
      }, 80);
    };
    this.scale.on('resize', gameResizeListener);
    this.events.once('shutdown', () => {
      this.scale.off('resize', gameResizeListener);
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
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

    // Execute any pending rounds recovered from authentication
    if (pendingRound) {
      this.handlePendingRound(pendingRound);
    } else {
      if (!this.stakeEngine.isReplayMode()) {
        this.introSplash.show(() => {});
      }
    }
  }

  private buildUI() {
    const w = this.scale.width;
    const h = this.scale.height;

    // === BACKGROUND (Dynamic Sugar Rush 1000 animations) ===
    this.backgroundManager = new BackgroundManager(this);

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
    logoBanner.fillGradientStyle(
      0xffffff,
      0xffffff,
      0xffffff,
      0xffffff,
      0.3,
      0.3,
      0,
      0,
    );
    logoBanner.fillRoundedRect(-188, -50, 376, 22, {
      tl: 10,
      tr: 10,
      bl: 0,
      br: 0,
    } as any);
    // Gold trim on ribbon edges
    logoBanner.lineStyle(2, 0xffcc44, 0.8);
    logoBanner.strokeRoundedRect(-190, -52, 380, 58, 12);

    // Shadow layer for 'SUGAR BLAST'
    const titleShadow = this.add
      .text(0, -22, 'SUGAR BLAST', {
        resolution: 2,
        fontFamily: '"Luckiest Guy", cursive, sans-serif',
        fontSize: '46px',
        fontStyle: 'bold',
        color: '#ff006a',
        stroke: '#ff006a',
        strokeThickness: 16,
        shadow: {
          offsetX: 0,
          offsetY: 4,
          color: '#000000',
          blur: 4,
          stroke: true,
          fill: true,
        },
      })
      .setOrigin(0.5, 0.5);

    // Main layer for 'SUGAR BLAST'
    this.logoText1 = this.add
      .text(0, -24, 'SUGAR BLAST', {
        resolution: 2,
        fontFamily: '"Luckiest Guy", cursive, sans-serif',
        fontSize: '46px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#ff006a',
        strokeThickness: 8,
        shadow: {
          offsetX: 0,
          offsetY: 4,
          color: '#000000',
          blur: 0,
          stroke: true,
          fill: true,
        },
      })
      .setOrigin(0.5, 0.5);

    // Shadow layer for '1000'
    const num1000Shadow = this.add
      .text(0, 24, '1000', {
        resolution: 2,
        fontFamily:
          '"Montserrat", "Poppins", sans-serif',
        fontSize: '62px',
        fontStyle: 'bold',
        color: '#442200',
      })
      .setOrigin(0.5, 0.5);

    // Main layer for '1000'
    this.logoText2 = this.add
      .text(0, 20, '1000', {
        resolution: 2,
        fontFamily:
          '"Montserrat", "Poppins", sans-serif',
        fontSize: '62px',
        fontStyle: 'bold',
        color: '#ffcc00',
        stroke: '#ff8800',
        strokeThickness: 10,
        shadow: {
          offsetX: 0,
          offsetY: 6,
          color: '#000000',
          blur: 0,
          stroke: true,
          fill: true,
        },
      })
      .setOrigin(0.5, 0.5);

    this.logoContainer.add([
      logoBanner,
      titleShadow,
      this.logoText1,
      num1000Shadow,
      this.logoText2,
    ]);

    // Buy buttons setup
    const btnStyle = {
      resolution: 2,
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
      .text(0, 0, '⚡', { resolution: 2, fontFamily: '"Poppins", sans-serif' })
      .setOrigin(0.5)
      .setDepth(21);
    this.anteBetTxt = this.add
      .text(0, 0, T('ANTE BET', this.stakeEngine.isSocialMode()), {
        resolution: 2,
        fontFamily: '"Poppins", sans-serif',
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

    this.featuresMenuTitleTxt = this.add
      .text(0, 0, 'BUY FEATURES', {
        resolution: 2,
        fontFamily: '"Poppins", sans-serif',
        fontStyle: '900',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(62)
      .setVisible(false);

    this.featuresMenuCloseBtn = this.add
      .text(0, 0, 'X', {
        resolution: 2,
        fontFamily: '"Poppins", sans-serif',
        fontStyle: '900',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(62)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.isFeaturesMenuOpen = false;
        this.layoutAll();
      })
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
      .text(0, 0, 'BUY', {
        resolution: 2,
        fontSize: '20px',
        color: '#ffe600',
        fontStyle: 'bold',
        fontFamily: '"Luckiest Guy", cursive, sans-serif',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(21);

    // === BOTTOM BAR & SPIN CONTROLS (created by new component classes) ===
    // BottomBarHUD and SpinControls are instantiated after overlays below

    // === FREE SPINS COUNTER ===
    this.txtFSRemaining = this.add
      .text(0, 0, '', {
        resolution: 2,
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
      // Enforce jurisdiction: if turbo is disabled by jurisdiction, ignore
      if (this.stakeEngine.isTurboDisabled()) return;
      this.grid.turboMode = enabled;
    });
    this.settings.setQualityCallback?.((quality: string) => {
      (this as any).graphicsQuality = quality;
      // Hook up actual engine quality logic here if needed (e.g. particle density)
      console.log('[Game] Graphics Quality set to:', quality);
    });

    // Enforce jurisdiction flags from auth config
    if (this.stakeEngine.isFullscreenDisabled()) {
      this.btnFullscreen.setVisible(false);
      this.iconFullscreen.setVisible(false);
    }

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
          resolution: 2,
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
    if (this.backgroundManager) {
      this.backgroundManager.resize(w, h);
    }

    // Determine layout mode
    const isPortrait = h > w;
    const isMobile = w < 768;
    const isStacked = isPortrait || w < 650;
    const isLandscapeMobile = !isPortrait && h < 500;

    // Height of the bottom bar
    const barH = isStacked ? Math.max(50, h * 0.065) : Math.max(45, h * 0.07);
    const safeH = h - barH;

    // Toolbar dimensions — compact on mobile for breathing room
    const toolPad = isMobile ? 16 : 35;
    const toolGap = isLandscapeMobile ? 34 : isMobile ? 36 : 50;
    const toolY = Math.max(16, safeH * 0.025);
    const toolbarH = isMobile ? 32 : 40; // toolbar total visual height

    // ==========================================
    // 1. GRID SCALING & POSITIONING
    // ==========================================
    let gridW: number;
    let gridH: number;
    let gridX: number;
    let gridY: number;

    if (isStacked) {
      // ── Mobile portrait: maximize grid while keeping clean spacing ──
      // Top: toolbar + logo + explicit gap for FS counter/turbo indicator
      // Scale logo height zone with screen height to prevent collapsing on short screens
      const logoH = isMobile ? Math.max(35, Math.min(55, h * 0.08)) : Math.max(50, Math.min(80, h * 0.09));
      const fsCounterGap = Math.max(12, Math.min(22, h * 0.03));
      const topSpace = toolY + toolbarH + logoH + fsCounterGap;

      // Bottom: compact controls area — scale with screen height
      const bottomSpace = isPortrait ? Math.max(140, Math.min(220, h * 0.22)) : 110;
      const availableH = safeH - topSpace - bottomSpace;
      
      // Grid uses 92% width — bigger cells, slight side margins
      const maxGridW = w * 0.92;
      gridW = Math.min(maxGridW, availableH);
      gridH = Math.min(availableH, maxGridW);
      gridW = Math.max(gridW, 140);
      gridH = Math.max(gridH, 140);

      gridX = (w - gridW) / 2;
      gridY = topSpace + (availableH - gridH) / 2;
    } else if (isLandscapeMobile) {
      // Short landscape: grid takes center, maximize height
      gridH = Math.min(safeH * 0.88, w * 0.42);
      gridW = gridH;
      gridX = (w - gridW) / 2;
      gridY = (safeH - gridH) / 2 + 5;
    } else {
      // Desktop column mode
      gridH = Math.min(w * 0.42, safeH * 0.78);
      gridW = gridH;
      gridX = (w - gridW) / 2;
      gridY = (safeH - gridH) / 2 + 10;
    }

    this.grid.offsetX = gridX;
    this.grid.offsetY = gridY;
    this.grid.cellW = gridW / 7;
    this.grid.cellH = gridH / 7;
    this.grid.drawCellBackgrounds();
    this.grid.repositionSprites();

    // === GRID PANEL IMAGE ===
    this.gridPanel.setVisible(false); // Hide the old background image

    // === PREMIUM CANDY MACHINE GRID FRAME ===
    this.gridFrame.clear();
    const f = this.gridFrame;

    const borderThickness = Math.max(6, Math.min(gridW, gridH) * 0.022);
    const framePadding = borderThickness + 4;
    const frameW = gridW + framePadding * 2;
    const frameH = gridH + framePadding * 2;
    const frameX = gridX - framePadding;
    const frameY = gridY - framePadding;
    const frameR = Math.max(16, Math.min(gridW, gridH) * 0.03);

    // --- Layer 1: Deep outer shadow ---
    f.fillStyle(0x000000, 0.45);
    f.fillRoundedRect(frameX + 4, frameY + 6, frameW, frameH, frameR + 2);

    // --- Layer 2: Thick glossy plastic rim (outer ring) ---
    // Bottom half (darker) for 3D depth - Premium glossy candy pink
    f.fillGradientStyle(0xffaadd, 0xffaadd, 0xff3388, 0xff3388, 1);
    f.fillRoundedRect(frameX, frameY, frameW, frameH, frameR);

    // Top half highlight overlay (lighter plastic shine)
    f.fillGradientStyle(
      0xffffff,
      0xffffff,
      0xffaadd,
      0xffaadd,
      0.9,
      0.9,
      0.1,
      0.1,
    );
    f.fillRoundedRect(frameX, frameY, frameW, frameH * 0.4, {
      tl: frameR,
      tr: frameR,
      bl: 0,
      br: 0,
    } as any);

    // Glass sheen on top edge of rim
    f.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.8, 0.8, 0, 0);
    f.fillRoundedRect(
      frameX + 4,
      frameY + 2,
      frameW - 8,
      borderThickness * 0.5,
      { tl: frameR - 2, tr: frameR - 2, bl: 0, br: 0 } as any,
    );

    // --- Layer 3: Inner recess (dark well holding the grid) ---
    const innerX = frameX + borderThickness;
    const innerY = frameY + borderThickness;
    const innerW = frameW - borderThickness * 2;
    const innerH = frameH - borderThickness * 2;
    const innerR = Math.max(8, frameR - 4);

    // Dark inset shadow to create depth (just a border rim shadow now)
    f.fillStyle(0x000000, 0.35);
    f.fillRoundedRect(
      innerX - 2,
      innerY - 2,
      innerW + 4,
      innerH + 4,
      innerR + 2,
    );

    // We intentionally do NOT draw a solid background here (like the old dark purple plate).
    // This allows the Grid.ts Phase 1 frosted glass background to shine through organically,
    // matching the original Sugar Rush 1000 aesthetic.

    // Inner border for definition
    f.lineStyle(1.5, 0xff006a, 0.5);
    f.strokeRoundedRect(innerX, innerY, innerW, innerH, innerR);

    // --- Layer 4: Outer rim border & highlight ---
    f.lineStyle(2, 0xffccdd, 0.7);
    f.strokeRoundedRect(frameX, frameY, frameW, frameH, frameR);
    f.lineStyle(1, 0xffffff, 0.2);
    f.strokeRoundedRect(
      frameX + 1,
      frameY + 1,
      frameW - 2,
      frameH - 2,
      frameR - 1,
    );

    // --- Layer 5: Glass glare diagonal across the grid ---
    f.beginPath();
    const glareW = gridW * 0.15;
    f.moveTo(gridX + gridW * 0.05, gridY);
    f.lineTo(gridX + gridW * 0.05 + glareW, gridY);
    f.lineTo(gridX, gridY + gridH * 0.3);
    f.lineTo(gridX, gridY + gridH * 0.15);
    f.closePath();
    f.fillStyle(0xffffff, 0.08);
    f.fillPath();

    // --- Layer 6: Decorative candy-bolt corner accents (hidden on very small grids) ---
    const minGridDim = Math.min(gridW, gridH);
    if (minGridDim > 300) {
      const boltR = Math.max(4, minGridDim * 0.012);
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
        f.strokeCircle(bp.x, bp.y, boltR);
      }
    }

    // ==========================================
    // 2. SPIN BUTTON GROUP (Calculated early for anchoring)
    // ==========================================
    const { spinX, spinY, spinSize } = this.spinControls.layout(
      w,
      h,
      gridX,
      gridY,
      gridH, // Use gridH for spin control layout since it's vertical sizing
      barH,
      isStacked,
      isLandscapeMobile,
    );
    this.updateSpinButtonState();
    this.updateAutoSpinDisplay();

    // ==========================================
    // 3. BUY PANELS & ANTE BET
    // ==========================================
    const availableWidthForFeatures = gridX;
    const availableHeightForFeatures = safeH - (gridY + gridH);

    const useFeaturesMenu =
      isLandscapeMobile || (!isStacked && availableWidthForFeatures < 160);

    // Compact buy buttons on mobile — smaller to save vertical space
    let buyW = isStacked
      ? Math.min(120, w * 0.30)
      : Math.min(200, gridX * 0.75);
    let buyH = isStacked
      ? Math.min(36, safeH * 0.045)
      : Math.min(100, safeH * 0.14);
    let buyGap = isStacked ? Math.max(5, w * 0.015) : 12;
    let anteW = isStacked ? buyW * 2 + buyGap : buyW;
    let anteH = isStacked ? Math.min(30, buyH * 0.7) : 45;

    let buyX1: number = 0;
    let buyX2: number = 0;
    let anteX: number = 0;
    let buyY1: number = 0;
    let buyY2: number = 0;
    let anteY: number = 0;

    let showFeaturesToggle = useFeaturesMenu;
    const showPopup = this.isFeaturesMenuOpen;

    if (showFeaturesToggle) {
      // Show the toggle button
      this.btnFeaturesMenuGraphics.setVisible(true).clear();
      this.btnFeaturesMenuHit.setVisible(true);
      this.btnFeaturesMenuIcon.setVisible(true);

      // Position toggle vertically centered with the grid on the left edge
      const toggleX = isLandscapeMobile ? 35 : Math.max(30, w * 0.08);
      const toggleY = gridY + gridH / 2;

      this.btnFeaturesMenuHit.setPosition(toggleX, toggleY).setSize(60, 60);
      // Glassmorphic toggle pill for BUY feature
      this.btnFeaturesMenuGraphics.fillStyle(0x000000, 0.5);
      this.btnFeaturesMenuGraphics.fillRoundedRect(
        toggleX - 30,
        toggleY - 30 + 4,
        60,
        60,
        15,
      );
      this.btnFeaturesMenuGraphics.fillGradientStyle(
        0xff006a,
        0xff006a,
        0xcc0055,
        0xcc0055,
        1,
      );
      this.btnFeaturesMenuGraphics.fillRoundedRect(
        toggleX - 30,
        toggleY - 30,
        60,
        60,
        15,
      );
      this.btnFeaturesMenuGraphics.lineStyle(2, 0xffffff, 0.8);
      this.btnFeaturesMenuGraphics.strokeRoundedRect(
        toggleX - 30,
        toggleY - 30,
        60,
        60,
        15,
      );

      this.btnFeaturesMenuIcon.setPosition(toggleX, toggleY);
    } else {
      this.btnFeaturesMenuGraphics.setVisible(false);
      this.btnFeaturesMenuHit.setVisible(false);
      this.btnFeaturesMenuIcon.setVisible(false);
    }

    // Determine base layout before popup
    if (isStacked) {
      // Stacked mobile: compact "BUY" + "ANTE" side by side above spin
      const blockBottom = spinY - spinSize / 2 - 8 - Math.max(10, safeH * 0.015);

      anteW = Math.min(130, w * 0.34);
      buyW = anteW;

      anteY = blockBottom - anteH / 2;
      buyY1 = anteY;
      
      const totalW = buyW + anteW + buyGap;
      buyX1 = w / 2 - totalW / 2 + buyW / 2;
      anteX = w / 2 + totalW / 2 - anteW / 2;

      // Super buy is hidden unless popup is open
      buyX2 = -9999;
      buyY2 = -9999;
    } else {
      // Desktop placement: stacked vertically on the left side
      buyX1 = Math.max(gridX / 2, buyW / 2 + 10);
      buyY1 = gridY + gridH / 2 - buyH / 2 - buyGap / 2;

      buyX2 = buyX1;
      buyY2 = gridY + gridH / 2 + buyH / 2 + buyGap / 2;

      anteX = buyX1;
      anteY = buyY2 + buyH / 2 + buyGap * 1.5 + anteH / 2;
    }

    if (showPopup) {
      this.featuresMenuHitOverlay
        .setVisible(true)
        .setPosition(w / 2, h / 2)
        .setSize(w, h);
      this.featuresMenuTitleTxt.setVisible(true);
      this.featuresMenuCloseBtn.setVisible(true);

      buyW = Math.min(220, w * 0.78);
      buyH = 58;
      buyGap = 14;
      
      if (!isStacked) {
        anteW = buyW;
        anteH = 42;
      }

      // Calculate heights with cleaner header
      const headerH = 44;
      const contentH = isStacked ? (buyH * 2 + buyGap) : (buyH * 2 + anteH + buyGap * 2);
      const popupW = buyW + 50;
      const popupH = contentH + headerH + 55;
      const popupX = w / 2;
      const popupY = h / 2;

      // Premium popup backdrop
      this.featuresMenuPopupBg.fillStyle(0x000000, 0.6);
      this.featuresMenuPopupBg.fillRoundedRect(
        popupX - popupW / 2 + 6,
        popupY - popupH / 2 + 8,
        popupW,
        popupH,
        24,
      );
      
      // Main Glass Panel
      this.featuresMenuPopupBg.fillGradientStyle(
        0x2d1b4e,
        0x2d1b4e,
        0x150b29,
        0x150b29,
        0.98,
      );
      this.featuresMenuPopupBg.fillRoundedRect(
        popupX - popupW / 2,
        popupY - popupH / 2,
        popupW,
        popupH,
        20,
      );
      
      // Header Background (Candy Pink)
      this.featuresMenuPopupBg.fillGradientStyle(
        0xff006a,
        0xff006a,
        0xcc0055,
        0xcc0055,
        1,
      );
      this.featuresMenuPopupBg.fillRoundedRect(
        popupX - popupW / 2,
        popupY - popupH / 2,
        popupW,
        headerH + 20,
        { tl: 20, tr: 20, bl: 0, br: 0 } as any
      );

      // Inner Header Highlight
      this.featuresMenuPopupBg.fillGradientStyle(
        0xffffff,
        0xffffff,
        0xffffff,
        0xffffff,
        0.2,
        0.2,
        0,
        0,
      );
      this.featuresMenuPopupBg.fillRoundedRect(
        popupX - popupW / 2 + 2,
        popupY - popupH / 2 + 2,
        popupW - 4,
        (headerH + 20) * 0.4,
        { tl: 18, tr: 18, bl: 0, br: 0 } as any
      );

      // Border Outline
      this.featuresMenuPopupBg.lineStyle(2, 0xff88bb, 0.9);
      this.featuresMenuPopupBg.strokeRoundedRect(
        popupX - popupW / 2,
        popupY - popupH / 2,
        popupW,
        popupH,
        20,
      );
      this.featuresMenuPopupBg.lineStyle(1, 0xffffff, 0.3);
      this.featuresMenuPopupBg.strokeRoundedRect(
        popupX - popupW / 2 + 2,
        popupY - popupH / 2 + 2,
        popupW - 4,
        popupH - 4,
        18,
      );

      // Position Header — title left-aligned, X right-aligned for clarity
      this.featuresMenuTitleTxt
        .setPosition(popupX - popupW / 2 + 24, popupY - popupH / 2 + headerH / 2 + 10)
        .setOrigin(0, 0.5)
        .setFontSize(18)
        .setShadow(0, 2, '#000000', 3, true, true);
        
      this.featuresMenuCloseBtn
        .setPosition(popupX + popupW / 2 - 24, popupY - popupH / 2 + headerH / 2 + 10)
        .setOrigin(1, 0.5)
        .setFontSize(20)
        .setShadow(0, 2, '#000000', 2, true, true);

      buyX1 = popupX;
      buyX2 = popupX;
      buyY1 = popupY - popupH / 2 + headerH + 28 + buyH / 2;
      buyY2 = buyY1 + buyH + buyGap;
      
      if (!isStacked) {
        anteX = popupX;
        anteY = buyY2 + buyH / 2 + buyGap + anteH / 2;
      }
    } else {
      this.featuresMenuHitOverlay.setVisible(false);
      this.featuresMenuPopupBg.setVisible(false);
      this.featuresMenuTitleTxt.setVisible(false);
      this.featuresMenuCloseBtn.setVisible(false);
    }

    const showFeatures = !useFeaturesMenu || this.isFeaturesMenuOpen;
    const featuresDepthBase = this.isFeaturesMenuOpen ? 1501 : 20;

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
      // Regular Buy
      this.drawBuyPanel(this.panelRegularGraphics, buyW, buyH, false);
      this.buyRegularHit.setPosition(buyX1, buyY1).setSize(buyW, buyH);
      this.panelRegularGraphics.setPosition(buyX1, buyY1);
      this.updateBuyText(
        this.buyRegularTxt1,
        this.buyRegularTxt2,
        buyX1,
        buyY1,
        buyW,
        buyH,
        'REGULAR',
      );

      // Super Buy
      this.drawBuyPanel(this.panelSuperGraphics, buyW, buyH, true);
      this.buySuperHit.setPosition(buyX2, buyY2).setSize(buyW, buyH);
      this.panelSuperGraphics.setPosition(buyX2, buyY2);
      this.updateBuyText(
        this.buySuperTxt1,
        this.buySuperTxt2,
        buyX2,
        buyY2,
        buyW,
        buyH,
        'SUPER',
      );

      this.anteBetHit.setPosition(anteX, anteY).setSize(anteW, anteH);
      this.anteBetBtn.setPosition(anteX, anteY);
      this.drawAnteBetButton(anteW, anteH);
      
      // Icon + Text centered as a pair inside the pill
      const anteFontSize = Math.max(8, Math.min(14, anteH * 0.35, anteW * 0.085));
      const iconSize = Math.max(12, Math.min(20, anteH * 0.45, anteW * 0.12));
      
      this.anteBetIcon
        .setPosition(anteX - anteW * 0.28, anteY)
        .setFontSize(iconSize)
        .setOrigin(0.5, 0.5);
        
      this.anteBetTxt
        .setPosition(anteX + iconSize * 0.2, anteY)
        .setOrigin(0.5, 0.5)
        .setAlign('center')
        .setFontSize(anteFontSize);
    }

    // ==========================================
    // 4. BOTTOM BAR & HUD (delegated to BottomBarHUD)
    // ==========================================
    this.bottomBarHUD.layout(w, h, barH, isStacked, isMobile);

    // ==========================================
    // 5. TOOLBAR ICONS (Top Left)
    // ==========================================
    this.btnSettings.setPosition(toolPad, toolY);
    this.btnPaytable.setPosition(toolPad + toolGap, toolY);
    this.soundToggle.setPosition(toolPad + toolGap * 2, toolY);
    this.btnFullscreen.setPosition(toolPad + toolGap * 3, toolY);

    // Reposition icon images on top of their parent toolbar buttons
    const targetSize = isMobile ? 14 : 24;
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
    const rightMargin = w - gridX - gridH;
    const rightColCenter = gridX + gridH + rightMargin / 2;
    // ==========================================
    // 6. LOGO — responsive placement with premium glow
    // ==========================================
    // Increased base width to 460 to account for thick fonts and stroke, preventing overlap
    const LOGO_BASE_W = 460;
    const LOGO_BASE_H = 150;
    // Dynamic max logo scale to adapt to larger portrait screens (tablets) beautifully
    const MAX_LOGO_SCALE = isStacked ? Math.min(0.80, Math.max(0.42, w / 900)) : 0.85;
    const MIN_LOGO_SCALE = 0.18; // Slightly lowered to guarantee logo visibility on short devices

    let logoScale = 1;
    let logoX = 0;
    let logoY = 0;
    let showLogo = false;

    if (isStacked) {
      // Portrait: compact logo between toolbar and FS counter zone
      const availW = w * 0.75; // Increased width availability for portrait logo
      const logoZoneTop = toolY + toolbarH + 4;
      const logoZoneBot = gridY - 18; // slightly tighter gap for better spacing
      const availH = logoZoneBot - logoZoneTop;

      if (availH > 20) { // lowered minimum height constraint to keep logo visible on shorter viewports
        const scaleW = availW / LOGO_BASE_W;
        const scaleH = availH / LOGO_BASE_H;
        logoScale = Math.min(scaleW, scaleH, MAX_LOGO_SCALE);

        if (logoScale >= MIN_LOGO_SCALE) {
          showLogo = true;
          logoX = w / 2;
          logoY = logoZoneTop + availH / 2;
        }
      }
    } else if (isLandscapeMobile || rightMargin < 140) {
      // Tight landscape: above the grid
      const availW = w * 0.5;
      const availH = gridY - 5;

      if (availH > 20) {
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

      if (availW > 100 && availH > 60) {
        const scaleW = availW / LOGO_BASE_W;
        const scaleH = availH / LOGO_BASE_H;
        logoScale = Math.min(scaleW, scaleH, MAX_LOGO_SCALE);

        if (logoScale >= MIN_LOGO_SCALE) {
          showLogo = true;
          // Fix to the right wall (with 20px padding) to maximize distance from the grid
          const actualLogoWidth = LOGO_BASE_W * logoScale;
          logoX = w - actualLogoWidth / 2 - 20;
          logoY = logoRegionTop + availH * 0.25;
        }
      }
    }

    if (showLogo) {
      this.logoWrapper
        .setVisible(true)
        .setPosition(logoX, logoY)
        .setScale(logoScale);
    } else {
      this.logoWrapper.setVisible(false);
    }

    // FS Counter — cleanly above the grid frame in the reserved gap strip
    const fsFS = isStacked ? Math.min(20, w * 0.045) : Math.min(32, w * 0.055);
    const fsCounterY = gridY - Math.max(12, gridW * 0.025);
    this.txtFSRemaining
      .setPosition(w / 2, fsCounterY)
      .setOrigin(0.5, 1) // anchor to bottom so text sits above gridY
      .setFontSize(fsFS);

    if (this.stakeEngine.isReplayMode()) {
      this.replayBtnHit.setPosition(w / 2, h / 2).setSize(240, 70);
      this.replayBtnTxt.setPosition(w / 2, h / 2).setFontSize(24);
    }
  }

  private drawToolbarIcons() {
    const isMobile = this.scale.width < 768;
    const iconR = isMobile ? 13 : 20;
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
      const radius = iconR;
      const isSoundOff = type === 'sound_off';
      
      const borderColor = isSoundOff ? 0xff006a : 0xff006a;
      const borderAlpha = isSoundOff ? 0.35 : 1.0;
      const rimColor = isSoundOff ? 0xff88ff : 0xff88ff;

      // 1. Soft Drop Shadow
      obj.fillStyle(0x000000, 0.55);
      obj.fillCircle(cx, cy + 2.5, radius + 2);

      // 2. Main Glass Face (Deep gradient)
      obj.fillGradientStyle(
        0x2d174d, // Top-Left
        0x2d174d, // Top-Right
        0x0f0722, // Bottom-Left
        0x0f0722, // Bottom-Right
        0.9, 0.9, 0.95, 0.95 // Transparent alpha blend
      );
      obj.fillCircle(cx, cy, radius);

      // 3. Glare Sheen (Top Hemisphere highlight)
      obj.fillStyle(0xffffff, 0.16);
      obj.beginPath();
      obj.arc(cx, cy, radius - 1, Math.PI, 0, false);
      obj.closePath();
      obj.fillPath();

      // 4. Sharp Neon Pink Outer Rim
      obj.lineStyle(2, borderColor, borderAlpha);
      obj.strokeCircle(cx, cy, radius + 1);

      // 5. Beveled Inner Inner Edge Glow
      obj.lineStyle(1.0, rimColor, isSoundOff ? 0.15 : 0.4);
      obj.strokeCircle(cx, cy, radius - 0.5);

      // 6. Outer Subtle Glow Ring
      if (!isSoundOff) {
        obj.lineStyle(0.5, 0xffffff, 0.2);
        obj.strokeCircle(cx, cy, radius + 2.5);
      }

      // Update icon state
      if (icon) {
        icon.setAlpha(isSoundOff ? 0.35 : 0.95);
      }
      if (type === 'sound_on' && this.iconSound)
        this.iconSound.setTexture('icon_sound');
      if (type === 'sound_off' && this.iconSound)
        this.iconSound.setTexture('icon_sound_off');

      // Dynamically define non-overlapping hit areas
      const hitRadius = isMobile ? 17 : 23;
      obj.setInteractive(
        new Phaser.Geom.Circle(cx, cy, hitRadius),
        Phaser.Geom.Circle.Contains,
      );
      if (obj.input) obj.input.cursor = 'pointer';
    }
  }

  private updateBuyText(
    txt1: Phaser.GameObjects.Text,
    txt2: Phaser.GameObjects.Text,
    x: number,
    y: number,
    w: number,
    h: number,
    type: string,
  ) {
    const isStacked = this.scale.width < 650 || this.scale.height > this.scale.width;
    const isCombinedButton = isStacked && type === 'REGULAR' && !this.isFeaturesMenuOpen;
    const isSmall = h < 50;

    // Adaptive font sizes: factor in both width and height to prevent text overlap
    const fsTitle = Math.max(8, Math.min(16, h * 0.22, w * 0.1));
    const fsSub = Math.max(9, Math.min(22, h * 0.32, w * (isCombinedButton ? 0.08 : 0.12)));

    const title = isCombinedButton ? 'BUY FEATURE' : (type === 'SUPER' ? 'SUPER FREE SPINS' : 'ULTRA FREE SPINS');
    const subText = isCombinedButton ? '1000X / 500X' : (type === 'SUPER' ? '500X' : '1000X');

    const disabled = options.anteBetEnabled;
    const alpha = disabled ? 0.4 : 1;

    // At small sizes: NO stroke, only a tight 1px shadow for contrast.
    const strokeThick = isSmall ? 0 : Math.max(1, fsTitle * 0.08);
    const strokeCol = type === 'SUPER' ? '#550022' : '#553300';

    // Move text closer to center if height is small
    const yOffset1 = isSmall ? h * 0.12 : h * 0.16;
    const yOffset2 = isSmall ? h * 0.20 : h * 0.18;

    txt1
      .setText(title)
      .setPosition(x, y - yOffset1)
      .setFontSize(fsTitle)
      .setFontFamily('"Inter", "Outfit", sans-serif')
      .setFontStyle('800')
      .setLineSpacing(0)
      .setColor('#ffffff')
      .setStroke(strokeCol, strokeThick)
      .setShadow(0, 1, '#000000', isSmall ? 1 : 3, true, true)
      .setAlpha(alpha)
      .setAlign('center')
      .setOrigin(0.5); // Ensure origin is 0.5 explicitly

    txt2
      .setText(subText)
      .setPosition(x, y + yOffset2)
      .setFontSize(fsSub)
      .setFontFamily('"Inter", "Outfit", sans-serif')
      .setFontStyle('900')
      .setColor('#ffe600')
      .setStroke(strokeCol, isSmall ? 0 : Math.max(1, fsSub * 0.08))
      .setShadow(0, 1, '#000000', isSmall ? 1 : 2, true, true)
      .setAlpha(alpha)
      .setAlign('center')
      .setOrigin(0.5);
  }

  private drawBuyPanel(
    gfx: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    isSuper: boolean,
  ) {
    gfx.clear();
    // Reduce max border radius so it doesn't become a full pill on mobile, saving horizontal space
    const r = Math.min(h * 0.35, 18);
    const accentTop = isSuper ? 0xff4499 : 0xffdd44;
    const accentBot = isSuper ? 0xcc0055 : 0xcc8800;
    const accentMid = isSuper ? 0xff0066 : 0xffaa00;
    const isSmall = h < 50;

    const disabled = options.anteBetEnabled;

    // 1. Drop shadow — simple, no glow fuzz
    gfx.fillStyle(0x000000, disabled ? 0.2 : 0.45);
    gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, r);

    // 2. Main body — clean solid gradient
    if (disabled) {
      gfx.fillGradientStyle(0x444444, 0x444444, 0x222222, 0x222222, 1);
    } else {
      gfx.fillGradientStyle(accentTop, accentTop, accentBot, accentBot, 1);
    }
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);

    // 3. Top highlight — crisp, not blurred
    if (!isSmall) {
      gfx.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.4, 0.4, 0, 0);
      gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 1, w - 4, h * 0.35, {
        tl: r - 1, tr: r - 1, bl: 0, br: 0,
      } as any);
    }

    // ULTRA-specific visual flair: Gold stars / sparkles inside the button
    if (!isSuper && !disabled) {
      gfx.fillStyle(0xffffff, 0.6);
      gfx.fillCircle(-w/3, -h/4, 2);
      gfx.fillCircle(w/4, h/3, 2.5);
      gfx.fillCircle(w/2.5, -h/3, 1.5);
      gfx.fillCircle(-w/4, h/4, 2);
      
      // Distinct inner gold glow
      gfx.lineStyle(2, 0xffffee, 0.5);
      gfx.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r - 2);
    }

    // 4. Single clean border
    gfx.lineStyle(isSmall ? 1.5 : 2, disabled ? 0x666666 : accentMid, disabled ? 0.5 : 0.9);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }

  private drawAnteBetButton(bw: number, bh: number) {
    this.anteBetBtn.clear();
    const x = -bw / 2;
    const y = -bh / 2;
    const rad = bh / 2;
    const isSmall = bh < 40;
    const g = this.anteBetBtn;

    this.anteBetIcon.setVisible(true);

    if (options.anteBetEnabled) {
      // Active — amber pill
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(x + 2, y + 3, bw, bh, rad);

      g.fillGradientStyle(0xffcc44, 0xffcc44, 0x996600, 0x996600, 1);
      g.fillRoundedRect(x, y, bw, bh, rad);

      if (!isSmall) {
        g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.35, 0.35, 0, 0);
        g.fillRoundedRect(x + 2, y + 1, bw - 4, bh * 0.35, {
          tl: rad - 1, tr: rad - 1, bl: 0, br: 0,
        } as any);
      }

      g.lineStyle(isSmall ? 1 : 1.5, 0xffeebb, 0.9);
      g.strokeRoundedRect(x, y, bw, bh, rad);

      this.anteBetTxt
        .setText('ANTE BET ON\nDouble Chance')
        .setFontFamily('"Inter", "Outfit", sans-serif')
        .setFontStyle('700')
        .setColor('#ffffff')
        .setLineSpacing(isSmall ? -4 : -2)
        .setStroke('#000000', 0)
        .setShadow(0, 1, '#000000', 1, true, true);
      this.anteBetIcon
        .setColor('#ffffff')
        .setShadow(0, 0, '#ffcc00', isSmall ? 2 : 4, true, true);
    } else {
      // Inactive — soft purple pill
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(x + 2, y + 3, bw, bh, rad);

      g.fillGradientStyle(0x5a3a7a, 0x5a3a7a, 0x2a1a4a, 0x2a1a4a, 0.95);
      g.fillRoundedRect(x, y, bw, bh, rad);

      if (!isSmall) {
        g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.18, 0.18, 0, 0);
        g.fillRoundedRect(x + 2, y + 1, bw - 4, bh * 0.35, {
          tl: rad - 1, tr: rad - 1, bl: 0, br: 0,
        } as any);
      }

      g.lineStyle(isSmall ? 1 : 1.5, 0x8866bb, 0.7);
      g.strokeRoundedRect(x, y, bw, bh, rad);

      this.anteBetTxt
        .setText('ANTE BET OFF\nDouble Chance')
        .setFontFamily('"Inter", "Outfit", sans-serif')
        .setFontStyle('700')
        .setColor('#ddccff')
        .setLineSpacing(isSmall ? -4 : -2)
        .setStroke('#000000', 0)
        .setShadow(0, 1, '#000000', 1, true, true);
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
      this.spinControls.drawStopButton(
        0,
        0,
        this.spinControls['_lastSpinSize'] || 100,
      );
      this.spinControls.spinGfx.setAlpha(1);
    } else {
      // Idle: show the normal PLAY button (pink + triangle icon)
      this.spinControls.drawSpinButton(
        0,
        0,
        this.spinControls['_lastSpinSize'] || 100,
      );
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
      if (
        this._spinLock ||
        this.fsActive ||
        this.autoSpinActive ||
        this.anyOverlayOpen()
      )
        return;
      if (this.betPresetIndex > 0) {
        this.betPresetIndex--;
        options.betAmount = BET_PRESETS[this.betPresetIndex];
        this.updateBetDisplay();
        this.audio.playSound('button');
      }
    });
    this.spinControls.betPlusHit.on('pointerdown', () => {
      if (
        this._spinLock ||
        this.fsActive ||
        this.autoSpinActive ||
        this.anyOverlayOpen()
      )
        return;
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

      const isStacked = this.scale.width < 650 || this.scale.height > this.scale.width;
      if (isStacked && !this.isFeaturesMenuOpen) {
        this.audio.playSound('button');
        this.isFeaturesMenuOpen = true;
        this.layoutAll();
      } else {
        this.requestPurchase(1, 1000);
      }
    });

    // Ante Bet toggle
    this.anteBetHit.on('pointerdown', () => {
      if (this._spinLock || this.fsActive || this.anyOverlayOpen()) return;
      options.anteBetEnabled = !options.anteBetEnabled;
      if (options.anteBetEnabled) {
        this.isFeaturesMenuOpen = false;
      }
      this.layoutAll();
      this.audio.playSound('button');
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
      this.settings.syncState(
        !anyOn, 
        !anyOn,
        this.grid.turboMode,
        (this as any).graphicsQuality || 'HIGH'
      );
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
      this.settings.syncState(
        this.musicEnabled, 
        this.sfxEnabled, 
        this.grid.turboMode, 
        (this as any).graphicsQuality || 'HIGH'
      );
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
    this.spinControls.drawAutoButton(
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

      // Pulse background intensity based on win size
      const pulseIntensity = Math.min(actualWin / this.getEffectiveBet(), 3);
      this.backgroundManager.triggerWinPulse(pulseIntensity);

      // Floating win text
      const cx = this.grid.offsetX + this.grid.cellH * 3.5;
      const cy = this.grid.offsetY + this.grid.cellH * 3.5;
      const winFS = Math.max(28, this.grid.cellH * 0.7);
      const winStroke = Math.max(3, winFS * 0.18);
      const winText = this.add
        .text(
          cx,
          cy,
          `+${DisplayBalance({ amount: actualWin, currency: this.currency })}`,
          {
            resolution: 2,
            fontSize: `${winFS}px`,
            color: '#ffe600',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: winStroke,
          },
        )
        .setOrigin(0.5)
        .setDepth(25);

      this.tweens.add({
        targets: winText,
        y: cy - this.grid.cellH * 1.2,
        alpha: 0,
        duration: 1200,
        ease: 'Power1',
        onComplete: () => winText.destroy(),
      });
    };

    this.grid.onFreeSpinsStart = (count) => {
      this.fsActive = true;
      this.txtFSRemaining.setText(`${count} FREE SPINS`).setVisible(true);

      // P0 Fix: Trigger intense visual mode for free spins
      this.backgroundManager.setFreeSpinsMode(true);

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

      // P0 Fix: Restore normal background visuals
      this.backgroundManager.setFreeSpinsMode(false);

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
            `FREE SPINS TOTAL\n${DisplayBalance({ amount: totalWin, currency: this.currency })}`,
            {
              resolution: 2,
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
          resolution: 2,
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
          this.bottomBarHUD.winSymbolIcon.x =
            this.bottomBarHUD.txtLastWin.x -
            this.bottomBarHUD.txtLastWin.width *
              this.bottomBarHUD.txtLastWin.scaleX -
            18;
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

    if (options.anteBetEnabled) {
      this.errorManager.showToast('DISABLE ANTE BET TO BUY FEATURES', '#ffaa00');
      return;
    }

    const baseBet = BET_PRESETS[this.betPresetIndex];
    const cost = baseBet * betMultCost;
    const label =
      triggerType === 2
        ? T('SUPER FREE SPINS', this.stakeEngine.isSocialMode())
        : T('ULTRA FREE SPINS', this.stakeEngine.isSocialMode());

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

      // Read free spins count from server's fsTrigger event (authoritative)
      const fsEvent = stateEvents.find((e: any) => e.type === 'fsTrigger');
      const fsAwarded =
        fsEvent?.totalSpins || options.freeSpinsByScatter[3] || 10;

      this.freeSpinsIntro.play(fsAwarded, () => {
        // Set up free spins state AFTER the intro finishes
        this.grid.freeSpinsRemaining = fsAwarded;
        if (triggerType === 1) {
          this.grid.isSuperFreeSpins = true;
          // ULTRA Free Spins (1000x): x4 starting multipliers on ALL grid spots
          for (let r = 0; r < options.gridSize; r++) {
            for (let c = 0; c < options.gridSize; c++) {
              (this.grid as any).multipliers[r][c] = 4;
              (this.grid as any).drawMultiplierUI(r, c);
            }
          }
        } else if (triggerType === 2) {
          this.grid.isSuperFreeSpins = true;
          // Super Free Spins (500x): x2 starting multipliers on ALL grid spots
          for (let r = 0; r < options.gridSize; r++) {
            for (let c = 0; c < options.gridSize; c++) {
              (this.grid as any).multipliers[r][c] = 2;
              (this.grid as any).drawMultiplierUI(r, c);
            }
          }
        }
        this.fsActive = true;
        this.backgroundManager.setFreeSpinsMode(true);
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
        // Send BASE bet to RGS (not ante-adjusted) — the server applies ante multiplier via mode
        // Override triggerType to 3 ('ante') if ante bet is enabled for a base spin
        const finalTrigger = (triggerType === 0 && options.anteBetEnabled) ? 3 : triggerType;
        const result = await this.stakeEngine.play(
          BET_PRESETS[this.betPresetIndex],
          finalTrigger,
        );

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
      const distBonus = Math.abs(totalAmount - bp * 1000);
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
