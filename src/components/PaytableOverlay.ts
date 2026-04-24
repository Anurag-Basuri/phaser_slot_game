import Phaser from 'phaser';
import options, { BET_PRESETS } from '../options';
import { getStakeEngine } from '../engine/StakeEngineClient';
import { T } from '../helpers/I18n';

/**
 * Multi-page Game Rules / Info overlay — 7 pages matching Sugar Rush 1000.
 *
 * Page 1: Symbol Payouts + Scatter info
 * Page 2: Tumble Feature
 * Page 3: Multiplier Spots Feature
 * Page 4: Free Spins + Retrigger
 * Page 5: Game Rules (volatility, RTP, bet limits)
 * Page 6: How to Play
 * Page 7: Settings Menu / Info Screen / Bet Menu / Max Win
 */
export class PaytableOverlay {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private pages: Phaser.GameObjects.Container[] = [];
  private currentPage = 0;
  private visible = false;
  private txtPageNum!: Phaser.GameObjects.Text;
  private dotIndicators: Phaser.GameObjects.Graphics[] = [];

  private readonly FONT_BODY = '"Inter", "Arial", sans-serif';
  private readonly FONT_TITLE = '"Luckiest Guy", cursive, sans-serif';
  private readonly COL_BODY = '#d0d0e0';
  private readonly COL_MUTED = '#8888aa';
  private readonly COL_ACCENT = '#ff006a';
  private readonly COL_GOLD = '#ffe600';

  private symbolNames = [
    'Orange Gummy Bear', 'Purple Gummy Bear', 'Red Gummy Bear',
    'Green Candy', 'Purple Candy', 'Orange Candy', 'Pink Candy'
  ];

  /** Draw a dark translucent card rectangle onto a page */
  private drawCard(page: Phaser.GameObjects.Container, x: number, y: number, cw: number, ch: number, accent = false) {
    const g = this.scene.add.graphics();
    g.fillStyle(0x1a1530, 0.6);
    g.fillRoundedRect(x, y, cw, ch, 12);
    g.lineStyle(1.5, accent ? 0xff006a : 0x332244, accent ? 0.6 : 0.5);
    g.strokeRoundedRect(x, y, cw, ch, 12);
    page.add(g);
  }

  /** Draw a horizontal divider line */
  private drawDivider(page: Phaser.GameObjects.Container, x1: number, x2: number, y: number) {
    const g = this.scene.add.graphics();
    g.lineStyle(1, 0x332244, 0.6);
    g.lineBetween(x1, y, x2, y);
    page.add(g);
  }

  /** Add a section title with underline accent */
  private addSectionTitle(page: Phaser.GameObjects.Container, x: number, y: number, text: string): number {
    page.add(this.scene.add.text(x, y, text, {
      fontSize: '22px', fontFamily: this.FONT_TITLE, color: '#ffffff'
    }).setOrigin(0.5));
    const g = this.scene.add.graphics();
    const lw = Math.min(text.length * 11, 300);
    g.lineStyle(2, 0xff006a, 0.5);
    g.lineBetween(x - lw/2, y + 16, x + lw/2, y + 16);
    page.add(g);
    return y + 40;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0).setDepth(50).setVisible(false);
    this.build();

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

    const logicalW = 860;
    const logicalH = 640;

    // Dark translucent backdrop
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(-w, -h, w * 3, h * 3);
    bg.setInteractive(new Phaser.Geom.Rectangle(-w, -h, w * 3, h * 3), Phaser.Geom.Rectangle.Contains);
    this.container.add(bg);

    const pageWrapper = this.scene.add.container(0, 0);
    this.container.add(pageWrapper);

