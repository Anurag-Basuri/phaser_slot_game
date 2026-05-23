import Phaser from 'phaser';
import { DisplayBalance } from '../helpers/Currency';
import { T } from '../helpers/I18n';
import { getStakeEngine } from '../engine';
import options, { BET_PRESETS } from '../options';
import { Theme } from '../constants/theme';

/**
 * BottomBarHUD — Industry-grade glassmorphic bottom bar.
 *
 * Guarantees:
 *  - Pills never exceed available width (dynamic shrink)
 *  - Font sizes adapt to bar height
 *  - Text is always legible (minimum sizes enforced)
 *  - No overlaps with spin controls
 */
export class BottomBarHUD {
  private scene: Phaser.Scene;

  // Graphics
  bar!: Phaser.GameObjects.Graphics;
  winPillGlow!: Phaser.GameObjects.Graphics;

  // Text elements
  txtMoneyLabel!: Phaser.GameObjects.Text;
  txtMoney!: Phaser.GameObjects.Text;
  txtBetLabel!: Phaser.GameObjects.Text;
  txtBet!: Phaser.GameObjects.Text;
  txtLastWinLabel!: Phaser.GameObjects.Text;
  txtLastWin!: Phaser.GameObjects.Text;
  winSymbolIcon!: Phaser.GameObjects.Sprite;
  demoLabel!: Phaser.GameObjects.Text;

  // Interactive
  private betPillHit!: Phaser.GameObjects.Rectangle;

  // State
  private _winPillBounds = { x: 0, w: 0, y: 0, h: 0 };
  private _prevMoney = -1;
  private _winCountTween: Phaser.Tweens.Tween | null = null;
  private _iconTargetScale = 0.2;
  
  // Layout State
  private _lastW = 0;
  private _lastH = 0;
  private _lastBarH = 0;
  private _lastIsMobile = false;

