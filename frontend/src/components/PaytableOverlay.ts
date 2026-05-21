import Phaser from 'phaser';
import options, { BET_PRESETS } from '../options';
import { getStakeEngine } from '../engine/StakeEngineClient';
import { T } from '../helpers/I18n';

/**
 * Multi-page Game Rules / Info overlay — 8 pages matching Sugar Blast 1000.
 *
 * Page 1: Symbol Payouts + Scatter info
 * Page 2: Tumble Feature
 * Page 3: Multiplier Spots Feature
 * Page 4: Free Spins + Retrigger
 * Page 5: Buy Features (1000× / 500×)
 * Page 6: Game Rules (volatility, RTP, bet limits)
 * Page 7: How to Play
 * Page 8: Settings Menu / Info Screen / Bet Menu / Max Win
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
  private readonly FONT_TITLE = '"Outfit", "Inter", sans-serif';
  private readonly COL_BODY = '#d0d0e0';
  private readonly COL_MUTED = '#8888aa';
  private readonly COL_ACCENT = '#ff006a';
  private readonly COL_GOLD = '#ffe600';

  private symbolNames = [
    'Orange Sherbet Ball', 'Blue Spiral Lollipop', 'Green Wrapped Toffee',
    'Yellow Star Candy', 'Red Candy Cane', 'Purple Gumball', 'Teal Rock Candy'
  ];

  private T(text: string): string {
    const isSocial = getStakeEngine().isSocialMode();
    if (!isSocial) return text;
    let t = text;
    t = t.replace(/\bwin feature\b/gi, 'play feature');
    t = t.replace(/\bpay out\b/gi, 'win');
    t = t.replace(/\bpaid out\b/gi, 'won');
    t = t.replace(/\bstake\b/gi, 'play amount');
    t = t.replace(/\bpays out\b/gi, 'won');
    t = t.replace(/\bbetting\b/gi, 'playing');
    t = t.replace(/\btotal bet\b/gi, 'total play');
    t = t.replace(/\bbet\b/gi, 'play');
    t = t.replace(/\bbets\b/gi, 'plays');
    t = t.replace(/\bcash\b/gi, 'coins');
    t = t.replace(/\bpayer\b/gi, 'winner');
    t = t.replace(/\bpay\b/gi, 'win');
    t = t.replace(/\bpays\b/gi, 'wins');
    t = t.replace(/\bpaid\b/gi, 'won');
    t = t.replace(/\bmoney\b/gi, 'coins');
    t = t.replace(/\bbuy\b/gi, 'play');
    t = t.replace(/\bbought\b/gi, 'instantly triggered');
    t = t.replace(/\bpurchase\b/gi, 'play');
    t = t.replace(/\bat the cost of\b/gi, 'for');
    t = t.replace(/\brebet\b/gi, 'respin');
    t = t.replace(/\bcost of\b/gi, 'can be played for');
    t = t.replace(/\bcredit\b/gi, 'balance');
    t = t.replace(/\bbuy bonus\b/gi, 'get bonus');
    t = t.replace(/\bgamble\b/gi, 'play');
    t = t.replace(/\bwager\b/gi, 'play');
    t = t.replace(/\bdeposit\b/gi, 'get coins');
    t = t.replace(/\bwithdraw\b/gi, 'redeem');
    t = t.replace(/\bbonus buy\b/gi, 'bonus / feature');
    t = t.replace(/\bcurrency\b/gi, 'token');
    t = t.replace(/\bfund\b/gi, 'balance');
    return t;
  }

  /** Draw a dark translucent card rectangle onto a page */
  private drawCard(page: Phaser.GameObjects.Container, x: number, y: number, cw: number, ch: number, accent = false) {
    const g = this.scene.add.graphics();
    g.fillStyle(0x0d0a18, 0.5);
    g.fillRoundedRect(x, y, cw, ch, 10);
    g.lineStyle(1, accent ? 0xff006a : 0xffffff, accent ? 0.4 : 0.07);
    g.strokeRoundedRect(x, y, cw, ch, 10);
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
    page.add(this.scene.add.text(x, y, this.T(text), {
      fontSize: '22px', fontFamily: this.FONT_TITLE, color: '#ffffff', fontStyle: '700'
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
    bg.on('pointerdown', () => { (this.scene as any).audio?.playSound('button'); this.hide(); });
    this.container.add(bg);

    const pageWrapper = this.scene.add.container(0, 0);
    this.container.add(pageWrapper);

    // Premium Panel Background for the Info Pages
    const panel = this.scene.add.graphics();
    // Drop shadow
    panel.fillStyle(0x000000, 0.4);
    panel.fillRoundedRect(6, 8, logicalW, logicalH, 20);
    // Main panel
    panel.fillGradientStyle(0x130f24, 0x130f24, 0x0a0812, 0x0a0812, 0.98);
    panel.fillRoundedRect(0, 0, logicalW, logicalH, 20);
    // Header gradient
    panel.fillGradientStyle(0xff006a, 0xff3388, 0x130f24, 0x130f24, 0.2, 0.2, 0, 0);
    panel.fillRoundedRect(0, 0, logicalW, 60, {tl:20,tr:20,bl:0,br:0} as any);
    // Border
    panel.lineStyle(2, 0xff006a, 0.6);
    panel.strokeRoundedRect(0, 0, logicalW, logicalH, 20);
    // Inner rim
    panel.lineStyle(1, 0xffffff, 0.05);
    panel.strokeRoundedRect(2, 2, logicalW - 4, logicalH - 4, 18);
    panel.setInteractive(new Phaser.Geom.Rectangle(0, 0, logicalW, logicalH), Phaser.Geom.Rectangle.Contains);
    pageWrapper.add(panel);

    const scale = Math.min(w / logicalW, h / logicalH, 1);
    pageWrapper.setScale(scale);
    pageWrapper.setPosition(
      (w - logicalW * scale) / 2,
      (h - logicalH * scale) / 2
    );

    // Title
    const isSocial = getStakeEngine().isSocialMode();
    pageWrapper.add(this.scene.add.text(logicalW / 2, 32, this.T(T('GAME RULES', isSocial)), {
      fontSize: '26px', fontFamily: this.FONT_TITLE, color: '#ffffff', fontStyle: '800'
    }).setOrigin(0.5));

    // Close button — circle with X
    const closeBtnGfx = this.scene.add.graphics();
    closeBtnGfx.fillStyle(0xff006a, 0.12);
    closeBtnGfx.fillCircle(logicalW - 35, 33, 16);
    closeBtnGfx.lineStyle(1.5, 0xff006a, 0.5);
    closeBtnGfx.strokeCircle(logicalW - 35, 33, 16);
    pageWrapper.add(closeBtnGfx);
    const closeBtn = this.scene.add.text(logicalW - 35, 33, this.T('✕'), {
      fontSize: '22px', color: '#ffffff', fontFamily: this.FONT_BODY, fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      (this.scene as any).audio.playSound('button');
      this.hide();
    });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff4488'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ffffff'));
    pageWrapper.add(closeBtn);

    // Build all 8 pages
    this.buildPage1_Symbols(pageWrapper, logicalW, logicalH);
    this.buildPage2_Tumble(pageWrapper, logicalW, logicalH);
    this.buildPage3_Multipliers(pageWrapper, logicalW, logicalH);
    this.buildPage4_FreeSpins(pageWrapper, logicalW, logicalH);
    this.buildPage5_BuyFeatures(pageWrapper, logicalW, logicalH);
    this.buildPage6_GameRules(pageWrapper, logicalW, logicalH);
    this.buildPage7_HowToPlay(pageWrapper, logicalW, logicalH);
    this.buildPage8_Settings(pageWrapper, logicalW, logicalH);

    // Navigation — ◀ ▶ with dot indicators
    const navY = logicalH - 38;
    const navCenter = logicalW / 2;

    const prevBtn = this.scene.add.text(navCenter - 120, navY, this.T('< PREV'), {
      fontSize: '20px', color: '#ff006a', fontStyle: 'bold', fontFamily: this.FONT_BODY,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    prevBtn.on('pointerdown', () => {
      (this.scene as any).audio.playSound('button');
      this.changePage(-1);
    });
    prevBtn.on('pointerover', () => prevBtn.setColor('#ff4488'));
    prevBtn.on('pointerout', () => prevBtn.setColor('#ff006a'));
    pageWrapper.add(prevBtn);

    const nextBtn = this.scene.add.text(navCenter + 120, navY, this.T('NEXT >'), {
      fontSize: '20px', color: '#ff006a', fontStyle: 'bold', fontFamily: this.FONT_BODY,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    nextBtn.on('pointerdown', () => {
      (this.scene as any).audio.playSound('button');
      this.changePage(1);
    });
    nextBtn.on('pointerover', () => nextBtn.setColor('#ff4488'));
    nextBtn.on('pointerout', () => nextBtn.setColor('#ff006a'));
    pageWrapper.add(nextBtn);

    // Dot indicators
    this.dotIndicators = [];
    for (let i = 0; i < 8; i++) {
      const dot = this.scene.add.graphics();
      const dx = navCenter - 56 + i * 16;
      dot.fillStyle(i === 0 ? 0xff006a : 0x332244, 1);
      dot.fillCircle(dx, navY, i === 0 ? 5 : 4);
      if (i === 0) { dot.lineStyle(1, 0xff006a, 0.5); dot.strokeCircle(dx, navY, 7); }
      pageWrapper.add(dot);
      this.dotIndicators.push(dot);
    }

    // Page label
    this.txtPageNum = this.scene.add.text(logicalW - 70, navY, this.T('1 / 8'), {
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
    page.add(this.scene.add.text(w / 2, yPos + 5, this.T('Cluster Pays: Min 5 connected symbols (horizontal/vertical) on a 7\u00d77 grid.'), {
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
      page.add(this.scene.add.text(startX - 8, rowY, this.T(tierLabel), {
        fontSize: '11px', color: this.COL_MUTED, fontStyle: 'bold', fontFamily: this.FONT_BODY
      }).setOrigin(1, 0));
      // Values
      order.forEach((symId, col) => {
        const cx = startX + col * colW + colW / 2;
        const payIdx = tier >= 15 ? 10 : tier - 5;
        const val = options.payvalues[symId][payIdx];
        const color = rowIdx < 2 ? this.COL_GOLD : rowIdx < 5 ? '#ffcc77' : this.COL_BODY;
        page.add(this.scene.add.text(cx, rowY, this.T(val.toFixed(2)), {
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
    page.add(this.scene.add.text(pad + 75, yPos + 8, this.T('SCATTER \u2014 Appears on all reels. Triggers Free Spins.'), {
      fontSize: '13px', color: this.COL_BODY, fontFamily: this.FONT_BODY
    }));
    page.add(this.scene.add.text(pad + 75, yPos + 28, this.T('3 or more Scatters award 10-30 Free Spins.'), {
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
      page.add(this.scene.add.text(pad + 20, yPos + 10 + i * 38, this.T(line), {
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
      page.add(this.scene.add.text(sx, yPos + 20, this.T(s), {
        fontSize: '14px', color: i === 4 ? this.COL_GOLD : '#ffffff', fontStyle: 'bold', fontFamily: this.FONT_BODY
      }).setOrigin(0.5));
      if (i < steps.length - 1) {
        page.add(this.scene.add.text(sx + stepW / 2, yPos + 20, this.T('\u2192'), {
          fontSize: '16px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY
        }).setOrigin(0.5));
      }
      page.add(this.scene.add.text(sx, yPos + 42, this.T(['Start', 'Cluster pays', 'Symbols vanish', 'Fill gaps', 'Until no wins'][i]), {
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
      page.add(this.scene.add.text(pad + 20, yPos + 10 + i * 32, this.T(line), {
        fontSize: '15px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 50 }
      }));
    });
    yPos += 200;

    // Multiplier progression visual card
    this.drawCard(page, pad, yPos, w - pad * 2, 90, true);
    page.add(this.scene.add.text(w / 2, yPos + 15, this.T('MULTIPLIER PROGRESSION'), {
      fontSize: '12px', color: this.COL_MUTED, fontStyle: 'bold', fontFamily: this.FONT_BODY
    }).setOrigin(0.5));
    const mults = ['\u00d72', '\u00d74', '\u00d78', '\u00d716', '\u00d732', '\u00d764', '...', '\u00d71024'];
    const mw = (w - pad * 2 - 40) / mults.length;
    mults.forEach((m, i) => {
      const mx = pad + 20 + i * mw + mw / 2;
      const isMax = i === mults.length - 1;
      page.add(this.scene.add.text(mx, yPos + 48, this.T(m), {
        fontSize: isMax ? '18px' : '16px', color: isMax ? this.COL_GOLD : '#ffffff',
        fontStyle: 'bold', fontFamily: this.FONT_BODY
      }).setOrigin(0.5));
      if (i < mults.length - 1 && m !== '...') {
        page.add(this.scene.add.text(mx + mw / 2, yPos + 48, this.T('\u2192'), {
          fontSize: '14px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY
        }).setOrigin(0.5));
      }
    });
    yPos += 110;

    // Free spins note
    this.drawCard(page, pad, yPos, w - pad * 2, 55);
    page.add(this.scene.add.text(w / 2, yPos + 14, this.T('\u26a1 During Free Spins, multipliers persist across all spins!'), {
      fontSize: '14px', color: this.COL_GOLD, fontFamily: this.FONT_BODY, fontStyle: 'bold'
    }).setOrigin(0.5));
    page.add(this.scene.add.text(w / 2, yPos + 36, this.T('They are only cleared when the bonus round ends.'), {
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
    let yPos = 70;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'FREE SPINS');

    // Rules card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 145);
    const fsRules = [
      '\u2022  3-7 Scatter symbols trigger 10-30 free spins.',
      '\u2022  Multiplier spots persist across the entire bonus round.',
      '\u2022  Re-trigger: 3+ Scatters during free spins award extra spins.',
      '\u2022  Additional free spins are added to the remaining count.',
    ];
    fsRules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 20, yPos + 8 + i * 30, this.T(line), {
        fontSize: '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 50 }
      }));
    });
    yPos += 155;

    // Scatter table card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 175, true);
    page.add(this.scene.add.text(w / 2, yPos + 6, this.T('SCATTER AWARDS'), {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold', fontFamily: this.FONT_BODY
    }).setOrigin(0.5));
    yPos += 28;

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
        bg.fillRect(pad + 10, yPos - 2, w - pad * 2 - 20, 24);
        page.add(bg);
      }
      page.add(this.scene.add.text(w / 2 - 60, yPos, this.T(row.count), {
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold', fontFamily: this.FONT_BODY
      }).setOrigin(1, 0));
      page.add(this.scene.add.text(w / 2 - 20, yPos, this.T('\u2192'), {
        fontSize: '14px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY
      }).setOrigin(0.5, 0));
      page.add(this.scene.add.text(w / 2 + 20, yPos, this.T(row.spins), {
        fontSize: '14px', color: this.COL_GOLD, fontStyle: 'bold', fontFamily: this.FONT_BODY
      }));
      yPos += 26;
    });
    yPos += 15;

    // Note at bottom about buy features
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 45);
    page.add(this.scene.add.text(w / 2, yPos + 12, this.T('\u27a1 See next page for Buy Free Spins options (1,000× and 500×)'), {
      fontSize: '13px', color: this.COL_GOLD, fontFamily: this.FONT_BODY, fontStyle: 'bold'
    }).setOrigin(0.5));

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 5: BUY FEATURES (1000× ULTRA / 500× SUPER)
  // ─────────────────────────────────────────────
  private buildPage5_BuyFeatures(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 40;
    let yPos = 70;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'BUY FREE SPINS');

    // Intro text
    page.add(this.scene.add.text(w / 2, yPos, this.T('Two premium options to instantly trigger the Free Spins bonus round.'), {
      fontSize: '14px', color: this.COL_MUTED, fontFamily: this.FONT_BODY, fontStyle: 'italic'
    }).setOrigin(0.5));
    yPos += 30;

    // ───── 1000× ULTRA Card (TOP TIER) ─────
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 195, true);
    // Title row
    page.add(this.scene.add.text(pad + 25, yPos + 8, this.T('\ud83d\udc8e  ULTRA FREE SPINS'), {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold', fontFamily: '"Outfit", "Inter", sans-serif'
    }));
    page.add(this.scene.add.text(w - pad - 25, yPos + 8, this.T('1,000× BET'), {
      fontSize: '18px', color: this.COL_GOLD, fontStyle: 'bold', fontFamily: '"Luckiest Guy", cursive, sans-serif'
    }).setOrigin(1, 0));
    yPos += 38;

    const buy1000Rules = [
      '\u2022  Costs 1,000× your current base bet amount.',
      '\u2022  Instantly triggers the ULTRA Free Spins bonus round.',
      '\u2022  3-7 Scatter symbols land on the board (server-determined).',
      '\u2022  Awards 10-30 Free Spins based on Scatter count.',
      '\u2022  All 49 grid spots start pre-loaded with ×4 multipliers!',
      '\u2022  Multipliers double on each hit: ×4 → ×8 → ×16 → ... → ×1024.',
      '\u2022  Multipliers persist and compound across all spins.',
      '\u2022  Best chance to hit the 25,000× MAX WIN cap.',
    ];
    buy1000Rules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 25, yPos + i * 19, this.T(line), {
        fontSize: '12px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 60 }
      }));
    });
    yPos += 170;

    // ───── 500× SUPER Card ─────
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 175, true);
    // Title row
    page.add(this.scene.add.text(pad + 25, yPos + 8, this.T('\u2b50  SUPER FREE SPINS'), {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold', fontFamily: '"Outfit", "Inter", sans-serif'
    }));
    page.add(this.scene.add.text(w - pad - 25, yPos + 8, this.T('500× BET'), {
      fontSize: '18px', color: this.COL_GOLD, fontStyle: 'bold', fontFamily: '"Luckiest Guy", cursive, sans-serif'
    }).setOrigin(1, 0));
    yPos += 38;

    const buy500Rules = [
      '\u2022  Costs 500× your current base bet amount.',
      '\u2022  Instantly triggers the SUPER Free Spins bonus round.',
      '\u2022  3-7 Scatter symbols land on the board (server-determined).',
      '\u2022  Awards 10-30 Free Spins based on Scatter count.',
      '\u2022  All 49 grid spots start pre-loaded with ×2 multipliers.',
      '\u2022  Multipliers double on each hit: ×2 → ×4 → ×8 → ... → ×1024.',
      '\u2022  Multipliers persist and compound across all spins.',
    ];
    buy500Rules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 25, yPos + i * 19, this.T(line), {
        fontSize: '12px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 60 }
      }));
    });
    yPos += 155;

    // Important notes
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 80);
    page.add(this.scene.add.text(w / 2, yPos + 8, this.T('IMPORTANT'), {
      fontSize: '13px', color: this.COL_ACCENT, fontStyle: 'bold', fontFamily: this.FONT_BODY
    }).setOrigin(0.5));
    const notes = [
      '\u2022  The cost is deducted from your balance immediately upon confirmation.',
      '\u2022  Ante Bet does not affect the Buy Feature cost.',
      '\u2022  Max win cap of 25,000× applies to all bonus rounds.',
    ];
    notes.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 25, yPos + 26 + i * 17, this.T(line), {
        fontSize: '11px', color: this.COL_MUTED, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 60 }
      }));
    });

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 6: GAME RULES (Volatility, RTP, Bet Limits)
  // ─────────────────────────────────────────────
  private buildPage6_GameRules(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 40;
    let yPos = 70;
    yPos = this.addSectionTitle(page, w / 2, yPos, 'GAME RULES');
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 50, true);
    page.add(this.scene.add.text(w / 2 - 40, yPos + 18, this.T('VOLATILITY'), {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold', fontFamily: this.FONT_BODY
    }).setOrigin(0.5));
    page.add(this.scene.add.text(w / 2 + 60, yPos + 18, this.T('\u26a1\u26a1\u26a1\u26a1\u26a1'), {
      fontSize: '16px', color: this.COL_GOLD
    }).setOrigin(0.5));
    yPos += 60;
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 200);
    const rules = [
      '\u2022  Wins are calculated per cluster (5+ connected symbols).',
      '\u2022  Multiple cluster wins in a single tumble are summed.',
      '\u2022  All wins are multiplied by the base bet amount.',
      '\u2022  Multiplier spots in a cluster are summed, then applied.',
      '\u2022  Free spins total win is awarded when the round ends.',
      '\u2022  Ante Bet: costs 25% more, doubles scatter chance.',
    ];
    rules.forEach((line, i) => {
      page.add(this.scene.add.text(pad + 20, yPos + 8 + i * 28, this.T(line), {
        fontSize: '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 50 }
      }));
    });
    yPos += 210;
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 95);
    page.add(this.scene.add.text(pad + 20, yPos + 8, this.T('RTP (Return to Player)'), {
      fontSize: '13px', color: this.COL_MUTED, fontStyle: 'bold', fontFamily: this.FONT_BODY
    }));
    page.add(this.scene.add.text(pad + 20, yPos + 30, this.T('Base: 96.53%  |  Ultra FS: 96.50%  |  Super: 96.44%'), {
      fontSize: '14px', color: '#ffffff', fontFamily: this.FONT_BODY
    }));
    page.add(this.scene.add.text(pad + 20, yPos + 55, this.T(`Bet: ${BET_PRESETS[0].toFixed(2)} \u2013 ${BET_PRESETS[BET_PRESETS.length - 1].toFixed(2)}  |  Max Win: ${options.maxWinMultiplier.toLocaleString()}\u00d7`), {
      fontSize: '14px', color: this.COL_GOLD, fontFamily: this.FONT_BODY, fontStyle: 'bold'
    }));
    yPos += 105;
    page.add(this.scene.add.text(w / 2, yPos + 5, this.T('Malfunction voids all wins and plays. A consistent internet connection is required.\nIn the event of a disconnection, reload the game to finish any uncompleted rounds.\nThe expected return is calculated over many plays. The game display is not representative\nof any physical device and is for illustrative purposes only. Winnings are settled\naccording to the amount received from the Remote Game Server and not from events\nwithin the web browser. TM and © 2026 Stake Engine.'), {
      fontSize: '11px', color: this.COL_MUTED, fontStyle: 'italic', fontFamily: this.FONT_BODY, align: 'center', lineSpacing: 2
    }).setOrigin(0.5, 0));
    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 7: HOW TO PLAY
  // ─────────────────────────────────────────────
  private buildPage7_HowToPlay(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 75;

    page.add(this.scene.add.text(w / 2, yPos, this.T('HOW TO PLAY'), {
      fontSize: '24px', fontFamily: '"Outfit", "Inter", sans-serif',
      color: '#ffffff', fontStyle: '800',
    }).setOrigin(0.5));
    yPos += 45;

    const howTo = [
      'Click the  ⊕  or  ⊖  buttons to change the bet value.',
      'Select the bet you want to use in the game.',
      'Press the SPIN button to play.',
    ];
    howTo.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, this.T(line), {
        fontSize: '15px', color: '#e0e0e0', align: 'center', fontFamily: '"Inter", "Arial", sans-serif'
      }).setOrigin(0.5, 0));
      yPos += 26;
    });

    yPos += 15;
    page.add(this.scene.add.text(w / 2, yPos, this.T('MAIN GAME INTERFACE'), {
      fontSize: '20px', fontFamily: '"Outfit", "Inter", sans-serif',
      color: '#ffffff', fontStyle: '700',
    }).setOrigin(0.5));
    yPos += 40;

    const uiInfo = [
      '[SETTINGS] opens the SETTINGS menu that contains settings which',
      'affect the way the game is being played.',
      '',
      '[SOUND] toggles sound and music on and off.',
      '',
      '[INFO] opens the Information page.',
      '',
      'BALANCE and BET labels show the current balance and',
      'current total bet.',
      '',
      '[+] and [-] change up or down the current bet.',
      '',
      '[SPIN] starts the game.',
      '',
      'AUTOPLAY opens the automatic play menu.',
      'Click the AUTOPLAY button again to stop it.',
    ];

    uiInfo.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, this.T(line), {
        fontSize: '14px', color: '#e0e0e0', align: 'center', fontFamily: '"Inter", "Arial", sans-serif'
      }).setOrigin(0.5, 0));
      yPos += line === '' ? 10 : 22;
    });

    parent.add(page);
    this.pages.push(page);
  }

  // ─────────────────────────────────────────────
  // PAGE 8: SETTINGS / INFO / BET MENU / MAX WIN
  // ─────────────────────────────────────────────
  private buildPage8_Settings(parent: Phaser.GameObjects.Container, w: number, h: number) {
    const page = this.scene.add.container(0, 0).setVisible(false);
    let yPos = 75;

    page.add(this.scene.add.text(w / 2, yPos, this.T('SETTINGS MENU'), {
      fontSize: '24px', fontFamily: '"Outfit", "Inter", sans-serif',
      color: '#ffffff', fontStyle: '800',
    }).setOrigin(0.5));
    yPos += 40;

    const settingsInfo = [
      'INTRO SCREEN – toggles the introductory screen on and off',
      'AMBIENT – toggles the ambient sound and music on and off',
      'SOUND FX – toggles the game\'s sound effects on and off',
      'GAME HISTORY – opens the game history page',
    ];
    settingsInfo.forEach((line) => {
      page.add(this.scene.add.text(w / 2, yPos, this.T(line), {
        fontSize: '13px', color: '#cccccc', align: 'center',
      }).setOrigin(0.5, 0));
      yPos += 22;
    });

    yPos += 20;
    page.add(this.scene.add.text(w / 2, yPos, this.T('INFORMATION SCREEN'), {
      fontSize: '20px', fontFamily: '"Outfit", "Inter", sans-serif',
      color: '#ffffff', fontStyle: '700',
    }).setOrigin(0.5));
    yPos += 35;

    page.add(this.scene.add.text(w / 2, yPos, this.T('◀  and  ▶  scroll between information pages'), {
      fontSize: '13px', color: '#cccccc', align: 'center',
    }).setOrigin(0.5, 0));
    yPos += 22;
    page.add(this.scene.add.text(w / 2, yPos, this.T('✕  closes the information screen'), {
      fontSize: '13px', color: '#cccccc', align: 'center',
    }).setOrigin(0.5, 0));
    yPos += 35;

    page.add(this.scene.add.text(w / 2, yPos, this.T('BET MENU'), {
      fontSize: '20px', fontFamily: '"Outfit", "Inter", sans-serif',
      color: '#ffffff', fontStyle: '700',
    }).setOrigin(0.5));
    yPos += 32;

    page.add(this.scene.add.text(w / 2, yPos, this.T('The bet menu shows the bet multiplier available in the game,\nand the current total bet in both coins and cash.'), {
      fontSize: '13px', color: '#cccccc', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));
    yPos += 40;

    page.add(this.scene.add.text(w / 2, yPos, this.T('Use the  ⊕  and  ⊖  buttons in the BET and COIN VALUE\nfields to change the values.'), {
      fontSize: '13px', color: '#cccccc', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));
    yPos += 45;

    // MAX WIN
    page.add(this.scene.add.text(w / 2, yPos, this.T('MAX WIN'), {
      fontSize: '22px', fontFamily: '"Outfit", "Inter", sans-serif',
      color: '#ffe600', fontStyle: '800',
    }).setOrigin(0.5));
    yPos += 30;

    page.add(this.scene.add.text(w / 2, yPos, this.T(`The maximum win amount is limited to ${options.maxWinMultiplier.toLocaleString()}× bet.\nIf the total win of a round reaches ${options.maxWinMultiplier.toLocaleString()}× bet the round\nimmediately ends, win is awarded and all remaining\nfree spins are forfeited.`), {
      fontSize: '13px', color: '#cccccc', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0));

    // Buy Free Spins section at the bottom
    yPos += 75;
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0x444444, 0.5);
    sep.lineBetween(100, yPos, w - 100, yPos);
    page.add(sep);
    yPos += 15;

    page.add(this.scene.add.text(w / 2, yPos, this.T('BUY ULTRA FREE SPINS: Pay 1,000× total bet with ×4 starting multipliers.\nBUY SUPER FREE SPINS: Pay 500× total bet with ×2 starting multipliers.'), {
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
        const dx = navCenter - 56 + i * 16;
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

