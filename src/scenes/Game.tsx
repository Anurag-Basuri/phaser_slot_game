import Phaser from 'phaser';

import { Grid, Audio } from '../components';
import { LocalStorageKey } from '../constants';
import options from '../options';

export class Game extends Phaser.Scene {
  audio!: Audio;
  grid!: Grid;
  
  txtMoney!: Phaser.GameObjects.Text;
  txtBet!: Phaser.GameObjects.Text;
  
  valueMoney = Number(localStorage.getItem(LocalStorageKey.Money) ?? options.money);
  currentBetMultiplier = 1;
  baseBet = 10;
  
  spinButton!: Phaser.GameObjects.Image | Phaser.GameObjects.Shape;
  autoSpinActive = false;
  autoSpinTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: 'Game' });
  }

  create() {
    this.audio = new Audio(this);

    const w = this.scale.width;
    const h = this.scale.height;

    // 1. Background
    this.add.rectangle(0, 0, w, h, 0x1a0f2e).setOrigin(0,0);
    this.add.graphics()
        .fillGradientStyle(0x3a1f4e, 0x3a1f4e, 0x1a0f2e, 0x1a0f2e, 1)
        .fillRect(0, 0, w, h);

    // 2. Buy Feature Buttons Area (Top)
    this.add.graphics().fillStyle(0x000000, 0.4).fillRect(0, 50, w, 150);
    
    // Super Free Spins button
    const btnSuperFS = this.add.rectangle(w/2 - 160, 125, 300, 100, 0x00d2ff, 0.8)
        .setInteractive({ useHandCursor: true }).setStrokeStyle(4, 0xffffff);
    this.add.text(w/2 - 160, 105, 'BUY SUPER\nFREE SPINS', { fontSize: '24px', color: '#fff', align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(w/2 - 160, 150, '500,000.00', { fontSize: '20px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    
    // Normal Free Spins button
    const btnFS = this.add.rectangle(w/2 + 160, 125, 300, 100, 0xff006a, 0.8)
        .setInteractive({ useHandCursor: true }).setStrokeStyle(4, 0xffffff);
    this.add.text(w/2 + 160, 105, 'BUY\nFREE SPINS', { fontSize: '24px', color: '#fff', align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(w/2 + 160, 150, '100,000.00', { fontSize: '20px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

    // 3. Grid Background Frame
    this.add.rectangle(w/2, 580, 580, 580, 0x000000, 0.5).setStrokeStyle(6, 0xffffff);

    // 4. Initialize Grid
    this.grid = new Grid(this);
    this.grid.onWinCallback = (winAmount) => {
        const actualWin = winAmount * this.currentBetMultiplier;
        this.valueMoney += actualWin;
        this.updateMoneyDisplay();
        this.audio.audioWin.play();
        
        // Float win text
        const winText = this.add.text(w/2, 580, `+${actualWin.toLocaleString()}`, { fontSize: '60px', color: '#ffe600', fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(20);
        this.tweens.add({ targets: winText, y: 480, alpha: 0, duration: 1500, onComplete: () => winText.destroy() });
    };
    
    this.grid.onCompleteCallback = () => {
        options.checkClick = false;
        
        if (this.autoSpinActive) {
            this.autoSpinTimer = this.time.delayedCall(1500, () => {
                if (this.autoSpinActive) this.attemptSpin();
            });
        }
    };

    // 5. Bottom Stake UI Bar
    this.add.graphics().fillStyle(0x0a0a0f, 1).fillRect(0, h - 350, w, 350);
    
    // Spin Button (Giant Circular)
    const spinCircle = this.add.circle(w/2, h - 180, 80, 0x222222).setInteractive({ useHandCursor: true }).setStrokeStyle(4, 0xffffff);
    const spinIcon = this.add.text(w/2, h - 180, '↻', { fontSize: '100px', color: '#ffffff' }).setOrigin(0.5);
    
    // Auto Spin Text/Button
    const btnAuto = this.add.rectangle(w/2, h - 250, 200, 40, 0x333333, 1).setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0xffffff);
    const txtAuto = this.add.text(w/2, h - 250, 'AUTO PLAY', { fontSize: '18px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

    // Minus Bet Button
    const btnMinus = this.add.circle(w/2 - 150, h - 180, 30, 0x333333).setInteractive({ useHandCursor: true });
    this.add.text(w/2 - 150, h - 180, '-', { fontSize: '40px', color: '#fff' }).setOrigin(0.5);

    // Plus Bet Button
    const btnPlus = this.add.circle(w/2 + 150, h - 180, 30, 0x333333).setInteractive({ useHandCursor: true });
    this.add.text(w/2 + 150, h - 180, '+', { fontSize: '30px', color: '#fff' }).setOrigin(0.5);

    // Credit and Bet Display (Bottom)
    this.txtMoney = this.add.text(w/2 - 100, h - 60, `CREDIT d${this.valueMoney.toLocaleString()}`, { fontSize: '28px', color: '#ffb300', fontFamily: '"Courier New", Courier, monospace', fontStyle: 'bold' }).setOrigin(1, 0.5);
    this.txtBet = this.add.text(w/2 + 100, h - 60, `BET d${(this.baseBet * this.currentBetMultiplier).toLocaleString()}`, { fontSize: '28px', color: '#cecece', fontFamily: '"Courier New", Courier, monospace', fontStyle: 'bold' }).setOrigin(0, 0.5);

    // Interactions
    btnMinus.on('pointerdown', () => this.changeBet(-1));
    btnPlus.on('pointerdown', () => this.changeBet(1));

    btnAuto.on('pointerdown', () => {
        this.autoSpinActive = !this.autoSpinActive;
        txtAuto.setText(this.autoSpinActive ? 'STOP AUTO' : 'AUTO PLAY');
        btnAuto.setFillStyle(this.autoSpinActive ? 0xff006a : 0x333333);
        if (this.autoSpinActive && !options.checkClick) {
            this.attemptSpin();
        }
    });

    spinCircle.on('pointerdown', () => {
        spinCircle.setScale(0.9);
        this.time.delayedCall(100, () => spinCircle.setScale(1));
        
        if (this.autoSpinActive) {
            this.autoSpinActive = false;
            txtAuto.setText('AUTO PLAY');
            btnAuto.setFillStyle(0x333333);
            if (this.autoSpinTimer) this.autoSpinTimer.remove();
        } else {
            this.attemptSpin();
        }
    });
  }

  updateMoneyDisplay() {
      this.txtMoney.setText(`CREDIT d${this.valueMoney.toLocaleString()}`);
      localStorage.setItem(LocalStorageKey.Money, String(this.valueMoney));
  }

  attemptSpin() {
      if (!options.checkClick && this.valueMoney >= this.baseBet * this.currentBetMultiplier) {
          options.checkClick = true;
          this.audio.musicDefault.play();
          
          this.valueMoney -= this.baseBet * this.currentBetMultiplier;
          this.updateMoneyDisplay();
          
          this.grid.startSpin();
      } else if (this.valueMoney < this.baseBet * this.currentBetMultiplier) {
          // Can't spin, stop auto
          this.autoSpinActive = false;
      }
  }

  changeBet(amount: number) {
      if (!options.checkClick) {
          const newMult = this.currentBetMultiplier + amount;
          if (newMult >= 1 && newMult <= 100) {
              this.currentBetMultiplier = newMult;
              
              options.coin = this.baseBet;
              options.line = this.currentBetMultiplier;

              this.txtBet.setText(`BET d${(this.baseBet * this.currentBetMultiplier).toLocaleString()}`);
          }
      }
  }
}
