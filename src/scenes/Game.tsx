import Phaser from 'phaser';

import { Grid, Audio } from '../components';
import { LocalStorageKey } from '../constants';
import options from '../options';

export class Game extends Phaser.Scene {
  audio!: Audio;
  grid!: Grid;

  // UI elements that need repositioning on resize
  private bgImage!: Phaser.GameObjects.Image;
  private gridFrame!: Phaser.GameObjects.Graphics;
  private spinBtn!: Phaser.GameObjects.Image;
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

  valueMoney = Number(localStorage.getItem(LocalStorageKey.Money) ?? options.money);
  currentBetMultiplier = 1;
  autoSpinActive = false;
  autoSpinTimer: Phaser.Time.TimerEvent | null = null;
  fsActive = false;
  soundEnabled = true;

  constructor() {
    super({ key: 'Game' });
  }

  create() {
    this.audio = new Audio(this);
    const w = this.scale.width;
    const h = this.scale.height;

    // === BACKGROUND ===
    this.bgImage = this.add.image(w / 2, h / 2, 'candyland_bg').setDisplaySize(w, h).setDepth(0);

    // === GRID FRAME ===
    this.gridFrame = this.add.graphics().setDepth(1);

    // === GRID ===
    this.grid = new Grid(this);
    this.wireGridCallbacks();

    // === RIGHT PANEL: Spin Button ===
    this.spinBtn = this.add.image(0, 0, 'gumball_rocket_btn')
      .setInteractive({ useHandCursor: true })
      .setDepth(15);

    // === RIGHT PANEL: Auto Play ===
    this.btnAuto = this.add.rectangle(0, 0, 1, 1, 0x0a0f1c, 0.85)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(3, 0x00d2ff)
      .setDepth(15);
    this.txtAuto = this.add.text(0, 0, 'AUTO PLAY', {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(16);

    // === LEFT PANEL: Buy Buttons ===
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

    // === FREE SPINS COUNTER ===
    this.txtFSRemaining = this.add.text(0, 0, '', {
      fontSize: '36px', color: '#fff', align: 'center', fontStyle: 'bold',
      stroke: '#ea00ff', strokeThickness: 5
    }).setOrigin(0.5).setVisible(false).setDepth(20);

    // === SOUND TOGGLE ===
    this.soundToggle = this.add.text(0, 0, '🔊', {
      fontSize: '28px'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(16);

    // === WIRE INTERACTIONS ===
    this.wireInteractions();

    // === INITIAL LAYOUT ===
    this.layoutAll();
    this.updateMoneyDisplay();

    // Initialize grid with current layout dimensions
    this.grid.init();
  }

  /** Proportional layout engine — positions everything based on current canvas size */
  private layoutAll() {
    const w = this.scale.width;
    const h = this.scale.height;
    const isPortrait = h > w * 1.1;

    // Background fill
    this.bgImage.setPosition(w / 2, h / 2).setDisplaySize(w, h);

    // Calculate grid cell size to fit in available space
    const barH = Math.max(60, h * 0.07);
    let gridArea: number;
    let gridX: number;
    let gridY: number;

    if (isPortrait) {
      // Portrait: grid uses full width, top section
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

      // Auto play below spin
      this.btnAuto.setPosition(w / 2, spinY + h * 0.11).setSize(180, 44).setDisplaySize(180, 44);
      this.txtAuto.setPosition(w / 2, spinY + h * 0.11).setFontSize(18);

      // FS counter
      this.txtFSRemaining.setPosition(w / 2, gridY - 30).setFontSize(28);

    } else {
      // Landscape: grid center-left, controls on right
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

      // Spin button: right of grid
      const spinX = gridRight + (w - gridRight) / 2;
      const spinScale = Math.min(0.6, (w - gridRight - 40) / 500);
      this.spinBtn.setPosition(spinX, gridCenterY - h * 0.05).setScale(spinScale);

      // Auto play below spin
      this.btnAuto.setPosition(spinX, gridCenterY + h * 0.25).setSize(200, 50).setDisplaySize(200, 50);
      this.txtAuto.setPosition(spinX, gridCenterY + h * 0.25).setFontSize(22);

      // FS counter
      this.txtFSRemaining.setPosition(spinX, gridCenterY - h * 0.3).setFontSize(36);
    }

    // Draw grid frame
    this.gridFrame.clear();
    this.gridFrame.fillStyle(0x0a102e, 0.75);
    this.gridFrame.fillRoundedRect(
      this.grid.offsetX - 15, this.grid.offsetY - 15,
      this.grid.cellSize * 7 + 30, this.grid.cellSize * 7 + 30, 14
    );
    this.gridFrame.lineStyle(6, 0x00d2ff, 0.9);
    this.gridFrame.strokeRoundedRect(
      this.grid.offsetX - 15, this.grid.offsetY - 15,
      this.grid.cellSize * 7 + 30, this.grid.cellSize * 7 + 30, 14
    );

    // Bottom bar
    this.bottomBar.clear();
    this.bottomBar.fillStyle(0x0a0f1c, 0.95);
    this.bottomBar.fillRect(0, h - barH, w, barH);

    const barCenterY = h - barH / 2;
    this.btnMinus.setPosition(w * 0.38, barCenterY);
    this.txtMinus.setPosition(w * 0.38, barCenterY);
    this.btnPlus.setPosition(w * 0.62, barCenterY);
    this.txtPlus.setPosition(w * 0.62, barCenterY);
    this.txtMoney.setPosition(w * 0.03, barCenterY).setFontSize(Math.max(18, Math.floor(barH * 0.38)));
    this.txtBet.setPosition(w * 0.50, barCenterY).setFontSize(Math.max(18, Math.floor(barH * 0.38)));

    // Sound toggle top-right
    this.soundToggle.setPosition(w - 40, 30);
  }

  private wireInteractions() {
    this.spinBtn.on('pointerdown', () => {
      if (this.fsActive) return;
      this.spinBtn.setScale(this.spinBtn.scaleX * 0.9);
      this.time.delayedCall(120, () => this.spinBtn.setScale(this.spinBtn.scaleX / 0.9));
      if (this.autoSpinActive) {
        this.stopAutoSpin();
      } else {
        this.attemptSpin(0);
      }
    });

    this.btnAuto.on('pointerdown', () => {
      if (this.fsActive) return;
      this.autoSpinActive = !this.autoSpinActive;
      this.txtAuto.setText(this.autoSpinActive ? 'STOP AUTO' : 'AUTO PLAY');
      this.btnAuto.setFillStyle(this.autoSpinActive ? 0xff006a : 0x0a0f1c);
      if (this.autoSpinActive && !options.checkClick) {
        this.attemptSpin(0);
      }
    });

    this.btnMinus.on('pointerdown', () => this.changeBet(-1));
    this.btnPlus.on('pointerdown', () => this.changeBet(1));

    this.buySuper.on('pointerdown', () => this.purchaseFeature(2, 500));
    this.buyRegular.on('pointerdown', () => this.purchaseFeature(1, 100));

    this.soundToggle.on('pointerdown', () => {
      this.soundEnabled = !this.soundEnabled;
      this.soundToggle.setText(this.soundEnabled ? '🔊' : '🔇');
      this.sound.mute = !this.soundEnabled;
    });
  }

  private wireGridCallbacks() {
    this.grid.onWinCallback = (winAmount) => {
      const actualWin = winAmount * this.currentBetMultiplier;
      if (!this.fsActive) {
        this.valueMoney += actualWin;
        this.updateMoneyDisplay();
      }
      if (this.soundEnabled) this.audio.audioWin.play();

      // Floating win text at grid center
      const cx = this.grid.offsetX + this.grid.cellSize * 3.5;
      const cy = this.grid.offsetY + this.grid.cellSize * 3.5;
      const winText = this.add.text(cx, cy, `+${actualWin.toFixed(2)}`, {
        fontSize: `${Math.max(36, this.grid.cellSize)}px`,
        color: '#ffe600', fontStyle: 'bold', stroke: '#000', strokeThickness: 8
      }).setOrigin(0.5).setDepth(25);

      this.tweens.add({
        targets: winText, y: cy - this.grid.cellSize * 2, alpha: 0,
        duration: 1800, ease: 'Power1',
        onComplete: () => winText.destroy()
      });

      // Big win celebration for 10x+ bet
      if (actualWin >= options.betAmount * this.currentBetMultiplier * 10) {
        this.showBigWin(actualWin);
      }
    };

    this.grid.onFreeSpinsStart = (count) => {
      this.fsActive = true;
      this.txtFSRemaining.setText(`${count}\nFREE SPINS`).setVisible(true);
    };

    this.grid.onFreeSpinsEnd = (totalWin) => {
      this.fsActive = false;
      this.txtFSRemaining.setVisible(false);
      const actualTotalWin = totalWin * this.currentBetMultiplier;
      this.valueMoney += actualTotalWin;
      this.updateMoneyDisplay();

      const endText = this.add.text(
        this.scale.width / 2, this.scale.height / 2,
        `TOTAL WIN\n${actualTotalWin.toFixed(2)}`,
        { fontSize: '80px', color: '#ffe600', align: 'center', fontStyle: 'bold', stroke: '#000', strokeThickness: 14 }
      ).setOrigin(0.5).setDepth(35).setScale(0);

      this.tweens.add({
        targets: endText, scale: 1, duration: 600, yoyo: true, hold: 2500, ease: 'Back.easeOut',
        onComplete: () => {
          endText.destroy();
          options.checkClick = false;
          if (this.autoSpinActive) this.attemptSpin(0);
        }
      });
    };

    this.grid.onCompleteCallback = () => {
      if (this.fsActive) return;
      options.checkClick = false;
      if (this.autoSpinActive) {
        this.autoSpinTimer = this.time.delayedCall(1000, () => {
          if (this.autoSpinActive && !this.fsActive) this.attemptSpin(0);
        });
      }
    };
  }

  private showBigWin(amount: number) {
    const overlay = this.add.graphics().setDepth(28);
    overlay.fillStyle(0x000000, 0.5);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);

    const bigText = this.add.text(
      this.scale.width / 2, this.scale.height / 2,
      `🎉 BIG WIN! 🎉\n${amount.toFixed(2)}`,
      { fontSize: '96px', color: '#ffe600', align: 'center', fontStyle: 'bold', stroke: '#ff0066', strokeThickness: 12 }
    ).setOrigin(0.5).setDepth(29).setScale(0);

    // Coin shower particles
    for (let i = 0; i < 8; i++) {
      const px = Phaser.Math.Between(this.scale.width * 0.1, this.scale.width * 0.9);
      const emitter = this.add.particles(px, -20, 'candy_' + Phaser.Math.Between(0, 6), {
        speed: { min: 100, max: 400 },
        angle: { min: 60, max: 120 },
        scale: { start: 0.4, end: 0.1 },
        lifespan: 2500,
        quantity: 2,
        gravityY: 200,
        frequency: 150
      });
      this.time.delayedCall(3000, () => { emitter.stop(); this.time.delayedCall(3000, () => emitter.destroy()); });
    }

    this.tweens.add({
      targets: bigText, scale: 1, duration: 800, ease: 'Back.easeOut', yoyo: true, hold: 2000,
      onComplete: () => { bigText.destroy(); overlay.destroy(); }
    });
  }

  updateMoneyDisplay() {
    this.txtMoney.setText(`CREDIT  ${this.valueMoney.toFixed(2)}`);
    localStorage.setItem(LocalStorageKey.Money, String(this.valueMoney));
  }

  purchaseFeature(triggerType: number, betMultCost: number) {
    if (options.checkClick || this.fsActive) return;
    const cost = options.betAmount * this.currentBetMultiplier * betMultCost;
    if (this.valueMoney >= cost) {
      options.checkClick = true;
      this.valueMoney -= cost;
      this.updateMoneyDisplay();
      if (this.soundEnabled) this.audio.audioButton.play();
      this.grid.startSpin(triggerType);
    }
  }

  attemptSpin(triggerType: number) {
    if (options.checkClick || this.fsActive) return;
    const cost = options.betAmount * this.currentBetMultiplier;
    if (this.valueMoney >= cost) {
      options.checkClick = true;
      this.valueMoney -= cost;
      this.updateMoneyDisplay();
      if (this.soundEnabled) {
        this.audio.audioReels.play();
      }
      this.grid.startSpin(triggerType);
    } else {
      this.stopAutoSpin();
    }
  }

  changeBet(amount: number) {
    if (options.checkClick || this.fsActive) return;
    const newMult = this.currentBetMultiplier + amount;
    if (newMult >= 1 && newMult <= 100) {
      this.currentBetMultiplier = newMult;
      this.txtBet.setText(`BET  ${(options.betAmount * this.currentBetMultiplier).toFixed(2)}`);
      if (this.soundEnabled) this.audio.audioButton.play();
    }
  }

  stopAutoSpin() {
    this.autoSpinActive = false;
    this.txtAuto.setText('AUTO PLAY');
    this.btnAuto.setFillStyle(0x0a0f1c);
    if (this.autoSpinTimer) this.autoSpinTimer.remove();
  }
}
