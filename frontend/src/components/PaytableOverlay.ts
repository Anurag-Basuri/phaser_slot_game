import Phaser from 'phaser';
import options, { BET_PRESETS } from '../options';
import { getStakeEngine } from '../engine/StakeEngineClient';
import { T } from '../helpers/I18n';
import type { GameScene } from '../scenes/GameScene';

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
  private scene: GameScene;
  private container!: Phaser.GameObjects.Container;
  private pages: Phaser.GameObjects.Container[] = [];
  private currentPage = 0;
  private visible = false;
  private txtPageNum!: Phaser.GameObjects.Text;
  private dotIndicators: Phaser.GameObjects.Graphics[] = [];

  private readonly FONT_BODY = '"Inter", "Roboto", "Arial", sans-serif';
  private readonly FONT_TITLE = '"Inter", "Roboto", "Arial", sans-serif';
  private readonly COL_BODY = '#dddddd';
  private readonly COL_MUTED = '#ff8c00';
  private readonly COL_ACCENT = '#ffffff';
  private readonly COL_GOLD = '#ff8c00';

  private symbolNames = [
    'Red Cherry Candy', 'Blue Sapphire Candy', 'Pink Rose Candy',
    'Green Apple Candy', 'Purple Grape Candy', 'Orange Tangerine Candy', 'Golden Lemon Candy'
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

  /** Draw a sleek translucent card rectangle onto a page */
  private drawCard(page: Phaser.GameObjects.Container, x: number, y: number, cw: number, ch: number, accent = false) {
    const g = this.scene.add.graphics();
    g.fillStyle(0x1a2436, 0.8);
    g.fillRoundedRect(x, y, cw, ch, 8);
    g.lineStyle(1, 0xff8c00, 0.4);
    g.strokeRoundedRect(x, y, cw, ch, 8);
    page.add(g);
  }

  /** Draw a horizontal divider line */
  private drawDivider(page: Phaser.GameObjects.Container, x1: number, x2: number, y: number) {
    const g = this.scene.add.graphics();
    g.lineStyle(1, 0xffffff, 0.2);
    g.lineBetween(x1, y, x2, y);
    page.add(g);
  }

  /** Add a section title with underline accent */
  private addSectionTitle(page: Phaser.GameObjects.Container, x: number, y: number, text: string): number {
    page.add(this.scene.add.text(30, y, this.T(text), { 
      fontSize: '28px', fontFamily: this.FONT_TITLE, color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0, 0.5));
    
    // Calculate approximate text width for the underline
    const tempText = this.scene.add.text(0, 0, this.T(text), { fontSize: '28px', fontFamily: this.FONT_TITLE, fontStyle: 'bold' });
    const lw = tempText.width + 10;
    tempText.destroy();

    const g = this.scene.add.graphics();
    g.lineStyle(1, 0xff8c00, 0.6);
    g.lineBetween(30, y + 18, 30 + lw, y + 18);
    page.add(g);
    return y + 45;
  }

  constructor(scene: GameScene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0).setDepth(100).setVisible(false);
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

  private scrollContainer!: Phaser.GameObjects.Container;
  private isMobileScroll = false;
  private scrollY = 0;
  private maxScrollY = 0;

  private build(w?: number, h?: number) {
    w = w || this.scene.scale.width;
    h = h || this.scene.scale.height;

    this.isMobileScroll = h > w || h < 600;
    const logicalW = this.isMobileScroll ? Math.min(600, w * 0.95) : Math.min(860, w * 0.9);
    const logicalH = this.isMobileScroll ? Math.min(1000, h * 0.95) : Math.min(680, h * 0.85);

    // Dark translucent backdrop
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(-w, -h, w * 3, h * 3);
    bg.setInteractive(new Phaser.Geom.Rectangle(-w, -h, w * 3, h * 3), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerdown', () => { this.scene.audio?.playSound('button'); this.hide(); });
    this.container.add(bg);

    const pageWrapper = this.scene.add.container(0, 0);
    this.container.add(pageWrapper);

    // Premium Panel Background for the Info Pages
    const panel = this.scene.add.graphics();
    
    // Main panel (Dark Navy)
    panel.fillStyle(0x0d1b2a, 1);
    panel.fillRoundedRect(0, 0, logicalW, logicalH, 16);

    // Thin Orange Border
    panel.lineStyle(2, 0xff8c00, 0.8);
    panel.strokeRoundedRect(0, 0, logicalW, logicalH, 16);

    panel.setInteractive(new Phaser.Geom.Rectangle(0, 0, logicalW, logicalH), Phaser.Geom.Rectangle.Contains);
    pageWrapper.add(panel);

    const wrapperX = (w - logicalW) / 2;
    const wrapperY = (h - logicalH) / 2;
    pageWrapper.setPosition(wrapperX, wrapperY);

    this.scrollContainer = this.scene.add.container(0, 0);
    pageWrapper.add(this.scrollContainer);

    if (this.isMobileScroll) {
      const maskGraphics = this.scene.make.graphics({});
      maskGraphics.fillStyle(0x000000);
      maskGraphics.fillRect(wrapperX + 10, wrapperY + 10, logicalW - 20, logicalH - 20);
      this.scrollContainer.mask = new Phaser.Display.Masks.GeometryMask(this.scene, maskGraphics);
      
      this.scrollY = 0;
      this.maxScrollY = 0;
      
      // Interactive scroll zone over the panel
      const hitZone = this.scene.add.zone(logicalW / 2, logicalH / 2, logicalW, logicalH)
        .setInteractive({ draggable: true });
      pageWrapper.add(hitZone);
      
      hitZone.on('drag', (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        this.scrollY += (pointer.position.y - pointer.prevPosition.y);
        this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScrollY, 0);
        this.scrollContainer.y = this.scrollY;
      });
      
      hitZone.on('wheel', (pointer: Phaser.Input.Pointer, deltaX: number, deltaY: number) => {
        this.scrollY -= deltaY;
        this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScrollY, 0);
        this.scrollContainer.y = this.scrollY;
      });
    }

    // Header Pill - Removed, replace with clean left-aligned title
    // Title
    const isSocial = getStakeEngine().isSocialMode();
    pageWrapper.add(this.scene.add.text(30, 20, this.T(T('FEATURE EXPLANATION', isSocial)), { 
      fontSize: '28px', fontFamily: this.FONT_TITLE, color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0, 0));

    // Divider under main title
    const titleGfx = this.scene.add.graphics();
    titleGfx.lineStyle(1, 0xff8c00, 0.6);
    titleGfx.lineBetween(30, 55, logicalW - 30, 55);
    pageWrapper.add(titleGfx);

    // Close button
    const closeBtnX = logicalW - 10;
    const closeBtnY = 10;
    const closeBtnGfx = this.scene.add.graphics();
    closeBtnGfx.fillStyle(0x3a0055, 1);
    closeBtnGfx.fillCircle(closeBtnX + 4, closeBtnY + 4, 26);
    closeBtnGfx.fillStyle(0xff3333, 1);
    closeBtnGfx.fillCircle(closeBtnX, closeBtnY, 26);
    closeBtnGfx.lineStyle(4, 0xffffff, 1);
    closeBtnGfx.strokeCircle(closeBtnX, closeBtnY, 26);
    pageWrapper.add(closeBtnGfx);

    const closeBtn = this.scene.add.text(closeBtnX, closeBtnY, this.T('✕'), { 
      fontSize: '28px', color: '#ffffff', fontFamily: this.FONT_BODY
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 0, false, true).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      this.hide();
    });
    closeBtn.on('pointerover', () => closeBtn.setScale(1.1));
    closeBtn.on('pointerout', () => closeBtn.setScale(1));
    pageWrapper.add(closeBtn);

    // Build all 8 pages
    const parentContainer = this.isMobileScroll ? this.scrollContainer : pageWrapper;
    let currentY = 75;
    const getStartY = () => this.isMobileScroll ? currentY : 75;

    currentY = this.buildPage1_Symbols(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage2_Tumble(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage3_Multipliers(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage4_FreeSpins(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage5_BuyFeatures(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage6_GameRules(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage7_HowToPlay(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage8_Settings(parentContainer, logicalW, logicalH, getStartY());

    if (this.isMobileScroll) {
      this.maxScrollY = Math.max(0, currentY - logicalH + 40);
    }

    if (!this.isMobileScroll) {
      // Navigation — ◀ ▶ with dot indicators
      const navY = logicalH - 38;
      const navCenter = logicalW / 2;

      const createNavBtn = (x: number, label: string, dir: number) => {
        const btnGroup = this.scene.add.container(x, navY);
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x1a2436, 1);
        bg.fillRoundedRect(-60, -20, 120, 40, 8);
        bg.lineStyle(1, 0xff8c00, 0.8);
        bg.strokeRoundedRect(-60, -20, 120, 40, 8);
        btnGroup.add(bg);

        const txt = this.scene.add.text(0, -2, label, {
          fontSize: '18px', color: '#ff8c00', fontFamily: this.FONT_TITLE, fontStyle: 'bold'
        }).setOrigin(0.5);
        btnGroup.add(txt);

        const hit = this.scene.add.rectangle(0, 0, 120, 40).setInteractive({ useHandCursor: true }).setAlpha(0.001);
        hit.on('pointerdown', () => {
          this.scene.audio.playSound('button');
          this.changePage(dir);
          this.scene.tweens.add({ targets: btnGroup, scale: 0.9, yoyo: true, duration: 100 });
        });
        hit.on('pointerover', () => this.scene.tweens.add({ targets: btnGroup, scale: 1.05, duration: 100 }));
        hit.on('pointerout', () => this.scene.tweens.add({ targets: btnGroup, scale: 1, duration: 100 }));
        btnGroup.add(hit);
        pageWrapper.add(btnGroup);
      };

      createNavBtn(navCenter - 140, this.T('◀ PREV'), -1);
      createNavBtn(navCenter + 140, this.T('NEXT ▶'), 1);

      // Dot indicators
      this.dotIndicators = [];
      for (let i = 0; i < 8; i++) {
        const dot = this.scene.add.graphics();
        const dx = navCenter - 75 + i * 22;
        dot.fillStyle(i === 0 ? 0xff0070 : 0xffb3cc, 1);
        dot.fillCircle(dx, navY, i === 0 ? 6 : 5);
        if (i === 0) { dot.lineStyle(2, 0xffffff, 1); dot.strokeCircle(dx, navY, 8); }
        pageWrapper.add(dot);
        this.dotIndicators.push(dot);
      }

      // Page label
      this.txtPageNum = this.scene.add.text(logicalW - 70, navY, this.T('1 / 8'), { 
        fontSize: '18px', color: '#ff0070', fontFamily: this.FONT_BODY
      }).setOrigin(0.5);
      pageWrapper.add(this.txtPageNum);

      this.showPage(0);
    } else {
      // In mobile scroll mode, all pages are visible simultaneously, just stacked.
      this.pages.forEach(p => p.setVisible(true));
      this.currentPage = 0;
    }
  }

  // ─────────────────────────────────────────────
  // PAGE 1: SYMBOL PAYOUTS
  // ─────────────────────────────────────────────
  private buildPage1_Symbols(parent: Phaser.GameObjects.Container, w: number, h: number, startY: number = 75): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 30;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'SYMBOL PAYOUTS');

    // Card background for the whole payout table
    this.drawCard(page, pad - 5, yPos - 5, w - pad * 2 + 10, (w < 700) ? 440 : 370);

    // Intro text
    page.add(this.scene.add.text(pad, yPos + 5, this.T('Cluster Pays: Min 5 connected symbols (horizontal/vertical) on a 7\u00d77 grid.'), { 
      fontSize: (w < 700) ? '15px' : '13px', color: this.COL_BODY, align: 'left', fontFamily: this.FONT_BODY, wordWrap: { width: w - pad * 2 }
    }).setOrigin(0, 0));
    yPos += 45;

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
          fontSize: (w < 700) ? '14px' : '11px', color, fontFamily: this.FONT_BODY, fontStyle: 'bold'
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
      fontSize: (w < 700) ? '16px' : '13px', color: this.COL_BODY, fontFamily: this.FONT_BODY
    }));
    page.add(this.scene.add.text(pad + 75, yPos + 28, this.T('3 or more Scatters award 10-30 Free Spins.'), { 
      fontSize: (w < 700) ? '15px' : '12px', color: this.COL_MUTED, fontFamily: this.FONT_BODY
    }));

    parent.add(page);
    this.pages.push(page);
    return yPos + 50;
  }

  // ─────────────────────────────────────────────
  // PAGE 2: TUMBLE FEATURE
  // ─────────────────────────────────────────────
  private buildPage2_Tumble(parent: Phaser.GameObjects.Container, w: number, h: number, startY: number = 75): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 40;
    let yPos = startY;

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
    page.add(this.scene.add.text(pad + 20, yPos + 10, this.T(tumbleRules.join('\n')), { 
      fontSize: '15px', color: this.COL_BODY, fontFamily: this.FONT_BODY, lineSpacing: 10, align: 'left',
      wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 235;

    // Visual flow diagram
    this.drawCard(page, pad, yPos, w - pad * 2, 70, true);
    const steps = ['SPIN', 'WIN', 'REMOVE', 'DROP', 'REPEAT'];
    const stepW = (w - pad * 2) / steps.length;
    steps.forEach((s, i) => {
      const sx = pad + i * stepW + stepW / 2;
      page.add(this.scene.add.text(sx, yPos + 20, this.T(s), { 
        fontSize: (w < 700) ? '17px' : '14px', color: i === 4 ? this.COL_GOLD : this.COL_BODY, fontStyle: '800', fontFamily: this.FONT_BODY
      }).setOrigin(0.5));
      if (i < steps.length - 1) {
        page.add(this.scene.add.text(sx + stepW / 2, yPos + 20, this.T('\u2192'), { 
          fontSize: '18px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY, fontStyle: 'bold'
        }).setOrigin(0.5));
      }
      page.add(this.scene.add.text(sx, yPos + 42, this.T(['Start', 'Cluster pays', 'Symbols vanish', 'Fill gaps', 'Until no wins'][i]), { 
        fontSize: (w < 700) ? '13px' : '10px', color: this.COL_MUTED, fontFamily: this.FONT_BODY
      }).setOrigin(0.5));
    });

    parent.add(page);
    this.pages.push(page);
    return yPos + 50;
  }

  // ─────────────────────────────────────────────
  // PAGE 3: MULTIPLIER SPOTS
  // ─────────────────────────────────────────────
  private buildPage3_Multipliers(parent: Phaser.GameObjects.Container, w: number, h: number, startY: number = 75): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 40;
    let yPos = startY;

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
    page.add(this.scene.add.text(pad + 20, yPos + 10, this.T(rules.join('\n')), { 
      fontSize: '15px', color: this.COL_BODY, fontFamily: this.FONT_BODY, lineSpacing: 10, align: 'left',
      wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 200;

    // Multiplier progression visual card
    this.drawCard(page, pad, yPos, w - pad * 2, 90, true);
    page.add(this.scene.add.text(pad + 15, yPos + 15, this.T('MULTIPLIER PROGRESSION'), { 
      fontSize: (w < 700) ? '15px' : '12px', color: this.COL_MUTED, fontStyle: 'bold', fontFamily: this.FONT_BODY
    }).setOrigin(0, 0.5));
    const mults = ['\u00d72', '\u00d74', '\u00d78', '\u00d716', '\u00d732', '\u00d764', '...', '\u00d71024'];
    const mw = (w - pad * 2 - 40) / mults.length;
    mults.forEach((m, i) => {
      const mx = pad + 20 + i * mw + mw / 2;
      const isMax = i === mults.length - 1;
      page.add(this.scene.add.text(mx, yPos + 48, this.T(m), { 
        fontSize: isMax ? '20px' : '16px', color: isMax ? this.COL_GOLD : this.COL_BODY,
        fontStyle: '900', fontFamily: this.FONT_BODY
      }).setOrigin(0.5));
      if (i < mults.length - 1 && m !== '...') {
        page.add(this.scene.add.text(mx + mw / 2, yPos + 48, this.T('\u2192'), { 
          fontSize: (w < 700) ? '17px' : '14px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY
        }).setOrigin(0.5));
      }
    });
    yPos += 110;

    // Free spins note
    this.drawCard(page, pad, yPos, w - pad * 2, 55);
    page.add(this.scene.add.text(pad + 15, yPos + 14, this.T('\u26a1 During Free Spins, multipliers persist across all spins!'), { 
      fontSize: (w < 700) ? '16px' : '14px', color: this.COL_GOLD, fontFamily: this.FONT_BODY, fontStyle: 'bold'
    }).setOrigin(0, 0.5));
    page.add(this.scene.add.text(pad + 15, yPos + 36, this.T('They are only cleared when the bonus round ends.'), { 
      fontSize: (w < 700) ? '14px' : '12px', color: this.COL_BODY, fontFamily: this.FONT_BODY
    }).setOrigin(0, 0.5));

    parent.add(page);
    this.pages.push(page);
    return yPos + 50;
  }

  // ─────────────────────────────────────────────
  // PAGE 4: FREE SPINS
  // ─────────────────────────────────────────────
  private buildPage4_FreeSpins(parent: Phaser.GameObjects.Container, w: number, h: number, startY: number = 70): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 40;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'FREE SPINS');

    // Rules card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 145);
    const fsRules = [
      '\u2022  3-7 Scatter symbols trigger 10-30 free spins.',
      '\u2022  Multiplier spots persist across the entire bonus round.',
      '\u2022  Re-trigger: 3+ Scatters during free spins award extra spins.',
      '\u2022  Additional free spins are added to the remaining count.',
    ];
    page.add(this.scene.add.text(pad + 20, yPos + 8, this.T(fsRules.join('\n')), { 
      fontSize: (w < 700) ? '16px' : '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY, lineSpacing: 10, align: 'left',
      wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 155;

    // Scatter table card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 175, true);
    page.add(this.scene.add.text(pad + 15, yPos + 6, this.T('SCATTER AWARDS'), { 
      fontSize: (w < 700) ? '16px' : '14px', color: this.COL_MUTED, fontStyle: 'bold', fontFamily: this.FONT_BODY
    }).setOrigin(0, 0.5));
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
        bg.fillStyle(0xffffff, 0.4);
        bg.fillRect(pad + 10, yPos - 2, w - pad * 2 - 20, 24);
        page.add(bg);
      }
      page.add(this.scene.add.text(w / 2 - 60, yPos, this.T(row.count), { 
        fontSize: (w < 700) ? '17px' : '14px', color: this.COL_BODY, fontStyle: 'bold', fontFamily: this.FONT_BODY
      }).setOrigin(1, 0));
      page.add(this.scene.add.text(w / 2 - 20, yPos, this.T('\u2192'), { 
        fontSize: (w < 700) ? '17px' : '14px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY
      }).setOrigin(0.5, 0));
      page.add(this.scene.add.text(w / 2 + 20, yPos, this.T(row.spins), { 
        fontSize: (w < 700) ? '17px' : '14px', color: this.COL_GOLD, fontStyle: 'bold', fontFamily: this.FONT_BODY
      }));
      yPos += 26;
    });
    yPos += 15;

    // Note at bottom about buy features
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 45);
    page.add(this.scene.add.text(pad + 15, yPos + 12, this.T('\u27a1 See next page for Buy Free Spins options (1,000× and 500×)'), { 
      fontSize: (w < 700) ? '14px' : '12px', color: this.COL_GOLD, fontFamily: this.FONT_BODY, fontStyle: 'bold'
    }).setOrigin(0, 0.5));

    parent.add(page);
    this.pages.push(page);
    return yPos + 50;
  }

  // ─────────────────────────────────────────────
  // PAGE 5: BUY FEATURES (1000× ULTRA / 500× SUPER)
  // ─────────────────────────────────────────────
  private buildPage5_BuyFeatures(parent: Phaser.GameObjects.Container, w: number, h: number, startY: number = 70): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 30;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'BUY FREE SPINS');

    // Subtitle
    page.add(this.scene.add.text(pad + 5, yPos, this.T('Instantly trigger the Free Spins bonus round.'), { 
      fontSize: '13px', color: this.COL_MUTED, fontFamily: this.FONT_BODY, fontStyle: 'italic',
      wordWrap: { width: w - pad * 2 }
    }).setOrigin(0, 0));
    yPos += 22;

    const isWide = w >= 700;
    const cardGap = 14;

    if (isWide) {
      // ══════ SIDE-BY-SIDE LAYOUT ══════
      const cardW = (w - pad * 2 - cardGap) / 2;
      const cardH = 390;
      const leftX = pad;
      const rightX = pad + cardW + cardGap;

      this.drawBuyCard(page, leftX, yPos, cardW, cardH,
        '\ud83d\udc8e', 'ULTRA', '1,000\u00d7', 0xff0070, 0x3a0025,
        '\u00d74', '\u00d74 \u2192 \u00d78 \u2192 \u00d716 \u2192 ... \u2192 \u00d71024',
        [
          '3\u20137 Scatters land on board',
          '10\u201330 Free Spins awarded',
          'All 49 spots pre-loaded \u00d74',
          'Multipliers double each hit',
          'Persist across all spins',
          'Best shot at 25,000\u00d7 MAX WIN',
        ]
      );

      this.drawBuyCard(page, rightX, yPos, cardW, cardH,
        '\u2b50', 'SUPER', '500\u00d7', 0xff8c00, 0x2a1a00,
        '\u00d72', '\u00d72 \u2192 \u00d74 \u2192 \u00d78 \u2192 ... \u2192 \u00d71024',
        [
          '3\u20137 Scatters land on board',
          '10\u201330 Free Spins awarded',
          'All 49 spots pre-loaded \u00d72',
          'Multipliers double each hit',
          'Persist across all spins',
          'Great value bonus option',
        ]
      );

      yPos += cardH + 10;
    } else {
      // ══════ STACKED COMPACT LAYOUT (narrow / mobile) ══════
      const cardW = w - pad * 2;
      const cardH = 195;

      this.drawBuyCard(page, pad, yPos, cardW, cardH,
        '\ud83d\udc8e', 'ULTRA', '1,000\u00d7', 0xff0070, 0x3a0025,
        '\u00d74', '\u00d74 \u2192 \u00d78 \u2192 \u00d716 \u2192 ... \u2192 \u00d71024',
        [
          '3\u20137 Scatters \u2192 10\u201330 Free Spins',
          'All 49 spots pre-loaded with \u00d74',
          'Multipliers double each hit',
          'Best shot at 25,000\u00d7 MAX WIN',
        ]
      );
      yPos += cardH + 10;

      this.drawBuyCard(page, pad, yPos, cardW, cardH,
        '\u2b50', 'SUPER', '500\u00d7', 0xff8c00, 0x2a1a00,
        '\u00d72', '\u00d72 \u2192 \u00d74 \u2192 \u00d78 \u2192 ... \u2192 \u00d71024',
        [
          '3\u20137 Scatters \u2192 10\u201330 Free Spins',
          'All 49 spots pre-loaded with \u00d72',
          'Multipliers double each hit',
          'Great value bonus option',
        ]
      );
      yPos += cardH + 10;
    }

    // ── Important footer strip ──
    const footerH = 42;
    const footG = this.scene.add.graphics();
    footG.fillStyle(0x0a0e18, 0.9);
    footG.fillRoundedRect(pad, yPos, w - pad * 2, footerH, 6);
    footG.lineStyle(1, 0xff8c00, 0.3);
    footG.strokeRoundedRect(pad, yPos, w - pad * 2, footerH, 6);
    page.add(footG);

    page.add(this.scene.add.text(pad + 12, yPos + 10, this.T('\u26a0'), { 
      fontSize: '14px', color: '#ff8c00'
    }).setOrigin(0, 0));

    page.add(this.scene.add.text(pad + 30, yPos + 8, this.T('Cost deducted on confirmation  \u2022  Ante Bet doesn\'t affect Buy cost  \u2022  Max win 25,000\u00d7'), { 
      fontSize: '11px', color: this.COL_MUTED, fontFamily: this.FONT_BODY, lineSpacing: 3,
      wordWrap: { width: w - pad * 2 - 50 }
    }).setOrigin(0, 0));

    parent.add(page);
    this.pages.push(page);
    return yPos + footerH + 15;
  }

  /**
   * Draws a premium Buy Feature product card with glowing accent, badge, and feature list.
   */
  private drawBuyCard(
    page: Phaser.GameObjects.Container,
    x: number, y: number, cw: number, ch: number,
    icon: string, tierName: string, costLabel: string,
    accentColor: number, bgTint: number,
    startMult: string, multChain: string,
    features: string[]
  ) {
    const g = this.scene.add.graphics();

    // Outer glow
    g.fillStyle(accentColor, 0.08);
    g.fillRoundedRect(x - 2, y - 2, cw + 4, ch + 4, 12);

    // Card body
    g.fillStyle(bgTint, 0.6);
    g.fillRoundedRect(x, y, cw, ch, 10);
    g.fillStyle(0x0d1b2a, 0.85);
    g.fillRoundedRect(x, y, cw, ch, 10);

    // Accent border
    g.lineStyle(2, accentColor, 0.7);
    g.strokeRoundedRect(x, y, cw, ch, 10);

    // Top accent line
    g.lineStyle(3, accentColor, 0.9);
    g.lineBetween(x + 15, y, x + cw - 15, y);

    page.add(g);

    const cx = x + cw / 2;
    const innerPad = 15;
    let ty = y + 14;

    // Icon + Tier Name
    page.add(this.scene.add.text(cx, ty, this.T(icon), { 
      fontSize: '28px'
    }).setOrigin(0.5, 0));
    ty += 32;

    page.add(this.scene.add.text(cx, ty, this.T(`${tierName} FREE SPINS`), { 
      fontSize: '16px', color: '#ffffff', fontStyle: 'bold', fontFamily: this.FONT_TITLE
    }).setOrigin(0.5, 0));
    ty += 22;

    // Cost badge
    const badgeW = Math.min(cw - 30, 160);
    const badgeH = 28;
    const badgeX = cx - badgeW / 2;
    const badgeG = this.scene.add.graphics();
    badgeG.fillStyle(accentColor, 0.25);
    badgeG.fillRoundedRect(badgeX, ty, badgeW, badgeH, 14);
    badgeG.lineStyle(1, accentColor, 0.8);
    badgeG.strokeRoundedRect(badgeX, ty, badgeW, badgeH, 14);
    page.add(badgeG);

    page.add(this.scene.add.text(cx, ty + badgeH / 2, this.T(`${costLabel} BET`), { 
      fontSize: '15px', color: this.COL_GOLD, fontStyle: 'bold', fontFamily: '"Luckiest Guy", cursive, sans-serif'
    }).setOrigin(0.5));
    ty += badgeH + 12;

    // Divider
    const divG = this.scene.add.graphics();
    divG.lineStyle(1, accentColor, 0.25);
    divG.lineBetween(x + innerPad, ty, x + cw - innerPad, ty);
    page.add(divG);
    ty += 10;

    // Starting multiplier highlight
    page.add(this.scene.add.text(x + innerPad, ty, this.T(`Starting Multiplier: ${startMult}`), { 
      fontSize: '12px', color: this.COL_GOLD, fontStyle: 'bold', fontFamily: this.FONT_BODY
    }).setOrigin(0, 0));
    ty += 16;

    page.add(this.scene.add.text(x + innerPad, ty, this.T(multChain), { 
      fontSize: '11px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY
    }).setOrigin(0, 0));
    ty += 18;

    // Feature list
    features.forEach((f) => {
      page.add(this.scene.add.text(x + innerPad + 2, ty, this.T(`\u25b8 ${f}`), { 
        fontSize: '11px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: cw - innerPad * 2 - 10 }
      }).setOrigin(0, 0));
      ty += 15;
    });
  }

  // ─────────────────────────────────────────────
  // PAGE 6: GAME RULES (Volatility, RTP, Bet Limits)
  // ─────────────────────────────────────────────
  private buildPage6_GameRules(parent: Phaser.GameObjects.Container, w: number, h: number, startY: number = 70): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 40;
    let yPos = startY;
    yPos = this.addSectionTitle(page, w / 2, yPos, 'GAME RULES');
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 50, true);
    page.add(this.scene.add.text(pad + 20, yPos + 18, this.T('VOLATILITY'), { 
      fontSize: (w < 700) ? '16px' : '14px', color: this.COL_BODY, fontStyle: 'bold', fontFamily: this.FONT_BODY
    }).setOrigin(0, 0.5));
    page.add(this.scene.add.text(w - pad - 20, yPos + 18, this.T('\u26a1\u26a1\u26a1\u26a1\u26a1'), { 
      fontSize: '16px', color: this.COL_GOLD
    }).setOrigin(1, 0.5));
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
    page.add(this.scene.add.text(pad + 20, yPos + 8, this.T(rules.join('\n')), { 
      fontSize: (w < 700) ? '16px' : '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY, lineSpacing: 10, align: 'left',
      wordWrap: { width: w - pad * 2 - 50 }
    }).setOrigin(0, 0));
    yPos += 210;
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 95);
    page.add(this.scene.add.text(pad + 20, yPos + 8, this.T('RTP (Return to Player)'), { 
      fontSize: (w < 700) ? '16px' : '13px', color: this.COL_MUTED, fontStyle: 'bold', fontFamily: this.FONT_BODY
    }).setOrigin(0, 0));
    page.add(this.scene.add.text(pad + 20, yPos + 30, this.T('Base: 96.53%  |  Ultra FS: 96.50%  |  Super: 96.44%'), { 
      fontSize: (w < 700) ? '15px' : '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY
    }).setOrigin(0, 0));
    page.add(this.scene.add.text(pad + 20, yPos + 55, this.T(`Bet: ${BET_PRESETS[0].toFixed(2)} \u2013 ${BET_PRESETS[BET_PRESETS.length - 1].toFixed(2)}  |  Max Win: ${options.maxWinMultiplier.toLocaleString()}\u00d7`), { 
      fontSize: (w < 700) ? '15px' : '14px', color: this.COL_GOLD, fontFamily: this.FONT_BODY, fontStyle: 'bold'
    }).setOrigin(0, 0));
    yPos += 105;
    page.add(this.scene.add.text(pad, yPos + 5, this.T('Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. Winnings are settled according to the amount received from the Remote Game Server.'), { 
      fontSize: '11px', color: this.COL_MUTED, fontStyle: 'italic', fontFamily: this.FONT_BODY, align: 'left', lineSpacing: 2, wordWrap: { width: w - pad * 2 }
    }).setOrigin(0, 0));
    parent.add(page);
    this.pages.push(page);
    return yPos + 120;
  }

  // ─────────────────────────────────────────────
  // PAGE 7: HOW TO PLAY
  // ─────────────────────────────────────────────
  private buildPage7_HowToPlay(parent: Phaser.GameObjects.Container, w: number, h: number, startY: number = 75): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 40;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'HOW TO PLAY');

    const howTo = [
      '\u2022  Click the  \u2295  or  \u2296  buttons to change the bet value.',
      '\u2022  Select the bet you want to use in the game.',
      '\u2022  Press the SPIN button to play.',
    ];
    page.add(this.scene.add.text(pad + 20, yPos, this.T(howTo.join('\n')), { 
      fontSize: '15px', color: this.COL_BODY, align: 'left', fontFamily: this.FONT_BODY, lineSpacing: 6, wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));

    yPos += 80;
    page.add(this.scene.add.text(pad, yPos, this.T('MAIN GAME INTERFACE'), { 
      fontSize: '18px', fontFamily: this.FONT_TITLE, color: this.COL_MUTED, fontStyle: 'bold'
    }).setOrigin(0, 0.5));
    yPos += 20;

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

    page.add(this.scene.add.text(pad + 20, yPos, this.T(uiInfo.join('\n')), { 
      fontSize: (w < 700) ? '15px' : '14px', color: this.COL_BODY, align: 'left', fontFamily: this.FONT_BODY, lineSpacing: 4, wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));

    parent.add(page);
    this.pages.push(page);
    return yPos + 50;
  }

  // ─────────────────────────────────────────────
  // PAGE 8: SETTINGS / INFO / BET MENU / MAX WIN
  // ─────────────────────────────────────────────
  private buildPage8_Settings(parent: Phaser.GameObjects.Container, w: number, h: number, startY: number = 75): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = 40;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'SETTINGS MENU');

    const settingsInfo = [
      '\u2022  INTRO SCREEN \u2013 toggles the introductory screen on and off',
      '\u2022  AMBIENT \u2013 toggles the ambient sound and music on and off',
      '\u2022  SOUND FX \u2013 toggles the game\'s sound effects on and off',
      '\u2022  GAME HISTORY \u2013 opens the game history page',
    ];
    page.add(this.scene.add.text(pad + 20, yPos, this.T(settingsInfo.join('\n')), { 
      fontSize: (w < 700) ? '15px' : '13px', color: this.COL_BODY, align: 'left', fontFamily: this.FONT_BODY, lineSpacing: 6, wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));

    yPos += 80;
    page.add(this.scene.add.text(pad, yPos, this.T('INFORMATION SCREEN'), { 
      fontSize: '18px', fontFamily: this.FONT_TITLE, color: this.COL_MUTED, fontStyle: 'bold'
    }).setOrigin(0, 0.5));
    yPos += 20;

    page.add(this.scene.add.text(pad + 20, yPos, this.T('\u2022  \u25c0  and  \u25b6  scroll between information pages\n\u2022  \u2715  closes the information screen'), { 
      fontSize: (w < 700) ? '15px' : '13px', color: this.COL_BODY, align: 'left', fontFamily: this.FONT_BODY, lineSpacing: 6, wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 45;

    page.add(this.scene.add.text(pad, yPos, this.T('BET MENU'), { 
      fontSize: '18px', fontFamily: this.FONT_TITLE, color: this.COL_MUTED, fontStyle: 'bold'
    }).setOrigin(0, 0.5));
    yPos += 20;

    page.add(this.scene.add.text(pad + 20, yPos, this.T('\u2022  The bet menu shows the bet multiplier available in the game, and the current total bet in both coins and cash.\n\u2022  Use the \u2295 and \u2296 buttons in the BET and COIN VALUE fields to change the values.'), { 
      fontSize: (w < 700) ? '15px' : '13px', color: this.COL_BODY, align: 'left', lineSpacing: 4, fontFamily: this.FONT_BODY, wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 60;

    // MAX WIN
    page.add(this.scene.add.text(pad, yPos, this.T('MAX WIN'), { 
      fontSize: '18px', fontFamily: this.FONT_TITLE, color: this.COL_MUTED, fontStyle: 'bold'
    }).setOrigin(0, 0.5));
    yPos += 20;

    page.add(this.scene.add.text(pad + 20, yPos, this.T(`\u2022  The maximum win amount is limited to ${options.maxWinMultiplier.toLocaleString()}× bet.\n\u2022  If the total win of a round reaches ${options.maxWinMultiplier.toLocaleString()}× bet the round immediately ends, win is awarded and all remaining free spins are forfeited.`), { 
      fontSize: (w < 700) ? '15px' : '13px', color: this.COL_BODY, align: 'left', lineSpacing: 4, fontFamily: this.FONT_BODY, wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));

    // Buy Free Spins section at the bottom
    yPos += 50;
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0x444444, 0.5);
    sep.lineBetween(100, yPos, w - 100, yPos);
    page.add(sep);
    yPos += 10;

    page.add(this.scene.add.text(pad, yPos, this.T('BUY ULTRA FREE SPINS: Pay 1,000× total bet with ×4 starting multipliers.\nBUY SUPER FREE SPINS: Pay 500× total bet with ×2 starting multipliers.'), { 
      fontSize: (w < 700) ? '14px' : '12px', color: this.COL_MUTED, align: 'left', lineSpacing: 6, fontFamily: this.FONT_BODY, wordWrap: { width: w - pad * 2 }
    }).setOrigin(0, 0));

    parent.add(page);
    this.pages.push(page);
    return yPos + 80;
  }

  // ─────────────────────────────────────────────
  // PAGE NAVIGATION
  // ─────────────────────────────────────────────
  private changePage(dir: number) {
    let newPage = this.currentPage + dir;
    // Loop pagination as requested
    if (newPage < 0) newPage = this.pages.length - 1;
    if (newPage >= this.pages.length) newPage = 0;
    
    this.showPage(newPage, dir);
  }

  private showPage(index: number, direction: number = 0) {
    if (this.isMobileScroll) return;
    const isMobile = this.scene.scale.width < 700;
    const isSlideIn = isMobile && direction !== 0;

    this.pages.forEach((p, i) => {
      if (i === index) {
        p.setVisible(true);
        if (isSlideIn) {
          // Vertical slide effect on smaller screens
          p.setY(direction > 0 ? 100 : -100);
          p.setAlpha(0);
          this.scene.tweens.killTweensOf(p);
          this.scene.tweens.add({
            targets: p,
            y: 0,
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut'
          });
        } else {
          p.setY(0);
          p.setAlpha(1);
        }
      } else {
        p.setVisible(false);
      }
    });
    this.currentPage = index;
    if (this.txtPageNum) {
      this.txtPageNum.setText(`${index + 1} / ${this.pages.length}`);
    }
    // Update dot indicators
    if (this.dotIndicators.length > 0) {
      const navCenter = 860 / 2;
      const navY = 680 - 38;
      this.dotIndicators.forEach((dot, i) => {
        dot.clear();
        const dx = navCenter - 56 + i * 16;
        if (i === index) {
          dot.fillStyle(0xffffff, 1); dot.fillCircle(dx, navY, 5);
          dot.lineStyle(1, 0xffffff, 0.4); dot.strokeCircle(dx, navY, 7);
        } else {
          dot.fillStyle(0x65627a, 1); dot.fillCircle(dx, navY, 4);
        }
      });
    }
  }

  public show() {
    this.visible = true;
    this.showPage(0);
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.container.setY(40);
    this.scene.tweens.add({ 
      targets: this.container, 
      alpha: 1, 
      y: 0,
      duration: 300, 
      ease: 'Back.easeOut' 
    });
  }

  public hide() {
    this.scene.tweens.add({
      targets: this.container, 
      alpha: 0, 
      y: 30,
      duration: 200, 
      ease: 'Cubic.easeIn',
      onComplete: () => { this.container.setVisible(false); this.visible = false; },
    });
  }

  public isVisible(): boolean { return this.visible; }
  public toggle() {
    if (this.visible) this.hide(); else this.show();
  }
}

