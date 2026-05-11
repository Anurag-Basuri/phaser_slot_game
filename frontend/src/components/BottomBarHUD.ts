import Phaser from 'phaser';
import { DisplayBalance } from '../helpers/Currency';
import { T } from '../helpers/I18n';
import { getStakeEngine } from '../engine';
import options, { BET_PRESETS } from '../options';

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

  private readonly COL_LABEL = '#ffaacc';  // Warm candy pink labels
  private readonly COL_VALUE = '#ffffff';
  private readonly COL_WIN = '#66ffaa';    // Bright candy mint
  private readonly FONT_LABEL = '"Outfit", "Inter", sans-serif';
  private readonly FONT_VALUE = '"Inter", "Arial", sans-serif';

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

    // ── Backdrop ── (Rich candy shelf gradient)
    // Base: deep cherry-to-plum gradient for candy-store warmth
    bb.fillGradientStyle(0x2a0833, 0x220828, 0x180420, 0x100318, 0.85, 0.85, 0.7, 0.7);
    bb.fillRect(0, h - barH, w, barH);

    // Candy stripe top edge (multicolor candy ribbon)
    const stripeH = 3;
    const stripeY = h - barH;
    const stripeSegments = Math.ceil(w / 24);
    const stripeColors = [0xff006a, 0xffcc00, 0x44ddff, 0xff66aa, 0x88ff44, 0xff8833];
    for (let i = 0; i < stripeSegments; i++) {
      const col = stripeColors[i % stripeColors.length];
      bb.fillStyle(col, 0.9);
      bb.fillRect(i * 24, stripeY, 24, stripeH);
    }

    // Warm pink glow beneath the stripe
    bb.fillGradientStyle(0xff3388, 0xff006a, 0x2a0833, 0x2a0833, 0.25, 0.25, 0, 0);
    bb.fillRect(0, stripeY + stripeH, w, 10);

    // Glass rim highlight
    bb.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.08, 0.08, 0, 0);
    bb.fillRect(0, stripeY + stripeH, w, 1);

    // Candy sprinkle dots on the backdrop (subtle but thematic)
    const sprinkleCount = Math.max(6, Math.floor(w / 60));
    for (let i = 0; i < sprinkleCount; i++) {
      const sx = (w / (sprinkleCount + 1)) * (i + 1) + ((i * 17) % 11 - 5);
      const sy = h - barH / 2 + ((i * 7) % 9 - 4);
      const sCol = stripeColors[(i * 3) % stripeColors.length];
      bb.fillStyle(sCol, 0.08);
      bb.fillCircle(sx, sy, 3 + (i % 3));
    }

    const txtY = h - barH / 2;
    const sidePad = isMobile ? 8 : 20;
    const labelFS = Math.max(8, Math.min(11, barH * 0.20));
    const valFS = Math.max(11, Math.min(18, barH * 0.34));
    const pillPad = isMobile ? 10 : 16;

    // ── Pill renderer (candy-themed with distinct accent per pill) ──
    const drawPill = (x: number, width: number, accent: number, accentDark: number) => {
      const py = h - barH + 5;
      const ph = barH - 10;
      const rad = ph / 2;

      // Drop shadow
      bb.fillStyle(0x000000, 0.4);
      bb.fillRoundedRect(x + 1, py + 2, width, ph, rad);

      // Body — deep candy glass with subtle accent tint
      bb.fillGradientStyle(accentDark, accentDark, 0x120820, 0x120820, 0.6, 0.6, 0.45, 0.45);
      bb.fillRoundedRect(x, py, width, ph, rad);

      // Candy glass sheen (top hemisphere highlight)
      bb.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.12, 0.12, 0, 0);
      bb.fillRoundedRect(x + 2, py + 1, width - 4, ph * 0.35, { tl: rad, tr: rad, bl: 0, br: 0 } as any);

      // Accent border (candy-colored rim with glow)
      bb.lineStyle(1.5, accent, 0.45);
      bb.strokeRoundedRect(x, py, width, ph, rad);

      // Inner glass rim
      bb.lineStyle(0.5, 0xffffff, 0.08);
      bb.strokeRoundedRect(x + 1, py + 1, width - 2, ph - 2, rad - 1);
    };

    // ── Calculate pill widths dynamically ──
    const gap = isMobile ? 5 : 10;
    const usableW = w - sidePad * 2 - gap * 2;

    // Uniform layout: all three pills share the available width equally
    const pillW = usableW / 3;
    const balW = pillW;
    const betW = pillW;
    const winW = pillW;
    
    // Abbreviate labels on small screens to save space
    const isSmall = w < 600;
    const isSocial = getStakeEngine().isSocialMode();
    this.txtMoneyLabel.setText(isSmall ? 'BAL' : T('BALANCE', isSocial));
    this.txtLastWinLabel.setText(isSmall ? 'WIN' : T('LAST WIN', isSocial));

    // Helper to prevent text overflow in pills
    const fitTextInPill = (label: Phaser.GameObjects.Text, value: Phaser.GameObjects.Text, availableWidth: number, iconWidth: number = 0) => {
      label.setScale(1);
      value.setScale(1);
      const totalContentW = label.width + value.width + iconWidth + 10; // 10px spacing
      if (totalContentW > availableWidth) {
        const scale = availableWidth / totalContentW;
        label.setScale(scale);
        value.setScale(scale);
      }
    };

    // ── Position pills (each with a distinct candy accent color) ──
    const balX = sidePad;
    drawPill(balX, balW, 0xff88bb, 0x2a0828);  // Pink candy accent for Balance
    this.txtMoneyLabel.setPosition(balX + pillPad, txtY).setFontSize(labelFS);
    this.txtMoney.setPosition(balX + balW - pillPad, txtY).setFontSize(valFS);
    fitTextInPill(this.txtMoneyLabel, this.txtMoney, balW - pillPad * 2);

    const betX = balX + balW + gap;
    drawPill(betX, betW, 0xffaa44, 0x2a1808);  // Golden candy accent for Bet
    this.txtBetLabel.setPosition(betX + pillPad, txtY).setFontSize(labelFS);
    this.txtBet.setPosition(betX + betW - pillPad, txtY).setFontSize(valFS);
    this.betPillHit.setPosition(betX + betW / 2, txtY).setSize(betW, barH - 4);
    fitTextInPill(this.txtBetLabel, this.txtBet, betW - pillPad * 2);

    const winX = betX + betW + gap;
    drawPill(winX, winW, 0x44ffaa, 0x082a18);  // Mint candy accent for Win
    this.txtLastWinLabel.setVisible(true).setPosition(winX + pillPad, txtY).setFontSize(labelFS);
    
    // Icon sits just to the left of the win value text
    // The pill height is barH - 10. We want the icon to fit comfortably inside it (about 75% of pill height).
    const targetIconHeight = Math.max(10, (barH - 10) * 0.8);
    const baseHeight = this.winSymbolIcon.height > 0 ? this.winSymbolIcon.height : 256;
    this._iconTargetScale = targetIconHeight / baseHeight;
    const expectedIconWidth = this.winSymbolIcon.visible ? targetIconHeight : 0; // Rough width

    // Position the win value and icon. If icon is visible, we shift the text.
    const winValX = winX + winW - pillPad;
    this.txtLastWin.setVisible(true).setPosition(winValX, txtY).setFontSize(valFS);
    
    fitTextInPill(this.txtLastWinLabel, this.txtLastWin, winW - pillPad * 2, expectedIconWidth + 18);
    
    this.winSymbolIcon.setPosition(winValX - (this.txtLastWin.width * this.txtLastWin.scaleX) - 18, txtY).setScale(this._iconTargetScale);

    this._winPillBounds = { x: winX, w: winW, y: h - barH + 5, h: barH - 10 };

    // Demo label — top of the bar, centered
    if (this.demoLabel.text) {
      this.demoLabel.setPosition(w / 2, h - barH - 10).setFontSize(Math.max(9, barH * 0.18));
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
    // Position sync
    this.winSymbolIcon.x = this.txtLastWin.x - (this.txtLastWin.width * this.txtLastWin.scaleX) - 18;
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
        // Keep icon position synced if text width changes
        if (this.winSymbolIcon.visible) {
          const winX = this._winPillBounds.x;
          const winW = this._winPillBounds.w;
          const pillPad = this.txtMoneyLabel.x - this.bar.x; // approximate padding
          this.winSymbolIcon.x = winX + winW - 16 - (this.txtLastWin.width * this.txtLastWin.scaleX) - 18;
        }
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
        this.txtLastWin.setColor(this.COL_WIN);
        this.scene.tweens.add({
          targets: this.txtLastWin,
          scaleX: 1.25, scaleY: 1.25,
          duration: 200, yoyo: true, ease: 'Back.easeOut',
        });
        // Show winning candy icon next to the final win value
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
}
