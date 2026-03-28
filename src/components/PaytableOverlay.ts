import Phaser from 'phaser';
import options from '../options';

/**
 * Multi-page Paytable / Info overlay (Sugar Rush style).
 * Page 1: Symbol payouts
 * Page 2: Scatter + Multiplier rules
 * Page 3: Buy features + Ante Bet + Game info
 */
export class PaytableOverlay {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private pages: Phaser.GameObjects.Container[] = [];
  private currentPage = 0;
  private visible = false;
  private txtPageNum!: Phaser.GameObjects.Text;

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
    bg.fillStyle(0x050a18, 0.95);
    bg.fillRect(0, 0, w, h);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    this.container.add(bg);

    // Title
    this.container.add(this.scene.add.text(w / 2, 30, 'PAYTABLE & RULES', {
      fontSize: '28px', color: '#aabbdd', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Close button
    const closeBtn = this.scene.add.text(w - 40, 28, '✕', {
      fontSize: '30px', color: '#556688',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff4466'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#556688'));
    this.container.add(closeBtn);

    // Build pages
    this.buildPage1_Symbols(w, h);
    this.buildPage2_Features(w, h);
    this.buildPage3_Info(w, h);

    // Navigation
    const navY = h - 50;
    const prevBtn = this.scene.add.text(w * 0.15, navY, '◀  PREV', {
      fontSize: '18px', color: '#5566aa', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    prevBtn.on('pointerdown', () => this.changePage(-1));
    prevBtn.on('pointerover', () => prevBtn.setColor('#8899dd'));
    prevBtn.on('pointerout', () => prevBtn.setColor('#5566aa'));
    this.container.add(prevBtn);

    this.txtPageNum = this.scene.add.text(w / 2, navY, '1 / 3', {
      fontSize: '16px', color: '#445566',
    }).setOrigin(0.5);
    this.container.add(this.txtPageNum);

    const nextBtn = this.scene.add.text(w * 0.85, navY, 'NEXT  ▶', {
      fontSize: '18px', color: '#5566aa', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    nextBtn.on('pointerdown', () => this.changePage(1));
    nextBtn.on('pointerover', () => nextBtn.setColor('#8899dd'));
    nextBtn.on('pointerout', () => nextBtn.setColor('#5566aa'));
    this.container.add(nextBtn);

    // Show page 0 initially
    this.showPage(0);
  }

  private buildPage1_Symbols(w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);

    let yPos = 75;
    const pageTitle = this.scene.add.text(w / 2, yPos, 'SYMBOL PAYOUTS', {
      fontSize: '18px', color: '#00d2ff', fontStyle: 'bold',
    }).setOrigin(0.5);
    page.add(pageTitle);
    yPos += 35;

    // Column headers
    const tierLabels = ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15+'];
    const startX = 200;
    const colW = Math.min(58, (w - startX - 30) / 11);

    page.add(this.scene.add.text(60, yPos, 'SYMBOL', { fontSize: '11px', color: '#556677', fontStyle: 'bold' }));
    tierLabels.forEach((label, i) => {
      page.add(this.scene.add.text(startX + i * colW, yPos, label, {
        fontSize: '11px', color: '#556677', fontStyle: 'bold',
      }).setOrigin(0.5, 0));
    });
    yPos += 22;

    // Separator
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0x1a2244, 0.5);
    sep.lineBetween(40, yPos, w - 40, yPos);
    page.add(sep);
    yPos += 8;

    // Symbol rows (highest paying first)
    const order = [6, 5, 4, 3, 2, 1, 0];
    for (const symId of order) {
      const icon = this.scene.add.sprite(50, yPos + 22, `candy_${symId}`);
      const iconScale = 36 / Math.max(icon.width, icon.height);
      icon.setScale(Math.min(iconScale, 0.5));
      page.add(icon);

      page.add(this.scene.add.text(80, yPos + 14, this.symbolNames[symId], {
        fontSize: '11px', color: '#8899aa',
      }));

      options.payvalues[symId].forEach((val, i) => {
        const color = val >= 50 ? '#ffe600' : val >= 10 ? '#ffaa44' : val >= 2 ? '#88aacc' : '#556688';
        page.add(this.scene.add.text(startX + i * colW, yPos + 14, `${val}×`, {
          fontSize: '10px', color, fontStyle: val >= 10 ? 'bold' : 'normal',
        }).setOrigin(0.5, 0));
      });

      yPos += 50;
    }

    this.container.add(page);
    this.pages.push(page);
  }

  private buildPage2_Features(w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 75;

    // Scatter section
    page.add(this.scene.add.text(w / 2, yPos, 'SCATTER — FREE SPINS', {
      fontSize: '18px', color: '#ff00cc', fontStyle: 'bold',
    }).setOrigin(0.5));
    yPos += 40;

    const scatterIcon = this.scene.add.sprite(60, yPos + 20, 'scatter');
    scatterIcon.setScale(Math.min(0.4, 50 / Math.max(scatterIcon.width, 1)));
    page.add(scatterIcon);

    const fsInfo = [
      '3 Scatters  →  10 Free Spins',
      '4 Scatters  →  15 Free Spins',
      '5 Scatters  →  20 Free Spins',
      '6 Scatters  →  25 Free Spins',
      '7 Scatters  →  30 Free Spins',
    ];
    fsInfo.forEach((line, i) => {
      page.add(this.scene.add.text(100, yPos + i * 24, line, {
        fontSize: '14px', color: '#bbaacc',
      }));
    });
    yPos += 24 * fsInfo.length + 15;

    page.add(this.scene.add.text(100, yPos, '• Scatters can retrigger during free spins', {
      fontSize: '12px', color: '#776699',
    }));
    yPos += 40;

    // Separator
    const sep = this.scene.add.graphics();
    sep.lineStyle(2, 0xffea00, 0.3);
    sep.lineBetween(40, yPos, w - 40, yPos);
    page.add(sep);
    yPos += 20;

    // Multiplier section
    page.add(this.scene.add.text(w / 2, yPos, 'MULTIPLIER SYSTEM', {
      fontSize: '18px', color: '#ffea00', fontStyle: 'bold',
    }).setOrigin(0.5));
    yPos += 35;

    const multInfo = [
      'Every winning position gets a multiplier stamp.',
      'Multipliers progress:  ×1 → ×2 → ×4 → ×8 → ... → ×1024',
      'All multipliers in a cluster are SUMMED together.',
      'Multipliers are PERSISTENT during Free Spins.',
      'In base game, multipliers reset each spin.',
    ];
    multInfo.forEach((line, i) => {
      const icon = i === 3 ? '⭐' : '•';
      const color = i === 3 ? '#ffea00' : '#aabb88';
      page.add(this.scene.add.text(60, yPos + i * 28, `${icon}  ${line}`, {
        fontSize: '13px', color,
      }));
    });

    this.container.add(page);
    this.pages.push(page);
  }

  private buildPage3_Info(w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 75;

    // Buy Features
    page.add(this.scene.add.text(w / 2, yPos, 'BUY FEATURES', {
      fontSize: '18px', color: '#00d2ff', fontStyle: 'bold',
    }).setOrigin(0.5));
    yPos += 40;

    const buyInfo = [
      { label: 'Buy Free Spins', cost: '100× Bet', desc: '10 Free Spins', color: '#ff006a' },
      { label: 'Super Free Spins', cost: '500× Bet', desc: '10 Free Spins + pre-seeded multipliers', color: '#00d2ff' },
    ];
    buyInfo.forEach((item) => {
      page.add(this.scene.add.text(60, yPos, item.label, {
        fontSize: '16px', color: item.color, fontStyle: 'bold',
      }));
      page.add(this.scene.add.text(60, yPos + 22, `Cost: ${item.cost}  •  ${item.desc}`, {
        fontSize: '12px', color: '#778899',
      }));
      yPos += 55;
    });

    // Separator
    const sep1 = this.scene.add.graphics();
    sep1.lineStyle(2, 0xffaa00, 0.3);
    sep1.lineBetween(40, yPos, w - 40, yPos);
    page.add(sep1);
    yPos += 20;

    // Ante Bet
    page.add(this.scene.add.text(w / 2, yPos, '⚡ ANTE BET', {
      fontSize: '18px', color: '#ffaa00', fontStyle: 'bold',
    }).setOrigin(0.5));
    yPos += 35;

    const anteInfo = [
      '•  Costs 25% more per spin',
      '•  DOUBLES scatter symbol probability',
      '•  More chances to trigger Free Spins',
    ];
    anteInfo.forEach((line) => {
      page.add(this.scene.add.text(60, yPos, line, {
        fontSize: '13px', color: '#ccaa66',
      }));
      yPos += 26;
    });

    yPos += 20;

    // Separator
    const sep2 = this.scene.add.graphics();
    sep2.lineStyle(1, 0x1a2244, 0.5);
    sep2.lineBetween(40, yPos, w - 40, yPos);
    page.add(sep2);
    yPos += 20;

    // Game info
    page.add(this.scene.add.text(w / 2, yPos, 'GAME INFORMATION', {
      fontSize: '16px', color: '#556688', fontStyle: 'bold',
    }).setOrigin(0.5));
    yPos += 30;

    const gameInfo = [
      `Target RTP:  96.00%`,
      `Max Win:  25,000× Bet`,
      `Volatility:  High`,
      `Min Bet:  0.20  |  Max Bet:  100.00`,
      `Grid:  7×7 Cluster Pays (min 5)`,
    ];
    gameInfo.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, line, {
        fontSize: '13px', color: '#445566',
      }).setOrigin(0.5, 0));
      yPos += 22;
    });

    this.container.add(page);
    this.pages.push(page);
  }

  private changePage(dir: number) {
    const newPage = this.currentPage + dir;
    if (newPage >= 0 && newPage < this.pages.length) {
      this.showPage(newPage);
    }
  }

  private showPage(index: number) {
    this.pages.forEach((p, i) => p.setVisible(i === index));
    this.currentPage = index;
    this.txtPageNum.setText(`${index + 1} / ${this.pages.length}`);
  }

  public show() {
    this.visible = true;
    this.showPage(0);
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 300, ease: 'Power2' });
  }

  public hide() {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 200, ease: 'Power2',
      onComplete: () => { this.container.setVisible(false); this.visible = false; },
    });
  }

  public isVisible(): boolean { return this.visible; }
  public toggle() {
    if (this.visible) this.hide(); else this.show();
  }
}
