import Phaser from 'phaser';
import { BET_PRESETS } from '../options';
import type { GameScene } from '../scenes/GameScene';

/**
 * Premium Bet Panel overlay — Sugar Blast–style bet selector.
 * Anchored above the spin button area, shows BET (level) and TOTAL BET.
 */
export class BetOverlay {
  private scene: GameScene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;
  private _resizeTimer: ReturnType<typeof setTimeout> | null = null;

  private onBetChange: ((index: number) => void) | null = null;

  // State (synced from Game before show)
  private betIndex = 4;
  private anteBetEnabled = false;
  private anteBetMultiplier = 1.25;

  // Dynamic UI refs
  private txtBetValue!: Phaser.GameObjects.Text;
  private txtTotalValue!: Phaser.GameObjects.Text;
  private txtMultiplier!: Phaser.GameObjects.Text;
  private btnBetMinus!: Phaser.GameObjects.Graphics;
  private btnBetPlus!: Phaser.GameObjects.Graphics;
  private btnTotalMinus!: Phaser.GameObjects.Graphics;
  private btnTotalPlus!: Phaser.GameObjects.Graphics;

  constructor(scene: GameScene) {
    this.scene = scene;
    this.build();

    this.scene.scale.on('resize', () => {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        const wasVisible = this.visible;
        if (this.container?.scene) {
          this.container.removeAll(true);
          this.container.destroy();
        }
        this.build();
        if (wasVisible) {
          this.container.setVisible(true);
          this.container.setAlpha(1);
          this.visible = true;
        }
      }, 100);
    });
  }

  public setCallback(cb: (index: number) => void) { this.onBetChange = cb; }

  public syncState(betIndex: number, anteBetEnabled: boolean, anteBetMultiplier: number) {
    this.betIndex = betIndex;
    this.anteBetEnabled = anteBetEnabled;
    this.anteBetMultiplier = anteBetMultiplier;
  }

  public show() {
    if (this.container?.scene) { this.container.removeAll(true); this.container.destroy(); }
    this.build();
    this.visible = true;
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 180, ease: 'Sine.easeOut' });
  }

  public hide() {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 130,
      onComplete: () => { this.container.setVisible(false); this.visible = false; },
    });
  }

  public isVisible() { return this.visible; }
  public toggle() { if (this.visible) this.hide(); else this.show(); }

  private emitChange() {
    if (this.onBetChange) this.onBetChange(this.betIndex);
    this.refreshValues();
  }

  private refreshValues() {
    const baseBet = BET_PRESETS[this.betIndex];
    const totalBet = this.anteBetEnabled ? baseBet * this.anteBetMultiplier : baseBet;
    const level = this.betIndex + 1; // 1-indexed level

    this.txtBetValue.setText(level.toString());
    this.txtTotalValue.setText(`$${totalBet.toFixed(2)}`);
    this.txtMultiplier.setText(`BET MULTIPLIER ${level}x`);

    // Dim boundary buttons
    const atMin = this.betIndex <= 0;
    const atMax = this.betIndex >= BET_PRESETS.length - 1;
    this.btnBetMinus.setAlpha(atMin ? 0.3 : 1);
    this.btnTotalMinus.setAlpha(atMin ? 0.3 : 1);
    this.btnBetPlus.setAlpha(atMax ? 0.3 : 1);
    this.btnTotalPlus.setAlpha(atMax ? 0.3 : 1);
  }

  // ═══════════════════════════════════════════════
  //  BUILD
  // ═══════════════════════════════════════════════
  private build() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const isMobile = w < 768;

    this.container = this.scene.add.container(0, 0).setDepth(140).setVisible(false);

    // ── Full-screen tap-to-dismiss ──
    const dimBg = this.scene.add.graphics();
    dimBg.fillStyle(0x000000, 0.55);
    dimBg.fillRect(0, 0, w, h);
    dimBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dimBg.on('pointerdown', () => this.hide());
    this.container.add(dimBg);

    // ── Panel ──
    const pW = Math.min(380, w * 0.92);
    const pH = 360;
    const pX = (w - pW) / 2;
    const pY = (h - pH) / 2 - (isMobile ? 10 : 0);
    const rad = 32;

    const panel = this.scene.add.graphics();
    // Comic drop shadow
    panel.fillStyle(0x3a0055, 1);
    panel.fillRoundedRect(pX + 12, pY + 12, pW, pH, rad);
    
    // Creamy candy base
    panel.fillGradientStyle(0xfff5f8, 0xfff5f8, 0xffe6f0, 0xffe6f0, 1);
    panel.fillRoundedRect(pX, pY, pW, pH, rad);
    
    // Hot pink thick border
    panel.lineStyle(8, 0xff0070, 1);
    panel.strokeRoundedRect(pX, pY, pW, pH, rad);

    // Inner rim
    panel.lineStyle(4, 0xffffff, 1);
    panel.strokeRoundedRect(pX + 6, pY + 6, pW - 12, pH - 12, 26);
    
    // Prevent clicks passing through
    panel.setInteractive(new Phaser.Geom.Rectangle(pX, pY, pW, pH), Phaser.Geom.Rectangle.Contains);
    this.container.add(panel);

    // ── Close (✕) ──
    const closeBtnX = pX + pW - 10;
    const closeBtnY = pY + 10;
    const closeBtnGfx = this.scene.add.graphics();
    closeBtnGfx.fillStyle(0x3a0055, 1);
    closeBtnGfx.fillCircle(closeBtnX + 4, closeBtnY + 4, 26);
    closeBtnGfx.fillStyle(0xff3333, 1);
    closeBtnGfx.fillCircle(closeBtnX, closeBtnY, 26);
    closeBtnGfx.lineStyle(4, 0xffffff, 1);
    closeBtnGfx.strokeCircle(closeBtnX, closeBtnY, 26);
    this.container.add(closeBtnGfx);

    const closeBtn = this.scene.add.text(closeBtnX, closeBtnY, '✕', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '28px', color: '#ffffff',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 0, false, true).setInteractive({ useHandCursor: true });
    
    closeBtn.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      this.hide();
    });
    closeBtn.on('pointerover', () => closeBtn.setScale(1.1));
    closeBtn.on('pointerout', () => closeBtn.setScale(1));
    this.container.add(closeBtn);

    // Header Pill for Title
    const headerW = 220;
    const headerH = 50;
    const headerX = pX + pW / 2 - headerW / 2;
    const headerY = pY - 15;
    const header = this.scene.add.graphics();
    header.fillStyle(0x3a0055, 1);
    header.fillRoundedRect(headerX + 4, headerY + 4, headerW, headerH, 25);
    header.fillGradientStyle(0xff0070, 0xff0070, 0xcc0055, 0xcc0055, 1);
    header.fillRoundedRect(headerX, headerY, headerW, headerH, 25);
    header.lineStyle(3, 0xffffff, 1);
    header.strokeRoundedRect(headerX, headerY, headerW, headerH, 25);
    this.container.add(header);

    // ── Title: BET MULTIPLIER Nx ──
    const level = this.betIndex + 1;
    this.txtMultiplier = this.scene.add.text(pX + pW / 2, headerY + headerH / 2, `BET MULTIPLIER ${level}x`, {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 0, false, true);
    this.container.add(this.txtMultiplier);

    // ── Thin separator under title ──
    const sep1 = this.scene.add.graphics();
    sep1.lineStyle(2, 0xffb3cc, 1);
    sep1.lineBetween(pX + 20, pY + 50, pX + pW - 20, pY + 50);
    this.container.add(sep1);

    // ── ROW LAYOUT ──
    const rowH = 50;
    const rowPad = 22;
    const btnR = 24; // button radius

    // ═══ BET ROW ═══
    const betRowY = pY + 75;
    this.buildLabel(pX + pW / 2, betRowY - 12, 'BET');
    const betResult = this.buildValueRow(pX, betRowY, pW, rowH, rowPad, btnR);
    this.txtBetValue = betResult.txt;
    this.btnBetMinus = betResult.minusGfx;
    this.btnBetPlus = betResult.plusGfx;

    // ═══ TOTAL BET ROW ═══
    const totalRowY = betRowY + rowH + 45;
    this.buildLabel(pX + pW / 2, totalRowY - 12, 'TOTAL BET');
    const totalResult = this.buildValueRow(pX, totalRowY, pW, rowH, rowPad, btnR);
    this.txtTotalValue = totalResult.txt;
    this.btnTotalMinus = totalResult.minusGfx;
    this.btnTotalPlus = totalResult.plusGfx;

    // ═══ BET MAX BUTTON ═══
    const maxW = pW * 0.6;
    const maxH = 55;
    const maxX = pX + (pW - maxW) / 2;
    const maxY = totalRowY + rowH + 30;

    const maxGfx = this.scene.add.graphics();
    
    // Massive Green Candy Button
    maxGfx.fillStyle(0x3a0055, 0.4);
    maxGfx.fillRoundedRect(maxX + 4, maxY + 6, maxW, maxH, 20); // Shadow
    
    maxGfx.fillGradientStyle(0x00e676, 0x00e676, 0x00b359, 0x00b359, 1);
    maxGfx.fillRoundedRect(maxX, maxY, maxW, maxH, 20); // Body
    
    maxGfx.lineStyle(4, 0xffffff, 1);
    maxGfx.strokeRoundedRect(maxX, maxY, maxW, maxH, 20); // Border

    this.container.add(maxGfx);

    const maxTxt = this.scene.add.text(maxX + maxW / 2, maxY + maxH / 2, 'BET MAX', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '24px', color: '#ffffff',
    }).setOrigin(0.5).setShadow(0, 3, '#004422', 0, false, true);
    this.container.add(maxTxt);

    const maxHit = this.scene.add.rectangle(maxX + maxW / 2, maxY + maxH / 2, maxW, maxH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    maxHit.on('pointerdown', () => { 
      this.scene.audio.playSound('button');
      this.betIndex = BET_PRESETS.length - 1; 
      this.emitChange(); 
    });
    maxHit.on('pointerover', () => { 
      this.scene.tweens.killTweensOf([maxGfx, maxTxt]);
      this.scene.tweens.add({ targets: [maxGfx, maxTxt], scale: 1.03, duration: 150, ease: 'Back.easeOut' }); 
    });
    maxHit.on('pointerout', () => { 
      this.scene.tweens.killTweensOf([maxGfx, maxTxt]);
      this.scene.tweens.add({ targets: [maxGfx, maxTxt], scale: 1, duration: 150, ease: 'Back.easeIn' }); 
    });
    this.container.add(maxHit);

    // Set initial values
    this.refreshValues();
  }

  // ── Build a section label ──
  private buildLabel(cx: number, cy: number, text: string) {
    this.container.add(this.scene.add.text(cx, cy, text, {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '20px', color: '#ff0070',
    }).setOrigin(0.5));
  }

  // ── Build a value row: [−] [ value ] [+] ──
  private buildValueRow(
    pX: number, rowY: number, pW: number, rowH: number, pad: number, btnR: number
  ): { txt: Phaser.GameObjects.Text; minusGfx: Phaser.GameObjects.Graphics; plusGfx: Phaser.GameObjects.Graphics } {
    const btnDiameter = btnR * 2;
    const fieldW = pW - pad * 2 - btnDiameter * 2 - 24;
    const fieldX = pX + pad + btnDiameter + 12;

    // Value field — pill shape
    const field = this.scene.add.graphics();
    field.fillStyle(0xffffff, 1);
    field.fillRoundedRect(fieldX, rowY, fieldW, rowH, 16);
    field.lineStyle(3, 0xffb3cc, 1);
    field.strokeRoundedRect(fieldX, rowY, fieldW, rowH, 16);
    this.container.add(field);

    const txt = this.scene.add.text(fieldX + fieldW / 2, rowY + rowH / 2, '', {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '28px', color: '#3a0055',
    }).setOrigin(0.5);
    this.container.add(txt);

    // ── Minus button ──
    const minusCx = pX + pad + btnR;
    const minusCy = rowY + rowH / 2;
    const minusGfx = this.drawRoundButton(minusCx, minusCy, btnR, false);
    const minusHit = this.scene.add.circle(minusCx, minusCy, btnR + 4, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    minusHit.on('pointerdown', () => { 
      if (this.betIndex > 0) { 
        this.scene.audio.playSound('button');
        this.betIndex--; 
        this.emitChange(); 
      } 
    });
    this.container.add(minusHit);

    // ── Plus button ──
    const plusCx = pX + pW - pad - btnR;
    const plusCy = rowY + rowH / 2;
    const plusGfx = this.drawRoundButton(plusCx, plusCy, btnR, true);
    const plusHit = this.scene.add.circle(plusCx, plusCy, btnR + 4, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    plusHit.on('pointerdown', () => { 
      if (this.betIndex < BET_PRESETS.length - 1) { 
        this.scene.audio.playSound('button');
        this.betIndex++; 
        this.emitChange(); 
      } 
    });
    this.container.add(plusHit);

    return { txt, minusGfx, plusGfx };
  }

  // ── Draw a single round +/− button ──
  private drawRoundButton(cx: number, cy: number, r: number, isPlus: boolean): Phaser.GameObjects.Graphics {
    const gfx = this.scene.add.graphics();

    if (isPlus) {
      // Green circle bouncy
      gfx.fillStyle(0x3a0055, 0.4);
      gfx.fillCircle(cx + 2, cy + 3, r); // shadow
      gfx.fillGradientStyle(0x00e676, 0x00e676, 0x00b359, 0x00b359, 1);
      gfx.fillCircle(cx, cy, r);
      gfx.lineStyle(3, 0xffffff, 1);
      gfx.strokeCircle(cx, cy, r);
    } else {
      // Pink circle bouncy
      gfx.fillStyle(0x3a0055, 0.4);
      gfx.fillCircle(cx + 2, cy + 3, r);
      gfx.fillGradientStyle(0xff0070, 0xff0070, 0xcc0055, 0xcc0055, 1);
      gfx.fillCircle(cx, cy, r);
      gfx.lineStyle(3, 0xffffff, 1);
      gfx.strokeCircle(cx, cy, r);
    }

    // Icon (−/+)
    const arm = r * 0.38;
    gfx.lineStyle(3, 0xffffff, 1);
    gfx.lineBetween(cx - arm, cy, cx + arm, cy);
    if (isPlus) gfx.lineBetween(cx, cy - arm, cx, cy + arm);

    this.container.add(gfx);
    return gfx;
  }
}
