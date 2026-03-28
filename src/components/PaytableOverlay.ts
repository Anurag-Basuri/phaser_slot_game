import Phaser from 'phaser';
import options from '../options';

/**
 * In-game Paytable / Info overlay.
 * Shows all symbol payouts, multiplier rules, and feature descriptions.
 */
export class PaytableOverlay {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;

  private symbolNames = [
    'Red Gummy Bear', 'Yellow Star', 'Purple Jelly Bean',
    'Green Candy', 'Pink Heart', 'Orange Slice', 'Blue Gumdrop'
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.build();
  }

  private build() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.container = this.scene.add.container(0, 0).setDepth(50).setVisible(false);

    // Dark overlay
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x050a1a, 0.92);
    bg.fillRect(0, 0, w, h);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(w / 2, 40, 'PAYTABLE & RULES', {
      fontSize: '36px', color: '#00d2ff', fontStyle: 'bold',
      stroke: '#003366', strokeThickness: 4,
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Close button
    const closeBtn = this.scene.add.text(w - 50, 30, '✕', {
      fontSize: '40px', color: '#ff4466',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff8899'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ff4466'));
    this.container.add(closeBtn);

    // === SYMBOL PAYOUTS ===
    let yPos = 100;
    const colWidths = [180, 50, 55, 55, 55, 60, 65, 70, 75, 85, 90, 100];
    const tierLabels = ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15+'];

    // Header row
    const headerStyle = { fontSize: '14px', color: '#aaaabb', fontStyle: 'bold' };
    let xOff = 60;
    this.container.add(this.scene.add.text(xOff, yPos, 'SYMBOL', headerStyle));
    xOff = 240;
    for (let i = 0; i < tierLabels.length; i++) {
      this.container.add(this.scene.add.text(xOff + i * 58, yPos, tierLabels[i], headerStyle).setOrigin(0.5, 0));
    }
    yPos += 30;

    // Separator
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0x334466, 0.6);
    sep.lineBetween(40, yPos, w - 40, yPos);
    this.container.add(sep);
    yPos += 10;

    // Symbol rows (highest paying first)
    const order = [6, 5, 4, 3, 2, 1, 0];
    for (const symId of order) {
      // Symbol icon
      const icon = this.scene.add.sprite(80, yPos + 20, `candy_${symId}`);
      const iconScale = 40 / Math.max(icon.width, icon.height);
      icon.setScale(Math.min(iconScale, 0.6));
      this.container.add(icon);

      // Symbol name
      const nameText = this.scene.add.text(110, yPos + 12, this.symbolNames[symId], {
        fontSize: '13px', color: '#ddddee',
      });
      this.container.add(nameText);

      // Pay values
      for (let i = 0; i < options.payvalues[symId].length; i++) {
        const val = options.payvalues[symId][i];
        const color = val >= 10 ? '#ffe600' : val >= 2 ? '#ffaa44' : '#aaaacc';
        const payText = this.scene.add.text(240 + i * 58, yPos + 12, `${val}×`, {
          fontSize: '12px', color, fontStyle: val >= 10 ? 'bold' : 'normal',
        }).setOrigin(0.5, 0);
        this.container.add(payText);
      }

      yPos += 48;
    }

    // === SCATTER SECTION ===
    yPos += 10;
    const sep2 = this.scene.add.graphics();
    sep2.lineStyle(2, 0xff00cc, 0.5);
    sep2.lineBetween(40, yPos, w - 40, yPos);
    this.container.add(sep2);
    yPos += 15;

    const scatterIcon = this.scene.add.sprite(80, yPos + 20, 'scatter');
    const scatterScale = 45 / Math.max(scatterIcon.width, scatterIcon.height);
    scatterIcon.setScale(Math.min(scatterScale, 0.6));
    this.container.add(scatterIcon);

    const scatterTitle = this.scene.add.text(110, yPos, 'SCATTER — Free Spins', {
      fontSize: '16px', color: '#ff00cc', fontStyle: 'bold',
    });
    this.container.add(scatterTitle);

    yPos += 28;
    const fsInfo = [
      '3 Scatters = 10 Free Spins',
      '4 Scatters = 15 Free Spins',
      '5 Scatters = 20 Free Spins',
      '6 Scatters = 25 Free Spins',
      '7 Scatters = 30 Free Spins',
    ];
    for (const line of fsInfo) {
      this.container.add(this.scene.add.text(110, yPos, line, {
        fontSize: '13px', color: '#ccbbdd',
      }));
      yPos += 20;
    }

    // === MULTIPLIER SECTION ===
    yPos += 15;
    const sep3 = this.scene.add.graphics();
    sep3.lineStyle(2, 0xffea00, 0.5);
    sep3.lineBetween(40, yPos, w - 40, yPos);
    this.container.add(sep3);
    yPos += 15;

    this.container.add(this.scene.add.text(60, yPos, 'MULTIPLIER SYSTEM', {
      fontSize: '16px', color: '#ffea00', fontStyle: 'bold',
    }));
    yPos += 28;

    const multInfo = [
      '• Every win position gets a multiplier stamp',
      '• Multipliers double after each win: ×1 → ×2 → ×4 → ×8 → ... → ×1024',
      '• Multipliers are persistent during Free Spins',
      '• All multipliers in a cluster are summed together',
    ];
    for (const line of multInfo) {
      this.container.add(this.scene.add.text(70, yPos, line, {
        fontSize: '13px', color: '#cccc99',
      }));
      yPos += 22;
    }

    // === BUY FEATURES ===
    yPos += 15;
    const sep4 = this.scene.add.graphics();
    sep4.lineStyle(2, 0x00d2ff, 0.5);
    sep4.lineBetween(40, yPos, w - 40, yPos);
    this.container.add(sep4);
    yPos += 15;

    this.container.add(this.scene.add.text(60, yPos, 'BUY FEATURES', {
      fontSize: '16px', color: '#00d2ff', fontStyle: 'bold',
    }));
    yPos += 28;

    const buyInfo = [
      '• Buy Free Spins: 100× Bet — Triggers 10 Free Spins instantly',
      '• Super Free Spins: 500× Bet — 10 Free Spins with pre-seeded multipliers',
      '  (center 3×3 starts with ×4-×16 multipliers)',
    ];
    for (const line of buyInfo) {
      this.container.add(this.scene.add.text(70, yPos, line, {
        fontSize: '13px', color: '#99ccdd',
      }));
      yPos += 22;
    }

    // === GAME INFO ===
    yPos += 20;
    this.container.add(this.scene.add.text(w / 2, yPos, 'Target RTP: 96.00%  |  Max Win: 25,000×  |  High Volatility', {
      fontSize: '14px', color: '#666688', align: 'center',
    }).setOrigin(0.5, 0));
  }

  public show() {
    this.visible = true;
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container, alpha: 1, duration: 300, ease: 'Power2',
    });
  }

  public hide() {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 200, ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false);
        this.visible = false;
      },
    });
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public toggle() {
    if (this.visible) this.hide();
    else this.show();
  }
}
