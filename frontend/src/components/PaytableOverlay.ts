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

  // ── Premium Candy Typography ──
  private readonly FONT_TITLE = '"Luckiest Guy", cursive, sans-serif';
  private readonly FONT_BODY = '"Inter", "Roboto", "Arial", sans-serif';
  private readonly COL_BODY = '#e0ddf0';
  private readonly COL_MUTED = '#ffaa33';
  private readonly COL_ACCENT = '#ffffff';
  private readonly COL_GOLD = '#ffc844';
  private readonly COL_PINK = '#ff66aa';

  // ── Panel colors ──
  private readonly PANEL_BG = 0x1a0e35;
  private readonly PANEL_BORDER = 0xff66aa;
  private readonly CARD_BG = 0x221445;
  private readonly CARD_BORDER = 0x9944cc;

  private symbolNames = [
    'Red Cherry Candy', 'Blue Sapphire Candy', 'Pink Rose Candy',
    'Green Apple Candy', 'Purple Grape Candy', 'Orange Tangerine Candy', 'Golden Lemon Candy'
  ];

  private Tr(text: string): string {
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

  /** Draw a candy-tinted card rectangle */
  private drawCard(page: Phaser.GameObjects.Container, x: number, y: number, cw: number, ch: number, accent = false) {
    const g = this.scene.add.graphics();
    // Card body
    g.fillStyle(this.CARD_BG, 0.85);
    g.fillRoundedRect(x, y, cw, ch, 12);
    // Border
    g.lineStyle(1.5, accent ? this.COL_PINK_HEX : this.CARD_BORDER, accent ? 0.6 : 0.35);
    g.strokeRoundedRect(x, y, cw, ch, 12);
    // Subtle inner glow at top
    g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.04, 0.04, 0, 0);
    g.fillRoundedRect(x + 2, y + 2, cw - 4, ch * 0.2, { tl: 10, tr: 10, bl: 0, br: 0 });
    page.add(g);
  }

  private get COL_PINK_HEX(): number { return 0xff66aa; }

  /** Add a section title with candy underline */
  private addSectionTitle(page: Phaser.GameObjects.Container, _x: number, y: number, text: string): number {
    const txt = this.scene.add.text(35, y, this.Tr(text), {
      fontSize: '30px', fontFamily: this.FONT_TITLE, color: '#ffffff',
      stroke: '#441177', strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 4, color: '#1a0033', blur: 0, stroke: false, fill: true },
      resolution: 2
    }).setOrigin(0, 0.5);
    page.add(txt);

    // Candy pink underline
    const lw = txt.width + 14;
    const g = this.scene.add.graphics();
    g.lineStyle(3, 0xff66aa, 0.7);
    g.lineBetween(35, y + 20, 35 + lw, y + 20);
    // Little diamond ornament at end
    g.fillStyle(0xff66aa, 0.6);
    g.fillRect(35 + lw - 2, y + 17, 6, 6);
    page.add(g);
    return y + 40;
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
    const logicalW = this.isMobileScroll ? Math.min(600, w * 0.95) : Math.min(880, w * 0.9);
    const logicalH = this.isMobileScroll ? Math.min(1000, h * 0.95) : Math.min(740, h * 0.9);

    // ── Dark translucent backdrop ──
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0015, 0.78);
    bg.fillRect(-w, -h, w * 3, h * 3);
    bg.setInteractive(new Phaser.Geom.Rectangle(-w, -h, w * 3, h * 3), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerdown', () => { this.scene.audio?.playSound('button'); this.hide(); });
    this.container.add(bg);

    const pageWrapper = this.scene.add.container(0, 0);
    this.container.add(pageWrapper);

    // ── Premium Candy Panel ──
    const panel = this.scene.add.graphics();

    // Shadow
    panel.fillStyle(0x0a0015, 0.5);
    panel.fillRoundedRect(6, 8, logicalW, logicalH, 20);

    // Main panel body — deep candy purple
    panel.fillGradientStyle(0x1e0e40, 0x2a1455, 0x140a30, 0x1a0e38, 1, 1, 1, 1);
    panel.fillRoundedRect(0, 0, logicalW, logicalH, 20);

    // Glossy top reflection
    panel.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.06, 0.06, 0, 0);
    panel.fillRoundedRect(3, 3, logicalW - 6, logicalH * 0.12, { tl: 18, tr: 18, bl: 0, br: 0 });

    // Thick candy pink border
    panel.lineStyle(4, this.PANEL_BORDER, 0.85);
    panel.strokeRoundedRect(0, 0, logicalW, logicalH, 20);

    // Inner white rim
    panel.lineStyle(1.5, 0xffffff, 0.15);
    panel.strokeRoundedRect(4, 4, logicalW - 8, logicalH - 8, 16);

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

      const hitZone = this.scene.add.zone(logicalW / 2, logicalH / 2, logicalW, logicalH)
        .setInteractive({ draggable: true });
      pageWrapper.add(hitZone);

      hitZone.on('drag', (pointer: Phaser.Input.Pointer, _dragX: number, _dragY: number) => {
        this.scrollY += (pointer.position.y - pointer.prevPosition.y);
        this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScrollY, 0);
        this.scrollContainer.y = this.scrollY;
      });

      hitZone.on('wheel', (_pointer: Phaser.Input.Pointer, _deltaX: number, deltaY: number) => {
        this.scrollY -= deltaY;
        this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScrollY, 0);
        this.scrollContainer.y = this.scrollY;
      });

      // Scroll indicator track on the right
      const scrollTrack = this.scene.add.graphics();
      scrollTrack.fillStyle(0xffffff, 0.08);
      scrollTrack.fillRoundedRect(logicalW - 10, 60, 4, logicalH - 120, 2);
      pageWrapper.add(scrollTrack);
    }

    // ── Header Title ──
    const isSocial = getStakeEngine().isSocialMode();
    pageWrapper.add(this.scene.add.text(35, 22, this.Tr(T('FEATURE EXPLANATION', isSocial)), {
      fontSize: '26px', fontFamily: this.FONT_TITLE, color: '#ffffff',
      stroke: '#441177', strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 3, color: '#1a0033', blur: 0, stroke: false, fill: true },
      resolution: 2
    }).setOrigin(0, 0));

    // Golden divider under main title
    const titleGfx = this.scene.add.graphics();
    titleGfx.lineStyle(2, 0xffc844, 0.5);
    titleGfx.lineBetween(35, 58, logicalW - 35, 58);
    pageWrapper.add(titleGfx);

    // ── Close button — candy red circle ──
    const closeBtnX = logicalW - 12;
    const closeBtnY = 12;
    const closeBtnGfx = this.scene.add.graphics();
    // Shadow
    closeBtnGfx.fillStyle(0x220011, 0.6);
    closeBtnGfx.fillCircle(closeBtnX + 3, closeBtnY + 3, 22);
    // Body
    closeBtnGfx.fillStyle(0xff3355, 1);
    closeBtnGfx.fillCircle(closeBtnX, closeBtnY, 22);
    // Highlight
    closeBtnGfx.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.3, 0.3, 0, 0);
    closeBtnGfx.fillCircle(closeBtnX - 3, closeBtnY - 5, 10);
    // Border
    closeBtnGfx.lineStyle(3, 0xffffff, 0.9);
    closeBtnGfx.strokeCircle(closeBtnX, closeBtnY, 22);
    pageWrapper.add(closeBtnGfx);

    const closeBtn = this.scene.add.text(closeBtnX, closeBtnY + 1, '✕', {
      fontSize: '22px', color: '#ffffff', fontFamily: this.FONT_TITLE,
      stroke: '#880022', strokeThickness: 2
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { this.scene.audio.playSound('button'); this.hide(); });
    closeBtn.on('pointerover', () => closeBtn.setScale(1.15));
    closeBtn.on('pointerout', () => closeBtn.setScale(1));
    pageWrapper.add(closeBtn);

    // ── Build all 8 pages ──
    const parentContainer = this.isMobileScroll ? this.scrollContainer : pageWrapper;
    let currentY = 80;
    const getStartY = () => this.isMobileScroll ? currentY : 80;

    currentY = this.buildPage1_Symbols(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage2_Tumble(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage3_Multipliers(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage4_FreeSpins(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage5_BuyFeatures(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage6_GameRules(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage7_HowToPlay(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.buildPage8_Settings(parentContainer, logicalW, logicalH, getStartY());

    if (this.isMobileScroll) {
      this.maxScrollY = Math.max(0, currentY - logicalH + 60);
    }

    if (!this.isMobileScroll) {
      // ── Navigation — candy-styled PREV / NEXT buttons ──
      const navY = logicalH - 40;
      const navCenter = logicalW / 2;

      const createNavBtn = (x: number, label: string, dir: number) => {
        const btnGroup = this.scene.add.container(x, navY);

        const nbg = this.scene.add.graphics();
        // Shadow
        nbg.fillStyle(0x1a0033, 0.5);
        nbg.fillRoundedRect(-65, -18, 130, 38, 12);
        // Body
        nbg.fillGradientStyle(0x3a1866, 0x3a1866, 0x2a1050, 0x2a1050, 1, 1, 1, 1);
        nbg.fillRoundedRect(-65, -20, 130, 38, 12);
        // Border
        nbg.lineStyle(2, 0xff66aa, 0.7);
        nbg.strokeRoundedRect(-65, -20, 130, 38, 12);
        // Top highlight
        nbg.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.1, 0.1, 0, 0);
        nbg.fillRoundedRect(-63, -19, 126, 10, { tl: 10, tr: 10, bl: 0, br: 0 });
        btnGroup.add(nbg);

        const txt = this.scene.add.text(0, -2, label, {
          fontSize: '16px', color: '#ffc844', fontFamily: this.FONT_TITLE,
          stroke: '#441177', strokeThickness: 2
        }).setOrigin(0.5);
        btnGroup.add(txt);

        const hit = this.scene.add.rectangle(0, 0, 130, 40).setInteractive({ useHandCursor: true }).setAlpha(0.001);
        hit.on('pointerdown', () => {
          this.scene.audio.playSound('button');
          this.changePage(dir);
          this.scene.tweens.add({ targets: btnGroup, scale: 0.9, yoyo: true, duration: 100 });
        });
        hit.on('pointerover', () => this.scene.tweens.add({ targets: btnGroup, scale: 1.06, duration: 100, ease: 'Back.easeOut' }));
        hit.on('pointerout', () => this.scene.tweens.add({ targets: btnGroup, scale: 1, duration: 100 }));
        btnGroup.add(hit);
        pageWrapper.add(btnGroup);
      };

      createNavBtn(navCenter - 200, this.Tr('◀ PREV'), -1);
      createNavBtn(navCenter + 200, this.Tr('NEXT ▶'), 1);

      // ── Dot indicators ──
      this.dotIndicators = [];
      for (let i = 0; i < 8; i++) {
        const dot = this.scene.add.graphics();
        pageWrapper.add(dot);
        this.dotIndicators.push(dot);
      }

      // ── Page label ──
      this.txtPageNum = this.scene.add.text(logicalW - 35, navY, this.Tr('1 / 8'), {
        fontSize: '16px', color: this.COL_PINK, fontFamily: this.FONT_TITLE,
        stroke: '#441177', strokeThickness: 2
      }).setOrigin(1, 0.5);
      pageWrapper.add(this.txtPageNum);

      this.showPage(0);
    } else {
      this.pages.forEach(p => p.setVisible(true));
      this.currentPage = 0;
    }
  }

  // ─────────────────────────────────────────────
  // PAGE 1: SYMBOL PAYOUTS
  // ─────────────────────────────────────────────
  private buildPage1_Symbols(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 30;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'SYMBOL PAYOUTS');

    // Card background for the payout table
    const tableH = (w < 700) ? 460 : 390;
    this.drawCard(page, pad - 5, yPos - 5, w - pad * 2 + 10, tableH);

    // Intro text
    page.add(this.scene.add.text(pad + 10, yPos + 8, this.Tr('Cluster Pays: Min 5 connected symbols (horizontal/vertical) on a 7×7 grid.'), {
      fontSize: (w < 700) ? '12px' : '13px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
      wordWrap: { width: w - pad * 2 - 20 }, lineSpacing: 2
    }).setOrigin(0, 0));
    yPos += 48;

    const order = [6, 5, 4, 3, 2, 1, 0];
    const colCount = 7;
    const colW = (w - pad * 2 - 40) / colCount;
    const startX = pad + 35;

    // Symbol icons
    order.forEach((symId, col) => {
      const cx = startX + col * colW + colW / 2;
      const icon = this.scene.add.sprite(cx, yPos + 25, `candy_${symId}`);
      icon.setScale(Math.min(0.45, colW / Math.max(icon.width, 1)));
      page.add(icon);
    });
    yPos += 58;

    // Payout rows
    const tiers = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5];
    const rowH = 26;
    tiers.forEach((tier, rowIdx) => {
      const rowY = yPos + rowIdx * rowH;
      if (rowIdx % 2 === 0) {
        const rowBg = this.scene.add.graphics();
        rowBg.fillStyle(0xffffff, 0.04);
        rowBg.fillRect(pad + 5, rowY - 2, w - pad * 2 - 10, rowH);
        page.add(rowBg);
      }
      const tierLabel = tier >= 15 ? '15+' : `${tier}`;
      page.add(this.scene.add.text(startX - 10, rowY + 2, this.Tr(tierLabel), {
        fontSize: (w < 700) ? '11px' : '12px', color: this.COL_GOLD, fontStyle: '700', fontFamily: this.FONT_BODY
      }).setOrigin(1, 0));
      order.forEach((symId, col) => {
        const cx = startX + col * colW + colW / 2;
        const payIdx = tier >= 15 ? 10 : tier - 5;
        const val = options.payvalues[symId][payIdx];
        const color = rowIdx < 2 ? this.COL_GOLD : rowIdx < 5 ? '#eebb66' : this.COL_BODY;
        page.add(this.scene.add.text(cx, rowY + 2, this.Tr(val.toFixed(2)), {
          fontSize: (w < 700) ? '9px' : '11px', color, fontFamily: this.FONT_BODY, fontStyle: '600'
        }).setOrigin(0.5, 0));
      });
    });

    yPos += tiers.length * rowH + 22;

    // Scatter info card
    this.drawCard(page, pad - 5, yPos - 5, w - pad * 2 + 10, 60, true);
    const scatterIcon = this.scene.add.sprite(pad + 35, yPos + 24, 'scatter');
    scatterIcon.setScale(Math.min(0.28, 42 / Math.max(scatterIcon.width, 1)));
    page.add(scatterIcon);
    page.add(this.scene.add.text(pad + 75, yPos + 10, this.Tr('SCATTER — Appears on all reels. Triggers Free Spins.'), {
      fontSize: (w < 700) ? '12px' : '13px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY, fontStyle: '600',
      wordWrap: { width: w - pad * 2 - 80 }
    }));
    page.add(this.scene.add.text(pad + 75, yPos + (w < 700 ? 42 : 32), this.Tr('3 or more Scatters award 10-30 Free Spins.'), {
      fontSize: (w < 700) ? '11px' : '12px', color: this.COL_GOLD, fontFamily: this.FONT_BODY,
      wordWrap: { width: w - pad * 2 - 80 }
    }));

    parent.add(page);
    this.pages.push(page);
    return yPos + 65;
  }

  // ─────────────────────────────────────────────
  // PAGE 2: TUMBLE FEATURE
  // ─────────────────────────────────────────────
  private buildPage2_Tumble(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 40;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'TUMBLE FEATURE');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 230);
    const tumbleRules = [
      '•  After every winning spin, winning symbols are removed.',
      '•  Remaining symbols drop to the bottom of the grid.',
      '•  Empty positions are filled with new symbols from above.',
      '•  Tumbling continues until no new wins appear.',
      '•  All wins are added to your balance after the full sequence.',
    ];
    page.add(this.scene.add.text(pad + 20, yPos + 12, this.Tr(tumbleRules.join('\n')), {
      fontSize: '15px', color: this.COL_BODY, fontFamily: this.FONT_BODY, lineSpacing: 12, align: 'left',
      wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 248;

    // Flow diagram
    this.drawCard(page, pad, yPos, w - pad * 2, 75, true);
    const steps = ['SPIN', 'WIN', 'REMOVE', 'DROP', 'REPEAT'];
    const stepW = (w - pad * 2) / steps.length;
    steps.forEach((s, i) => {
      const sx = pad + i * stepW + stepW / 2;
      page.add(this.scene.add.text(sx, yPos + 20, this.Tr(s), {
        fontSize: (w < 700) ? '10px' : '14px', color: i === 4 ? this.COL_GOLD : this.COL_ACCENT,
        fontStyle: '800', fontFamily: this.FONT_TITLE
      }).setOrigin(0.5));
      if (i < steps.length - 1) {
        page.add(this.scene.add.text(sx + stepW / 2, yPos + 20, this.Tr('→'), {
          fontSize: '14px', color: this.COL_PINK, fontFamily: this.FONT_BODY, fontStyle: 'bold'
        }).setOrigin(0.5));
      }
      page.add(this.scene.add.text(sx, yPos + 46, this.Tr(['Start', 'Cluster pays', 'Symbols vanish', 'Fill gaps', 'Until no wins'][i]), {
        fontSize: (w < 700) ? '8px' : '10px', color: this.COL_MUTED, fontFamily: this.FONT_BODY,
        align: 'center', wordWrap: { width: stepW - 4 }
      }).setOrigin(0.5, 0));
    });

    parent.add(page);
    this.pages.push(page);
    return yPos + 85;
  }

  // ─────────────────────────────────────────────
  // PAGE 3: MULTIPLIER SPOTS
  // ─────────────────────────────────────────────
  private buildPage3_Multipliers(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 40;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'MULTIPLIER SPOTS');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 195);
    const rules = [
      '•  Winning symbols mark their grid spot.',
      '•  Second explosion on same spot → ×2 multiplier.',
      '•  Each further explosion doubles it (up to ×1024).',
      '•  Multiple multipliers in one cluster are summed.',
      '•  Base game: multipliers reset after tumble sequence.',
    ];
    page.add(this.scene.add.text(pad + 20, yPos + 12, this.Tr(rules.join('\n')), {
      fontSize: '15px', color: this.COL_BODY, fontFamily: this.FONT_BODY, lineSpacing: 12, align: 'left',
      wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 210;

    // Multiplier progression
    this.drawCard(page, pad, yPos, w - pad * 2, 95, true);
    page.add(this.scene.add.text(pad + 18, yPos + 16, this.Tr('MULTIPLIER PROGRESSION'), {
      fontSize: '13px', color: this.COL_GOLD, fontStyle: '800', fontFamily: this.FONT_TITLE
    }).setOrigin(0, 0.5));
    const mults = ['×2', '×4', '×8', '×16', '×32', '×64', '...', '×1024'];
    const mw = (w - pad * 2 - (w < 700 ? 10 : 40)) / mults.length;
    mults.forEach((m, i) => {
      const mx = pad + (w < 700 ? 5 : 20) + i * mw + mw / 2;
      const isMax = i === mults.length - 1;
      page.add(this.scene.add.text(mx, yPos + 52, this.Tr(m), {
        fontSize: isMax ? (w < 700 ? '13px' : '18px') : (w < 700 ? '11px' : '15px'), color: isMax ? this.COL_GOLD : this.COL_BODY,
        fontStyle: '900', fontFamily: this.FONT_TITLE
      }).setOrigin(0.5));
      if (i < mults.length - 1 && m !== '...') {
        page.add(this.scene.add.text(mx + mw / 2, yPos + 52, this.Tr('→'), {
          fontSize: (w < 700) ? '10px' : '14px', color: this.COL_PINK, fontFamily: this.FONT_BODY
        }).setOrigin(0.5));
      }
    });
    yPos += 115;

    // Free spins note
    this.drawCard(page, pad, yPos, w - pad * 2, 60);
    page.add(this.scene.add.text(pad + 18, yPos + 16, this.Tr('⚡ During Free Spins, multipliers persist across all spins!'), {
      fontSize: (w < 700) ? '15px' : '14px', color: this.COL_GOLD, fontFamily: this.FONT_TITLE, fontStyle: 'normal'
    }).setOrigin(0, 0.5));
    page.add(this.scene.add.text(pad + 18, yPos + 40, this.Tr('They are only cleared when the bonus round ends.'), {
      fontSize: (w < 700) ? '13px' : '12px', color: this.COL_BODY, fontFamily: this.FONT_BODY
    }).setOrigin(0, 0.5));

    parent.add(page);
    this.pages.push(page);
    return yPos + 70;
  }

  // ─────────────────────────────────────────────
  // PAGE 4: FREE SPINS
  // ─────────────────────────────────────────────
  private buildPage4_FreeSpins(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 40;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'FREE SPINS');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 155);
    const fsRules = [
      '•  3-7 Scatter symbols trigger 10-30 free spins.',
      '•  Multiplier spots persist across the entire bonus round.',
      '•  Re-trigger: 3+ Scatters during free spins award extra spins.',
      '•  Additional free spins are added to the remaining count.',
    ];
    page.add(this.scene.add.text(pad + 20, yPos + 12, this.Tr(fsRules.join('\n')), {
      fontSize: (w < 700) ? '15px' : '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY, lineSpacing: 12, align: 'left',
      wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 168;

    // Scatter awards table
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 190, true);
    page.add(this.scene.add.text(pad + 18, yPos + 8, this.Tr('SCATTER AWARDS'), {
      fontSize: '15px', color: this.COL_GOLD, fontStyle: 'normal', fontFamily: this.FONT_TITLE
    }).setOrigin(0, 0.5));
    yPos += 30;

    const scatterTable = [
      { count: '3 Scatters', spins: '10 Free Spins' },
      { count: '4 Scatters', spins: '12 Free Spins' },
      { count: '5 Scatters', spins: '15 Free Spins' },
      { count: '6 Scatters', spins: '20 Free Spins' },
      { count: '7 Scatters', spins: '30 Free Spins' },
    ];
    scatterTable.forEach((row, i) => {
      const rowY = yPos + i * 28;
      if (i % 2 === 0) {
        const rbg = this.scene.add.graphics();
        rbg.fillStyle(0xffffff, 0.05);
        rbg.fillRoundedRect(pad + 10, rowY - 2, w - pad * 2 - 20, 26, 4);
        page.add(rbg);
      }
      page.add(this.scene.add.text(w / 2 - (w < 700 ? 30 : 60), rowY + 2, this.Tr(row.count), {
        fontSize: (w < 700) ? '12px' : '13px', color: this.COL_BODY, fontStyle: '600', fontFamily: this.FONT_BODY
      }).setOrigin(1, 0));
      page.add(this.scene.add.text(w / 2 + (w < 700 ? 10 : -20), rowY + 2, '→', {
        fontSize: '14px', color: this.COL_PINK, fontFamily: this.FONT_BODY
      }).setOrigin(0.5, 0));
      page.add(this.scene.add.text(w / 2 + (w < 700 ? 40 : 20), rowY + 2, this.Tr(row.spins), {
        fontSize: (w < 700) ? '12px' : '13px', color: this.COL_GOLD, fontStyle: '700', fontFamily: this.FONT_BODY
      }));
    });
    yPos += scatterTable.length * 28 + 18;

    // Note
    this.drawCard(page, pad, yPos, w - pad * 2, 48);
    page.add(this.scene.add.text(pad + 18, yPos + 14, this.Tr('➡ See next page for Buy Free Spins options (1,000× and 500×)'), {
      fontSize: (w < 700) ? '13px' : '12px', color: this.COL_GOLD, fontFamily: this.FONT_BODY, fontStyle: '600'
    }).setOrigin(0, 0.5));

    parent.add(page);
    this.pages.push(page);
    return yPos + 55;
  }

  // ─────────────────────────────────────────────
  // PAGE 5: BUY FEATURES
  // ─────────────────────────────────────────────
  private buildPage5_BuyFeatures(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 30;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'BUY FREE SPINS');

    page.add(this.scene.add.text(pad + 8, yPos, this.Tr('Instantly trigger the Free Spins bonus round.'), {
      fontSize: '13px', color: this.COL_MUTED, fontFamily: this.FONT_BODY, fontStyle: 'italic',
      wordWrap: { width: w - pad * 2 }
    }).setOrigin(0, 0));
    yPos += 25;

    const isWide = w >= 700;
    const cardGap = 16;

    if (isWide) {
      const cardW = (w - pad * 2 - cardGap) / 2;
      const cardH = 310;
      this.drawBuyCard(page, pad, yPos, cardW, cardH,
        '💎', 'ULTRA', '1,000×', 0xff66aa, 0x2a0830,
        '×4', '×4 → ×8 → ×16 → ... → ×1024',
        ['3–7 Scatters land on board', '10–30 Free Spins awarded', 'All 49 spots pre-loaded ×4', 'Multipliers double each hit', 'Persist across all spins', 'Best shot at 25,000× MAX WIN']
      );
      this.drawBuyCard(page, pad + cardW + cardGap, yPos, cardW, cardH,
        '⭐', 'SUPER', '500×', 0xffc844, 0x2a1a00,
        '×2', '×2 → ×4 → ×8 → ... → ×1024',
        ['3–7 Scatters land on board', '10–30 Free Spins awarded', 'All 49 spots pre-loaded ×2', 'Multipliers double each hit', 'Persist across all spins', 'Great value bonus option']
      );
      yPos += cardH + 12;
    } else {
      const cardW = w - pad * 2;
      const cardH = 200;
      this.drawBuyCard(page, pad, yPos, cardW, cardH,
        '💎', 'ULTRA', '1,000×', 0xff66aa, 0x2a0830,
        '×4', '×4 → ×8 → ×16 → ... → ×1024',
        ['3–7 Scatters → 10–30 Free Spins', 'All 49 spots pre-loaded with ×4', 'Multipliers double each hit', 'Best shot at 25,000× MAX WIN']
      );
      yPos += cardH + 12;
      this.drawBuyCard(page, pad, yPos, cardW, cardH,
        '⭐', 'SUPER', '500×', 0xffc844, 0x2a1a00,
        '×2', '×2 → ×4 → ×8 → ... → ×1024',
        ['3–7 Scatters → 10–30 Free Spins', 'All 49 spots pre-loaded with ×2', 'Multipliers double each hit', 'Great value bonus option']
      );
      yPos += cardH + 12;
    }

    // Footer
    const footerH = 45;
    const footG = this.scene.add.graphics();
    footG.fillStyle(this.CARD_BG, 0.9);
    footG.fillRoundedRect(pad, yPos, w - pad * 2, footerH, 10);
    footG.lineStyle(1, this.CARD_BORDER, 0.3);
    footG.strokeRoundedRect(pad, yPos, w - pad * 2, footerH, 10);
    page.add(footG);

    page.add(this.scene.add.text(pad + 14, yPos + 12, '⚠', { fontSize: '14px', color: this.COL_GOLD }).setOrigin(0, 0));
    page.add(this.scene.add.text(pad + 34, yPos + 10, this.Tr('Cost deducted on confirmation  •  Ante Bet doesn\'t affect Buy cost  •  Max win 25,000×'), {
      fontSize: '11px', color: this.COL_MUTED, fontFamily: this.FONT_BODY, lineSpacing: 3,
      wordWrap: { width: w - pad * 2 - 55 }
    }).setOrigin(0, 0));

    parent.add(page);
    this.pages.push(page);
    return yPos + footerH + 18;
  }

  /** Draws a premium Buy Feature card */
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
    g.fillStyle(accentColor, 0.1);
    g.fillRoundedRect(x - 3, y - 3, cw + 6, ch + 6, 14);
    // Card body
    g.fillStyle(bgTint, 0.5);
    g.fillRoundedRect(x, y, cw, ch, 12);
    g.fillStyle(this.CARD_BG, 0.85);
    g.fillRoundedRect(x, y, cw, ch, 12);
    // Top highlight
    g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.05, 0.05, 0, 0);
    g.fillRoundedRect(x + 3, y + 3, cw - 6, ch * 0.15, { tl: 10, tr: 10, bl: 0, br: 0 });
    // Border
    g.lineStyle(2, accentColor, 0.65);
    g.strokeRoundedRect(x, y, cw, ch, 12);
    page.add(g);

    const cx = x + cw / 2;
    const innerPad = 18;
    let ty = y + 16;

    // Icon
    page.add(this.scene.add.text(cx, ty, icon, { fontSize: '26px' }).setOrigin(0.5, 0));
    ty += 30;

    // Tier name
    page.add(this.scene.add.text(cx, ty, this.Tr(`${tierName} FREE SPINS`), {
      fontSize: '15px', color: '#ffffff', fontStyle: 'normal', fontFamily: this.FONT_TITLE,
      stroke: '#441177', strokeThickness: 2
    }).setOrigin(0.5, 0));
    ty += 24;

    // Cost badge
    const badgeW = Math.min(cw - 30, 155);
    const badgeH = 30;
    const badgeX = cx - badgeW / 2;
    const badgeG = this.scene.add.graphics();
    badgeG.fillStyle(accentColor, 0.2);
    badgeG.fillRoundedRect(badgeX, ty, badgeW, badgeH, 15);
    badgeG.lineStyle(1.5, accentColor, 0.7);
    badgeG.strokeRoundedRect(badgeX, ty, badgeW, badgeH, 15);
    page.add(badgeG);
    page.add(this.scene.add.text(cx, ty + badgeH / 2, this.Tr(`${costLabel} BET`), {
      fontSize: '14px', color: this.COL_GOLD, fontStyle: 'normal', fontFamily: this.FONT_TITLE
    }).setOrigin(0.5));
    ty += badgeH + 14;

    // Divider
    const divG = this.scene.add.graphics();
    divG.lineStyle(1, accentColor, 0.2);
    divG.lineBetween(x + innerPad, ty, x + cw - innerPad, ty);
    page.add(divG);
    ty += 12;

    // Starting multiplier
    page.add(this.scene.add.text(x + innerPad, ty, this.Tr(`Starting Multiplier: ${startMult}`), {
      fontSize: '12px', color: this.COL_GOLD, fontStyle: '700', fontFamily: this.FONT_BODY
    }).setOrigin(0, 0));
    ty += 18;

    page.add(this.scene.add.text(x + innerPad, ty, this.Tr(multChain), {
      fontSize: '11px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY
    }).setOrigin(0, 0));
    ty += 20;

    // Features list
    features.forEach(f => {
      page.add(this.scene.add.text(x + innerPad + 4, ty, this.Tr(`▸ ${f}`), {
        fontSize: '11px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: cw - innerPad * 2 - 10 }, lineSpacing: 2
      }).setOrigin(0, 0));
      ty += 17;
    });
  }

  // ─────────────────────────────────────────────
  // PAGE 6: GAME RULES
  // ─────────────────────────────────────────────
  private buildPage6_GameRules(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 40;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'GAME RULES');

    // Volatility card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 52, true);
    page.add(this.scene.add.text(pad + 20, yPos + 20, this.Tr('VOLATILITY'), {
      fontSize: '14px', color: this.COL_ACCENT, fontStyle: '700', fontFamily: this.FONT_BODY
    }).setOrigin(0, 0.5));
    page.add(this.scene.add.text(w - pad - 20, yPos + 20, '⚡⚡⚡⚡⚡', {
      fontSize: '16px', color: this.COL_GOLD
    }).setOrigin(1, 0.5));
    yPos += 62;

    // Rules card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 230);
    const rules = [
      '•  Wins are calculated per cluster (5+ connected symbols).',
      '•  Multiple cluster wins in a single tumble are summed.',
      '•  All wins are multiplied by the base bet amount.',
      '•  Multiplier spots in a cluster are summed, then applied.',
      '•  Free spins total win is awarded when the round ends.',
      '•  Ante Bet: costs 25% more, doubles scatter chance.',
    ];
    page.add(this.scene.add.text(pad + 20, yPos + 10, this.Tr(rules.join('\n')), {
      fontSize: (w < 700) ? '14px' : '13px', color: this.COL_BODY, fontFamily: this.FONT_BODY, lineSpacing: 12, align: 'left',
      wordWrap: { width: w - pad * 2 - 50 }
    }).setOrigin(0, 0));
    yPos += 240;

    // RTP card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 105);
    page.add(this.scene.add.text(pad + 20, yPos + 10, this.Tr('RTP (Return to Player)'), {
      fontSize: '13px', color: this.COL_GOLD, fontStyle: '700', fontFamily: this.FONT_BODY
    }).setOrigin(0, 0));
    page.add(this.scene.add.text(pad + 20, yPos + 34, this.Tr('Base: 96.53%  |  Ultra FS: 96.50%  |  Super: 96.44%'), {
      fontSize: (w < 700) ? '13px' : '13px', color: this.COL_BODY, fontFamily: this.FONT_BODY
    }).setOrigin(0, 0));
    page.add(this.scene.add.text(pad + 20, yPos + 60, this.Tr(`Bet: ${BET_PRESETS[0].toFixed(2)} – ${BET_PRESETS[BET_PRESETS.length - 1].toFixed(2)}  |  Max Win: ${options.maxWinMultiplier.toLocaleString()}×`), {
      fontSize: '13px', color: this.COL_GOLD, fontFamily: this.FONT_BODY, fontStyle: '700'
    }).setOrigin(0, 0));
    yPos += 115;

    // Disclaimer
    page.add(this.scene.add.text(pad, yPos + 5, this.Tr('Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. Winnings are settled according to the amount received from the Remote Game Server.'), {
      fontSize: '10px', color: '#8877aa', fontStyle: 'italic', fontFamily: this.FONT_BODY, align: 'left', lineSpacing: 3, wordWrap: { width: w - pad * 2 }
    }).setOrigin(0, 0));

    parent.add(page);
    this.pages.push(page);
    return yPos + 130;
  }

  // ─────────────────────────────────────────────
  // PAGE 7: HOW TO PLAY
  // ─────────────────────────────────────────────
  private buildPage7_HowToPlay(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 40;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'HOW TO PLAY');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 90);
    const howTo = [
      '•  Click the  ⊕  or  ⊖  buttons to change the bet value.',
      '•  Select the bet you want to use in the game.',
      '•  Press the SPIN button to play.',
    ];
    page.add(this.scene.add.text(pad + 20, yPos + 10, this.Tr(howTo.join('\n')), {
      fontSize: '14px', color: this.COL_BODY, align: 'left', fontFamily: this.FONT_BODY, lineSpacing: 10, wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 100;

    // UI Guide section
    yPos = this.addSectionTitle(page, w / 2, yPos, 'MAIN GAME INTERFACE');

    const uiItems = [
      '[SETTINGS] – opens the settings menu.',
      '[SOUND] – toggles sound and music on/off.',
      '[INFO] – opens this Information page.',
      'BALANCE / BET – show current balance and bet.',
      '[+] / [-] – change the current bet up or down.',
      '[SPIN] – starts the game.',
      'AUTOPLAY – opens auto play menu. Click again to stop.',
    ];
    const uiCardH = uiItems.length * 26 + 24;
    this.drawCard(page, pad, yPos - 5, w - pad * 2, uiCardH);
    uiItems.forEach((item, i) => {
      page.add(this.scene.add.text(pad + 20, yPos + 10 + i * 26, this.Tr(`•  ${item}`), {
        fontSize: '13px', color: this.COL_BODY, fontFamily: this.FONT_BODY,
        wordWrap: { width: w - pad * 2 - 50 }
      }).setOrigin(0, 0));
    });

    parent.add(page);
    this.pages.push(page);
    return yPos + uiCardH + 20;
  }

  // ─────────────────────────────────────────────
  // PAGE 8: SETTINGS / INFO / BET MENU / MAX WIN
  // ─────────────────────────────────────────────
  private buildPage8_Settings(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 40;
    let yPos = startY;
    const fs = '12px';
    const ls = 6;

    yPos = this.addSectionTitle(page, w / 2, yPos, 'SETTINGS MENU');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 105);
    const settingsInfo = [
      '•  INTRO SCREEN – toggles the introductory screen on/off',
      '•  AMBIENT – toggles ambient sound and music on/off',
      '•  SOUND FX – toggles sound effects on/off',
      '•  GAME HISTORY – opens game history page',
    ];
    page.add(this.scene.add.text(pad + 20, yPos + 10, this.Tr(settingsInfo.join('\n')), {
      fontSize: fs, color: this.COL_BODY, align: 'left', fontFamily: this.FONT_BODY, lineSpacing: ls, wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 115;

    // Information Screen
    yPos = this.addSectionTitle(page, w / 2, yPos, 'INFORMATION SCREEN');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 52);
    page.add(this.scene.add.text(pad + 20, yPos + 8, this.Tr('•  ◀ and ▶ scroll between information pages   •  ✕ closes the screen'), {
      fontSize: fs, color: this.COL_BODY, fontFamily: this.FONT_BODY, wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 60;

    // Bet Menu
    yPos = this.addSectionTitle(page, w / 2, yPos, 'BET MENU');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 62);
    page.add(this.scene.add.text(pad + 20, yPos + 8, this.Tr('•  The bet menu shows available bet multipliers and current total bet.\n•  Use ⊕ and ⊖ to change BET and COIN VALUE.'), {
      fontSize: fs, color: this.COL_BODY, align: 'left', lineSpacing: ls, fontFamily: this.FONT_BODY, wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 72;

    // Max Win
    yPos = this.addSectionTitle(page, w / 2, yPos, 'MAX WIN');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 62);
    page.add(this.scene.add.text(pad + 20, yPos + 8, this.Tr(`•  Maximum win: ${options.maxWinMultiplier.toLocaleString()}× bet. If reached, the round ends immediately.\n•  Win is awarded and remaining free spins are forfeited.`), {
      fontSize: fs, color: this.COL_BODY, align: 'left', lineSpacing: ls, fontFamily: this.FONT_BODY, wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    yPos += 72;

    // Buy Free Spins footer
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0xff66aa, 0.3);
    sep.lineBetween(pad + 40, yPos, w - pad - 40, yPos);
    page.add(sep);
    yPos += 10;

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 50);
    page.add(this.scene.add.text(pad + 18, yPos + 6, this.Tr('BUY ULTRA FREE SPINS: 1,000× total bet with ×4 starting multipliers.\nBUY SUPER FREE SPINS: 500× total bet with ×2 starting multipliers.'), {
      fontSize: '11px', color: this.COL_GOLD, align: 'left', lineSpacing: 5, fontFamily: this.FONT_BODY, fontStyle: '600', wordWrap: { width: w - pad * 2 - 30 }
    }).setOrigin(0, 0));

    parent.add(page);
    this.pages.push(page);
    return yPos + 70;
  }

  // ─────────────────────────────────────────────
  // PAGE NAVIGATION
  // ─────────────────────────────────────────────
  private changePage(dir: number) {
    let newPage = this.currentPage + dir;
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
          p.setY(direction > 0 ? 80 : -80);
          p.setAlpha(0);
          this.scene.tweens.killTweensOf(p);
          this.scene.tweens.add({
            targets: p, y: 0, alpha: 1,
            duration: 280, ease: 'Back.easeOut'
          });
        } else {
          p.setY(0).setAlpha(1);
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
      const logicalW = Math.min(880, this.scene.scale.width * 0.9);
      const navCenter = logicalW / 2;
      const navY = Math.min(740, this.scene.scale.height * 0.9) - 40;
      this.dotIndicators.forEach((dot, i) => {
        dot.clear();
        const dx = navCenter - 60 + i * 16;
        if (i === index) {
          dot.fillStyle(0xff66aa, 1);
          dot.fillCircle(dx, navY, 6);
          dot.lineStyle(2, 0xffffff, 0.5);
          dot.strokeCircle(dx, navY, 8);
        } else {
          dot.fillStyle(0x6644aa, 0.6);
          dot.fillCircle(dx, navY, 4);
        }
      });
    }
  }

  public show() {
    this.visible = true;
    this.showPage(0);
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.container.setY(30);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1, y: 0,
      duration: 300,
      ease: 'Back.easeOut'
    });
  }

  public hide() {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0, y: 20,
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