    // Premium Panel Background for the Info Pages
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x130f24, 0.98); // Dark navy
    panel.fillRoundedRect(0, 0, logicalW, logicalH, 24);
    
    // Top gradient accent for the panel header
    panel.fillStyle(0xff006a, 0.15);
    panel.fillRoundedRect(0, 0, logicalW, 70, 24);
    
    panel.lineStyle(4, 0xff006a, 1); // Hot pink border
    panel.strokeRoundedRect(0, 0, logicalW, logicalH, 24);
    pageWrapper.add(panel);

    const scale = Math.min(w / logicalW, h / logicalH, 1);
    pageWrapper.setScale(scale);
    pageWrapper.setPosition(
      (w - logicalW * scale) / 2,
      (h - logicalH * scale) / 2
    );

    // Title
    const isSocial = getStakeEngine().isSocialMode();
    pageWrapper.add(this.scene.add.text(logicalW / 2, 35, T('GAME RULES', isSocial), {
      fontSize: '28px', fontFamily: this.FONT_TITLE, color: '#ffffff'
    }).setOrigin(0.5));

    // Close button — circle with X
    const closeBtnGfx = this.scene.add.graphics();
    closeBtnGfx.fillStyle(0xff006a, 0.2);
    closeBtnGfx.fillCircle(logicalW - 35, 35, 18);
    closeBtnGfx.lineStyle(2, 0xff006a, 0.8);
    closeBtnGfx.strokeCircle(logicalW - 35, 35, 18);
    pageWrapper.add(closeBtnGfx);
    const closeBtn = this.scene.add.text(logicalW - 35, 35, '✕', {
      fontSize: '22px', color: '#ffffff', fontFamily: this.FONT_BODY, fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff4488'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ffffff'));
    pageWrapper.add(closeBtn);

    // Build all 7 pages
    this.buildPage1_Symbols(pageWrapper, logicalW, logicalH);
    this.buildPage2_Tumble(pageWrapper, logicalW, logicalH);
    this.buildPage3_Multipliers(pageWrapper, logicalW, logicalH);
    this.buildPage4_FreeSpins(pageWrapper, logicalW, logicalH);
    this.buildPage5_GameRules(pageWrapper, logicalW, logicalH);
    this.buildPage6_HowToPlay(pageWrapper, logicalW, logicalH);
    this.buildPage7_Settings(pageWrapper, logicalW, logicalH);

    // Navigation — ◀ ▶ with dot indicators
    const navY = logicalH - 38;
    const navCenter = logicalW / 2;

    const prevBtn = this.scene.add.text(navCenter - 120, navY, '◀', {
      fontSize: '28px', color: '#ff006a', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    prevBtn.on('pointerdown', () => this.changePage(-1));
    prevBtn.on('pointerover', () => prevBtn.setColor('#ff4488'));
    prevBtn.on('pointerout', () => prevBtn.setColor('#ff006a'));
    pageWrapper.add(prevBtn);

    const nextBtn = this.scene.add.text(navCenter + 120, navY, '▶', {
      fontSize: '28px', color: '#ff006a', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    nextBtn.on('pointerdown', () => this.changePage(1));
    nextBtn.on('pointerover', () => nextBtn.setColor('#ff4488'));
    nextBtn.on('pointerout', () => nextBtn.setColor('#ff006a'));
    pageWrapper.add(nextBtn);

    // Dot indicators
    this.dotIndicators = [];
    for (let i = 0; i < 7; i++) {
      const dot = this.scene.add.graphics();
      const dx = navCenter - 48 + i * 16;
      dot.fillStyle(i === 0 ? 0xff006a : 0x332244, 1);
      dot.fillCircle(dx, navY, i === 0 ? 5 : 4);
      if (i === 0) { dot.lineStyle(1, 0xff006a, 0.5); dot.strokeCircle(dx, navY, 7); }
      pageWrapper.add(dot);
      this.dotIndicators.push(dot);
    }

    // Page label
    this.txtPageNum = this.scene.add.text(logicalW - 70, navY, '1 / 7', {
      fontSize: '14px', color: '#8888aa', fontFamily: this.FONT_BODY
    }).setOrigin(0.5);
    pageWrapper.add(this.txtPageNum);

    this.showPage(0);
  }

  // ─────────────────────────────────────────────
  // PAGE 1: SYMBOL PAYOUTS
  // ─────────────────────────────────────────────
  private buildPage1_Symbols(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 30;
    let yPos = 75;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'SYMBOL PAYOUTS');

    // Card background for the whole payout table
    this.drawCard(page, pad - 5, yPos - 5, w - pad * 2 + 10, 370);

    // Intro text
    page.add(this.scene.add.text(w / 2, yPos + 5, 'Cluster Pays: Min 5 connected symbols (horizontal/vertical) on a 7\u00d77 grid.', {
      fontSize: '13px', color: this.COL_MUTED, align: 'center', fontFamily: this.FONT_BODY
    }).setOrigin(0.5, 0));
    yPos += 30;

    const order = [6, 5, 4, 3, 2, 1, 0];
    const colCount = 7;
    const colW = (w - pad * 2 - 40) / colCount;
    const startX = pad + 35;

    // Symbol icons row
    order.forEach((symId, col) => {
      const cx = startX + col * colW + colW / 2;
      const icon = this.scene.add.sprite(cx, yPos + 25, `candy_${symId}`);
      icon.setScale(Math.min(0.45, 44 / Math.max(icon.width, 1)));
      page.add(icon);
    });
    yPos += 55;

    // Payout rows with alternating shading
    const tiers = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5];
    const rowH = 24;
    tiers.forEach((tier, rowIdx) => {
      const rowY = yPos + rowIdx * rowH;
      // Alternating row background
      if (rowIdx % 2 === 0) {
        const rowBg = this.scene.add.graphics();
        rowBg.fillStyle(0xffffff, 0.03);
        rowBg.fillRect(pad, rowY - 2, w - pad * 2, rowH);
        page.add(rowBg);
      }
      const tierLabel = tier >= 15 ? '15+' : `${tier}`;
      // Tier label
      page.add(this.scene.add.text(startX - 8, rowY, tierLabel, {
        fontSize: '11px', color: this.COL_MUTED, fontStyle: 'bold', fontFamily: this.FONT_BODY
      }).setOrigin(1, 0));
      // Values
      order.forEach((symId, col) => {
        const cx = startX + col * colW + colW / 2;
        const payIdx = tier >= 15 ? 10 : tier - 5;
        const val = options.payvalues[symId][payIdx];
        const color = rowIdx < 2 ? this.COL_GOLD : rowIdx < 5 ? '#ffcc77' : this.COL_BODY;
        page.add(this.scene.add.text(cx, rowY, val.toFixed(2), {
          fontSize: '11px', color, fontFamily: this.FONT_BODY, fontStyle: 'bold'
        }).setOrigin(0.5, 0));
      });
    });

    yPos += tiers.length * rowH + 20;

    // Scatter info card
    this.drawCard(page, pad - 5, yPos - 5, w - pad * 2 + 10, 55, true);
    const scatterIcon = this.scene.add.sprite(pad + 35, yPos + 22, 'scatter');
    scatterIcon.setScale(Math.min(0.28, 42 / Math.max(scatterIcon.width, 1)));
    page.add(scatterIcon);
    page.add(this.scene.add.text(pad + 75, yPos + 8, 'SCATTER \u2014 Appears on all reels. Triggers Free Spins.', {
      fontSize: '13px', color: this.COL_BODY, fontFamily: this.FONT_BODY
    }));
    page.add(this.scene.add.text(pad + 75, yPos + 28, '3 or more Scatters award 10-30 Free Spins.', {
      fontSize: '12px', color: this.COL_MUTED, fontFamily: this.FONT_BODY
    }));

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 2: TUMBLE FEATURE
  // ─────────────────────────────────────────────
  private buildPage2_Tumble(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 40;
    let yPos = 75;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'TUMBLE FEATURE');

    // Card for the explanation
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 220);

    const tumbleRules = [
      '\u2022  After every winning spin, winning symbols are removed.',
      '\u2022  Remaining symbols drop to the bottom of the grid.',
      '\u2022  Empty positions are filled with new symbols from above.',
      '\u2022  Tumbling continues until no new wins appear.',
      '\u2022  All wins are added to your balance after the full sequence.',
    ];
    tumbleRules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 20, yPos + 10 + i * 38, line, {
        fontSize: '15px', color: this.COL_BODY, fontFamily: this.FONT_BODY, lineSpacing: 4,
        wordWrap: { width: w - pad * 2 - 50 }
      }));
    });
    yPos += 235;

    // Visual flow diagram
    this.drawCard(page, pad, yPos, w - pad * 2, 70, true);
    const steps = ['SPIN', 'WIN', 'REMOVE', 'DROP', 'REPEAT'];
    const stepW = (w - pad * 2) / steps.length;
    steps.forEach((s, i) => {
      const sx = pad + i * stepW + stepW / 2;
      page.add(this.scene.add.text(sx, yPos + 20, s, {
        fontSize: '14px', color: i === 4 ? this.COL_GOLD : '#ffffff', fontStyle: 'bold', fontFamily: this.FONT_BODY
      }).setOrigin(0.5));
      if (i < steps.length - 1) {
        page.add(this.scene.add.text(sx + stepW / 2, yPos + 20, '\u2192', {
          fontSize: '16px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY
        }).setOrigin(0.5));
      }
      page.add(this.scene.add.text(sx, yPos + 42, ['Start', 'Cluster pays', 'Symbols vanish', 'Fill gaps', 'Until no wins'][i], {
        fontSize: '10px', color: this.COL_MUTED, fontFamily: this.FONT_BODY
      }).setOrigin(0.5));
    });

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 3: MULTIPLIER SPOTS
  // ─────────────────────────────────────────────
  private buildPage3_Multipliers(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 40;
    let yPos = 75;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'MULTIPLIER SPOTS');

    // Rules card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 185);
    const rules = [
      '\u2022  Winning symbols mark their grid spot.',
      '\u2022  Second explosion on same spot \u2192 \u00d72 multiplier.',
      '\u2022  Each further explosion doubles it (up to \u00d71024).',
      '\u2022  Multiple multipliers in one cluster are summed.',
      '\u2022  Base game: multipliers reset after tumble sequence.',
    ];
    rules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 20, yPos + 10 + i * 32, line, {
        fontSize: '15px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 50 }
      }));
    });
    yPos += 200;

    // Multiplier progression visual card
    this.drawCard(page, pad, yPos, w - pad * 2, 90, true);
    page.add(this.scene.add.text(w / 2, yPos + 15, 'MULTIPLIER PROGRESSION', {
      fontSize: '12px', color: this.COL_MUTED, fontStyle: 'bold', fontFamily: this.FONT_BODY
    }).setOrigin(0.5));
    const mults = ['\u00d72', '\u00d74', '\u00d78', '\u00d716', '\u00d732', '\u00d764', '...', '\u00d71024'];
    const mw = (w - pad * 2 - 40) / mults.length;
    mults.forEach((m, i) => {
      const mx = pad + 20 + i * mw + mw / 2;
      const isMax = i === mults.length - 1;
      page.add(this.scene.add.text(mx, yPos + 48, m, {
        fontSize: isMax ? '18px' : '16px', color: isMax ? this.COL_GOLD : '#ffffff',
        fontStyle: 'bold', fontFamily: this.FONT_BODY
      }).setOrigin(0.5));
      if (i < mults.length - 1 && m !== '...') {
        page.add(this.scene.add.text(mx + mw / 2, yPos + 48, '\u2192', {
          fontSize: '14px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY
        }).setOrigin(0.5));
      }
    });
    yPos += 110;

    // Free spins note
    this.drawCard(page, pad, yPos, w - pad * 2, 55);
    page.add(this.scene.add.text(w / 2, yPos + 14, '\u26a1 During Free Spins, multipliers persist across all spins!', {
      fontSize: '14px', color: this.COL_GOLD, fontFamily: this.FONT_BODY, fontStyle: 'bold'
    }).setOrigin(0.5));
    page.add(this.scene.add.text(w / 2, yPos + 36, 'They are only cleared when the bonus round ends.', {
      fontSize: '12px', color: this.COL_MUTED, fontFamily: this.FONT_BODY
    }).setOrigin(0.5));

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 4: FREE SPINS
  // ─────────────────────────────────────────────
  private buildPage4_FreeSpins(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 40;
    let yPos = 75;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'FREE SPINS');

    // Rules card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 160);
    const fsRules = [
      '\u2022  3-7 Scatter symbols trigger 10-30 free spins.',
      '\u2022  Multipliers persist across the entire bonus round.',
      '\u2022  Re-trigger with 3+ Scatters during free spins.',
      '\u2022  Special reels are in play during the feature.',
    ];
    fsRules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 20, yPos + 10 + i * 34, line, {
        fontSize: '15px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 50 }
      }));
    });
    yPos += 175;

    // Scatter table card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 185, true);
    page.add(this.scene.add.text(w / 2, yPos + 8, 'SCATTER AWARDS', {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold', fontFamily: this.FONT_BODY
    }).setOrigin(0.5));
    yPos += 35;

    const scatterTable = [
      { count: '3 Scatters', spins: '10 Free Spins' },
      { count: '4 Scatters', spins: '12 Free Spins' },
      { count: '5 Scatters', spins: '15 Free Spins' },
      { count: '6 Scatters', spins: '20 Free Spins' },
      { count: '7 Scatters', spins: '30 Free Spins' },
    ];
    scatterTable.forEach((row, i) => {
      if (i % 2 === 0) {
        const bg = this.scene.add.graphics();
        bg.fillStyle(0xffffff, 0.03);
        bg.fillRect(pad + 10, yPos - 2, w - pad * 2 - 20, 26);
        page.add(bg);
      }
      page.add(this.scene.add.text(w / 2 - 60, yPos, row.count, {
        fontSize: '15px', color: '#ffffff', fontStyle: 'bold', fontFamily: this.FONT_BODY
      }).setOrigin(1, 0));
      page.add(this.scene.add.text(w / 2 - 20, yPos, '\u2192', {
        fontSize: '15px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY
      }).setOrigin(0.5, 0));
      page.add(this.scene.add.text(w / 2 + 20, yPos, row.spins, {
        fontSize: '15px', color: this.COL_GOLD, fontStyle: 'bold', fontFamily: this.FONT_BODY
      }));
      yPos += 28;
    });

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 5: GAME RULES (Volatility, RTP, Bet Limits)
  // ─────────────────────────────────────────────
  private buildPage5_GameRules(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 40;
    let yPos = 75;
    yPos = this.addSectionTitle(page, w / 2, yPos, 'GAME RULES');
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 50, true);
    page.add(this.scene.add.text(w / 2 - 40, yPos + 18, 'VOLATILITY', {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold', fontFamily: this.FONT_BODY
    }).setOrigin(0.5));
    page.add(this.scene.add.text(w / 2 + 60, yPos + 18, '\u26a1\u26a1\u26a1\u26a1\u26a1', {
      fontSize: '16px', color: this.COL_GOLD
    }).setOrigin(0.5));
    yPos += 60;
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 175);
    const rules = [
      '\u2022  Only the highest win per combination is paid.',
      '\u2022  Multiple block wins are summed to total win.',
      '\u2022  All wins are multiplied by base bet.',
      '\u2022  Free spins win awarded after round completes.',
      '\u2022  SPACE key starts/stops the spin.',
    ];
    rules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 20, yPos + 8 + i * 30, line, {
        fontSize: '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 50 }
      }));
    });
    yPos += 185;
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 95);
    page.add(this.scene.add.text(pad + 20, yPos + 8, 'RTP (Return to Player)', {
      fontSize: '13px', color: this.COL_MUTED, fontStyle: 'bold', fontFamily: this.FONT_BODY
    }));
    page.add(this.scene.add.text(pad + 20, yPos + 30, 'Base: 96.53%  |  Buy FS: 96.52%  |  Super: 96.44%', {
      fontSize: '14px', color: '#ffffff', fontFamily: this.FONT_BODY
    }));
    page.add(this.scene.add.text(pad + 20, yPos + 55, `Bet: ${BET_PRESETS[0].toFixed(2)} \u2013 ${BET_PRESETS[BET_PRESETS.length - 1].toFixed(2)}  |  Max Win: ${options.maxWinMultiplier.toLocaleString()}\u00d7`, {
      fontSize: '14px', color: this.COL_GOLD, fontFamily: this.FONT_BODY, fontStyle: 'bold'
    }));
    yPos += 105;
    page.add(this.scene.add.text(w / 2, yPos + 5, 'Malfunction voids all pays and plays.', {
      fontSize: '12px', color: this.COL_MUTED, fontStyle: 'italic', fontFamily: this.FONT_BODY
    }).setOrigin(0.5, 0));
    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 6: HOW TO PLAY
  // ─────────────────────────────────────────────
  private buildPage6_HowToPlay(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 75;

    page.add(this.scene.add.text(w / 2, yPos, 'HOW TO PLAY', {
      fontSize: '24px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));
    yPos += 45;

    const howTo = [
      'Click the  ⊕  or  ⊖  buttons to change the bet value.',
      'Select the bet you want to use in the game.',
      'Press the SPIN button to play.',
    ];
    howTo.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, line, {
        fontSize: '15px', color: '#e0e0e0', align: 'center', fontFamily: '"Inter", "Arial", sans-serif'
      }).setOrigin(0.5, 0));
      yPos += 26;
    });

    yPos += 15;
    page.add(this.scene.add.text(w / 2, yPos, 'MAIN GAME INTERFACE', {
      fontSize: '20px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
    yPos += 40;

    const uiInfo = [
      '☰  opens the SETTINGS menu that contains settings which',
      '     affect the way the game is being played.',
      '',
      '▶▶▶  cycles through spin speed settings: normal speed,',
      '       quick spin and turbo spin.',
      '',
      '🔊  toggles sound and music on and off.',
      '',
      'ℹ  opens the Information page.',
      '',
      'BALANCE and BET labels show the current balance and',
      'current total bet.',
      '',
      '⊕  and  ⊖  change up or down the current bet.',
      '',
      '▶  starts the game.',
      '',
      'AUTOPLAY  opens the automatic play menu.',
      'Click the  AUTOPLAY  button again to stop it.',
    ];

    uiInfo.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, line, {
        fontSize: '14px', color: '#e0e0e0', align: 'center', fontFamily: '"Inter", "Arial", sans-serif'
      }).setOrigin(0.5, 0));
      yPos += line === '' ? 10 : 22;
    });

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 7: SETTINGS / INFO / BET MENU / MAX WIN
  // ─────────────────────────────────────────────
  private buildPage7_Settings(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 75;

    page.add(this.scene.add.text(w / 2, yPos, 'SETTINGS MENU', {
      fontSize: '22px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));
    yPos += 45;

    const settingsInfo = [
      'INTRO SCREEN – toggles the introductory screen on and off',
      'AMBIENT – toggles the ambient sound and music on and off',
      'SOUND FX – toggles the game\'s sound effects on and off',
      'GAME HISTORY – opens the game history page',
    ];
    settingsInfo.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, line, {
        fontSize: '13px', color: '#cccccc', align: 'center',
      }).setOrigin(0.5, 0));
      yPos += 22;
    });

    yPos += 20;
    page.add(this.scene.add.text(w / 2, yPos, 'INFORMATION SCREEN', {
      fontSize: '18px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
    yPos += 35;

    page.add(this.scene.add.text(w / 2, yPos, '◀  and  ▶  scroll between information pages', {
      fontSize: '13px', color: '#cccccc', align: 'center',
    }).setOrigin(0.5, 0));
    yPos += 22;
    page.add(this.scene.add.text(w / 2, yPos, '✕  closes the information screen', {
      fontSize: '13px', color: '#cccccc', align: 'center',
    }).setOrigin(0.5, 0));
    yPos += 35;

    page.add(this.scene.add.text(w / 2, yPos, 'BET MENU', {
      fontSize: '18px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));
    yPos += 32;

    page.add(this.scene.add.text(w / 2, yPos, 'The bet menu shows the bet multiplier available in the game,\nand the current total bet in both coins and cash.', {
      fontSize: '13px', color: '#cccccc', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));
    yPos += 40;

    page.add(this.scene.add.text(w / 2, yPos, 'Use the  ⊕  and  ⊖  buttons in the BET and COIN VALUE\nfields to change the values.', {
      fontSize: '13px', color: '#cccccc', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));
    yPos += 45;

    // MAX WIN
    page.add(this.scene.add.text(w / 2, yPos, 'MAX WIN', {
      fontSize: '18px', fontFamily: '"Luckiest Guy", cursive, sans-serif',
      color: '#ffe600', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5));
    yPos += 30;

    page.add(this.scene.add.text(w / 2, yPos, `The maximum win amount is limited to ${options.maxWinMultiplier.toLocaleString()}× bet.\nIf the total win of a round reaches ${options.maxWinMultiplier.toLocaleString()}× bet the round\nimmediately ends, win is awarded and all remaining\nfree spins are forfeited.`, {
      fontSize: '13px', color: '#cccccc', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));

    // Buy Free Spins section at the bottom
    yPos += 75;
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0x444444, 0.5);
    sep.lineBetween(100, yPos, w - 100, yPos);
    page.add(sep);
    yPos += 15;

    page.add(this.scene.add.text(w / 2, yPos, 'BUY FREE SPINS: Pay 100× total bet to trigger FREE SPINS.\nBUY SUPER FREE SPINS: Pay 500× total bet with ×2 starting multipliers.', {
      fontSize: '13px', color: '#aaaaaa', align: 'center', lineSpacing: 6, fontFamily: '"Inter", "Arial", sans-serif'
    }).setOrigin(0.5, 0));

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE NAVIGATION
  // ─────────────────────────────────────────────
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
    // Update dot indicators
    if (this.dotIndicators.length > 0) {
      const navCenter = 860 / 2;
      const navY = 640 - 38;
      this.dotIndicators.forEach((dot, i) => {
        dot.clear();
        const dx = navCenter - 48 + i * 16;
        if (i === index) {
          dot.fillStyle(0xff006a, 1); dot.fillCircle(dx, navY, 5);
          dot.lineStyle(1, 0xff006a, 0.4); dot.strokeCircle(dx, navY, 7);
        } else {
          dot.fillStyle(0x332244, 1); dot.fillCircle(dx, navY, 4);
        }
      });
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
