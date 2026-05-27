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
    const pH = 340;
    const pX = (w - pW) / 2;
    const pY = (h - pH) / 2 - (isMobile ? 10 : 0);
    const rad = 18;

    const panel = this.scene.add.graphics();
    // Thick shadow
    panel.fillStyle(0x000000, 0.65);
    panel.fillRoundedRect(pX + 3, pY + 5, pW, pH, rad);
    // Body — solid dark
    panel.fillStyle(0x12121a, 1);
    panel.fillRoundedRect(pX, pY, pW, pH, rad);
    // Subtle border
    panel.lineStyle(2, 0x2a2a3a, 1);
    panel.strokeRoundedRect(pX, pY, pW, pH, rad);
    // Prevent clicks passing through
    panel.setInteractive(new Phaser.Geom.Rectangle(pX, pY, pW, pH), Phaser.Geom.Rectangle.Contains);
    this.container.add(panel);

    // ── Close (✕) ──
    const closeBtn = this.scene.add.text(pX + pW - 28, pY + 25, '✕', {
       fontSize: '20px', color: '#666', fontFamily: '"Poppins", sans-serif', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      this.scene.audio.playSound('button');
      this.hide();
    });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff006a'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#666'));
    this.container.add(closeBtn);

    // ── Title: BET MULTIPLIER Nx ──
    const level = this.betIndex + 1;
    this.txtMultiplier = this.scene.add.text(pX + pW / 2 - 8, pY + 25, `BET MULTIPLIER ${level}x`, {
      
      fontFamily: '"Poppins", sans-serif',
      fontSize: '16px', color: '#ffffff', fontStyle: '800',
      letterSpacing: 1.5,
    }).setOrigin(0.5);
    this.container.add(this.txtMultiplier);

    // ── Thin separator under title ──
    const sep1 = this.scene.add.graphics();
    sep1.lineStyle(1, 0x2a2a3a, 0.7);
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
    const maxW = pW * 0.5;
    const maxH = 44;
    const maxX = pX + (pW - maxW) / 2;
    const maxY = totalRowY + rowH + 30;

    const maxGfx = this.scene.add.graphics();
    // Shadow
    maxGfx.fillStyle(0x005522, 1);
    maxGfx.fillRoundedRect(maxX, maxY + 3, maxW, maxH, 10);
    // Body
    maxGfx.fillStyle(0x00b84a, 1);
    maxGfx.fillRoundedRect(maxX, maxY, maxW, maxH, 10);
    // Glass
    maxGfx.fillStyle(0xffffff, 0.18);
    maxGfx.fillRoundedRect(maxX + 3, maxY + 2, maxW - 6, maxH * 0.38, { tl: 8, tr: 8, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);
    this.container.add(maxGfx);

    const maxHit = this.scene.add.rectangle(maxX + maxW / 2, maxY + maxH / 2, maxW, maxH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    maxHit.on('pointerdown', () => { 
      this.scene.audio.playSound('button');
      this.betIndex = BET_PRESETS.length - 1; 
      this.emitChange(); 
    });
    maxHit.on('pointerover', () => { this.scene.tweens.add({ targets: maxGfx, scaleX: 1.03, scaleY: 1.03, duration: 100 }); });
    maxHit.on('pointerout', () => { this.scene.tweens.add({ targets: maxGfx, scaleX: 1, scaleY: 1, duration: 100 }); });
    this.container.add(maxHit);

    this.container.add(this.scene.add.text(maxX + maxW / 2, maxY + maxH / 2, 'BET MAX', {
       fontFamily: '"Poppins", sans-serif',
      fontSize: '18px', color: '#ffffff', fontStyle: '800',
    }).setOrigin(0.5));

    // Set initial values
    this.refreshValues();
  }

  // ── Build a section label ──
  private buildLabel(cx: number, cy: number, text: string) {
    this.container.add(this.scene.add.text(cx, cy, text, {
       fontFamily: '"Poppins", sans-serif',
      fontSize: '13px', color: '#889', fontStyle: '700',
      letterSpacing: 2.5,
    }).setOrigin(0.5));
  }

  // ── Build a value row: [−] [ value ] [+] ──
  private buildValueRow(
    pX: number, rowY: number, pW: number, rowH: number, pad: number, btnR: number
  ): { txt: Phaser.GameObjects.Text; minusGfx: Phaser.GameObjects.Graphics; plusGfx: Phaser.GameObjects.Graphics } {
    const btnDiameter = btnR * 2;
    const fieldW = pW - pad * 2 - btnDiameter * 2 - 24;
    const fieldX = pX + pad + btnDiameter + 12;

    // Value field — dark recessed rectangle
    const field = this.scene.add.graphics();
    field.fillStyle(0x0b0b14, 1);
    field.fillRoundedRect(fieldX, rowY, fieldW, rowH, 12);
    field.lineStyle(1.5, 0x222233, 1);
    field.strokeRoundedRect(fieldX, rowY, fieldW, rowH, 12);
    this.container.add(field);

    const txt = this.scene.add.text(fieldX + fieldW / 2, rowY + rowH / 2, '', {
       fontFamily: '"Poppins", sans-serif',
      fontSize: '22px', color: '#ffffff', fontStyle: '700',
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
      // Green circle
      gfx.fillStyle(0x007733, 1);
      gfx.fillCircle(cx, cy + 2, r); // subtle shadow
      gfx.fillStyle(0x00b84a, 1);
      gfx.fillCircle(cx, cy, r);
      gfx.fillStyle(0x33dd77, 0.25);
      gfx.beginPath();
      gfx.arc(cx, cy - r * 0.28, r * 0.55, Math.PI, 0, false);
      gfx.fill();
    } else {
      // Dark/slate circle
      gfx.fillStyle(0x111118, 1);
      gfx.fillCircle(cx, cy + 2, r);
      gfx.fillStyle(0x2a2a38, 1);
      gfx.fillCircle(cx, cy, r);
      gfx.lineStyle(1.5, 0x3a3a4a, 1);
      gfx.strokeCircle(cx, cy, r);
      gfx.fillStyle(0xffffff, 0.08);
      gfx.beginPath();
      gfx.arc(cx, cy - r * 0.28, r * 0.55, Math.PI, 0, false);
      gfx.fill();
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
