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
    this.container = this.scene.add.container(0, 0).setDepth(50).setVisible(false);
    this.build();
    
    // Auto-resize listener
    this.scene.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.resize(gameSize.width, gameSize.height);
    });
  }

  public resize(w: number, h: number) {
    const isVisible = this.visible;
    const pageIndex = this.currentPage;
    this.container.removeAll(true);
    this.pages = [];
    this.build(w, h);
    if (isVisible) {
      this.showPage(pageIndex);
    }
  }

  private build(w?: number, h?: number) {
    w = w || this.scene.scale.width;
    h = h || this.scene.scale.height;

    // We build the UI using a fixed logical size so it never breaks formatting
    const logicalW = 800;
    const logicalH = 600;

    // Dark overlay - absolute to screen
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0d1530, 0.98);
    // Draw negative/positive bounds so it perfectly fills no matter the center position
    bg.fillRect(-w, -h, w * 3, h * 3);
    bg.setInteractive(new Phaser.Geom.Rectangle(-w, -h, w * 3, h * 3), Phaser.Geom.Rectangle.Contains);
    this.container.add(bg);

    // Create a sub-container for the fixed-size pages
    const pageWrapper = this.scene.add.container(0, 0);
    this.container.add(pageWrapper);

    // Center the wrapper and scale it to fit the screen
    const scale = Math.min(w / logicalW, h / logicalH, 1);
    pageWrapper.setScale(scale);
    // We assume the page wrapper has origin 0,0 for its children, but we'll center it physically
    pageWrapper.setPosition(
      (w - logicalW * scale) / 2, 
      (h - logicalH * scale) / 2
    );

    // Title
    pageWrapper.add(this.scene.add.text(logicalW / 2, 30, 'PAYTABLE & RULES', {
      fontSize: '28px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5));

    // Close button
    const closeBtn = this.scene.add.text(logicalW - 40, 28, '✕', {
      fontSize: '30px', color: '#ffffff', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff4466'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ffffff'));
    pageWrapper.add(closeBtn);

    // Build pages using logical size
    this.buildPage1_Symbols(pageWrapper, logicalW, logicalH);
    this.buildPage2_Features(pageWrapper, logicalW, logicalH);
    this.buildPage3_Info(pageWrapper, logicalW, logicalH);

    // Navigation
    const navY = logicalH - 40;
    const prevBtn = this.scene.add.text(logicalW * 0.15, navY, '◀  PREV', {
      fontSize: '18px', color: '#aaccff', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    prevBtn.on('pointerdown', () => this.changePage(-1));
    prevBtn.on('pointerover', () => prevBtn.setColor('#ffffff'));
    prevBtn.on('pointerout', () => prevBtn.setColor('#aaccff'));
    pageWrapper.add(prevBtn);

    this.txtPageNum = this.scene.add.text(logicalW / 2, navY, '1 / 3', {
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    pageWrapper.add(this.txtPageNum);

    const nextBtn = this.scene.add.text(logicalW * 0.85, navY, 'NEXT  ▶', {
      fontSize: '18px', color: '#aaccff', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    nextBtn.on('pointerdown', () => this.changePage(1));
    nextBtn.on('pointerover', () => nextBtn.setColor('#ffffff'));
    nextBtn.on('pointerout', () => nextBtn.setColor('#aaccff'));
    pageWrapper.add(nextBtn);
    
    this.showPage(0);
  }

  private buildPage1_Symbols(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);

    let yPos = 75;
    const pageTitle = this.scene.add.text(w / 2, yPos, 'SYMBOL PAYOUTS', {
      fontSize: '22px', color: '#ffffff', fontStyle: 'bold', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);
    page.add(pageTitle);
    yPos += 45;

    // Column headers
    const tierLabels = ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15+'];
    const startX = 220;
    const colW = Math.min(60, (w - startX - 30) / 11);

    page.add(this.scene.add.text(50, yPos, 'SYMBOL', { fontSize: '13px', color: '#ffffff', fontStyle: 'bold' }));
    tierLabels.forEach((label, i) => {
      page.add(this.scene.add.text(startX + i * colW, yPos, label, {
        fontSize: '13px', color: '#cccccc', fontStyle: 'bold',
      }).setOrigin(0.5, 0));
    });
    yPos += 25;

    // Separator
    const sep = this.scene.add.graphics();
    sep.lineStyle(2, 0xffffff, 0.4);
    sep.lineBetween(30, yPos, w - 30, yPos);
    page.add(sep);
    yPos += 14;

    // Symbol rows (highest paying first)
    const order = [6, 5, 4, 3, 2, 1, 0];
    for (const symId of order) {
      const icon = this.scene.add.sprite(50, yPos + 22, `candy_${symId}`);
      const iconScale = 42 / Math.max(icon.width, icon.height);
      icon.setScale(Math.min(iconScale, 0.6));
      page.add(icon);

      page.add(this.scene.add.text(80, yPos + 14, this.symbolNames[symId], {
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
      }));

      options.payvalues[symId].forEach((val, i) => {
        const color = val >= 50 ? '#ffe600' : val >= 10 ? '#ffae00' : val >= 2 ? '#bbf0ff' : '#cccccc';
        page.add(this.scene.add.text(startX + i * colW, yPos + 14, `${val}×`, {
          fontSize: '12px', color, fontStyle: val >= 10 ? 'bold' : 'normal', stroke: val >= 10 ? '#000': '', strokeThickness: val >= 10 ? 2 : 0
        }).setOrigin(0.5, 0));
      });

      yPos += 55;
    }

    parent.add(page);
    this.pages.push(page);
  }

  private buildPage2_Features(parent: Phaser.GameObjects.Container, w: number, h: number) {
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
        fontSize: '15px', color: '#ffffff',
      }));
    });
    yPos += 24 * fsInfo.length + 15;

    page.add(this.scene.add.text(100, yPos, '• Scatters can retrigger during free spins', {
      fontSize: '13px', color: '#cccccc', fontStyle: 'italic'
    }));
    yPos += 40;

    // Separator
    const sep = this.scene.add.graphics();
    sep.lineStyle(2, 0xffea00, 0.5);
    sep.lineBetween(40, yPos, w - 40, yPos);
    page.add(sep);
    yPos += 20;

    // Multiplier section
    page.add(this.scene.add.text(w / 2, yPos, 'MULTIPLIER SYSTEM', {
      fontSize: '18px', color: '#ffea00', fontStyle: 'bold', stroke: '#000', strokeThickness: 3
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
      const color = i === 3 ? '#ffea00' : '#ffffff';
      page.add(this.scene.add.text(60, yPos + i * 28, `${icon}  ${line}`, {
        fontSize: '14px', color,
      }));
    });

    parent.add(page);
    this.pages.push(page);
  }

  private buildPage3_Info(parent: Phaser.GameObjects.Container, w: number, h: number) {
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
        fontSize: '18px', color: item.color, fontStyle: 'bold', stroke: '#000', strokeThickness: 2
      }));
      page.add(this.scene.add.text(60, yPos + 22, `Cost: ${item.cost}  •  ${item.desc}`, {
        fontSize: '13px', color: '#ffffff',
      }));
      yPos += 55;
    });

    // Separator
    const sep1 = this.scene.add.graphics();
    sep1.lineStyle(2, 0xffaa00, 0.5);
    sep1.lineBetween(40, yPos, w - 40, yPos);
    page.add(sep1);
    yPos += 20;

    // Ante Bet
    page.add(this.scene.add.text(w / 2, yPos, '⚡ ANTE BET', {
      fontSize: '18px', color: '#ffaa00', fontStyle: 'bold', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5));
    yPos += 35;

    const anteInfo = [
      '•  Costs 25% more per spin',
      '•  DOUBLES scatter symbol probability',
      '•  More chances to trigger Free Spins',
    ];
    anteInfo.forEach((line) => {
      page.add(this.scene.add.text(60, yPos, line, {
        fontSize: '14px', color: '#ffffff',
      }));
      yPos += 26;
    });

    yPos += 20;

    // Separator
    const sep2 = this.scene.add.graphics();
    sep2.lineStyle(2, 0xffffff, 0.2);
    sep2.lineBetween(40, yPos, w - 40, yPos);
    page.add(sep2);
    yPos += 20;

    // Game info
    page.add(this.scene.add.text(w / 2, yPos, 'GAME INFORMATION', {
      fontSize: '17px', color: '#aaccff', fontStyle: 'bold',
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
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5, 0));
      yPos += 24;
    });

    parent.add(page);
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
    if (this.txtPageNum) {
      this.txtPageNum.setText(`${index + 1} / ${this.pages.length}`);
    }
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
