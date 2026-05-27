import Phaser from 'phaser';
import type { Game } from './Game';
import { attemptSpin, executePurchase } from './SpinManager';
import options, { BET_PRESETS } from '../options';
import { DisplayBalance } from '../helpers/Currency';
import { T } from '../helpers/I18n';

export function updateSpinButtonState(this: Game) {
    this.updateUIInteractivity();
    if (!this.spinControls?.spinGfx) return;

    // Visual transformation: Play ▶ ↔ Stop ■ (Sugar Blast 1000 standard)
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

export function updateUIInteractivity(this: Game) {
    const spinning = this._spinLock;
    const inFS = this.fsActive;
    const inAuto = this.autoSpinActive;
    const busy = spinning || inFS || inAuto;

    // ——— Bet +/- buttons ———
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

    // ——— Buy Free Spins panels ———
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

    // ——— Ante Bet toggle ———
    const anteDisabled = busy;
    this.anteBetBtn.setAlpha(anteDisabled ? 0.3 : 1);
    this.anteBetTxt.setAlpha(anteDisabled ? 0.4 : 1);
    this.anteBetIcon.setAlpha(anteDisabled ? 0.4 : 1);
    if (anteDisabled) {
      this.anteBetHit.disableInteractive();
    } else {
      this.anteBetHit.setInteractive();
    }

    // ——— Settings & Paytable ——— (disabled during active spin only)
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

    // ——— Sound toggle & Fullscreen → ALWAYS enabled ———
    this.soundToggle.setAlpha(1);
    this.btnFullscreen.setAlpha(1);
  }

export function wireInteractions(this: Game) {
    // Spin button — game logic only (tactile feedback is handled by SpinControls)
    this.spinControls.spinHit.on('pointerdown', () => {
      handleUniversalAction.call(this);
    });

    // Auto play
    this.spinControls.autoHit.on('pointerdown', () => {
      if (this.fsActive || anyOverlayOpen.call(this)) return;
      this.audio.playSound('button');
      if (!this.autoSpinActive) {
        // Check balance before opening overlay
        const cost = getEffectiveBet.call(this);
        if (this.valueMoney < cost) {
          this.errorManager.showToast('INSUFFICIENT FUNDS', '#ff4466');
          return;
        }
        this.autoPlayOverlay.show(this.stakeEngine.isTurboDisabled());
      } else {
        this.skipScreensActive = false;
        this.stopAutoSpin();
      }
    });

    // Bet controls — directly cycle through bet presets (Sugar Blast 1000 behavior)
    this.spinControls.betMinusHit.on('pointerdown', () => {
      if (
        this._spinLock ||
        this.fsActive ||
        this.autoSpinActive ||
        anyOverlayOpen.call(this)
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
        anyOverlayOpen.call(this)
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
          let baseScale = this.baseScaleMap.get(t);
          if (!baseScale) {
            baseScale = { x: t.scaleX, y: t.scaleY };
            this.baseScaleMap.set(t, baseScale);
          }
          this.tweens.add({
            targets: t,
            scaleX: baseScale.x * 1.1,
            scaleY: baseScale.y * 1.1,
            duration: 150,
            ease: 'Back.easeOut',
          });
        });
      });
      hit.on('pointerout', () => {
        const targets = Array.isArray(target) ? target : [target];
        targets.forEach((t) => {
          const baseScale = this.baseScaleMap.get(t);
          if (baseScale) {
            this.tweens.add({
              targets: t,
              scaleX: baseScale.x,
              scaleY: baseScale.y,
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
      if (this._spinLock || this.fsActive || anyOverlayOpen.call(this)) return;
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
      requestPurchase.call(this, 2, 500);
    });
    this.buyRegularHit.on('pointerdown', () => {
      if (this._spinLock || this.fsActive || anyOverlayOpen.call(this)) return;
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
        requestPurchase.call(this, 1, 1000);
      }
    });

    // Ante Bet toggle
    this.anteBetHit.on('pointerdown', () => {
      if (this._spinLock || this.fsActive || anyOverlayOpen.call(this)) return;
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
      if (anyOverlayOpen.call(this)) return;
      const anyOn = this.musicEnabled || this.sfxEnabled;
      this.musicEnabled = !anyOn;
      this.sfxEnabled = !anyOn;
      this.audio.setMusicMuted(anyOn);
      this.audio.setSfxMuted(anyOn);
      this.settings.syncState(
        !anyOn, 
        !anyOn,
        this.grid.turboMode,
        this.graphicsQuality || 'HIGH'
      );
      this.drawToolbarIcons();
      // Only play the button sound if we just turned sounds ON
      if (!anyOn) this.audio.playSound('button');
    });

    // Paytable
    this.btnPaytable.on('pointerdown', () => {
      if (anyOverlayOpen.call(this)) return;
      this.audio.playSound('button');
      this.paytable.toggle();
    });

    // Settings
    this.btnSettings.on('pointerdown', () => {
      if (anyOverlayOpen.call(this)) return;
      this.audio.playSound('button');
      this.settings.syncState(
        this.musicEnabled, 
        this.sfxEnabled, 
        this.grid.turboMode, 
        this.graphicsQuality || 'HIGH'
      );
      this.settings.toggle();
    });

    // Fullscreen
    this.btnFullscreen.on('pointerdown', () => {
      if (anyOverlayOpen.call(this)) return;
      this.audio.playSound('button');
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
      } else {
        this.scale.startFullscreen();
      }
    });
  }

export function handleUniversalAction(this: Game) {
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
      attemptSpin.call(this, 0);
    }
  }

export function updateAutoSpinDisplay(this: Game) {
    this.spinControls.drawAutoButton(
      this.autoSpinActive,
      this.autoSpinRemaining,
    );
  }

export function anyOverlayOpen(this: Game): boolean {
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

export function getEffectiveBet(this: Game): number {
    const baseBet = BET_PRESETS[this.betPresetIndex];
    return options.anteBetEnabled
      ? baseBet * options.anteBetCostMultiplier
      : baseBet;
  }

export function requestPurchase(this: Game, triggerType: number, betMultCost: number) {
    if (this._spinLock || this.fsActive || anyOverlayOpen.call(this)) return;

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
      () => executePurchase.call(this, triggerType, baseBet, cost),
      () => {
        /* cancelled */
      },
    );
  }
