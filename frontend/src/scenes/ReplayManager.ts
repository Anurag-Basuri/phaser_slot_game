import Phaser from 'phaser';
import type { Game } from './Game';
import options, { BET_PRESETS } from '../options';
import { StakeEngineClient } from '../engine/StakeEngineClient';

  export async function executeReplay(this: Game) {
    this.replayBtnHit.setVisible(false);
    this.replayBtnTxt.setVisible(false);

    const replayScale = Math.min(1.5, Math.max(0.4, this.scale.width / 800));
    const loadTxt = this.add.text(this.scale.width / 2, this.scale.height / 2, 'LOADING REPLAY...', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: `${32 * replayScale}px`,
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: loadTxt, alpha: 0.5, duration: 400, yoyo: true, repeat: -1 });

    // We fetch replayData state bypassing normal play triggers
    const replayData = await this.stakeEngine.fetchReplay();
    loadTxt.destroy();

    const stateEvents = replayData.state || [];

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

    this.grid.processServerEvents(stateEvents);
  }
  export function handlePendingRound(this: Game, round: any) {
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
      `[Game] Pending round detected Ã¢â‚¬â€ restored bet amount to ${options.betAmount} (total cost: ${totalAmount})`,
    );
    
    const stateEvents = round.state || [];
    if (stateEvents.length > 0) {
      this._spinLock = true;
      this.updateSpinButtonState();
      
      const fsEvent = stateEvents.find((e: any) => e.type === 'fsTrigger');
      if (fsEvent) {
        this.grid.isSuperFreeSpins = fsEvent.triggerType === 'super';
        this.grid.freeSpinsRemaining = fsEvent.totalSpins || 0;
      }
      
      // Let grid play out the events. When finished, its standard callbacks will call endRound().
      this.grid.processServerEvents(stateEvents);
    } else {
      this.stakeEngine
        .endRound()
        .catch((e) => console.warn('[Game] endRound error:', e));
    }
  }
  export function saveSpinRecord(this: Game, _winAmount: number, _feature: string) {
    // Stateless Ã¢â‚¬â€ no local history tracking.
    // All game history is server-authoritative via Stake Engine.
  }
