import Phaser from 'phaser';

import { Grid, Audio } from '../components';
import { LocalStorageKey } from '../constants';
import options from '../options';

export class Game extends Phaser.Scene {
  audio!: Audio;
  grid!: Grid;
  
  txtMoney!: Phaser.GameObjects.Text;
  txtBet!: Phaser.GameObjects.Text;
  txtFSRemaining!: Phaser.GameObjects.Text;
  
  valueMoney = Number(localStorage.getItem(LocalStorageKey.Money) ?? options.money);
  currentBetMultiplier = 1; // Used over 'lines' conceptually
  baseBet = 10;
  
  spinBtn!: Phaser.GameObjects.Image;
  autoSpinActive = false;
  autoSpinTimer: Phaser.Time.TimerEvent | null = null;
  fsActive = false;

  constructor() {
    super({ key: 'Game' });
  }

  create() {
    this.audio = new Audio(this);

    const w = this.scale.width;
    const h = this.scale.height;

    // 1. Background
    this.add.image(w/2, h/2, 'candyland_bg').setDisplaySize(w, h); // Fully stretch/fit to background

    // 2. Buy Feature Buttons Area (Left-Middle panel next to grid)
    this.add.rectangle(w/2 - 800, h/2 - 200, 260, 160, 0x00d2ff, 0.8)
        .setInteractive({ useHandCursor: true }).setStrokeStyle(6, 0xffffff)
        .on('pointerdown', () => this.purchaseFeature(2, 500));
    this.add.text(w/2 - 800, h/2 - 230, 'SUPER RNG SPINS', { fontSize: '24px', color: '#fff', align: 'center', fontStyle: 'bold', stroke: '#0055ff', strokeThickness: 6 }).setOrigin(0.5);
    this.add.text(w/2 - 800, h/2 - 180, '500x BET', { fontSize: '28px', color: '#ffea00', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);

    this.add.rectangle(w/2 - 800, h/2, 260, 160, 0xff006a, 0.8)
        .setInteractive({ useHandCursor: true }).setStrokeStyle(6, 0xffffff)
        .on('pointerdown', () => this.purchaseFeature(1, 100));
    this.add.text(w/2 - 800, h/2 - 30, 'BUY\nFREE SPINS', { fontSize: '24px', color: '#fff', align: 'center', fontStyle: 'bold', stroke: '#ff00aa', strokeThickness: 6 }).setOrigin(0.5);
    this.add.text(w/2 - 800, h/2 + 30, '100x BET', { fontSize: '28px', color: '#ffbd00', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);

    // 3. Main Grid Background Frame (Slightly left of center for widescreen)
    const gridX = w/2 - 450;
    const gridY = h/2 - 350;
    this.add.graphics()
      .fillStyle(0x0a102e, 0.7)
      .fillRoundedRect(gridX - 25, gridY - 25, options.symbolSize * 7 + 50, options.symbolSize * 7 + 50, 16)
      .lineStyle(10, 0x00d2ff, 1)
      .strokeRoundedRect(gridX - 25, gridY - 25, options.symbolSize * 7 + 50, options.symbolSize * 7 + 50, 16);

    // 4. Initialize Grid
    this.grid = new Grid(this, gridX, gridY);
    this.grid.onWinCallback = (winAmount) => {
        const actualWin = winAmount * this.currentBetMultiplier;
        if (!this.fsActive) {
            this.valueMoney += actualWin;
            this.updateMoneyDisplay();
        }
        this.audio.audioWin.play();
        
        // Float win text
        const winText = this.add.text(gridX + 350, gridY + 350, `+${actualWin.toLocaleString()}`, { fontSize: '80px', color: '#ffe600', fontStyle: 'bold', stroke: '#000', strokeThickness: 10 }).setOrigin(0.5).setDepth(20);
        this.tweens.add({ targets: winText, y: gridY + 150, alpha: 0, duration: 2000, ease: 'Power1', onComplete: () => winText.destroy() });
    };

    // Tracker for Free spins
    this.txtFSRemaining = this.add.text(w/2 + 450, h/2 - 250, `0\nFREE SPINS`, { fontSize: '40px', color: '#fff', align: 'center', fontStyle: 'bold', stroke: '#ea00ff', strokeThickness: 6 }).setOrigin(0.5).setVisible(false);

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
        
        const endText = this.add.text(w/2, h/2, `TOTAL FS WIN:\n${actualTotalWin.toLocaleString()}`, { fontSize: '100px', color: '#ffe600', align: 'center', fontStyle: 'bold', stroke: '#000', strokeThickness: 16 }).setOrigin(0.5).setDepth(30).setScale(0);
        this.tweens.add({ targets: endText, scale: 1, duration: 600, yoyo: true, hold: 3000, ease: 'Back.easeOut', 
            onComplete: () => {
                endText.destroy();
                // Resume loop if auto
                options.checkClick = false;
                if (this.autoSpinActive) this.attemptSpin(0);
            }
        });
    };

    this.grid.onCompleteCallback = () => {
        if (this.fsActive) return; // Grid handles internal looping during FS
        
        options.checkClick = false;
        if (this.autoSpinActive) {
            this.autoSpinTimer = this.time.delayedCall(1200, () => {
                if (this.autoSpinActive && !this.fsActive) this.attemptSpin(0);
            });
        }
    };

    // 5. Gumball Rocket Spin UI (Right Side)
    this.spinBtn = this.add.image(w/2 + 450, h/2 + 100, 'gumball_rocket_btn')
        .setInteractive({ useHandCursor: true })
        .setScale(0.85);

    // Auto Play Button
    const btnAuto = this.add.rectangle(w/2 + 450, h/2 + 350, 240, 60, 0x000000, 0.8).setInteractive({ useHandCursor: true }).setStrokeStyle(4, 0xffffff);
    const txtAuto = this.add.text(w/2 + 450, h/2 + 350, 'AUTO PLAY', { fontSize: '26px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

    // 6. Stake Bottom Betting Bar
    const barHeight = 80;
    this.add.graphics().fillStyle(0x0a0f1c, 0.95).fillRect(0, h - barHeight, w, barHeight);
    
    const btnMinus = this.add.circle(w/2 - 200, h - barHeight/2, 25, 0x333333).setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0xffffff);
    this.add.text(w/2 - 200, h - barHeight/2, '-', { fontSize: '36px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5, 0.55);

    const btnPlus = this.add.circle(w/2 + 200, h - barHeight/2, 25, 0x333333).setInteractive({ useHandCursor: true }).setStrokeStyle(2, 0xffffff);
    this.add.text(w/2 + 200, h - barHeight/2, '+', { fontSize: '30px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5, 0.55);

    this.txtMoney = this.add.text(100, h - barHeight/2, `CREDIT d ${this.valueMoney.toLocaleString()}`, { fontSize: '32px', color: '#ffb300', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.txtBet = this.add.text(w/2, h - barHeight/2, `BET d ${(this.baseBet * this.currentBetMultiplier).toLocaleString()}`, { fontSize: '32px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold' }).setOrigin(0.5, 0.5);

    // Interactions
    btnMinus.on('pointerdown', () => this.changeBet(-1));
    btnPlus.on('pointerdown', () => this.changeBet(1));

    btnAuto.on('pointerdown', () => {
        if (this.fsActive) return;
        this.autoSpinActive = !this.autoSpinActive;
        txtAuto.setText(this.autoSpinActive ? 'STOP AUTO' : 'AUTO PLAY');
        btnAuto.setFillStyle(this.autoSpinActive ? 0xff006a : 0x000000);
        if (this.autoSpinActive && !options.checkClick) {
            this.attemptSpin(0);
        }
    });

    this.spinBtn.on('pointerdown', () => {
        if (this.fsActive) return;
        
        this.spinBtn.setScale(0.80);
        this.time.delayedCall(150, () => this.spinBtn.setScale(0.85));
        
        if (this.autoSpinActive) {
            this.autoSpinActive = false;
            txtAuto.setText('AUTO PLAY');
            btnAuto.setFillStyle(0x000000);
            if (this.autoSpinTimer) this.autoSpinTimer.remove();
        } else {
            this.attemptSpin(0);
        }
    });
  }

  updateMoneyDisplay() {
      this.txtMoney.setText(`CREDIT d ${this.valueMoney.toLocaleString()}`);
      localStorage.setItem(LocalStorageKey.Money, String(this.valueMoney));
  }

  purchaseFeature(triggerType: number, betMultiplierCost: number) {
      if (options.checkClick || this.fsActive) return;
      
      const cost = (this.baseBet * this.currentBetMultiplier) * betMultiplierCost;
      if (this.valueMoney >= cost) {
          options.checkClick = true;
          this.valueMoney -= cost;
          this.updateMoneyDisplay();
          this.grid.startSpin(triggerType);
      }
  }

  attemptSpin(triggerType: number) {
      if (!options.checkClick && !this.fsActive) {
          const cost = this.baseBet * this.currentBetMultiplier;
          if (this.valueMoney >= cost) {
              options.checkClick = true;
              this.audio.musicDefault.play();
              
              this.valueMoney -= cost;
              this.updateMoneyDisplay();
              
              this.grid.startSpin(triggerType);
          } else {
              this.autoSpinActive = false; // Stop auto if broke
          }
      }
  }

  changeBet(amount: number) {
      if (!options.checkClick && !this.fsActive) {
          const newMult = this.currentBetMultiplier + amount;
          if (newMult >= 1 && newMult <= 100) {
              this.currentBetMultiplier = newMult;
              
              options.coin = this.baseBet;
              options.line = this.currentBetMultiplier;
              this.txtBet.setText(`BET d ${(this.baseBet * this.currentBetMultiplier).toLocaleString()}`);
          }
      }
  }
}
