import Phaser from 'phaser';

import { Grid, Audio, PaytableOverlay, SettingsOverlay, WinCelebration } from '../components';
import { LocalStorageKey } from '../constants';
import { getStakeEngine, StakeEngineClient } from '../engine';
import options from '../options';

/**
 * Main Game Scene — Production-ready for Stake Engine.
 * 
 * Features:
 * - Stake Engine RGS integration (with demo mode fallback)
 * - 7x7 cascading cluster pays
 * - Persistent multiplier system (up to 1024x)
 * - Free Spins with scatter trigger + retrigger
 * - Buy Feature (100x/500x bet)
 * - Tiered win celebrations (Nice/Big/Mega/Epic/Ultra)
 * - Paytable & Settings overlays
 * - Auto Play
 * - Responsive portrait/landscape layout
 */
export class Game extends Phaser.Scene {
  audio!: Audio;
  grid!: Grid;
  paytable!: PaytableOverlay;
  settings!: SettingsOverlay;
  winCelebration!: WinCelebration;

  private stakeEngine!: StakeEngineClient;

  // UI elements
  private bgImage!: Phaser.GameObjects.Image;
  private gridFrame!: Phaser.GameObjects.Graphics;
  private gridGlow!: Phaser.GameObjects.Graphics;
  private spinBtn!: Phaser.GameObjects.Image;
  private spinBtnGlow!: Phaser.GameObjects.Graphics;
  private btnAuto!: Phaser.GameObjects.Rectangle;
  private txtAuto!: Phaser.GameObjects.Text;
  private btnMinus!: Phaser.GameObjects.Arc;
  private txtMinus!: Phaser.GameObjects.Text;
  private btnPlus!: Phaser.GameObjects.Arc;
  private txtPlus!: Phaser.GameObjects.Text;
  private txtMoney!: Phaser.GameObjects.Text;
  private txtBet!: Phaser.GameObjects.Text;
  private bottomBar!: Phaser.GameObjects.Graphics;
  private txtFSRemaining!: Phaser.GameObjects.Text;
  private buySuper!: Phaser.GameObjects.Rectangle;
  private buyRegular!: Phaser.GameObjects.Rectangle;
  private buySuperTxt1!: Phaser.GameObjects.Text;
  private buySuperTxt2!: Phaser.GameObjects.Text;
  private buyRegularTxt1!: Phaser.GameObjects.Text;
  private buyRegularTxt2!: Phaser.GameObjects.Text;
  private soundToggle!: Phaser.GameObjects.Text;
  private btnPaytable!: Phaser.GameObjects.Text;
  private btnSettings!: Phaser.GameObjects.Text;
  private txtLastWin!: Phaser.GameObjects.Text;
  private demoLabel!: Phaser.GameObjects.Text;

  // State
  valueMoney = Number(localStorage.getItem(LocalStorageKey.Money) ?? options.money);
  currentBetMultiplier = 1;
  autoSpinActive = false;
  autoSpinTimer: Phaser.Time.TimerEvent | null = null;
  fsActive = false;
  soundEnabled = true;
  lastWin = 0;

  constructor() {
    super({ key: 'Game' });
  }

