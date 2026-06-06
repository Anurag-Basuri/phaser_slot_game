import { layoutAll, drawToolbarIcons } from './LayoutManager';
import { attemptSpin, executePurchase, resyncAfterError } from './SpinManager';
import { handlePendingRound } from './ReplayManager';
import { wireInteractions, handleUniversalAction, updateSpinButtonState as _updateSpinButtonState, updateUIInteractivity as _updateUIInteractivity, updateAutoSpinDisplay as _updateAutoSpinDisplay, anyOverlayOpen as _anyOverlayOpen, getEffectiveBet as _getEffectiveBet } from './InteractionWiring';
import { buildUI } from './UIBuilder';
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
import { computeLayout } from '../constants/LayoutEngine';

/**
 * Main Game Scene Ã¢â‚¬â€ Production-ready for Stake Engine.
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

  public stakeEngine!: StakeEngineClient;
  public skipScreensActive = false;

  // UI elements
  public backgroundManager!: BackgroundManager;
  public gridPanel!: Phaser.GameObjects.Image;
  public logoWrapper!: Phaser.GameObjects.Container;
  public logoContainer!: Phaser.GameObjects.Container;
  public logoText1!: Phaser.GameObjects.Text;
  public logoText2!: Phaser.GameObjects.Text;
  private logoGlow!: Phaser.GameObjects.Graphics;
  public gridFrame!: Phaser.GameObjects.Graphics;
  public panelSuperGraphics!: Phaser.GameObjects.Graphics;
  public panelRegularGraphics!: Phaser.GameObjects.Graphics;

  public txtFSRemaining!: Phaser.GameObjects.Text;
  public buySuperHit!: Phaser.GameObjects.Rectangle;
  public buyRegularHit!: Phaser.GameObjects.Rectangle;
  public buySuperTxt1!: Phaser.GameObjects.Text;
  public buySuperTxt2!: Phaser.GameObjects.Text;
  public buyRegularTxt1!: Phaser.GameObjects.Text;
  public buyRegularTxt2!: Phaser.GameObjects.Text;
  public soundToggle!: Phaser.GameObjects.Graphics;
  public iconSound!: Phaser.GameObjects.Image;
  public btnPaytable!: Phaser.GameObjects.Graphics;
  public iconPaytable!: Phaser.GameObjects.Image;
  public btnSettings!: Phaser.GameObjects.Graphics;
  public iconSettings!: Phaser.GameObjects.Image;
  public btnFullscreen!: Phaser.GameObjects.Graphics;
  public iconFullscreen!: Phaser.GameObjects.Image;
  // Ante Bet
  public anteBetBtn!: Phaser.GameObjects.Graphics;
  public anteBetHit!: Phaser.GameObjects.Rectangle;
  public anteBetTxt!: Phaser.GameObjects.Text;
  public anteBetIcon!: Phaser.GameObjects.Text;

  // Features Menu (for small screens)
  public btnFeaturesMenuGraphics!: Phaser.GameObjects.Graphics;
  public btnFeaturesMenuHit!: Phaser.GameObjects.Rectangle;
  public btnFeaturesMenuIcon!: Phaser.GameObjects.Text;
  public featuresMenuPopupBg!: Phaser.GameObjects.Graphics;
  public featuresMenuHitOverlay!: Phaser.GameObjects.Rectangle;
  public featuresMenuTitleTxt!: Phaser.GameObjects.Text;
  public featuresMenuCloseBtn!: Phaser.GameObjects.Text;
  public isFeaturesMenuOpen = false;

  // Replay UI
  public replayBtnHit!: Phaser.GameObjects.Rectangle;
  public replayBtnTxt!: Phaser.GameObjects.Text;

  // State Ã¢â‚¬â€ balance always starts from options.money in demo, or from Stake Engine auth
  valueMoney = options.money;
  currency = 'USD';
  betPresetIndex = options.defaultBetIndex;
  autoSpinActive = false;
  autoSpinStopOnFeature = false;
  autoSpinRemaining = 0; // 0 = infinite when autoSpinActive
  autoSpinTimer: Phaser.Time.TimerEvent | null = null;
  fsActive = false;
  musicEnabled = true;
  sfxEnabled = true;
  lastWin = 0;
  private _winCountTween?: Phaser.Tweens.Tween;
  private _displayedWin = 0;

  // Spin lock Ã¢â‚¬â€ prevents double-trigger across pointer + keyboard
  public _spinLock = false;
  public _recovering = false; // True while resync is in progress
  private _resizeTimer: ReturnType<typeof setTimeout> | null = null;
  public graphicsQuality: string = 'HIGH';
  public baseScaleMap = new Map<any, { x: number; y: number }>();

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

        if (auth.config) {
          const minBet = auth.config.minBet || 100000;
          const maxBet = auth.config.maxBet || 240000000;
          const stepBet = auth.config.stepBet || 100000; // Enforce stepBet

          let rawLevels: number[] = [];
          if (auth.config.betLevels && auth.config.betLevels.length > 0) {
            rawLevels = auth.config.betLevels;
          } else {
            let current = minBet;
            while (current <= maxBet) {
              rawLevels.push(current);
              current += stepBet;
            }
          }

          BET_PRESETS.length = 0;
          for (const val of rawLevels) {
            // Strict modulo validation to prevent rejecting play requests
            if (val >= minBet && val <= maxBet && (val - minBet) % stepBet === 0) {
              const displayVal = StakeEngineClient.toDisplayAmount(val);
              if (!BET_PRESETS.includes(displayVal)) {
                BET_PRESETS.push(displayVal);
              }
            }
          }

          if (BET_PRESETS.length === 0) {
            BET_PRESETS.push(StakeEngineClient.toDisplayAmount(minBet)); // Fallback
          }

          const defaultDisplay = StakeEngineClient.toDisplayAmount(
            auth.config.defaultBetLevel || auth.config.minBet || 1000000,
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
          // Unrecoverable Ã¢â‚¬â€ session is invalid, must relaunch
          this.errorManager.showBlockingError(
            'SESSION EXPIRED',
            async () => {
              throw new Error('Session expired Ã¢â‚¬â€ cannot retry');
            },
            () => window.location.reload(),
          );
        } else {
          // Network error Ã¢â‚¬â€ allow retry
          this.errorManager.showBlockingError('CONNECTION FAILED', () =>
            resyncAfterError.call(this),
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

    // NOW fill the grid with symbols Ã¢â‚¬â€ positions are correct
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

    // Resize handler Ã¢â‚¬â€ debounced to prevent frame spikes during drag
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

    // Keyboard support Ã¢â‚¬â€ both SPACE and ENTER start/stop the spin (official spec)
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
      handlePendingRound.call(this, pendingRound);
    } else {
      if (!this.stakeEngine.isReplayMode()) {
        this.introSplash.show(() => {});
      }
    }
  }

  private buildUI() { buildUI.call(this); }

  /** Proportional layout engine Ã¢â‚¬â€  handles all responsive modes */
  public layoutAll() { layoutAll.call(this); }
  public drawToolbarIcons() { drawToolbarIcons.call(this); }
  public updateSpinButtonState() { _updateSpinButtonState.call(this); }
  public updateUIInteractivity() { _updateUIInteractivity.call(this); }
  public handleUniversalAction() { handleUniversalAction.call(this); }
  public updateAutoSpinDisplay() { _updateAutoSpinDisplay.call(this); }
  public anyOverlayOpen(): boolean { return _anyOverlayOpen.call(this); }
  public getEffectiveBet(): number { return _getEffectiveBet.call(this); }
  private wireInteractions() { wireInteractions.call(this); }


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
    this.bottomBarHUD.updateLastWinDisplay(
      this.lastWin,
      this.currency,
      this.getEffectiveBet(),
      symbolKey
    );
  }



  /**
   * Parse a 'reveal' event board from the RGS into a number[][] of symbol IDs.
   * RGS format: board[row][col] = {symbol: "L3", id: 0, reel: col, row: row}
   * Frontend needs: number[][] where each value is the symbol ID (0-7).
   */


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
    this.autoSpinStopOnFeature = false;
    this.skipScreensActive = false;
    this.updateAutoSpinDisplay();
    this.updateSpinButtonState();
    if (this.autoSpinTimer) {
      this.autoSpinTimer.remove();
      this.autoSpinTimer = null;
    }
  }

  // ==========================================
  // REPLAY EXECUTION
  // ==========================================



  /**
   * Handle a spin/purchase failure.
   * Instead of blindly refunding the local balance, show a blocking error
   * and attempt to resync with the server to get the authoritative balance.
   */

  /**
   * Resync with the RGS after a network failure.
   * Fetches the authoritative wallet balance and updates the local state.
   * On success, unlocks the game. On failure, the error modal stays visible.
   */
}