  private readonly COL_LABEL = '#bbbbcc';  // Premium subtle silver/gray for labels
  private readonly COL_VALUE = '#ffffff';
  private readonly COL_WIN = '#66ffaa';    // Bright candy mint
  private readonly FONT_LABEL = Theme.fonts.label.family;
  private readonly FONT_VALUE = Theme.fonts.numeric.family;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create() {
    const isSocial = getStakeEngine().isSocialMode();

    const tLabel: Phaser.Types.GameObjects.Text.TextStyle = {
      resolution: 2, fontFamily: this.FONT_LABEL, fontStyle: '600',
      color: this.COL_LABEL, letterSpacing: 1.5,
    };
    const tVal: Phaser.Types.GameObjects.Text.TextStyle = {
      resolution: 2, fontFamily: this.FONT_VALUE, fontStyle: '700',
      color: this.COL_VALUE,
    };

    this.bar = this.scene.add.graphics().setDepth(45);
    this.winPillGlow = this.scene.add.graphics().setDepth(46).setAlpha(0);

    this.txtMoneyLabel = this.scene.add.text(0, 0, T('BALANCE', isSocial), tLabel).setOrigin(0, 0.5).setDepth(50);
    this.txtMoney = this.scene.add.text(0, 0, '', tVal).setOrigin(1, 0.5).setDepth(50);

    this.txtBetLabel = this.scene.add.text(0, 0, T('BET', isSocial), tLabel).setOrigin(0, 0.5).setDepth(50);
    this.txtBet = this.scene.add.text(0, 0, '', tVal).setOrigin(1, 0.5).setDepth(50);

    this.txtLastWinLabel = this.scene.add.text(0, 0, T('LAST WIN', isSocial), tLabel).setOrigin(0, 0.5).setDepth(50);
    this.txtLastWin = this.scene.add.text(0, 0, '', { ...tVal, color: this.COL_WIN }).setOrigin(1, 0.5).setDepth(50);
    this.txtLastWin.setText(DisplayBalance({ amount: 0, currency: 'USD' }));

    this.winSymbolIcon = this.scene.add.sprite(0, 0, 'candy_0').setDepth(50).setVisible(false);

    this.demoLabel = this.scene.add.text(0, 0, '', {
      resolution: 2, fontFamily: this.FONT_LABEL, fontStyle: '700', color: '#ff4466'
    }).setOrigin(0.5, 0.5).setDepth(50).setAlpha(0.7);

    if (getStakeEngine().isDemoMode()) {
      this.demoLabel.setText('DEMO');
    }

    this.betPillHit = this.scene.add.rectangle(0, 0, 10, 10, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(51);
  }

  onBetTap(cb: () => void) { this.betPillHit.on('pointerdown', cb); }

  /** Responsive layout for the bottom bar */
  layout(w: number, h: number, barH: number, isStacked: boolean, isMobile: boolean) {
    this.bar.clear();
    const bb = this.bar;

    // ── Backdrop ── (Rich candy shelf gradient)
    // Base: deep cherry-to-plum gradient for candy-store warmth
    bb.fillGradientStyle(0x2a0833, 0x220828, 0x180420, 0x100318, 0.85, 0.85, 0.7, 0.7);
    bb.fillRect(0, h - barH, w, barH);

    // Smooth candy gradient top edge to prevent rendering artifacts
    const stripeH = 3;
    const stripeY = h - barH;
    bb.fillGradientStyle(0xff006a, 0x44ddff, 0xff006a, 0x44ddff, 1, 1, 1, 1);
    bb.fillRect(0, stripeY, w, stripeH);

    // Warm pink glow beneath the stripe
    bb.fillGradientStyle(0xff3388, 0xff006a, 0x2a0833, 0x2a0833, 0.25, 0.25, 0, 0);
    bb.fillRect(0, stripeY + stripeH, w, 10);

    // Glass rim highlight
    bb.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.08, 0.08, 0, 0);
    bb.fillRect(0, stripeY + stripeH, w, 1);

    // Candy sprinkle dots on the backdrop (subtle but thematic)
    const sprinkleCount = Math.max(6, Math.floor(w / 60));
    const stripeColors = [0xff006a, 0xffcc00, 0x44ddff, 0xff66aa, 0x88ff44, 0xff8833];
    for (let i = 0; i < sprinkleCount; i++) {
      const sx = (w / (sprinkleCount + 1)) * (i + 1) + ((i * 17) % 11 - 5);
      const sy = h - barH / 2 + ((i * 7) % 9 - 4);
      const sCol = stripeColors[(i * 3) % stripeColors.length];
      bb.fillStyle(sCol, 0.08);
      bb.fillCircle(sx, sy, 3 + (i % 3));
    }

    this._lastW = w;
    this._lastH = h;
    this._lastBarH = barH;
    this._lastIsMobile = isMobile;

    this.realignText();

    // Demo label — top right of the screen, unobtrusive
    if (this.demoLabel.text) {
      this.demoLabel
        .setPosition(w - 20, 20)
        .setOrigin(1, 0)
        .setFontSize(14)
        .setDepth(100);
    }
  }

  getWinPillBounds() { return this._winPillBounds; }

  // ───── Reactive Animations ─────

  updateMoneyDisplay(newBal: number, currency: string) {
    const oldBal = this._prevMoney;
    const decreased = oldBal >= 0 && newBal < oldBal;
    const increased = oldBal >= 0 && newBal > oldBal;
    this._prevMoney = newBal;

    this.txtMoney.setText(DisplayBalance({ amount: newBal, currency }));
    this.scene.tweens.killTweensOf(this.txtMoney);

    if (decreased) {
      this.txtMoney.setColor('#ff4466').setScale(0.9);
      this.scene.tweens.add({
        targets: this.txtMoney, scaleX: 1, scaleY: 1,
        duration: 400, ease: 'Back.easeOut',
        onComplete: () => { this.txtMoney.setColor('#ffffff'); }
      });
    } else if (increased) {
      this.txtMoney.setColor('#44ff88').setScale(1.2);
      this.scene.tweens.add({
        targets: this.txtMoney, scaleX: 1, scaleY: 1,
        duration: 450, ease: 'Back.easeOut',
        onComplete: () => { this.txtMoney.setColor('#ffffff'); }
      });
    }

    this.realignText();
  }

