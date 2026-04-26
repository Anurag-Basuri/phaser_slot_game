import Phaser from 'phaser';
import { BET_PRESETS } from '../options';

/**
 * Premium Bet Panel overlay — Sugar Rush–style bet selector.
 * Shows BET level and TOTAL BET with +/- controls and a BET MAX button.
 */
export class BetOverlay {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;
  private _resizeTimer: ReturnType<typeof setTimeout> | null = null;

  // Callbacks
  private onBetChange: ((index: number) => void) | null = null;

  // State (owned by Game, synced before show)
  private betIndex = 4;
  private anteBetEnabled = false;
  private anteBetMultiplier = 1.25;

  // UI refs that update
  private txtBetValue!: Phaser.GameObjects.Text;
  private txtTotalValue!: Phaser.GameObjects.Text;
  private txtMultiplier!: Phaser.GameObjects.Text;
  private btnMinusGfx!: Phaser.GameObjects.Graphics;
  private btnPlusGfx!: Phaser.GameObjects.Graphics;
  private btnTotalMinusGfx!: Phaser.GameObjects.Graphics;
  private btnTotalPlusGfx!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
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

  public setCallback(cb: (index: number) => void) {
    this.onBetChange = cb;
  }

  /** Sync state from Game before showing */
  public syncState(betIndex: number, anteBetEnabled: boolean, anteBetMultiplier: number) {
    this.betIndex = betIndex;
    this.anteBetEnabled = anteBetEnabled;
    this.anteBetMultiplier = anteBetMultiplier;
  }

