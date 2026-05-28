import Phaser from 'phaser';
import type { Game } from './Game';
import { StakeError, StakeEngineClient } from '../engine/StakeEngineClient';
import { DisplayBalance } from '../helpers/Currency';
import { BET_PRESETS } from '../options';
import { saveSpinRecord } from './ReplayManager';
import options from '../options';

  export function wireGridCallbacks(this: Game) {
    // Disconnect recovery: save animation progress after each RGS event completes
    // SDK spec: POST /bet/event { sessionID, event } ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â allows player to resume from correct point on reconnect
    this.grid.onEventProcessed = (eventIndex: number) => {
      this.stakeEngine.saveEvent(eventIndex.toString());
    };

    this.grid.onWinCallback = (winAmount, symbolId) => {
      const actualWin = winAmount;
      if (!this.fsActive) {
        this.valueMoney += actualWin;
        this.updateMoneyDisplay();
        this.lastWin += actualWin;

        const symKey = symbolId !== undefined ? `candy_${symbolId}` : undefined;
        this.updateLastWinDisplay(symKey);
      }
      // During free spins, don't track lastWin per cascade ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
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
      this.audio.playMusic('musicFreeSpins', 800);

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
            saveSpinRecord.call(this, totalWin, 'free_spins');
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
                if (this.autoSpinActive && !this.fsActive) attemptSpin.call(this, 0);
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
      // MAX WIN reached ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â show special celebration
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
      
      // Fix: Must prepare the grid (sweep old symbols, reset state) before dropping new spin events
      this.grid.prepareSpin();

      // In production, the Stake RGS returns ALL free spin events in a single play() response.
      // The grid processes them sequentially via its event queue. When finishRound() decrements
      // freeSpinsRemaining and calls onNextFreeSpinNeeded, the remaining FS events are already
      // queued — we must NOT call play() again or the server will reject it.
      // Only call play() in demo mode where each free spin needs a separate outcome.
      if (this.stakeEngine.isDemoMode()) {
        this.stakeEngine.play(options.betAmount, 0).then(result => {
          const stateEvents = result.round?.state || [];
          this.grid.processServerEvents(stateEvents);
        }).catch(err => {
          console.error('[Game] onNextFreeSpinNeeded play error:', err);
          this.grid.abortSpin();
          this._spinLock = false;
          handleSpinFailure.call(this, err);
        });
      }
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
        saveSpinRecord.call(this, this.lastWin, 'base');
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
          const delay = this.grid.turboMode ? 50 : 600;
          this.autoSpinTimer = this.time.delayedCall(delay, () => {
            if (this.autoSpinActive && !this.fsActive) attemptSpin.call(this, 0);
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
  export async function executePurchase(this: Game, 
    triggerType: number,
    baseBet: number,
    totalCost: number,
  ) {
    this._spinLock = true;
    this.isFeaturesMenuOpen = false; // Close the buy menu popup immediately upon confirmation
    this.layoutAll();
    
    this.updateSpinButtonState();
    if (this.stakeEngine.isDemoMode()) {
      this.valueMoney -= totalCost;
      this.updateMoneyDisplay();
    }
    this.lastWin = 0;
    options.betAmount = BET_PRESETS[this.betPresetIndex];
    this.updateLastWinDisplay();

    this.audio.playSound('button');

    this.grid.prepareSpin();

    try {
      // Send BASE bet to RGS ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â  the mode ('bonus'/'super') tells server the multiplier
      const result = await this.stakeEngine.play(baseBet, triggerType);
      const stateEvents = result.round?.state || [];

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
        // NOTE: Do NOT pre-set grid.freeSpinsRemaining here!
        if (triggerType === 1) {
          this.grid.isSuperFreeSpins = true;
          this.grid.superMultiplier = 4;
          this.grid.seedMultipliers(4);
        } else if (triggerType === 2) {
          this.grid.isSuperFreeSpins = true;
          this.grid.superMultiplier = 2;
          this.grid.seedMultipliers(2);
        }
        this.fsActive = true;
        this.backgroundManager.setFreeSpinsMode(true);
        this.txtFSRemaining
          .setText(`${this.grid.freeSpinsRemaining} FREE SPINS`)
          .setVisible(true);
        this.audio.playMusic('musicFreeSpins', 800);
        this.grid.processServerEvents(stateEvents);
      });
    } catch (err) {
      console.error('[Game] Buy feature error:', err);
      this.grid.abortSpin();
      this._spinLock = false;
      this.stopAutoSpin();

      // Do NOT blindly refund balance ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â resync with server
      handleSpinFailure.call(this, err);
    }
  }
  export function parseRevealBoard(this: Game, board: any[][]): number[][] {
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
  export async function attemptSpin(this: Game, triggerType: number) {
    if (
      this._spinLock ||
      this._recovering ||
      this.fsActive ||
      this.anyOverlayOpen()
    ) {
      // If auto-spin is active but we're temporarily blocked (e.g. settings open),
      // patiently wait and retry instead of silently breaking the loop forever.
      if (this.autoSpinActive && !this.fsActive && !this._recovering) {
        if (this.autoSpinTimer) this.autoSpinTimer.destroy();
        this.autoSpinTimer = this.time.delayedCall(500, () => {
          if (this.autoSpinActive) attemptSpin.call(this, triggerType);
        });
      }
      return;
    }

    const cost = this.getEffectiveBet();
    if (this.valueMoney >= cost) {
      this._spinLock = true;
      if (this.stakeEngine.isDemoMode()) {
        this.valueMoney -= cost;
        this.updateMoneyDisplay();
      }
      this.lastWin = 0;
      // Bug 8: Store the BASE bet, not the ante-adjusted cost, for payout calculation
      options.betAmount = BET_PRESETS[this.betPresetIndex];
      this.updateLastWinDisplay();

      this.audio.playReels();

      this.grid.prepareSpin();
      this.updateSpinButtonState();

      try {
        // Send BASE bet to RGS (not ante-adjusted) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â the server applies ante multiplier via mode
        // Override triggerType to 3 ('ante') if ante bet is enabled for a base spin
        const finalTrigger = (triggerType === 0 && options.anteBetEnabled) ? 3 : triggerType;
        const result = await this.stakeEngine.play(
          BET_PRESETS[this.betPresetIndex],
          finalTrigger,
        );

        const stateEvents = result.round?.state || [];

        // Update balance from server response (authoritative)
        if (result.balance && !this.stakeEngine.isDemoMode()) {
          this.valueMoney = StakeEngineClient.toDisplayAmount(
            result.balance.amount,
          );
          this.updateMoneyDisplay();
        }

        this.grid.processServerEvents(stateEvents);
      } catch (err) {
        console.error('[Game] Play error:', err);
        this.grid.abortSpin();
        this._spinLock = false;
        this.stopAutoSpin();

        // Do NOT blindly refund balance ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â resync with server
        handleSpinFailure.call(this, err);
        return;
      }
    } else {
      this.stopAutoSpin();
      this.errorManager.showToast('INSUFFICIENT FUNDS', '#ff4466');
    }
  }
  export function handleSpinFailure(this: Game, err: unknown): void {
    // Close any overlays that might be open
    if (this.paytable.isVisible()) this.paytable.hide();
    if (this.settings.isVisible()) this.settings.hide();
    if (this.confirmDialog.isVisible()) this.confirmDialog.dismiss();

    const isAuth = err instanceof StakeError && err.code === 'AUTH';
    const headline = isAuth ? 'SESSION EXPIRED' : 'CONNECTION LOST';

    if (isAuth) {
      // Unrecoverable ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â session is dead
      this.errorManager.showBlockingError(
        headline,
        async () => {
          throw new Error('Session expired');
        },
        () => window.location.reload(),
      );
    } else {
      // Recoverable ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â show retry modal that resyncs balance
      this.errorManager.showBlockingError(headline, () =>
        resyncAfterError.call(this),
      );
    }
  }
  export async function resyncAfterError(this: Game): Promise<void> {
    this._recovering = true;
    console.log('[Game] Attempting resync with server...');

    try {
      const state = await this.stakeEngine.resync();

      // Server provided the true balance ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â overwrite local state
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

      // Clean up ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no local state to clear

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