  updateBetDisplay(betPresetIndex: number, currency: string, anteBetEnabled: boolean) {
    if (getStakeEngine().isReplayMode()) {
      const params = new URLSearchParams(window.location.search);
      const amount = parseFloat(params.get('amount') || '1');
      const mode = params.get('mode') || 'BASE';
      const formattedBase = DisplayBalance({ amount, currency });
      const rData = (getStakeEngine() as any).replayData;
      if (rData && rData.costMultiplier > 1) {
        const effective = amount * rData.costMultiplier;
        const formattedEffective = DisplayBalance({ amount: effective, currency });
        this.txtBet.setText(`${mode} ${formattedBase}, ${formattedEffective} REAL COST`).setFontSize(12);
      } else {
        this.txtBet.setText(formattedBase);
      }
      return;
    }

    const baseBet = BET_PRESETS[betPresetIndex];
    const costMult = anteBetEnabled ? options.anteBetCostMultiplier : 1;
    const effectiveBet = baseBet * costMult;
    const formatted = DisplayBalance({ amount: effectiveBet, currency });

    if (anteBetEnabled) {
      const formattedBase = DisplayBalance({ amount: baseBet, currency });
      // Keep the same font styling as the rest of the bar, don't force a hard-coded font size
      this.txtBet.setText(`${formattedBase} (${formatted})`);
    } else {
      this.txtBet.setText(formatted);
    }
    
    this.realignText();
  }

  setWinSymbol(key?: string) {
    if (!key) {
      this.winSymbolIcon.setVisible(false);
      return;
    }
    this.winSymbolIcon.setTexture(key).setVisible(true).setScale(0);
    this.scene.tweens.add({
      targets: this.winSymbolIcon,
      scale: this._iconTargetScale,
      duration: 350,
      ease: 'Back.easeOut'
    });
    
    this.realignText();
  }

  updateLastWinDisplay(target: number, currency: string, betAmount: number, symbolKey?: string) {
    if (this._winCountTween) { this._winCountTween.stop(); }
    this.scene.tweens.killTweensOf([this.txtLastWin, this.txtLastWinLabel]);
    this.txtLastWin.setScale(1);
    this.txtLastWinLabel.setScale(1);
    this.winPillGlow.clear().setAlpha(0);

    if (target <= 0) {
      this.txtLastWin.setText(DisplayBalance({ amount: 0, currency })).setColor(this.COL_WIN);
      return;
    }

    const isBigWin = target >= betAmount * 10;
    const b = this._winPillBounds;
    const counter = { val: 0 };

    this._winCountTween = this.scene.tweens.add({
      targets: counter, val: target,
      duration: Math.min(2000, 300 + target * 10),
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.txtLastWin.setText(DisplayBalance({ amount: counter.val, currency }));
        this.realignText();
      },
      onStart: () => {
        this.scene.tweens.add({
          targets: [this.txtLastWin, this.txtLastWinLabel],
          scaleX: 1.06, scaleY: 1.06,
          duration: 200, yoyo: true, repeat: 3, ease: 'Sine.easeInOut',
        });
      },
      onComplete: () => {
        this.txtLastWin.setText(DisplayBalance({ amount: target, currency }));
        this.realignText();
        this.txtLastWin.setColor(this.COL_WIN);
        this.scene.tweens.add({
          targets: this.txtLastWin,
          scaleX: 1.25, scaleY: 1.25,
          duration: 200, yoyo: true, ease: 'Back.easeOut',
        });
        if (symbolKey) {
          this.winSymbolIcon.setTexture(symbolKey).setVisible(true).setScale(0);
          this.scene.tweens.add({
            targets: this.winSymbolIcon,
            scale: this._iconTargetScale,
            duration: 300,
            ease: 'Back.easeOut'
          });
          this.winSymbolIcon.x = this.txtLastWin.x - (this.txtLastWin.width * this.txtLastWin.scaleX) - 18;
        }
      }
    });