  public show() {
    if (this.container?.scene) {
      this.container.removeAll(true);
      this.container.destroy();
    }
    this.build();
    this.visible = true;
    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 200 });
  }

  public hide() {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, duration: 150,
      onComplete: () => { this.container.setVisible(false); this.visible = false; },
    });
  }

  public isVisible() { return this.visible; }
  public toggle() { if (this.visible) this.hide(); else this.show(); }

  private emitChange() {
    if (this.onBetChange) this.onBetChange(this.betIndex);
    this.refreshDisplay();
  }

  private refreshDisplay() {
    const baseBet = BET_PRESETS[this.betIndex];
    const totalBet = this.anteBetEnabled ? baseBet * this.anteBetMultiplier : baseBet;
    this.txtBetValue.setText(`$${baseBet.toFixed(2)}`);
    this.txtTotalValue.setText(`$${totalBet.toFixed(2)}`);

    const betMultiplier = Math.round(baseBet / BET_PRESETS[0]);
    this.txtMultiplier.setText(`BET MULTIPLIER ${betMultiplier}x`);

    // Dim min/max boundary buttons
    const atMin = this.betIndex <= 0;
    const atMax = this.betIndex >= BET_PRESETS.length - 1;
    this.btnMinusGfx.setAlpha(atMin ? 0.3 : 1);
    this.btnTotalMinusGfx.setAlpha(atMin ? 0.3 : 1);
    this.btnPlusGfx.setAlpha(atMax ? 0.3 : 1);
    this.btnTotalPlusGfx.setAlpha(atMax ? 0.3 : 1);
  }

  private build() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.container = this.scene.add.container(0, 0).setDepth(140).setVisible(false);

    // Dark background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRect(0, 0, w, h);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    bg.on('pointerdown', () => this.hide());
    this.container.add(bg);

    // Panel dimensions
    const isMobile = w < 768;
    const pW = isMobile ? w * 0.92 : 380;
    const pH = isMobile ? 310 : 320;
    const pX = (w - pW) / 2;
    const pY = (h - pH) / 2;

    // Panel background
    const panel = this.scene.add.graphics();
    // Drop shadow
    panel.fillStyle(0x000000, 0.6);
    panel.fillRoundedRect(pX + 4, pY + 6, pW, pH, 20);
    // Main
    panel.fillStyle(0x111118, 0.98);
    panel.fillRoundedRect(pX, pY, pW, pH, 20);
    // Accent border
    panel.lineStyle(2.5, 0xff006a, 0.7);
    panel.strokeRoundedRect(pX, pY, pW, pH, 20);
    // Inner highlight
    panel.lineStyle(1, 0xffffff, 0.06);
    panel.strokeRoundedRect(pX + 2, pY + 2, pW - 4, pH - 4, 18);
    // Header accent
    panel.fillStyle(0xffffff, 0.04);
    panel.fillRoundedRect(pX, pY, pW, 55, { tl: 20, tr: 20, bl: 0, br: 0 } as any);
    panel.lineStyle(1, 0xffffff, 0.08);
    panel.lineBetween(pX + 20, pY + 55, pX + pW - 20, pY + 55);

    panel.setInteractive(new Phaser.Geom.Rectangle(pX, pY, pW, pH), Phaser.Geom.Rectangle.Contains);
    this.container.add(panel);

    // Close button
    const closeBtn = this.scene.add.text(pX + pW - 30, pY + 27, '✕', {
      fontSize: '22px', color: '#8899aa', fontFamily: '"Inter", sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff006a'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#8899aa'));
    this.container.add(closeBtn);

    // Title — Bet Multiplier Nx
    const betMultiplier = Math.round(BET_PRESETS[this.betIndex] / BET_PRESETS[0]);
    this.txtMultiplier = this.scene.add.text(pX + pW / 2 - 10, pY + 27, `BET MULTIPLIER ${betMultiplier}x`, {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '22px', color: '#ffffff',
      shadow: { offsetX: 0, offsetY: 2, color: '#ff006a', blur: 6, fill: true }
    }).setOrigin(0.5);
    this.container.add(this.txtMultiplier);

    // ─── BET ROW ───
    const rowH = 60;
    const rowY1 = pY + 85;
    this.buildRow(pX, rowY1, pW, rowH, 'BET', BET_PRESETS[this.betIndex], true);

    // ─── TOTAL BET ROW ───
    const rowY2 = rowY1 + rowH + 45;
    const totalBet = this.anteBetEnabled
      ? BET_PRESETS[this.betIndex] * this.anteBetMultiplier
      : BET_PRESETS[this.betIndex];
    this.buildRow(pX, rowY2, pW, rowH, 'TOTAL BET', totalBet, false);

    // ─── BET MAX BUTTON ───
    const maxBtnW = pW * 0.55;
    const maxBtnH = 48;
    const maxBtnX = pX + (pW - maxBtnW) / 2;
    const maxBtnY = rowY2 + rowH + 35;

    const maxBtnGfx = this.scene.add.graphics();
    // Shadow
    maxBtnGfx.fillStyle(0x004422, 1);
    maxBtnGfx.fillRoundedRect(maxBtnX, maxBtnY + 4, maxBtnW, maxBtnH, 12);
    // Body
    maxBtnGfx.fillStyle(0x00cc55, 1);
    maxBtnGfx.fillRoundedRect(maxBtnX, maxBtnY, maxBtnW, maxBtnH, 12);
    // Highlight
    maxBtnGfx.fillStyle(0x44ff88, 0.35);
    maxBtnGfx.fillRoundedRect(maxBtnX + 4, maxBtnY + 2, maxBtnW - 8, maxBtnH * 0.35, 8);
    this.container.add(maxBtnGfx);

    const maxHit = this.scene.add.rectangle(
      maxBtnX + maxBtnW / 2, maxBtnY + maxBtnH / 2,
      maxBtnW, maxBtnH, 0xffffff, 0
    ).setInteractive({ useHandCursor: true });
    maxHit.on('pointerdown', () => {
      this.betIndex = BET_PRESETS.length - 1;
      this.emitChange();
    });
    maxHit.on('pointerover', () => maxBtnGfx.setAlpha(0.8));
    maxHit.on('pointerout', () => maxBtnGfx.setAlpha(1));
    this.container.add(maxHit);

    this.container.add(this.scene.add.text(
      maxBtnX + maxBtnW / 2, maxBtnY + maxBtnH / 2, 'BET MAX', {
        fontFamily: '"Luckiest Guy", cursive, sans-serif',
        fontSize: '24px', color: '#ffffff',
        stroke: '#004422', strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 2, color: '#000', blur: 0, fill: true }
      }
    ).setOrigin(0.5));

    // Initial display update
    this.refreshDisplay();
  }

  private buildRow(pX: number, rowY: number, pW: number, rowH: number, label: string, value: number, isTop: boolean) {
    const pad = 20;
    const btnSize = rowH;
    const fieldW = pW - pad * 2 - btnSize * 2 - 20;
    const fieldX = pX + pad + btnSize + 10;

    // Label
    this.container.add(this.scene.add.text(pX + pW / 2, rowY - 18, label, {
      fontFamily: '"Inter", sans-serif',
      fontSize: '15px', color: '#8899bb', fontStyle: '800',
      letterSpacing: 2
    }).setOrigin(0.5));

    // Value field (dark pill)
    const fieldGfx = this.scene.add.graphics();
    fieldGfx.fillStyle(0x0a0a12, 1);
    fieldGfx.fillRoundedRect(fieldX, rowY, fieldW, rowH, 12);
    fieldGfx.lineStyle(2, 0x222233, 1);
    fieldGfx.strokeRoundedRect(fieldX, rowY, fieldW, rowH, 12);
    this.container.add(fieldGfx);

    const valueTxt = this.scene.add.text(fieldX + fieldW / 2, rowY + rowH / 2, `$${value.toFixed(2)}`, {
      fontFamily: '"Luckiest Guy", cursive, sans-serif',
      fontSize: '28px', color: '#ffffff',
      shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 2, fill: true }
    }).setOrigin(0.5);
    this.container.add(valueTxt);

    if (isTop) {
      this.txtBetValue = valueTxt;
    } else {
      this.txtTotalValue = valueTxt;
    }

    // Minus button
    const minusGfx = this.drawCircleButton(pX + pad + btnSize / 2, rowY + rowH / 2, btnSize / 2, false);
    const minusHit = this.scene.add.rectangle(
      pX + pad + btnSize / 2, rowY + rowH / 2, btnSize, btnSize, 0xffffff, 0
    ).setInteractive({ useHandCursor: true });
    minusHit.on('pointerdown', () => {
      if (this.betIndex > 0) {
        this.betIndex--;
        this.emitChange();
      }
    });
    this.container.add(minusHit);

    // Plus button
    const plusGfx = this.drawCircleButton(pX + pW - pad - btnSize / 2, rowY + rowH / 2, btnSize / 2, true);
    const plusHit = this.scene.add.rectangle(
      pX + pW - pad - btnSize / 2, rowY + rowH / 2, btnSize, btnSize, 0xffffff, 0
    ).setInteractive({ useHandCursor: true });
    plusHit.on('pointerdown', () => {
      if (this.betIndex < BET_PRESETS.length - 1) {
        this.betIndex++;
        this.emitChange();
      }
    });
    this.container.add(plusHit);

    if (isTop) {
      this.btnMinusGfx = minusGfx;
      this.btnPlusGfx = plusGfx;
    } else {
      this.btnTotalMinusGfx = minusGfx;
      this.btnTotalPlusGfx = plusGfx;
    }
  }

  private drawCircleButton(cx: number, cy: number, r: number, isPlus: boolean): Phaser.GameObjects.Graphics {
    const gfx = this.scene.add.graphics();

    // Shadow
    gfx.fillStyle(0x000000, 0.4);
    gfx.fillCircle(cx, cy + 3, r);

    if (isPlus) {
      // Green button
      gfx.fillStyle(0x006622, 1);
      gfx.fillCircle(cx, cy, r);
      gfx.fillStyle(0x00cc55, 1);
      gfx.fillCircle(cx, cy, r - 3);
      // Highlight
      gfx.fillStyle(0x44ff88, 0.3);
      gfx.beginPath();
      gfx.arc(cx, cy - r * 0.3, r * 0.5, Math.PI, 0, false);
      gfx.fill();
    } else {
      // Dark/grey button
      gfx.fillStyle(0x222233, 1);
      gfx.fillCircle(cx, cy, r);
      gfx.fillStyle(0x3a3a4a, 1);
      gfx.fillCircle(cx, cy, r - 3);
      // Highlight
      gfx.fillStyle(0xffffff, 0.12);
      gfx.beginPath();
      gfx.arc(cx, cy - r * 0.3, r * 0.5, Math.PI, 0, false);
      gfx.fill();
    }

    // Icon
    const arm = r * 0.4;
    gfx.lineStyle(3.5, 0xffffff, 1);
    gfx.lineBetween(cx - arm, cy, cx + arm, cy);
    if (isPlus) gfx.lineBetween(cx, cy - arm, cx, cy + arm);

    this.container.add(gfx);
    return gfx;
  }
}
