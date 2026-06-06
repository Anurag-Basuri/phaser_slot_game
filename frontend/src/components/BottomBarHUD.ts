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
  pillsGfx!: Phaser.GameObjects.Graphics;

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

  private readonly COL_LABEL = '#ffddee';  // Bright candy pink for labels
  private readonly COL_VALUE = '#ffffff';
  private readonly COL_WIN = '#44ffaa';    // Vivid neon mint
  private readonly FONT_LABEL = Theme.fonts.label.family;
  private readonly FONT_VALUE = Theme.fonts.numeric.family;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create() {
    const isSocial = getStakeEngine().isSocialMode();

    const tLabel: Phaser.Types.GameObjects.Text.TextStyle = {
       fontFamily: this.FONT_LABEL, fontStyle: '600',
      color: this.COL_LABEL, letterSpacing: 1.5,
    };
    const tVal: Phaser.Types.GameObjects.Text.TextStyle = {
       fontFamily: this.FONT_VALUE, fontStyle: '700',
      color: this.COL_VALUE,
    };

    this.bar = this.scene.add.graphics().setDepth(45);
    this.pillsGfx = this.scene.add.graphics().setDepth(46);
    this.winPillGlow = this.scene.add.graphics().setDepth(47).setAlpha(0);

    this.txtMoneyLabel = this.scene.add.text(0, 0, T('BALANCE', isSocial), tLabel).setOrigin(0, 0.5).setDepth(50);
    this.txtMoney = this.scene.add.text(0, 0, '', tVal).setOrigin(1, 0.5).setDepth(50);

    this.txtBetLabel = this.scene.add.text(0, 0, T('BET', isSocial), tLabel).setOrigin(0, 0.5).setDepth(50);
    this.txtBet = this.scene.add.text(0, 0, '', tVal).setOrigin(1, 0.5).setDepth(50);

    this.txtLastWinLabel = this.scene.add.text(0, 0, T('LAST WIN', isSocial), tLabel).setOrigin(0, 0.5).setDepth(50);
    this.txtLastWin = this.scene.add.text(0, 0, '', { ...tVal, color: this.COL_WIN }).setOrigin(1, 0.5).setDepth(50);
    this.txtLastWin.setText(DisplayBalance({ amount: 0, currency: 'USD' }));

    this.winSymbolIcon = this.scene.add.sprite(0, 0, 'candy_0').setDepth(50).setVisible(false);

    this.demoLabel = this.scene.add.text(0, 0, '', {
       fontFamily: this.FONT_LABEL, fontStyle: '700', color: '#ff4466'
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

    // ── Backdrop ── (Solid rigid arcade panel — hyper-saturated)
    // Solid vivid purple base
    bb.fillGradientStyle(0x440088, 0x330077, 0x220055, 0x110033, 1, 1, 1, 1);
    bb.fillRect(0, h - barH, w, barH);

    // Thick candy-striped top border (rigid, not gradient)
    const stripeH = Math.max(4, barH * 0.06);
    const stripeY = h - barH;
    bb.fillStyle(0xff0070, 1);
    bb.fillRect(0, stripeY, w, stripeH);
    // Secondary highlight stripe
    bb.fillStyle(0xffdd00, 1);
    bb.fillRect(0, stripeY + stripeH, w, Math.max(2, stripeH * 0.5));

    // Hard glossy upper highlight (rigid, no soft gradient)
    bb.fillStyle(0xffffff, 0.12);
    bb.fillRect(0, stripeY + stripeH + 2, w, Math.max(2, barH * 0.08));

    // Bottom edge line for rigid framing
    bb.fillStyle(0x000000, 0.5);
    bb.fillRect(0, h - 2, w, 2);

    this._lastW = w;
    this._lastH = h;
    this._lastBarH = barH;
    this._lastIsMobile = isMobile;

    this.realignText();

    // Demo label — bottom right of the screen, just above the bottom bar
    if (this.demoLabel.text) {
      this.demoLabel
        .setPosition(w - 10, h - barH - 8)
        .setOrigin(1, 1)
        .setFontSize(14)
        .setAlpha(0.8)
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

    if (decreased) {
      this.txtMoney.setText(DisplayBalance({ amount: newBal, currency }));
      this.txtMoney.setColor('#ff4466').setScale(0.9);
      this.scene.tweens.add({
        targets: this.txtMoney, scaleX: 1, scaleY: 1,
        duration: 400, ease: 'Back.easeOut',
        onComplete: () => { this.txtMoney.setColor('#ffffff'); }
      });
    } else if (increased) {
      this.txtMoney.setColor('#44ff88').setScale(1.2);
      const counter = { val: oldBal };
      this.scene.tweens.add({
        targets: counter, val: newBal,
        duration: Math.min(1500, 300 + (newBal - oldBal) * 10),
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          this.txtMoney.setText(DisplayBalance({ amount: counter.val, currency }));
          this.realignText();
        },
        onComplete: () => {
          this.txtMoney.setText(DisplayBalance({ amount: newBal, currency }));
          this.realignText();
          this.txtMoney.setColor('#ffffff');
          this.scene.tweens.add({ targets: this.txtMoney, scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });
        }
      });
    } else {
      this.txtMoney.setText(DisplayBalance({ amount: newBal, currency }));
    }

    this.realignText();
  }

  updateBetDisplay(betPresetIndex: number, currency: string, anteBetEnabled: boolean) {
    if (getStakeEngine().isReplayMode()) {
      const params = new URLSearchParams(window.location.search);
      const amount = parseFloat(params.get('amount') || '1');
      const mode = params.get('mode') || 'BASE';
      const formattedBase = DisplayBalance({ amount, currency });
      const rData = getStakeEngine().getReplayData();
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
    // Extract current value from text to avoid resetting to 0 on subsequent cascades
    const currentText = this.txtLastWin.text.replace(/[^0-9.-]+/g, '');
    const currentVal = parseFloat(currentText) || 0;
    const counter = { val: currentVal };

    this._winCountTween = this.scene.tweens.add({
      targets: counter, val: target,
      duration: Math.min(2000, 300 + target * 10),
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.txtLastWin.setText(DisplayBalance({ amount: counter.val, currency }));
        this.realignText();
      },
      onStart: () => {
        this.txtLastWin.setColor('#ffffff');
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

  hideForReplay() {
    this.txtMoneyLabel.setVisible(false);
    this.txtMoney.setVisible(false);
    this.betPillHit.setVisible(false);
    if (this.demoLabel) this.demoLabel.setVisible(false);
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
    // Get natural dimensions for the center Bet pill first
    this.txtBetLabel.setFontSize(labelFS);
    this.txtBet.setFontSize(valFS);
    const betGap = isSmall ? 6 : 10;
    let betLblW = this.txtBetLabel.width * this.txtBetLabel.scaleX;
    let betValW = this.txtBet.width * this.txtBet.scaleX;
    let betTotalW = betLblW + betGap + betValW;
    const betPillW = Math.max(120, betTotalW + 40);

    const centerX = w / 2;
    // Calculate maximum available space for the side zones (Balance and Last Win)
    const sideZoneLimit = centerX - (betPillW / 2) - sidePad - (isSmall ? 4 : 16);
    
    const applyFit = (lbl: Phaser.GameObjects.Text, val: Phaser.GameObjects.Text, lblFS: number, vFS: number, gap: number, extraW: number = 0, limit: number) => {
      // First set the intended font sizes
      lbl.setFontSize(lblFS);
      val.setFontSize(vFS);
      const total = lbl.width + gap + val.width + extraW;
      if (total > limit) {
        const shrink = limit / total;
        lbl.setFontSize(Math.max(9, Math.round(lblFS * shrink)));
        val.setFontSize(Math.max(10, Math.round(vFS * shrink)));
      }
    };

    const balGap = isSmall ? 6 : 12;
    applyFit(this.txtMoneyLabel, this.txtMoney, labelFS, valFS, balGap, 0, sideZoneLimit);

    // If bet itself is too wide, restrict it
    const maxBetW = w * 0.4;
    if (betTotalW > maxBetW) {
      applyFit(this.txtBetLabel, this.txtBet, labelFS, valFS, betGap, 0, maxBetW);
      // Recalculate
      betLblW = this.txtBetLabel.width * this.txtBetLabel.scaleX;
      betValW = this.txtBet.width * this.txtBet.scaleX;
      betTotalW = betLblW + betGap + betValW;
    }

    const targetIconHeight = Math.max(14, barH * 0.45);
    const baseHeight = this.winSymbolIcon.height > 0 ? this.winSymbolIcon.height : 256;
    this._iconTargetScale = targetIconHeight / baseHeight;
    const iconOffset = this.winSymbolIcon.visible ? targetIconHeight + 8 : 0;
    const winGap = isSmall ? 8 : 16;
    applyFit(this.txtLastWinLabel, this.txtLastWin, labelFS, valFS, winGap, iconOffset, sideZoneLimit);

    // ── Zone 1: BALANCE (Far Left) ──
    this.txtMoneyLabel.setPosition(sidePad, txtY).setOrigin(0, 0.5);
    const balLblVisualW = this.txtMoneyLabel.width * this.txtMoneyLabel.scaleX;
    const balValVisualW = this.txtMoney.width * this.txtMoney.scaleX;
    this.txtMoney.setPosition(sidePad + balLblVisualW + balGap, txtY).setOrigin(0, 0.5);

    // ── Zone 3: WIN (Far Right) ──
    this.txtLastWin.setVisible(true).setPosition(w - sidePad, txtY).setOrigin(1, 0.5);
    const winValVisualW = this.txtLastWin.width * this.txtLastWin.scaleX;
    
    if (this.winSymbolIcon.visible) {
      this.winSymbolIcon.setPosition(w - sidePad - winValVisualW - 12, txtY).setScale(this._iconTargetScale);
    }
    
    const winLblVisualW = this.txtLastWinLabel.width * this.txtLastWinLabel.scaleX;
    this.txtLastWinLabel.setVisible(true)
      .setPosition(w - sidePad - winValVisualW - iconOffset - winGap, txtY)
      .setOrigin(1, 0.5);

    // ── Zone 2: BET (Center) ──
    this.txtBetLabel.setOrigin(1, 0.5);
    this.txtBet.setOrigin(0, 0.5);
    
    this.txtBetLabel.setPosition(centerX - betTotalW / 2 + betLblW, txtY);
    this.txtBet.setPosition(centerX - betTotalW / 2 + betLblW + betGap, txtY);
    this.betPillHit.setPosition(centerX, txtY).setSize(Math.max(120, betTotalW + 40), barH);

    // ── Draw Rigid Arcade Pill Panels Behind Text ──
    this.pillsGfx.clear();
    const pillH = barH * 0.68;
    const pillY = txtY - pillH / 2;
    const pillR = Math.min(pillH / 2, 10);
    
    const drawRigidPill = (px: number, py: number, pw: number, ph: number) => {
      // Dark smooth shadow underneath
      this.pillsGfx.fillStyle(0x000000, 0.5);
      this.pillsGfx.fillRoundedRect(px + 2, py + 4, pw, ph, pillR);
      
      // Premium dark gradient body
      this.pillsGfx.fillGradientStyle(0x1a0033, 0x1a0033, 0x0a0f1a, 0x0a0f1a, 0.95);
      this.pillsGfx.fillRoundedRect(px, py, pw, ph, pillR);
      
      // Crisp outer stroke (border)
      this.pillsGfx.lineStyle(2, 0x5533aa, 1);
      this.pillsGfx.strokeRoundedRect(px, py, pw, ph, pillR);
      
      // Gloss highlight
      this.pillsGfx.fillStyle(0xffffff, 0.08);
      this.pillsGfx.fillRoundedRect(px + 2, py + 1, pw - 4, ph * 0.35, { tl: pillR - 1, tr: pillR - 1, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);
    };

    // Bal Pill
    drawRigidPill(sidePad - 8, pillY, balLblVisualW + balGap + balValVisualW + 16, pillH);
    // Bet Pill
    drawRigidPill(centerX - betTotalW / 2 - 12, pillY, betTotalW + 24, pillH);
    // Win Pill
    drawRigidPill(w - sidePad - winValVisualW - iconOffset - winGap - winLblVisualW - 8, pillY, winLblVisualW + winGap + iconOffset + winValVisualW + 16, pillH);

    // Define win bounds for particle effect targeting
    this._winPillBounds = { x: w - sidePad - winValVisualW - 50, w: 100, y: h - barH, h: barH };
  }
}