    if (isBigWin && b.w > 0) {
      this.winPillGlow.clear();
      this.winPillGlow.fillStyle(0xffaa00, 0.20);
      this.winPillGlow.fillRoundedRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, b.h / 2 + 4);
      this.scene.tweens.add({
        targets: this.winPillGlow,
        alpha: { from: 0, to: 0.6 },
        duration: 500, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
        onComplete: () => { this.winPillGlow.setAlpha(0); }
      });
      this.txtLastWin.setColor('#ffe600');
    }
  }

  hideAll() {
    this.txtMoneyLabel.setVisible(false);
    this.txtMoney.setVisible(false);
    this.txtBetLabel.setVisible(false);
    this.txtBet.setVisible(false);
    this.betPillHit.setVisible(false);
  }

  private realignText() {
    if (this._lastW === 0) return; // Not laid out yet

    const w = this._lastW;
    const h = this._lastH;
    const barH = this._lastBarH;
    const isMobile = this._lastIsMobile;

    const txtY = h - barH / 2;
    const sidePad = isMobile ? 12 : 24;
    const labelFS = Math.max(9, Math.min(13, barH * 0.28));
    const valFS = Math.max(12, Math.min(18, barH * 0.42));
    
    const isSmall = w < 600;
    const isSocial = getStakeEngine().isSocialMode();
    this.txtMoneyLabel.setText(isSmall ? 'BAL' : T('BALANCE', isSocial));
    this.txtLastWinLabel.setText(isSmall ? 'WIN' : T('LAST WIN', isSocial));

    // Reset scales in case they were shrunken previously
    this.txtMoneyLabel.setScale(1);
    this.txtMoney.setScale(1);
    this.txtBetLabel.setScale(1);
    this.txtBet.setScale(1);
    this.txtLastWinLabel.setScale(1);
    this.txtLastWin.setScale(1);

    // ── Pre-calculate text sizing to prevent overlap ──
    const zoneLimit = (w - sidePad * 2) / 3 - (isSmall ? 2 : 10);
    
    const applyFit = (lbl: Phaser.GameObjects.Text, val: Phaser.GameObjects.Text, lblFS: number, vFS: number, gap: number, extraW: number = 0) => {
      // First set the intended font sizes
      lbl.setFontSize(lblFS);
      val.setFontSize(vFS);
      const total = lbl.width + gap + val.width + extraW;
      if (total > zoneLimit) {
        const shrink = zoneLimit / total;
        lbl.setFontSize(Math.max(7, Math.round(lblFS * shrink)));
        val.setFontSize(Math.max(9, Math.round(vFS * shrink)));
      }
    };

    const balGap = isSmall ? 6 : 12;
    applyFit(this.txtMoneyLabel, this.txtMoney, labelFS, valFS, balGap);

    const betGap = isSmall ? 6 : 10;
    applyFit(this.txtBetLabel, this.txtBet, labelFS, valFS, betGap);

    const targetIconHeight = Math.max(14, barH * 0.45);
    const baseHeight = this.winSymbolIcon.height > 0 ? this.winSymbolIcon.height : 256;
    this._iconTargetScale = targetIconHeight / baseHeight;
    const iconOffset = this.winSymbolIcon.visible ? targetIconHeight + 8 : 0;
    const winGap = isSmall ? 8 : 16;
    applyFit(this.txtLastWinLabel, this.txtLastWin, labelFS, valFS, winGap, iconOffset);

    // ── Zone 1: BALANCE (Far Left) ──
    this.txtMoneyLabel.setPosition(sidePad, txtY).setOrigin(0, 0.5);
    const balLblVisualW = this.txtMoneyLabel.width;
    this.txtMoney.setPosition(sidePad + balLblVisualW + balGap, txtY).setOrigin(0, 0.5);

    // ── Zone 3: WIN (Far Right) ──
    this.txtLastWin.setVisible(true).setPosition(w - sidePad, txtY).setOrigin(1, 0.5);
    const winValVisualW = this.txtLastWin.width;
    
    if (this.winSymbolIcon.visible) {
      this.winSymbolIcon.setPosition(w - sidePad - winValVisualW - 12, txtY).setScale(this._iconTargetScale);
    }
    
    this.txtLastWinLabel.setVisible(true)
      .setPosition(w - sidePad - winValVisualW - iconOffset - winGap, txtY)
      .setOrigin(1, 0.5);

    // ── Zone 2: BET (Center) ──
    const centerX = w / 2;
    this.txtBetLabel.setOrigin(1, 0.5);
    this.txtBet.setOrigin(0, 0.5);
    
    const betLblW = this.txtBetLabel.width;
    const betValW = this.txtBet.width;
    const betTotalW = betLblW + betGap + betValW;
    
    this.txtBetLabel.setPosition(centerX - betTotalW / 2 + betLblW, txtY);
    this.txtBet.setPosition(centerX - betTotalW / 2 + betLblW + betGap, txtY);
    this.betPillHit.setPosition(centerX, txtY).setSize(Math.max(120, betTotalW + 40), barH);

    // Define win bounds for particle effect targeting
    this._winPillBounds = { x: w - sidePad - winValVisualW - 50, w: 100, y: h - barH, h: barH };
  }
}
