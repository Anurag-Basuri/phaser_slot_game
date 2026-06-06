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
  private scrollThumb!: Phaser.GameObjects.Graphics;
  private scrollTrackH = 0;
  private scrollTrackY = 0;
  private velocityY = 0;
  private lastPointerY = 0;
  private scrollTween: Phaser.Tweens.Tween | null = null;
  private logicalW = 0;
  private logicalH = 0;

  // ── Candy Theme Typography ──
  private readonly FONT_TITLE = '"Fredoka One", "Comic Sans MS", sans-serif';
  private readonly FONT_BODY = '"Fredoka One", sans-serif';
  private readonly COL_BODY = '#ffffff';
  private readonly COL_MUTED = '#ffccdd';
  private readonly COL_ACCENT = '#ffffff';
  private readonly COL_GOLD = '#ffdd22';
  private readonly COL_PINK = '#ff0066';

  /** Resolution multiplier for crisp text on HiDPI displays */
  private readonly RES = 2;

  // ── Panel colors ──
  private readonly PANEL_BG = 0x380036; // Plum
  private readonly PANEL_BORDER = 0xfff0f5; // Creamy white
  private readonly CARD_BG = 0x9b1b6c; // Translucent magenta
  private readonly CARD_BORDER = 0xfff0f5;

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

  /** Draw a translucent dark card rectangle */
  private drawCard(page: Phaser.GameObjects.Container, x: number, y: number, cw: number, ch: number, accent = false, accentColor?: number) {
    const g = this.scene.add.graphics();
    // Card body
    g.fillStyle(this.CARD_BG, 0.7);
    g.fillRoundedRect(x, y, cw, ch, 15);
    // Border
    const bColor = accentColor ? accentColor : (accent ? this.PANEL_BORDER : this.CARD_BORDER);
    const bAlpha = accentColor ? 1 : (accent ? 0.9 : 0.6);
    g.lineStyle(2, bColor, bAlpha);
    g.strokeRoundedRect(x, y, cw, ch, 15);
    page.add(g);
  }

  private get COL_PINK_HEX(): number { return 0xff0066; }

  /** Add a flat, crisp section title with orange divider */
  private addSectionTitle(page: Phaser.GameObjects.Container, w: number, y: number, text: string): number {
    const isMob = w < 700;
    const pad = isMob ? 15 : 35;
    const fontSize = isMob ? '22px' : '28px';
    const txt = this.scene.add.text(pad, y, this.Tr(text), {
      fontSize, fontFamily: this.FONT_TITLE, color: '#ffffff',
      fontStyle: '900', stroke: '#1a001a', strokeThickness: 3,
      resolution: this.RES
    }).setOrigin(0, 0.5);
    txt.setShadow(0, 2, '#1a001a', 0, true, false);
    page.add(txt);

    // Flat thin orange divider spanning the width
    const g = this.scene.add.graphics();
    g.lineStyle(2, this.PANEL_BORDER, 0.6);
    g.lineBetween(pad, y + (isMob ? 18 : 24), w - pad, y + (isMob ? 18 : 24));
    page.add(g);
    
    return y + (isMob ? 36 : 46);
  }

  /** Add a visual divider between sections in mobile scroll mode */
  private addMobileDivider(parent: Phaser.GameObjects.Container, w: number, y: number): number {
    if (!this.isMobileScroll) return y;
    const pad = 30;
    const g = this.scene.add.graphics();
    g.lineStyle(1, 0xffffff, 0.06);
    g.lineBetween(pad, y, w - pad, y);
    parent.add(g);
    return y + 20;
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
  private pageWrapperRef!: Phaser.GameObjects.Container;

  private build(w?: number, h?: number) {
    w = w || this.scene.scale.width;
    h = h || this.scene.scale.height;

    this.isMobileScroll = h > w || h < 600;
    const logicalW = this.isMobileScroll ? Math.min(600, w * 0.95) : Math.min(880, w * 0.9);
    const logicalH = this.isMobileScroll ? Math.min(1000, h * 0.95) : Math.min(740, h * 0.9);
    this.logicalW = logicalW;
    this.logicalH = logicalH;

    // ── Dark translucent backdrop ──
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0015, 0.82);
    bg.fillRect(-w, -h, w * 3, h * 3);
    bg.setInteractive(new Phaser.Geom.Rectangle(-w, -h, w * 3, h * 3), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerdown', () => { this.scene.audio?.playSound('button'); this.hide(); });
    this.container.add(bg);

    const pageWrapper = this.scene.add.container(0, 0);
    this.container.add(pageWrapper);
    this.pageWrapperRef = pageWrapper;

    // ── Premium Dark Panel ──
    const panel = this.scene.add.graphics();

    // Subtle drop shadow
    panel.fillStyle(0x000000, 0.5);
    panel.fillRoundedRect(4, 6, logicalW, logicalH, 14);

    // Main panel body — candy purple
    panel.fillStyle(this.PANEL_BG, 1);
    panel.fillRoundedRect(0, 0, logicalW, logicalH, 24);

    // Glossy Highlight
    panel.fillStyle(0xffffff, 0.08);
    panel.fillRoundedRect(4, 4, logicalW - 8, logicalH * 0.2, 20);

    // Thick soft pink border
    panel.lineStyle(4, this.PANEL_BORDER, 1);
    panel.strokeRoundedRect(0, 0, logicalW, logicalH, 24);

    panel.setInteractive(new Phaser.Geom.Rectangle(0, 0, logicalW, logicalH), Phaser.Geom.Rectangle.Contains);
    pageWrapper.add(panel);

    const wrapperX = (w - logicalW) / 2;
    const wrapperY = (h - logicalH) / 2;
    pageWrapper.setPosition(wrapperX, wrapperY);

    this.scrollContainer = this.scene.add.container(0, 0);
    pageWrapper.add(this.scrollContainer);

    if (this.isMobileScroll) {
      // Mask to clip content within the panel (leave header space)
      const maskGraphics = this.scene.make.graphics({});
      maskGraphics.fillStyle(0x000000);
      maskGraphics.fillRect(wrapperX + 5, wrapperY + 55, logicalW - 10, logicalH - 60);
      this.scrollContainer.mask = new Phaser.Display.Masks.GeometryMask(this.scene, maskGraphics);

      this.scrollY = 0;
      this.maxScrollY = 0;
      this.velocityY = 0;

      const hitZone = this.scene.add.zone(logicalW / 2, logicalH / 2, logicalW, logicalH)
        .setInteractive({ draggable: true });
      pageWrapper.add(hitZone);

      // Inertia-based scrolling with momentum
      hitZone.on('dragstart', (pointer: Phaser.Input.Pointer) => {
        this.velocityY = 0;
        this.lastPointerY = pointer.position.y;
        if (this.scrollTween) { this.scrollTween.stop(); this.scrollTween = null; }
      });

      hitZone.on('drag', (pointer: Phaser.Input.Pointer) => {
        const dy = pointer.position.y - this.lastPointerY;
        this.velocityY = dy;
        this.lastPointerY = pointer.position.y;
        this.scrollY += dy;
        this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScrollY, 0);
        this.scrollContainer.y = this.scrollY;
        this.updateScrollThumb();
      });

      hitZone.on('dragend', () => {
        // Momentum coast
        if (Math.abs(this.velocityY) > 1) {
          const targetY = Phaser.Math.Clamp(this.scrollY + this.velocityY * 12, -this.maxScrollY, 0);
          this.scrollTween = this.scene.tweens.add({
            targets: this.scrollContainer,
            y: targetY,
            duration: 600,
            ease: 'Cubic.easeOut',
            onUpdate: () => {
              this.scrollY = this.scrollContainer.y;
              this.updateScrollThumb();
            }
          });
        }
      });

      hitZone.on('wheel', (_pointer: Phaser.Input.Pointer, _deltaX: number, deltaY: number) => {
        if (this.scrollTween) { this.scrollTween.stop(); this.scrollTween = null; }
        this.scrollY -= deltaY * 1.2;
        this.scrollY = Phaser.Math.Clamp(this.scrollY, -this.maxScrollY, 0);
        this.scrollContainer.y = this.scrollY;
        this.updateScrollThumb();
      });

      // Scroll track (background rail)
      this.scrollTrackY = 60;
      this.scrollTrackH = logicalH - 80;
      const scrollTrack = this.scene.add.graphics();
      scrollTrack.fillStyle(0xffffff, 0.06);
      scrollTrack.fillRoundedRect(logicalW - 10, this.scrollTrackY, 4, this.scrollTrackH, 2);
      pageWrapper.add(scrollTrack);

      // Scroll thumb (moves with scroll position)
      this.scrollThumb = this.scene.add.graphics();
      pageWrapper.add(this.scrollThumb);
    }

    // ── Header Title ──
    const isSocial = getStakeEngine().isSocialMode();
    const isMob = w < 700 || this.isMobileScroll;
    const headerPad = isMob ? 15 : 35;
    const titleText = this.scene.add.text(headerPad, isMob ? 16 : 28, this.Tr(T('FEATURE EXPLANATION', isSocial)), {
      fontSize: isMob ? '20px' : '32px', fontFamily: this.FONT_TITLE, fontStyle: '900', color: '#ffffff',
      stroke: '#9b1b6c', strokeThickness: isMob ? 3 : 4,
      resolution: this.RES
    }).setOrigin(0, 0);
    titleText.setShadow(0, 3, '#1a001a', 0, true, false);
    pageWrapper.add(titleText);

    // Header divider
    const headerDiv = this.scene.add.graphics();
    headerDiv.lineStyle(3, this.PANEL_BORDER, 0.6);
    headerDiv.lineBetween(headerPad, isMob ? 44 : 64, logicalW - headerPad, isMob ? 44 : 64);
    pageWrapper.add(headerDiv);

    // ── Close button — Bubbly style ──
    const closeBtnR = isMob ? 16 : 20;
    const closeBtnX = logicalW - closeBtnR - 8;
    const closeBtnY = isMob ? 24 : 20;
    const closeBtnGfx = this.scene.add.graphics();
    closeBtnGfx.fillStyle(0xff3333, 1);
    closeBtnGfx.fillCircle(closeBtnX, closeBtnY, closeBtnR);
    closeBtnGfx.lineStyle(3, 0xffffff, 1);
    closeBtnGfx.strokeCircle(closeBtnX, closeBtnY, closeBtnR);
    pageWrapper.add(closeBtnGfx);

    const closeBtn = this.scene.add.text(closeBtnX, closeBtnY + 1, '✖', {
      fontSize: isMob ? '16px' : '20px', color: '#ffffff', fontFamily: this.FONT_TITLE,
      resolution: this.RES
    }).setOrigin(0.5);
    pageWrapper.add(closeBtn);

    const closeHit = this.scene.add.rectangle(closeBtnX, closeBtnY, 48, 48).setInteractive({ useHandCursor: true }).setAlpha(0.001);
    closeHit.on('pointerdown', () => { this.scene.audio.playSound('button'); this.hide(); });
    closeHit.on('pointerover', () => closeBtn.setScale(1.2));
    closeHit.on('pointerout', () => closeBtn.setScale(1));
    pageWrapper.add(closeHit);

    // ── Build all 8 pages ──
    const parentContainer = this.isMobileScroll ? this.scrollContainer : pageWrapper;
    const contentStartY = isMob ? 55 : 80;
    let currentY = contentStartY;
    const getStartY = () => this.isMobileScroll ? currentY : contentStartY;

    currentY = this.buildPage1_Symbols(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.addMobileDivider(parentContainer, logicalW, currentY);
    currentY = this.buildPage2_ScatterAndFreeSpins(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.addMobileDivider(parentContainer, logicalW, currentY);
    currentY = this.buildPage3_TumbleAndMultipliers(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.addMobileDivider(parentContainer, logicalW, currentY);
    currentY = this.buildPage4_BuyFeatures(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.addMobileDivider(parentContainer, logicalW, currentY);
    currentY = this.buildPage5_GameRulesAndStats(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.addMobileDivider(parentContainer, logicalW, currentY);
    currentY = this.buildPage6_HowToPlay(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.addMobileDivider(parentContainer, logicalW, currentY);
    currentY = this.buildPage7_MenusAndNav(parentContainer, logicalW, logicalH, getStartY());
    currentY = this.addMobileDivider(parentContainer, logicalW, currentY);
    currentY = this.buildPage8_Terms(parentContainer, logicalW, logicalH, getStartY());

    if (this.isMobileScroll) {
      // Add bottom padding so last section isn't flush with panel edge
      currentY += 40;
      this.maxScrollY = Math.max(0, currentY - logicalH + 20);
      this.updateScrollThumb();
    }

    if (!this.isMobileScroll) {
      // ── Navigation — sleek PREV / NEXT buttons ──
      const navY = logicalH - 40;
      const navCenter = logicalW / 2;

      const createNavBtn = (x: number, label: string, dir: number) => {
        const btnGroup = this.scene.add.container(x, navY);

        const nbg = this.scene.add.graphics();
        nbg.fillStyle(0x000000, 0.3);
        nbg.fillRoundedRect(-55, -18, 110, 36, 8);
        nbg.lineStyle(1.5, this.PANEL_BORDER, 0.8);
        nbg.strokeRoundedRect(-55, -18, 110, 36, 8);
        btnGroup.add(nbg);

        const txt = this.scene.add.text(0, -2, label, {
          fontSize: '14px', color: this.COL_GOLD, fontFamily: this.FONT_TITLE, fontStyle: '800',
          resolution: this.RES
        }).setOrigin(0.5);
        btnGroup.add(txt);

        const hit = this.scene.add.rectangle(0, 0, 120, 48).setInteractive({ useHandCursor: true }).setAlpha(0.001);
        hit.on('pointerdown', () => {
          this.scene.audio.playSound('button');
          this.changePage(dir);
          this.scene.tweens.add({ targets: btnGroup, scale: 0.95, yoyo: true, duration: 100 });
        });
        hit.on('pointerover', () => {
          this.scene.tweens.add({ targets: btnGroup, scale: 1.05, duration: 100, ease: 'Back.easeOut' });
        });
        hit.on('pointerout', () => this.scene.tweens.add({ targets: btnGroup, scale: 1, duration: 100 }));
        btnGroup.add(hit);
        pageWrapper.add(btnGroup);
      };

      createNavBtn(navCenter - 180, this.Tr('◀ PREV'), -1);
      createNavBtn(navCenter + 180, this.Tr('NEXT ▶'), 1);

      // ── Dot indicators ──
      this.dotIndicators = [];
      for (let i = 0; i < 8; i++) {
        const dot = this.scene.add.graphics();
        pageWrapper.add(dot);
        this.dotIndicators.push(dot);
      }

      // ── Page label ──
      this.txtPageNum = this.scene.add.text(logicalW - 35, navY, this.Tr('1 / 8'), {
        fontSize: '16px', color: this.COL_PINK, fontFamily: this.FONT_TITLE, fontStyle: '600',
        resolution: this.RES
      }).setOrigin(1, 0.5);
      pageWrapper.add(this.txtPageNum);

      this.showPage(0);
    } else {
      this.pages.forEach(p => p.setVisible(true));
      this.currentPage = 0;
    }
  }

  /** Update the scroll thumb position based on scroll progress */
  private updateScrollThumb() {
    if (!this.scrollThumb || this.maxScrollY <= 0) return;
    this.scrollThumb.clear();
    const progress = Math.abs(this.scrollY) / this.maxScrollY;
    const thumbH = Math.max(30, (this.logicalH / (this.maxScrollY + this.logicalH)) * this.scrollTrackH);
    const thumbY = this.scrollTrackY + progress * (this.scrollTrackH - thumbH);
    this.scrollThumb.fillStyle(0xff9900, 0.5);
    this.scrollThumb.fillRoundedRect(this.logicalW - 11, thumbY, 6, thumbH, 3);
  }

  // ─────────────────────────────────────────────
  // PAGE 1: SYMBOL PAYOUTS
  // ─────────────────────────────────────────────
  private buildPage1_Symbols(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 30;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w, yPos, 'SYMBOL PAYOUTS');

    // Card background for the payout table
    const tableH = (w < 700) ? 460 : 380;
    this.drawCard(page, pad - 5, yPos - 5, w - pad * 2 + 10, tableH);

    // Intro text
    page.add(this.scene.add.text(pad + 15, yPos + 10, this.Tr('Cluster Pays: Min 5 connected symbols (horizontal/vertical) on a 7×7 grid.'), {
      fontSize: (w < 700) ? '12px' : '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES,
      wordWrap: { width: w - pad * 2 - 30 }, lineSpacing: 8
    }).setOrigin(0, 0));
    yPos += 50;

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
    const rowH = 25;
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
        fontSize: (w < 700) ? '11px' : '12px', color: this.COL_GOLD, fontStyle: '700', fontFamily: this.FONT_BODY,
        resolution: this.RES
      }).setOrigin(1, 0));
      order.forEach((symId, col) => {
        const cx = startX + col * colW + colW / 2;
        const payIdx = tier >= 15 ? 10 : tier - 5;
        const val = options.payvalues[symId][payIdx];
        const color = rowIdx < 2 ? this.COL_GOLD : rowIdx < 5 ? '#eebb66' : this.COL_BODY;
        page.add(this.scene.add.text(cx, rowY + 2, this.Tr(val.toFixed(2)), {
          fontSize: (w < 700) ? '9px' : '11px', color, fontFamily: this.FONT_BODY, resolution: this.RES, fontStyle: '600'
        }).setOrigin(0.5, 0));
      });
    });

    yPos += tiers.length * rowH + 20;

    parent.add(page);
    this.pages.push(page);
    return yPos + 20;
  }

  // ─────────────────────────────────────────────
  // PAGE 2: SCATTER & FREE SPINS
  // ─────────────────────────────────────────────
  private buildPage2_ScatterAndFreeSpins(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 40;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w, yPos, 'SCATTER & FREE SPINS');

    // Scatter info card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 70, true);
    const scatterIcon = this.scene.add.sprite(pad + 35, yPos + 28, 'scatter');
    scatterIcon.setScale(Math.min(0.3, 45 / Math.max(scatterIcon.width, 1)));
    page.add(scatterIcon);
    page.add(this.scene.add.text(pad + 75, yPos + 10, this.Tr('SCATTER — Appears on all reels. Triggers Free Spins.'), {
      fontSize: (w < 700) ? '12px' : '13px', color: this.COL_ACCENT, fontFamily: this.FONT_BODY, resolution: this.RES, fontStyle: '600',
      wordWrap: { width: w - pad * 2 - 80 }
    }));
    page.add(this.scene.add.text(pad + 75, yPos + 38, this.Tr('3 or more Scatters award 10-30 Free Spins.'), {
      fontSize: (w < 700) ? '11px' : '12px', color: this.COL_GOLD, fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES,
      wordWrap: { width: w - pad * 2 - 80 }
    }));
    yPos += 80;

    // Free spins rules
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 110);
    const fsRules = [
      '•  Multiplier spots persist across the entire bonus round.',
      '•  Multipliers only clear when the free spins sequence ends.',
      '•  Re-trigger: 3+ Scatters during free spins award extra spins.',
      '•  Additional free spins are added to the remaining count.',
    ];
    page.add(this.scene.add.text(pad + 15, yPos + 10, this.Tr(fsRules.join('\n')), {
      fontSize: (w < 700) ? '12px' : '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES, lineSpacing: 8, align: 'left',
      wordWrap: { width: w - pad * 2 - 30 }
    }).setOrigin(0, 0));
    yPos += 125;

    // Scatter awards table
    const tableH = 180;
    this.drawCard(page, pad, yPos - 5, w - pad * 2, tableH, true);
    page.add(this.scene.add.text(pad + 20, yPos + 12, this.Tr('SCATTER AWARDS'), {
      fontSize: '15px', color: this.COL_GOLD, fontStyle: '700', fontFamily: this.FONT_TITLE,
      resolution: this.RES
    }).setOrigin(0, 0.5));
    yPos += 35;

    const scatterTable = [
      { count: '3 Scatters', spins: '10 Free Spins' },
      { count: '4 Scatters', spins: '12 Free Spins' },
      { count: '5 Scatters', spins: '15 Free Spins' },
      { count: '6 Scatters', spins: '20 Free Spins' },
      { count: '7 Scatters', spins: '30 Free Spins' },
    ];
    scatterTable.forEach((row, i) => {
      const rowY = yPos + i * 26;
      if (i % 2 === 0) {
        const rbg = this.scene.add.graphics();
        rbg.fillStyle(0xffffff, 0.05);
        rbg.fillRoundedRect(pad + 10, rowY - 2, w - pad * 2 - 20, 24, 4);
        page.add(rbg);
      }
      page.add(this.scene.add.text(w / 2 - (w < 700 ? 30 : 60), rowY + 2, this.Tr(row.count), {
        fontSize: (w < 700) ? '12px' : '13px', color: this.COL_BODY, fontStyle: '600', fontFamily: this.FONT_BODY,
        resolution: this.RES
      }).setOrigin(1, 0));
      page.add(this.scene.add.text(w / 2 + (w < 700 ? 10 : -20), rowY + 2, '→', {
        fontSize: '14px', color: this.COL_PINK, fontFamily: this.FONT_BODY,
        resolution: this.RES
      }).setOrigin(0.5, 0));
      page.add(this.scene.add.text(w / 2 + (w < 700 ? 40 : 20), rowY + 2, this.Tr(row.spins), {
        fontSize: (w < 700) ? '12px' : '13px', color: this.COL_GOLD, fontStyle: '700', fontFamily: this.FONT_BODY,
        resolution: this.RES
      }));
    });
    yPos += scatterTable.length * 26 + 20;

    parent.add(page);
    this.pages.push(page);
    return yPos + 20;
  }

  // ─────────────────────────────────────────────
  // PAGE 3: TUMBLE & MULTIPLIER SPOTS
  // ─────────────────────────────────────────────
  private buildPage3_TumbleAndMultipliers(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 40;
    let yPos = startY;

    // TUMBLE FEATURE
    yPos = this.addSectionTitle(page, w, yPos, 'TUMBLE FEATURE');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 95);
    const tumbleRules = [
      '•  After every win, winning symbols are removed.',
      '•  Remaining symbols drop, and empty positions are filled from above.',
      '•  Tumbling continues until no new wins appear.',
    ];
    page.add(this.scene.add.text(pad + 15, yPos + 10, this.Tr(tumbleRules.join('\n')), {
      fontSize: (w < 700) ? '12px' : '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES, lineSpacing: 8, align: 'left',
      wordWrap: { width: w - pad * 2 - 30 }
    }).setOrigin(0, 0));
    yPos += 110;

    // Multiplier spots
    yPos = this.addSectionTitle(page, w, yPos, 'MULTIPLIER SPOTS');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 115);
    const multRules = [
      '•  Winning symbols mark their grid spot.',
      '•  Second explosion on same spot → ×2 multiplier.',
      '•  Each further explosion doubles it (up to ×1024).',
      '•  Multiple multipliers in one cluster are summed.',
      '•  Base game: multipliers reset after tumble sequence.',
    ];
    page.add(this.scene.add.text(pad + 22, yPos + 10, this.Tr(multRules.join('\n')), {
      fontSize: (w < 700) ? '12px' : '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES, lineSpacing: 4, align: 'left',
      wordWrap: { width: w - pad * 2 - 44 }
    }).setOrigin(0, 0));
    yPos += 125;

    // Multiplier progression
    this.drawCard(page, pad, yPos, w - pad * 2, 85, true);
    page.add(this.scene.add.text(pad + 18, yPos + 16, this.Tr('MULTIPLIER PROGRESSION'), {
      fontSize: '13px', color: this.COL_GOLD, fontStyle: '800', fontFamily: this.FONT_TITLE,
      resolution: this.RES
    }).setOrigin(0, 0.5));
    const mults = ['×2', '×4', '×8', '×16', '...', '×1024'];
    const mw = (w - pad * 2 - (w < 700 ? 10 : 40)) / mults.length;
    mults.forEach((m, i) => {
      const mx = pad + (w < 700 ? 5 : 20) + i * mw + mw / 2;
      const isMax = i === mults.length - 1;
      page.add(this.scene.add.text(mx, yPos + 50, this.Tr(m), {
        fontSize: isMax ? (w < 700 ? '13px' : '16px') : (w < 700 ? '11px' : '14px'), color: isMax ? this.COL_GOLD : this.COL_BODY,
        fontStyle: '900', fontFamily: this.FONT_TITLE, resolution: this.RES
      }).setOrigin(0.5));
      if (i < mults.length - 1 && m !== '...') {
        page.add(this.scene.add.text(mx + mw / 2, yPos + 50, this.Tr('→'), {
          fontSize: (w < 700) ? '10px' : '14px', color: this.COL_PINK, fontFamily: this.FONT_BODY,
          resolution: this.RES
        }).setOrigin(0.5));
      }
    });
    yPos += 105;

    parent.add(page);
    this.pages.push(page);
    return yPos + 20;
  }

  // ─────────────────────────────────────────────
  // PAGE 4: BUY FEATURES
  // ─────────────────────────────────────────────
  private buildPage4_BuyFeatures(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 30;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w, yPos, 'BUY FREE SPINS');

    page.add(this.scene.add.text(pad + 8, yPos, this.Tr('Instantly trigger the Free Spins bonus round.'), {
      fontSize: '13px', color: this.COL_MUTED, fontFamily: this.FONT_BODY, resolution: this.RES, fontStyle: 'italic',
      wordWrap: { width: w - pad * 2 }
    }).setOrigin(0, 0));
    yPos += 25;

    const isWide = w >= 700;
    const cardGap = 16;

    if (isWide) {
      const cardW = (w - pad * 2 - cardGap) / 2;
      const cardH = 310;
      this.drawBuyCard(page, pad, yPos, cardW, cardH,
        '💎', 'ULTRA FREE SPINS', '1,000× BET', this.COL_PINK_HEX,
        'Starting Multiplier: ×4', '×4 → ×8 → ×16 → ... → ×1024',
        ['3–7 Scatters land on board', '10–30 Free Spins awarded', 'All 49 spots pre-loaded ×4', 'Multipliers double each hit', 'Persist across all spins', 'Best shot at 25,000× MAX WIN']
      );
      this.drawBuyCard(page, pad + cardW + cardGap, yPos, cardW, cardH,
        '⭐', 'SUPER FREE SPINS', '500× BET', 0xff9900,
        'Starting Multiplier: ×2', '×2 → ×4 → ×8 → ... → ×1024',
        ['3–7 Scatters land on board', '10–30 Free Spins awarded', 'All 49 spots pre-loaded ×2', 'Multipliers double each hit', 'Persist across all spins', 'Great value bonus option']
      );
      yPos += cardH + 12;
    } else {
      const cardW = w - pad * 2;
      const cardH = 200;
      this.drawBuyCard(page, pad, yPos, cardW, cardH,
        '💎', 'ULTRA FREE SPINS', '1,000× BET', this.COL_PINK_HEX,
        'Starting Multiplier: ×4', '×4 → ×8 → ×16 → ... → ×1024',
        ['3–7 Scatters → 10–30 Free Spins', 'All 49 spots pre-loaded with ×4', 'Multipliers double each hit', 'Best shot at 25,000× MAX WIN']
      );
      yPos += cardH + 12;
      this.drawBuyCard(page, pad, yPos, cardW, cardH,
        '⭐', 'SUPER FREE SPINS', '500× BET', 0xff9900,
        'Starting Multiplier: ×2', '×2 → ×4 → ×8 → ... → ×1024',
        ['3–7 Scatters → 10–30 Free Spins', 'All 49 spots pre-loaded with ×2', 'Multipliers double each hit', 'Great value bonus option']
      );
      yPos += cardH + 12;
    }

    // Footer
    const footerH = 45;
    this.drawCard(page, pad, yPos, w - pad * 2, footerH);

    page.add(this.scene.add.text(pad + 14, yPos + 12, '⚠', { fontSize: '14px', color: this.COL_GOLD, resolution: this.RES }).setOrigin(0, 0));
    page.add(this.scene.add.text(pad + 34, yPos + 10, this.Tr('Cost deducted on confirmation  •  Ante Bet doesn\'t affect Buy cost  •  Max win 25,000×'), {
      fontSize: '11px', color: this.COL_MUTED, fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES, lineSpacing: 3,
      wordWrap: { width: w - pad * 2 - 55 }
    }).setOrigin(0, 0));

    parent.add(page);
    this.pages.push(page);
    return yPos + footerH + 18;
  }

  /** Draws a premium Buy Feature card */
  /** Draw specific complex cards for the Buy Free Spins page */
  private drawBuyCard(page: Phaser.GameObjects.Container, x: number, y: number, cw: number, ch: number,
    emoji: string, title: string, costLabel: string, accentColor: number,
    startMult: string, multProgression: string, features: string[]) {

    this.drawCard(page, x, y, cw, ch, true, accentColor);

    const innerPad = 15;
    let ty = y + innerPad;

    // Header layout: Title and pill
    page.add(this.scene.add.text(x + cw / 2, ty, emoji, { fontSize: '24px' }).setOrigin(0.5, 0));
    ty += 30;

    page.add(this.scene.add.text(x + cw / 2, ty, this.Tr(title), {
      fontSize: '18px', color: '#ffffff', fontFamily: this.FONT_TITLE, fontStyle: '900', resolution: this.RES
    }).setOrigin(0.5, 0));
    ty += 28;

    // Pill for the cost
    const pillW = 140;
    const pillH = 34;
    const px = x + cw / 2 - pillW / 2;
    const pillG = this.scene.add.graphics();
    pillG.fillStyle(0x000000, 0.4);
    pillG.fillRoundedRect(px, ty, pillW, pillH, 17);
    pillG.lineStyle(3, accentColor, 1);
    pillG.strokeRoundedRect(px, ty, pillW, pillH, 17);
    page.add(pillG);

    page.add(this.scene.add.text(x + cw / 2, ty + pillH / 2, this.Tr(costLabel), {
      fontSize: '16px', color: `#${accentColor.toString(16).padStart(6, '0')}`, fontStyle: '800', fontFamily: this.FONT_TITLE, resolution: this.RES, stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5, 0.5));
    ty += pillH + 20;

    // Separator
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0xffffff, 0.1);
    sep.lineBetween(x + 20, ty, x + cw - 20, ty);
    page.add(sep);
    ty += 15;

    // Start multiplier
    const smLabel = this.scene.add.text(x + innerPad, ty, this.Tr(startMult), {
      fontSize: '13px', color: this.COL_GOLD, fontFamily: this.FONT_TITLE, fontStyle: '700', resolution: this.RES
    }).setOrigin(0, 0);
    page.add(smLabel);
    ty += 20;

    page.add(this.scene.add.text(x + innerPad, ty, this.Tr(multProgression), {
      fontSize: '12px', color: this.COL_ACCENT, fontFamily: this.FONT_TITLE, fontStyle: '800', resolution: this.RES
    }).setOrigin(0, 0));
    ty += 25;

    // Features list
    features.forEach(f => {
      page.add(this.scene.add.text(x + innerPad, ty, this.Tr(`• ${f}`), {
        fontSize: '11px', color: this.COL_BODY, fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES,
        wordWrap: { width: cw - innerPad * 2 }
      }).setOrigin(0, 0));
      ty += 16;
    });
  }

  // ─────────────────────────────────────────────
  // PAGE 5: GAME RULES & STATS
  // ─────────────────────────────────────────────
  private buildPage5_GameRulesAndStats(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 40;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w, yPos, 'GAME RULES & STATS');

    // Volatility card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 55, true);
    page.add(this.scene.add.text(pad + 22, yPos + 22, this.Tr('VOLATILITY'), {
      fontSize: '14px', color: this.COL_ACCENT, fontStyle: '700', fontFamily: this.FONT_BODY,
      resolution: this.RES
    }).setOrigin(0, 0.5));
    page.add(this.scene.add.text(w - pad - 22, yPos + 22, '⚡⚡⚡⚡⚡', {
      fontSize: '16px', color: this.COL_GOLD, resolution: this.RES
    }).setOrigin(1, 0.5));
    yPos += 68;

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
    page.add(this.scene.add.text(pad + 15, yPos + 14, this.Tr(rules.join('\n')), {
      fontSize: (w < 700) ? '12px' : '14px', color: this.COL_BODY, fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES, lineSpacing: 8, align: 'left',
      wordWrap: { width: w - pad * 2 - 30 }
    }).setOrigin(0, 0));
    yPos += 245;

    // RTP & Stats card
    this.drawCard(page, pad, yPos - 5, w - pad * 2, 110);
    page.add(this.scene.add.text(pad + 22, yPos + 14, this.Tr('RTP (Return to Player)'), {
      fontSize: '13px', color: this.COL_GOLD, fontStyle: '700', fontFamily: this.FONT_BODY,
      resolution: this.RES
    }).setOrigin(0, 0));
    page.add(this.scene.add.text(pad + 22, yPos + 38, this.Tr('Base: 96.53%  |  Ultra FS: 96.50%  |  Super: 96.44%'), {
      fontSize: '12px', color: this.COL_BODY, fontFamily: this.FONT_BODY, fontStyle: '500',
      resolution: this.RES
    }).setOrigin(0, 0));
    page.add(this.scene.add.text(pad + 22, yPos + 66, this.Tr(`Bet Range: ${BET_PRESETS[0].toFixed(2)} – ${BET_PRESETS[BET_PRESETS.length - 1].toFixed(2)}  |  Max Win: ${options.maxWinMultiplier.toLocaleString()}×`), {
      fontSize: (w < 700) ? '11px' : '13px', color: this.COL_GOLD, fontFamily: this.FONT_BODY, resolution: this.RES, fontStyle: '700'
    }).setOrigin(0, 0));

    parent.add(page);
    this.pages.push(page);
    return yPos + 130;
  }

  // ─────────────────────────────────────────────
  // PAGE 6: HOW TO PLAY & INTERFACE
  // ─────────────────────────────────────────────
  private buildPage6_HowToPlay(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 40;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w, yPos, 'HOW TO PLAY');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 110);
    const howTo = [
      '•  Click the  ⊕  or  ⊖  buttons to change the bet value.',
      '•  Select the bet you want to use in the game.',
      '•  Press the SPIN button to play.',
    ];
    page.add(this.scene.add.text(pad + 15, yPos + 14, this.Tr(howTo.join('\n')), {
      fontSize: (w < 700) ? '12px' : '14px', color: this.COL_BODY, align: 'left', fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES, lineSpacing: 8, wordWrap: { width: w - pad * 2 - 30 }
    }).setOrigin(0, 0));
    yPos += 125;

    // UI Guide section
    yPos = this.addSectionTitle(page, w, yPos, 'MAIN GAME INTERFACE');

    const uiItems = [
      '[SETTINGS] – opens the settings menu.',
      '[SOUND] – toggles sound and music on/off.',
      '[INFO] – opens this Information page.',
      'BALANCE / BET – show current balance and bet.',
      '[+] / [-] – change the current bet up or down.',
      '[SPIN] – starts the game.',
      'AUTOPLAY – opens auto play menu. Click again to stop.',
    ];
    const uiCardH = uiItems.length * 30 + 28;
    this.drawCard(page, pad, yPos - 5, w - pad * 2, uiCardH);
    uiItems.forEach((item, i) => {
      page.add(this.scene.add.text(pad + 15, yPos + 14 + i * 30, this.Tr(`•  ${item}`), {
        fontSize: (w < 700) ? '11px' : '13px', color: this.COL_BODY, fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES,
        wordWrap: { width: w - pad * 2 - 30 }
      }).setOrigin(0, 0));
    });

    parent.add(page);
    this.pages.push(page);
    return yPos + uiCardH + 20;
  }

  // ─────────────────────────────────────────────
  // PAGE 7: MENUS & NAVIGATION
  // ─────────────────────────────────────────────
  private buildPage7_MenusAndNav(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 40;
    let yPos = startY;
    const fs = (w < 700) ? '12px' : '13px';
    const ls = 8;

    yPos = this.addSectionTitle(page, w, yPos, 'SETTINGS MENU');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 118);
    const settingsInfo = [
      '•  INTRO SCREEN – toggles the introductory screen on/off',
      '•  AMBIENT – toggles ambient sound and music on/off',
      '•  SOUND FX – toggles sound effects on/off',
      '•  GAME HISTORY – opens game history page',
    ];
    page.add(this.scene.add.text(pad + 15, yPos + 14, this.Tr(settingsInfo.join('\n')), {
      fontSize: fs, color: this.COL_BODY, align: 'left', fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES, lineSpacing: ls, wordWrap: { width: w - pad * 2 - 30 }
    }).setOrigin(0, 0));
    yPos += 130;

    // Information Screen
    yPos = this.addSectionTitle(page, w, yPos, 'INFORMATION SCREEN');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 50);
    page.add(this.scene.add.text(pad + 15, yPos + 14, this.Tr('•  ◀ and ▶ scroll between information pages   •  ✖ closes the screen'), {
      fontSize: fs, color: this.COL_BODY, fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES, wordWrap: { width: w - pad * 2 - 30 }
    }).setOrigin(0, 0));
    yPos += 62;

    // Bet Menu
    yPos = this.addSectionTitle(page, w, yPos, 'BET MENU');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 68);
    page.add(this.scene.add.text(pad + 15, yPos + 14, this.Tr('•  The bet menu shows available bet multipliers and current total bet.\n•  Use ⊕ and ⊖ to change BET and COIN VALUE.'), {
      fontSize: fs, color: this.COL_BODY, align: 'left', lineSpacing: ls, fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES, wordWrap: { width: w - pad * 2 - 30 }
    }).setOrigin(0, 0));
    yPos += 80;

    // Max Win info
    yPos = this.addSectionTitle(page, w, yPos, 'MAX WIN EXPLANATION');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 68);
    page.add(this.scene.add.text(pad + 15, yPos + 14, this.Tr(`•  Maximum win: ${options.maxWinMultiplier.toLocaleString()}× bet. If reached, the round ends immediately.\n•  Win is awarded and remaining free spins are forfeited.`), {
      fontSize: fs, color: this.COL_BODY, align: 'left', lineSpacing: ls, fontFamily: this.FONT_BODY, fontStyle: '500', resolution: this.RES, wordWrap: { width: w - pad * 2 - 30 }
    }).setOrigin(0, 0));
    
    parent.add(page);
    this.pages.push(page);
    return yPos + 85;
  }

  // ─────────────────────────────────────────────
  // PAGE 8: TERMS & DISCLAIMER
  // ─────────────────────────────────────────────
  private buildPage8_Terms(parent: Phaser.GameObjects.Container, w: number, _h: number, startY: number = 80): number {
    const page = this.scene.add.container(0, 0).setVisible(false);
    const pad = w < 700 ? 15 : 40;
    let yPos = startY;

    yPos = this.addSectionTitle(page, w, yPos, 'TERMS & DISCLAIMER');

    this.drawCard(page, pad, yPos - 5, w - pad * 2, 160);
    const text = 'Malfunction voids all wins and plays.\n\nA consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds.\n\nThe expected return is calculated over many plays. Winnings are settled according to the amount received from the Remote Game Server.\n\nAll game rules and payouts are subject to change according to the terms of service.';
    
    page.add(this.scene.add.text(pad + 20, yPos + 14, this.Tr(text), {
      fontSize: '12px', color: '#9988bb', fontStyle: 'italic', fontFamily: this.FONT_BODY, resolution: this.RES, align: 'left', lineSpacing: 10, wordWrap: { width: w - pad * 2 - 40 }
    }).setOrigin(0, 0));
    
    parent.add(page);
    this.pages.push(page);
    return yPos + 180;
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
    // Update dot indicators using stored logicalW/logicalH
    if (this.dotIndicators.length > 0) {
      const navCenter = this.logicalW / 2;
      const navY = this.logicalH - 40;
      const totalDotsW = this.pages.length * 18;
      const dotsStartX = navCenter - totalDotsW / 2;
      this.dotIndicators.forEach((dot, i) => {
        dot.clear();
        const dx = dotsStartX + i * 18;
        const dy = navY;
        if (i === this.currentPage) {
          dot.fillStyle(0xff9900, 1);
          dot.fillCircle(dx, dy, 5);
        } else {
          dot.fillStyle(0xffffff, 0.25);
          dot.fillCircle(dx, dy, 3);
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
      duration: 500,
      ease: 'Elastic.easeOut'
    });

    // 6. UI Panel Starbursts (Juice)
    if (this.scene.textures.exists('gold_star')) {
      const w = this.scene.scale.width;
      const h = this.scene.scale.height;
      const stars = this.scene.add.particles(w/2, h/2, 'gold_star', {
        speed: { min: 200, max: 800 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.6, end: 0 },
        lifespan: 800,
        blendMode: 'ADD',
        rotate: { min: -180, max: 180 },
      });
      stars.setDepth(this.container.depth - 1);
      stars.explode(20);
      this.scene.time.delayedCall(900, () => stars.destroy());
    }
  }

  public hide() {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0, y: 30, scale: 0.9,
      duration: 200,
      ease: 'Back.easeIn',
      onComplete: () => { 
        this.container.setVisible(false); 
        this.container.setScale(1);
        this.visible = false; 
      },
    });
  }

  public isVisible(): boolean { return this.visible; }
  public toggle() {
    if (this.visible) this.hide(); else this.show();
  }
}