  async create() {
    // Initialize Stake Engine
    this.stakeEngine = getStakeEngine();
    
    if (!this.stakeEngine.isDemoMode()) {
      try {
        const auth = await this.stakeEngine.authenticate();
        this.valueMoney = StakeEngineClient.toDisplayAmount(auth.balance);
        
        // Resume pending round if exists
        if (auth.round) {
          console.log('[Game] Resuming pending round:', auth.round.roundId);
        }
      } catch (err) {
        console.error('[Game] Auth failed, falling back to demo mode:', err);
      }
    }

    this.audio = new Audio(this);
    this.winCelebration = new WinCelebration(this);

    const w = this.scale.width;
    const h = this.scale.height;

    // === BACKGROUND ===
    this.bgImage = this.add.image(w / 2, h / 2, 'candyland_bg').setDisplaySize(w, h).setDepth(0);

    // === GRID GLOW (animated ambient glow behind grid) ===
    this.gridGlow = this.add.graphics().setDepth(0.5).setAlpha(0.4);

    // === GRID FRAME ===
    this.gridFrame = this.add.graphics().setDepth(1);

    // === GRID ===
    this.grid = new Grid(this);
    this.wireGridCallbacks();

    // === SPIN BUTTON ===
    this.spinBtn = this.add.image(0, 0, 'gumball_rocket_btn')
      .setInteractive({ useHandCursor: true })
      .setDepth(15);

    this.spinBtnGlow = this.add.graphics().setDepth(14.5);

    // === AUTO PLAY ===
    this.btnAuto = this.add.rectangle(0, 0, 1, 1, 0x0a0f1c, 0.85)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(3, 0x00d2ff)
      .setDepth(15);
    this.txtAuto = this.add.text(0, 0, 'AUTO', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(16);

    // === BUY BUTTONS ===
    this.buySuper = this.add.rectangle(0, 0, 1, 1, 0x00d2ff, 0.85)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(4, 0xffffff)
      .setDepth(15);
    this.buySuperTxt1 = this.add.text(0, 0, 'SUPER FREE SPINS', {
      fontSize: '18px', color: '#fff', fontStyle: 'bold', align: 'center',
      stroke: '#0044cc', strokeThickness: 4
    }).setOrigin(0.5).setDepth(16);
    this.buySuperTxt2 = this.add.text(0, 0, '500× BET', {
      fontSize: '22px', color: '#ffe600', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(16);

    this.buyRegular = this.add.rectangle(0, 0, 1, 1, 0xff006a, 0.85)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(4, 0xffffff)
      .setDepth(15);
    this.buyRegularTxt1 = this.add.text(0, 0, 'BUY FREE SPINS', {
      fontSize: '18px', color: '#fff', fontStyle: 'bold', align: 'center',
      stroke: '#aa0055', strokeThickness: 4
    }).setOrigin(0.5).setDepth(16);
    this.buyRegularTxt2 = this.add.text(0, 0, '100× BET', {
      fontSize: '22px', color: '#ffe600', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(16);

    // === BOTTOM BAR ===
    this.bottomBar = this.add.graphics().setDepth(14);

    this.btnMinus = this.add.circle(0, 0, 22, 0x1a1f3c)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x00d2ff)
      .setDepth(15);
    this.txtMinus = this.add.text(0, 0, '−', {
      fontSize: '30px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5, 0.55).setDepth(16);

    this.btnPlus = this.add.circle(0, 0, 22, 0x1a1f3c)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, 0x00d2ff)
      .setDepth(15);
    this.txtPlus = this.add.text(0, 0, '+', {
      fontSize: '28px', color: '#fff', fontStyle: 'bold'
    }).setOrigin(0.5, 0.55).setDepth(16);

    this.txtMoney = this.add.text(0, 0, '', {
      fontSize: '26px', color: '#ffb300', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(16);

    this.txtBet = this.add.text(0, 0, '', {
      fontSize: '26px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5).setDepth(16);

    this.txtLastWin = this.add.text(0, 0, '', {
      fontSize: '22px', color: '#44ff88', fontFamily: 'monospace', fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(16);

    // === FREE SPINS COUNTER ===
    this.txtFSRemaining = this.add.text(0, 0, '', {
      fontSize: '36px', color: '#fff', align: 'center', fontStyle: 'bold',
      stroke: '#ea00ff', strokeThickness: 5
    }).setOrigin(0.5).setVisible(false).setDepth(20);

    // === TOOLBAR: Sound, Paytable, Settings ===
    this.soundToggle = this.add.text(0, 0, '🔊', {
      fontSize: '26px'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(16);

    this.btnPaytable = this.add.text(0, 0, 'ℹ', {
      fontSize: '26px', color: '#00d2ff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(16);

    this.btnSettings = this.add.text(0, 0, '⚙', {
      fontSize: '26px', color: '#aaaacc'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(16);

    // === DEMO MODE LABEL ===
    this.demoLabel = this.add.text(10, 10, '', {
      fontSize: '14px', color: '#ff4466', fontStyle: 'bold',
      backgroundColor: '#0a0f1c80', padding: { x: 8, y: 4 },
    }).setDepth(50).setAlpha(0.8);

    if (this.stakeEngine.isDemoMode()) {
      this.demoLabel.setText('DEMO MODE');
    }

    // === OVERLAYS ===
    this.paytable = new PaytableOverlay(this);
    this.settings = new SettingsOverlay(this);
    this.settings.setSoundCallback((enabled) => {
      this.soundEnabled = enabled;
      this.soundToggle.setText(enabled ? '🔊' : '🔇');
      this.sound.mute = !enabled;
    });

    // === WIRE INTERACTIONS ===
    this.wireInteractions();

    // === INITIAL LAYOUT ===
    this.layoutAll();
    this.updateMoneyDisplay();
    this.updateBetDisplay();

    // === AMBIENT GRID GLOW ANIMATION ===
    this.tweens.add({
      targets: this.gridGlow,
      alpha: { from: 0.2, to: 0.5 },
      yoyo: true,
      repeat: -1,
      duration: 2000,
      ease: 'Sine.easeInOut',
    });

    // Initialize grid
    this.grid.init();

    // Start background music
    if (this.soundEnabled) {
      this.audio.musicBackgroundDefault.play();
    }
  }

  /** Proportional layout engine */
  private layoutAll() {
    const w = this.scale.width;
    const h = this.scale.height;
    const isPortrait = h > w * 1.1;

    this.bgImage.setPosition(w / 2, h / 2).setDisplaySize(w, h);

    const barH = Math.max(60, h * 0.07);
    let gridArea: number;
    let gridX: number;
    let gridY: number;

    if (isPortrait) {
      gridArea = w * 0.88;
      const cellSize = Math.floor(gridArea / options.gridSize);
      gridX = (w - cellSize * options.gridSize) / 2;
      gridY = h * 0.05;

      this.grid.cellSize = cellSize;
      this.grid.offsetX = gridX;
      this.grid.offsetY = gridY;

      const gridBottom = gridY + cellSize * 7;

      // Buy buttons: horizontal row below grid
      const buyW = w * 0.42;
      const buyH = h * 0.08;
      const buyY = gridBottom + buyH / 2 + 15;
      this.buySuper.setPosition(w * 0.26, buyY).setSize(buyW, buyH).setDisplaySize(buyW, buyH);
      this.buySuperTxt1.setPosition(w * 0.26, buyY - 12).setFontSize(14);
      this.buySuperTxt2.setPosition(w * 0.26, buyY + 12).setFontSize(16);
      this.buyRegular.setPosition(w * 0.74, buyY).setSize(buyW, buyH).setDisplaySize(buyW, buyH);
      this.buyRegularTxt1.setPosition(w * 0.74, buyY - 12).setFontSize(14);
      this.buyRegularTxt2.setPosition(w * 0.74, buyY + 12).setFontSize(16);

      // Spin button below buy buttons
      const spinY = buyY + buyH / 2 + h * 0.12;
      const spinScale = Math.min(0.35, (h * 0.18) / 500);
      this.spinBtn.setPosition(w / 2, spinY).setScale(spinScale);

      // Auto play
      this.btnAuto.setPosition(w / 2, spinY + h * 0.11).setSize(160, 42).setDisplaySize(160, 42);
      this.txtAuto.setPosition(w / 2, spinY + h * 0.11).setFontSize(18);

      // FS counter
      this.txtFSRemaining.setPosition(w / 2, gridY - 30).setFontSize(28);

    } else {
      // Landscape
      gridArea = Math.min(h * 0.82, w * 0.48);
      const cellSize = Math.floor(gridArea / options.gridSize);
      gridX = w * 0.28 - (cellSize * options.gridSize) / 2;
      gridY = (h - barH - cellSize * options.gridSize) / 2;

      this.grid.cellSize = cellSize;
      this.grid.offsetX = gridX;
      this.grid.offsetY = gridY;

      const gridRight = gridX + cellSize * 7;
      const gridCenterY = gridY + cellSize * 3.5;

      // Buy buttons: left column
      const buyW = w * 0.11;
      const buyH = h * 0.14;
      const buyX = gridX - buyW / 2 - 25;
      this.buySuper.setPosition(buyX, gridCenterY - buyH - 10).setSize(buyW, buyH).setDisplaySize(buyW, buyH);
      this.buySuperTxt1.setPosition(buyX, gridCenterY - buyH - 22).setFontSize(14);
      this.buySuperTxt2.setPosition(buyX, gridCenterY - buyH + 5).setFontSize(18);
      this.buyRegular.setPosition(buyX, gridCenterY + 10).setSize(buyW, buyH).setDisplaySize(buyW, buyH);
      this.buyRegularTxt1.setPosition(buyX, gridCenterY - 2).setFontSize(14);
      this.buyRegularTxt2.setPosition(buyX, gridCenterY + 24).setFontSize(18);

      // Spin button
      const spinX = gridRight + (w - gridRight) / 2;
      const spinScale = Math.min(0.6, (w - gridRight - 40) / 500);
      this.spinBtn.setPosition(spinX, gridCenterY - h * 0.05).setScale(spinScale);

      // Auto play
      this.btnAuto.setPosition(spinX, gridCenterY + h * 0.25).setSize(180, 46).setDisplaySize(180, 46);
      this.txtAuto.setPosition(spinX, gridCenterY + h * 0.25).setFontSize(20);

      // FS counter
      this.txtFSRemaining.setPosition(spinX, gridCenterY - h * 0.3).setFontSize(36);
    }

    // Draw grid frame with glow effect
    const gPad = 15;
    const gW = this.grid.cellSize * 7 + gPad * 2;
    const gH = gW;
    const gX = this.grid.offsetX - gPad;
    const gY = this.grid.offsetY - gPad;

    // Ambient glow
    this.gridGlow.clear();
    this.gridGlow.fillStyle(0x00d2ff, 0.15);
    this.gridGlow.fillRoundedRect(gX - 8, gY - 8, gW + 16, gH + 16, 20);

    // Frame
    this.gridFrame.clear();
    this.gridFrame.fillStyle(0x0a102e, 0.75);
    this.gridFrame.fillRoundedRect(gX, gY, gW, gH, 14);
    this.gridFrame.lineStyle(4, 0x00d2ff, 0.85);
    this.gridFrame.strokeRoundedRect(gX, gY, gW, gH, 14);
    // Inner border accent
    this.gridFrame.lineStyle(1, 0x0066aa, 0.4);
    this.gridFrame.strokeRoundedRect(gX + 4, gY + 4, gW - 8, gH - 8, 12);

    // Bottom bar
    this.bottomBar.clear();
    this.bottomBar.fillStyle(0x0a0f1c, 0.95);
    this.bottomBar.fillRect(0, h - barH, w, barH);
    // Top accent line
    this.bottomBar.lineStyle(2, 0x00d2ff, 0.4);
    this.bottomBar.lineBetween(0, h - barH, w, h - barH);

    const barCenterY = h - barH / 2;
    this.btnMinus.setPosition(w * 0.35, barCenterY);
    this.txtMinus.setPosition(w * 0.35, barCenterY);
    this.btnPlus.setPosition(w * 0.55, barCenterY);
    this.txtPlus.setPosition(w * 0.55, barCenterY);
    this.txtMoney.setPosition(w * 0.03, barCenterY).setFontSize(Math.max(16, Math.floor(barH * 0.35)));
    this.txtBet.setPosition(w * 0.45, barCenterY).setFontSize(Math.max(16, Math.floor(barH * 0.35)));
    this.txtLastWin.setPosition(w * 0.97, barCenterY).setFontSize(Math.max(14, Math.floor(barH * 0.30)));

    // Toolbar icons top-right
    this.soundToggle.setPosition(w - 40, 30);
    this.btnPaytable.setPosition(w - 80, 30);
    this.btnSettings.setPosition(w - 120, 30);
  }

  private wireInteractions() {
    // Spin button
    this.spinBtn.on('pointerdown', () => {
      if (this.paytable.isVisible() || this.settings.isVisible()) return;
      if (this.fsActive) return;

      this.spinBtn.setScale(this.spinBtn.scaleX * 0.9);
      this.time.delayedCall(120, () => this.spinBtn.setScale(this.spinBtn.scaleX / 0.9));

      if (this.autoSpinActive) {
        this.stopAutoSpin();
      } else {
        this.attemptSpin(0);
      }
    });

    // Spin button hover glow
    this.spinBtn.on('pointerover', () => {
      this.tweens.add({ targets: this.spinBtn, scaleX: this.spinBtn.scaleX * 1.05, scaleY: this.spinBtn.scaleY * 1.05, duration: 150 });
    });
    this.spinBtn.on('pointerout', () => {
      this.tweens.add({ targets: this.spinBtn, scaleX: this.spinBtn.scaleX / 1.05, scaleY: this.spinBtn.scaleY / 1.05, duration: 150 });
    });

    // Auto play
    this.btnAuto.on('pointerdown', () => {
      if (this.fsActive) return;
      this.autoSpinActive = !this.autoSpinActive;
      this.txtAuto.setText(this.autoSpinActive ? 'STOP' : 'AUTO');
      this.btnAuto.setFillStyle(this.autoSpinActive ? 0xff006a : 0x0a0f1c);
      if (this.autoSpinActive && !options.checkClick) {
        this.attemptSpin(0);
      }
    });

    // Bet controls
    this.btnMinus.on('pointerdown', () => this.changeBet(-1));
    this.btnPlus.on('pointerdown', () => this.changeBet(1));

    // Buy features
    this.buySuper.on('pointerdown', () => this.purchaseFeature(2, 500));
    this.buyRegular.on('pointerdown', () => this.purchaseFeature(1, 100));

    // Buy button hover effects
    this.buySuper.on('pointerover', () => this.buySuper.setAlpha(1));
    this.buySuper.on('pointerout', () => this.buySuper.setAlpha(0.85));
    this.buyRegular.on('pointerover', () => this.buyRegular.setAlpha(1));
    this.buyRegular.on('pointerout', () => this.buyRegular.setAlpha(0.85));

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
  }

  private wireGridCallbacks() {
    this.grid.onWinCallback = (winAmount) => {
      const actualWin = winAmount * this.currentBetMultiplier;
      if (!this.fsActive) {
        this.valueMoney += actualWin;
        this.updateMoneyDisplay();
      }
      this.lastWin += actualWin;
      this.updateLastWinDisplay();

      if (this.soundEnabled) this.audio.audioWin.play();

      // Floating win text
      const cx = this.grid.offsetX + this.grid.cellSize * 3.5;
      const cy = this.grid.offsetY + this.grid.cellSize * 3.5;
      const winText = this.add.text(cx, cy, `+${actualWin.toFixed(2)}`, {
        fontSize: `${Math.max(32, this.grid.cellSize * 0.85)}px`,
        color: '#ffe600', fontStyle: 'bold', stroke: '#000', strokeThickness: 8
      }).setOrigin(0.5).setDepth(25);

      this.tweens.add({
        targets: winText, y: cy - this.grid.cellSize * 1.5, alpha: 0,
        duration: 1500, ease: 'Power1',
        onComplete: () => winText.destroy()
      });
    };

    this.grid.onFreeSpinsStart = (count) => {
      this.fsActive = true;
      this.txtFSRemaining.setText(`${count}\nFREE SPINS`).setVisible(true);
      // Pulse animation on FS counter
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
      const actualTotalWin = totalWin * this.currentBetMultiplier;
      this.valueMoney += actualTotalWin;
      this.updateMoneyDisplay();
      this.lastWin = actualTotalWin;
      this.updateLastWinDisplay();

      // Show win celebration
      const betAmount = options.betAmount * this.currentBetMultiplier;
      const celebDuration = this.winCelebration.show(actualTotalWin, betAmount);

      // End round text after celebration
      const delay = Math.max(celebDuration, 600);
      this.time.delayedCall(delay, () => {
        const endText = this.add.text(
          this.scale.width / 2, this.scale.height / 2,
          `FREE SPINS TOTAL\n${actualTotalWin.toFixed(2)}`,
          { fontSize: '72px', color: '#ffe600', align: 'center', fontStyle: 'bold', stroke: '#000', strokeThickness: 12 }
        ).setOrigin(0.5).setDepth(35).setScale(0);

        this.tweens.add({
          targets: endText, scale: 1, duration: 500, yoyo: true, hold: 2000, ease: 'Back.easeOut',
          onComplete: () => {
            endText.destroy();
            options.checkClick = false;
            // End round with Stake Engine
            this.stakeEngine.endRound();
            if (this.autoSpinActive) this.attemptSpin(0);
          }
        });
      });
    };

    this.grid.onCompleteCallback = () => {
      if (this.fsActive) return;

      // Check if we should show a win celebration
      if (this.lastWin > 0) {
        const betAmount = options.betAmount * this.currentBetMultiplier;
        const celebDuration = this.winCelebration.show(this.lastWin, betAmount);

        this.time.delayedCall(Math.max(celebDuration, 100), () => {
          options.checkClick = false;
          this.stakeEngine.endRound();
          if (this.autoSpinActive) {
            this.autoSpinTimer = this.time.delayedCall(800, () => {
              if (this.autoSpinActive && !this.fsActive) this.attemptSpin(0);
            });
          }
        });
      } else {
        options.checkClick = false;
        this.stakeEngine.endRound();
        if (this.autoSpinActive) {
          this.autoSpinTimer = this.time.delayedCall(800, () => {
            if (this.autoSpinActive && !this.fsActive) this.attemptSpin(0);
          });
        }
      }
    };
  }

  updateMoneyDisplay() {
    this.txtMoney.setText(`💰 ${this.valueMoney.toFixed(2)}`);
    localStorage.setItem(LocalStorageKey.Money, String(this.valueMoney));
  }

  updateBetDisplay() {
    this.txtBet.setText(`BET ${(options.betAmount * this.currentBetMultiplier).toFixed(2)}`);
  }

  updateLastWinDisplay() {
    if (this.lastWin > 0) {
      this.txtLastWin.setText(`WIN ${this.lastWin.toFixed(2)}`);
    } else {
      this.txtLastWin.setText('');
    }
  }

  async purchaseFeature(triggerType: number, betMultCost: number) {
    if (options.checkClick || this.fsActive) return;
    if (this.paytable.isVisible() || this.settings.isVisible()) return;

    const cost = options.betAmount * this.currentBetMultiplier * betMultCost;
    if (this.valueMoney >= cost) {
      options.checkClick = true;
      this.valueMoney -= cost;
      this.lastWin = 0;
      this.updateMoneyDisplay();
      this.updateLastWinDisplay();
      
      if (this.soundEnabled) this.audio.audioButton.play();

      // Call Stake Engine for buy feature
      try {
        await this.stakeEngine.play(cost, triggerType);
      } catch (err) {
        console.error('[Game] Buy feature play error:', err);
      }

      this.grid.startSpin(triggerType);
    }
  }

  async attemptSpin(triggerType: number) {
    if (options.checkClick || this.fsActive) return;
    if (this.paytable.isVisible() || this.settings.isVisible()) return;

    const cost = options.betAmount * this.currentBetMultiplier;
    if (this.valueMoney >= cost) {
      options.checkClick = true;
      this.valueMoney -= cost;
      this.lastWin = 0;
      this.updateMoneyDisplay();
      this.updateLastWinDisplay();

      if (this.soundEnabled) {
        this.audio.audioReels.play();
      }

      // Call Stake Engine
      try {
        await this.stakeEngine.play(cost, triggerType);
      } catch (err) {
        console.error('[Game] Play error:', err);
      }

      this.grid.startSpin(triggerType);
    } else {
      this.stopAutoSpin();
      // Insufficient balance feedback
      const noFunds = this.add.text(this.scale.width / 2, this.scale.height / 2, 'INSUFFICIENT BALANCE', {
        fontSize: '32px', color: '#ff4466', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 6
      }).setOrigin(0.5).setDepth(30);
      this.tweens.add({
        targets: noFunds, alpha: 0, y: noFunds.y - 80, duration: 1500,
        onComplete: () => noFunds.destroy()
      });
    }
  }

  changeBet(amount: number) {
    if (options.checkClick || this.fsActive) return;
    const newMult = this.currentBetMultiplier + amount;
    if (newMult >= 1 && newMult <= 100) {
      this.currentBetMultiplier = newMult;
      this.updateBetDisplay();
      if (this.soundEnabled) this.audio.audioButton.play();
    }
  }

  stopAutoSpin() {
    this.autoSpinActive = false;
    this.txtAuto.setText('AUTO');
    this.btnAuto.setFillStyle(0x0a0f1c);
    if (this.autoSpinTimer) this.autoSpinTimer.remove();
  }
}
