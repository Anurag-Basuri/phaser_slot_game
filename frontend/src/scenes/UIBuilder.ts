import { wireGridCallbacks, attemptSpin } from './SpinManager';
import { executeReplay } from './ReplayManager';
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
import { computeLayout } from '../constants/LayoutEngine';
import type { Game } from './Game';
import options, { BET_PRESETS } from '../options';
import { T } from '../helpers/I18n';
  export function buildUI(this: Game) {
    const w = this.scale.width;
    const h = this.scale.height;

    // === BACKGROUND (Dynamic Sugar Blast 1000 animations) ===
    this.backgroundManager = new BackgroundManager(this);

    // === GRID PANEL (authentic Sugar Blast 1000 frame image) ===
    this.gridPanel = this.add.image(0, 0, 'grid_panel').setDepth(1);

    // === GRID ===
    this.grid = new Grid(this);
    wireGridCallbacks.call(this);

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
    } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);
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
      .text(0, 0, '\u25CF', { resolution: 2, fontFamily: '"Poppins", sans-serif' })
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
        fontSize: '28px',
        color: '#ffffff',
        align: 'center',
        fontStyle: '900',
        fontFamily: '"Inter", "Outfit", sans-serif',
        stroke: '#8800ff',
        strokeThickness: 5,
        shadow: {
          offsetX: 0,
          offsetY: 2,
          color: '#330066',
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
      if (btn.input) btn.input.cursor = 'pointer';
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

    // Bet overlay callback ΓÇö updates game bet index
    this.betOverlay.setCallback((newIndex) => {
      this.betPresetIndex = newIndex;
      options.betAmount = BET_PRESETS[this.betPresetIndex];
      this.updateBetDisplay();
      this.audio.playSound('button');
    });

    this.autoPlayOverlay.setCallbacks((spins, turbo, quick, skip) => {
      this.grid.turboMode = turbo;
      this.grid.quickMode = quick && !turbo;
      this.skipScreensActive = skip;
      this.autoSpinActive = true;
      this.autoSpinRemaining = spins;
      this.updateAutoSpinDisplay();
      if (!this._spinLock) {
        attemptSpin.call(this, 0);
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
      this.graphicsQuality = quality;
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
      this.bottomBarHUD.hideForReplay();

      this.logoWrapper.setVisible(false);

      // spin controls already hidden above

      this.replayBtnHit = this.add
        .rectangle(0, 0, 240, 70, 0xff006a)
        .setStrokeStyle(3, 0xffffff, 1)
        .setInteractive({ useHandCursor: true })
        .setDepth(55)
        .on('pointerdown', () => executeReplay.call(this));
      this.replayBtnTxt = this.add
        .text(0, 0, 'Γû╢ START REPLAY', {
          resolution: 2,
          fontSize: '24px',
          fontFamily: '"Luckiest Guy", cursive, sans-serif',
          color: '#fff',
        })
        .setOrigin(0.5)
        .setDepth(56);
    }
  }


