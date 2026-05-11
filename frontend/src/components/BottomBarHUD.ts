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
  demoLabel!: Phaser.GameObjects.Text;

  // Interactive
  private betPillHit!: Phaser.GameObjects.Rectangle;

  // State
  private _winPillBounds = { x: 0, w: 0, y: 0, h: 0 };
  private _prevMoney = -1;
  private _winCountTween: Phaser.Tweens.Tween | null = null;

  private readonly COL_LABEL = '#bb88cc';
  private readonly COL_VALUE = '#ffffff';
  private readonly COL_WIN = '#44ff88';
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

    // ── Backdrop ──
    // Glassmorphic candy panel — semi-transparent so background bleeds through
    bb.fillGradientStyle(0x1a0a28, 0x1a0a28, 0x0d0515, 0x0d0515, 0.65, 0.65, 0.45, 0.45);
    bb.fillRect(0, h - barH, w, barH);

    // Top accent line (candy-pink gradient)
    bb.fillGradientStyle(0xff88bb, 0xff006a, 0xcc0055, 0xff88bb, 1);
    bb.fillRect(0, h - barH, w, 2);

    // Subtle glow beneath line
    bb.fillGradientStyle(0xff006a, 0xff006a, 0x1a0a28, 0x1a0a28, 0.18, 0.18, 0, 0);
    bb.fillRect(0, h - barH + 2, w, 8);

    // Inner highlight line (subtle glass rim)
    bb.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.06, 0.06, 0, 0);
    bb.fillRect(0, h - barH + 2, w, 1);

    const txtY = h - barH / 2;
    const sidePad = isMobile ? 8 : 20;
    const labelFS = Math.max(8, Math.min(11, barH * 0.20));
    const valFS = Math.max(11, Math.min(18, barH * 0.34));
    const pillPad = isMobile ? 10 : 16;

    // ── Pill renderer ──
    const drawPill = (x: number, width: number, accent = 0xff006a) => {
      const py = h - barH + 5;
      const ph = barH - 10;
      const rad = ph / 2;

      // Shadow
      bb.fillStyle(0x000000, 0.35);
      bb.fillRoundedRect(x + 1, py + 2, width, ph, rad);

      // Body — translucent deep plum (candy-glass)
      bb.fillGradientStyle(0x1a0a28, 0x1a0a28, 0x120820, 0x120820, 0.5);
      bb.fillRoundedRect(x, py, width, ph, rad);

      // Top glass sheen
      bb.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.08, 0.08, 0, 0);
      bb.fillRoundedRect(x + 2, py + 1, width - 4, ph * 0.35, { tl: rad, tr: rad, bl: 0, br: 0 } as any);

      // Accent border (candy-colored rim)
      bb.lineStyle(1.5, accent, 0.3);
      bb.strokeRoundedRect(x, py, width, ph, rad);

      // Inner rim
      bb.lineStyle(0.5, 0xffffff, 0.06);
      bb.strokeRoundedRect(x + 1, py + 1, width - 2, ph - 2, rad - 1);
    };

    // ── Calculate pill widths dynamically ──
    const gap = isMobile ? 5 : 10;
    const usableW = w - sidePad * 2 - gap * 2;

    // Uniform layout: all three pills share the available width equally.
    // This strictly prevents "jumping" sizes and ensures a premium, symmetrical look.
    const pillW = usableW / 3;
    const balW = pillW;
    const betW = pillW;
    const winW = pillW;

    // ── Position pills ──
    const balX = sidePad;
    drawPill(balX, balW);
    this.txtMoneyLabel.setPosition(balX + pillPad, txtY).setFontSize(labelFS);
    this.txtMoney.setPosition(balX + balW - pillPad, txtY).setFontSize(valFS);

    const betX = balX + balW + gap;
    drawPill(betX, betW);
    this.txtBetLabel.setPosition(betX + pillPad, txtY).setFontSize(labelFS);
    this.txtBet.setPosition(betX + betW - pillPad, txtY).setFontSize(valFS);
    this.betPillHit.setPosition(betX + betW / 2, txtY).setSize(betW, barH - 4);

    const winX = betX + betW + gap;
    drawPill(winX, winW, 0x44ff88);
    this.txtLastWinLabel.setVisible(true).setPosition(winX + pillPad, txtY).setFontSize(labelFS);
    this.txtLastWin.setVisible(true).setPosition(winX + winW - pillPad, txtY).setFontSize(valFS);

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

  updateLastWinDisplay(target: number, currency: string, betAmount: number) {
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
