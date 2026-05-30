import Phaser from 'phaser';
import { Theme } from '../constants/theme';
import { LayoutMetrics } from '../constants/LayoutEngine';

/**
 * SpinControls — Industry-grade spin button, bet +/- buttons, and autoplay toggle.
 *
 * Design:
 *  - Spin button: layered candy-pink gradient with gold/chrome ring, glossy hemisphere
 *  - Bet +/- buttons: positioned vertically above/below spin in stacked mode (no overlap)
 *  - Autoplay: sleek pill beneath spin
 *  - All buttons never overlap bottom bar pills
 */
export class SpinControls {
  private scene: Phaser.Scene;

  // Spin button
  spinOuterRing!: Phaser.GameObjects.Graphics;
  spinInnerPulse!: Phaser.GameObjects.Graphics;
  spinGfx!: Phaser.GameObjects.Graphics;
  spinHit!: Phaser.GameObjects.Rectangle;
  spinLabel!: Phaser.GameObjects.Text;

  // Bet +/- buttons
  betMinusGfx!: Phaser.GameObjects.Graphics;
  betMinusHit!: Phaser.GameObjects.Rectangle;
  betPlusGfx!: Phaser.GameObjects.Graphics;
  betPlusHit!: Phaser.GameObjects.Rectangle;

  // Autoplay button
  autoGfx!: Phaser.GameObjects.Graphics;
  autoHit!: Phaser.GameObjects.Rectangle;
  autoTxt!: Phaser.GameObjects.Text;

  // Cached last layout
  private _lastSpinX = 0;
  private _lastSpinY = 0;
  private _lastSpinSize = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create() {
    this.spinOuterRing = this.scene.add.graphics().setDepth(19);
    this.spinInnerPulse = this.scene.add.graphics().setDepth(20);
    this.spinGfx = this.scene.add.graphics().setDepth(20);

    // Continuous premium idle animations
    this.scene.tweens.add({
      targets: this.spinInnerPulse,
      alpha: { from: 0.1, to: 0.5 },
      yoyo: true,
      duration: 1200,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this.spinHit = this.scene.add.rectangle(0, 0, 150, 150, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(21);
    this.spinLabel = this.scene.add.text(0, 0, '', {
      
      fontFamily: Theme.fonts.label.family,
      fontStyle: '700',
    }).setOrigin(0.5).setDepth(21);

    this.betMinusGfx = this.scene.add.graphics().setDepth(20);
    this.betMinusHit = this.scene.add.rectangle(0, 0, 44, 44)
      .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(21);
    this.betPlusGfx = this.scene.add.graphics().setDepth(20);
    this.betPlusHit = this.scene.add.rectangle(0, 0, 44, 44)
      .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(21);

    // Setup interactive hover/press states for tactile arcade feedback
    this.setupTactileFeedback(this.betMinusGfx, this.betMinusHit);
    this.setupTactileFeedback(this.betPlusGfx, this.betPlusHit);
    this.setupTactileFeedback(this.spinGfx, this.spinHit);

    this.autoGfx = this.scene.add.graphics().setDepth(21);
    this.autoHit = this.scene.add.rectangle(0, 0, 100, 30, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(22);
    this.autoTxt = this.scene.add.text(0, 0, 'AUTO', {
      
      fontFamily: Theme.fonts.body.family,
      fontStyle: '800',
      color: '#ffffff',
      shadow: { offsetX: 0, offsetY: 1, color: '#000000', blur: 2, fill: true }
    }).setOrigin(0.5).setDepth(23);

    // Autoplay also gets tactile feedback
    this.setupTactileFeedback(this.autoGfx, this.autoHit);
  }

  /**
   * Binds high-fidelity micro-animations for hover scaling and active pressing click effects
   */
  private setupTactileFeedback(gfx: Phaser.GameObjects.Graphics, hit: Phaser.GameObjects.Rectangle) {
    hit.on('pointerover', () => {
      this.scene.tweens.killTweensOf([gfx, hit]);
      this.scene.tweens.add({
        targets: [gfx, hit],
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 100,
        ease: 'Quad.easeOut'
      });
    });

    hit.on('pointerout', () => {
      this.scene.tweens.killTweensOf([gfx, hit]);
      this.scene.tweens.add({
        targets: [gfx, hit],
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 100,
        ease: 'Quad.easeOut'
      });
    });

    hit.on('pointerdown', () => {
      this.scene.tweens.killTweensOf([gfx, hit]);
      this.scene.tweens.add({
        targets: [gfx, hit],
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 50,
        ease: 'Quad.easeOut'
      });
    });

    hit.on('pointerup', () => {
      this.scene.tweens.killTweensOf([gfx, hit]);
      this.scene.tweens.add({
        targets: [gfx, hit],
        scaleX: 1.1, // return to hover scale
        scaleY: 1.1,
        duration: 80,
        ease: 'Quad.easeOut'
      });
    });
  }

  onSpin(cb: () => void) { this.spinHit.on('pointerdown', cb); }
  onBetMinus(cb: () => void) { this.betMinusHit.on('pointerdown', cb); }
  onBetPlus(cb: () => void) { this.betPlusHit.on('pointerdown', cb); }
  onAutoPlay(cb: () => void) { this.autoHit.on('pointerdown', cb); }

  /**
   * Responsive layout — uses pre-computed LayoutMetrics from the unified LayoutEngine.
   * All sizes are ratios of gridSize, guaranteeing proportional scaling.
   */
  layout(metrics: LayoutMetrics) {
    const { spinX, spinY, spinSize, betBtnSize, autoPillW, autoPillH, autoGap, autoY, w, mode } = metrics;

    this._lastSpinX = spinX;
    this._lastSpinY = spinY;
    this._lastSpinSize = spinSize;

    // ── Spin button ──
    this.spinHit.setPosition(spinX, spinY).setSize(spinSize * 1.3, spinSize * 1.3);
    this.spinGfx.setPosition(spinX, spinY);
    this.spinOuterRing.setPosition(spinX, spinY);
    this.spinInnerPulse.setPosition(spinX, spinY);
    this.drawSpinButton(0, 0, spinSize);

    // Scale spin label proportionally to button size
    const spinLabelFS = Math.max(10, Math.min(18, spinSize * 0.18));
    this.spinLabel.setFontSize(spinLabelFS);

    // ── AutoPlay pill ──
    const autoFS = Math.max(9, Math.min(14, spinSize * 0.15));
    this.autoHit.setVisible(true).setPosition(spinX, autoY).setSize(autoPillW, autoPillH);
    this.autoTxt.setVisible(true).setPosition(spinX, autoY).setFontSize(autoFS);
    this.autoGfx.setVisible(true);

    // ── Bet +/- buttons — always spinSize × 0.45, flanking the spin ──
    const bBtnSize = betBtnSize;
    const isPortrait = mode === 'portrait';

    if (isPortrait) {
      // Portrait: +/- flanking spin horizontally
      const betBtnOffset = spinSize / 2 + bBtnSize / 2 + Math.max(16, w * 0.05);
      const minusX = spinX - betBtnOffset;
      const plusX = spinX + betBtnOffset;

      this.betMinusHit.setPosition(minusX, spinY).setSize(bBtnSize * 1.4, bBtnSize * 1.4);
      this.drawBetButton(this.betMinusGfx, minusX, spinY, bBtnSize, false);
      this.betPlusHit.setPosition(plusX, spinY).setSize(bBtnSize * 1.4, bBtnSize * 1.4);
      this.drawBetButton(this.betPlusGfx, plusX, spinY, bBtnSize, true);
    } else {
      // Landscape: left & right of spin button
      const betBtnOffset = spinSize / 2 + bBtnSize / 2 + 14;
      const minusX = Math.max(bBtnSize + 4, spinX - betBtnOffset);
      const plusX = Math.min(w - bBtnSize - 4, spinX + betBtnOffset);
      this.betMinusHit.setPosition(minusX, spinY).setSize(bBtnSize * 1.4, bBtnSize * 1.4);
      this.drawBetButton(this.betMinusGfx, minusX, spinY, bBtnSize, false);
      this.betPlusHit.setPosition(plusX, spinY).setSize(bBtnSize * 1.4, bBtnSize * 1.4);
      this.drawBetButton(this.betPlusGfx, plusX, spinY, bBtnSize, true);
    }

    return { spinX, spinY, spinSize };
  }

  /** Draw the premium procedural spin button */
  drawSpinButton(x: number, y: number, size: number) {
    const g = this.spinGfx;
    g.clear();
    this.spinOuterRing.clear();
    this.spinInnerPulse.clear();

    const r = size / 2;

    // ── Pulsing Inner Glow ──
    this.spinInnerPulse.fillGradientStyle(0x00e676, 0x00e676, 0x00cc66, 0x00cc66, 0.8, 0.8, 0, 0);
    this.spinInnerPulse.fillCircle(x, y, r + 18);

    // ── Massive Gummy Spin Button ──
    // 1. Drop shadow (thick, comic style)
    g.fillStyle(0x003311, 0.7);
    g.fillCircle(x + 4, y + 6, r + 2);

    // 2. Thick bright border (mint green)
    g.lineStyle(6, 0x00ff88, 1);
    g.strokeCircle(x, y, r);

    // 3. Candy Gradient Body (Green)
    g.fillGradientStyle(0x33ff99, 0x00e676, 0x00cc66, 0x00994d, 1);
    g.fillCircle(x, y, r);

    // 4. Glass highlight (top crescent)
    g.beginPath();
    g.arc(x - 4, y - 4, r * 0.8, Math.PI * 0.65, Math.PI * 1.85, false);
    g.arc(x - 1, y - 1, r * 0.8, Math.PI * 1.85, Math.PI * 0.65, true);
    g.closePath();
    g.fillStyle(0xffffff, 0.4);
    g.fillPath();

    // ── Play Triangle Icon ──
    const triSize = r * 0.7; // Large icon
    const triX = x + triSize * 0.2;
    
    // Inset Shadow
    g.fillStyle(0x3a0055, 0.6);
    g.beginPath();
    g.moveTo(triX - triSize * 0.5, y - triSize * 0.6 + 6);
    g.lineTo(triX + triSize * 0.65, y + 6);
    g.lineTo(triX - triSize * 0.5, y + triSize * 0.6 + 6);
    g.closePath();
    g.fillPath();

    // Crisp White Face
    g.fillStyle(0xffffff, 1.0);
    g.beginPath();
    g.moveTo(triX - triSize * 0.5, y - triSize * 0.6);
    g.lineTo(triX + triSize * 0.65, y);
    g.lineTo(triX - triSize * 0.5, y + triSize * 0.6);
    g.closePath();
    g.fillPath();
  }

  /** Draw the STOP button (visually replaces spin during active spin) */
  drawStopButton(x: number, y: number, size: number) {
    const g = this.spinGfx;
    g.clear();
    this.spinOuterRing.clear();
    this.spinInnerPulse.clear();

    const r = size / 2;

    // 1. Drop shadow
    g.fillStyle(0x3a0055, 0.7);
    g.fillCircle(x + 4, y + 6, r + 2);

    // 2. Thick bright border (orange/red)
    g.lineStyle(6, 0xff5500, 1);
    g.strokeCircle(x, y, r);

    // 3. Candy Gradient Body (Red/Orange)
    g.fillGradientStyle(0xff5500, 0xff2200, 0xee1100, 0xcc0000, 1);
    g.fillCircle(x, y, r);

    // 4. Glass highlight (top crescent)
    g.beginPath();
    g.arc(x - 4, y - 4, r * 0.8, Math.PI * 0.65, Math.PI * 1.85, false);
    g.arc(x - 1, y - 1, r * 0.8, Math.PI * 1.85, Math.PI * 0.65, true);
    g.closePath();
    g.fillStyle(0xffffff, 0.4);
    g.fillPath();

    // White square STOP icon
    const sqSize = r * 0.5;

    // Square shadow
    g.fillStyle(0x3a0055, 0.6);
    g.fillRoundedRect(x - sqSize / 2, y - sqSize / 2 + 5, sqSize, sqSize, 6);

    // Square body
    g.fillStyle(0xffffff, 1.0);
    g.fillRoundedRect(x - sqSize / 2, y - sqSize / 2, sqSize, sqSize, 6);
  }

  /** Draw a bet +/- button */
  drawBetButton(gfx: Phaser.GameObjects.Graphics, tx: number, ty: number, size: number, isPlus: boolean) {
    gfx.clear();
    gfx.setPosition(tx, ty);
    const cx = 0;
    const cy = 0;
    const r = size / 2;

    // 1. Drop shadow (comic style)
    gfx.fillStyle(0x3a0055, 0.6);
    gfx.fillCircle(cx + 2, cy + 4, r + 2);

    // 2. Thick border (white or pink)
    gfx.lineStyle(4, 0xffffff, 1);
    gfx.strokeCircle(cx, cy, r);

    // 3. Candy Gradient Body
    if (isPlus) {
      // Cyan bouncy gummy for Plus
      gfx.fillGradientStyle(0x33ddff, 0x00ccff, 0x0099ee, 0x0077cc, 1);
    } else {
      // Golden Orange bouncy gummy for Minus
      gfx.fillGradientStyle(0xffcc33, 0xffaa00, 0xee8800, 0xcc6600, 1);
    }
    gfx.fillCircle(cx, cy, r);

    // 4. Glass highlight
    gfx.beginPath();
    gfx.arc(cx - 2, cy - 2, r * 0.8, Math.PI * 0.65, Math.PI * 1.85, false);
    gfx.arc(cx - 1, cy - 1, r * 0.8, Math.PI * 1.85, Math.PI * 0.65, true);
    gfx.closePath();
    gfx.fillStyle(0xffffff, 0.35);
    gfx.fillPath();

    // Icon (plus/minus) — thicker and drop shadowed
    const arm = size * 0.25;
    const thick = Math.max(3, size * 0.15);
    
    // Icon shadow
    gfx.fillStyle(0x3a0055, 0.5);
    if (isPlus) {
      gfx.fillRoundedRect(cx - thick / 2, cy - arm + 2, thick, arm * 2, 2);
      gfx.fillRoundedRect(cx - arm, cy - thick / 2 + 2, arm * 2, thick, 2);
    } else {
      gfx.fillRoundedRect(cx - arm, cy - thick / 2 + 2, arm * 2, thick, 2);
    }

    // Pure White Icon
    gfx.fillStyle(0xffffff, 1);
    if (isPlus) {
      gfx.fillRoundedRect(cx - thick / 2, cy - arm, thick, arm * 2, 2);
      gfx.fillRoundedRect(cx - arm, cy - thick / 2, arm * 2, thick, 2);
    } else {
      gfx.fillRoundedRect(cx - arm, cy - thick / 2, arm * 2, thick, 2);
    }
  }

  /** Draw the autoplay button at its last known position */
  drawAutoButton(isActive: boolean, remaining: number) {
    if (!this.autoGfx.visible) return;
    
    const autoX = this.autoHit.x;
    const autoY = this.autoHit.y;
    this.autoGfx.clear();
    this.autoGfx.setPosition(autoX, autoY);
    this.autoTxt.setPosition(autoX, autoY);

    const bw = this.autoHit.width || 88;
    const bh = this.autoHit.height || 28;
    const rad = Math.min(bh * 0.5, 20); // Pill shape
    const x = -bw / 2;
    const y = -bh / 2;

    // Drop shadow
    this.autoGfx.fillStyle(0x3a0055, 0.6);
    this.autoGfx.fillRoundedRect(x + 2, y + 4, bw, bh, rad);

    if (isActive) {
      // Active STOP state: Vibrant red/orange gummy
      this.autoGfx.fillGradientStyle(0xff5500, 0xff5500, 0xcc2200, 0xcc2200, 1);
      this.autoGfx.fillRoundedRect(x, y, bw, bh, rad);

      this.autoGfx.lineStyle(3, 0xffffff, 1);
      this.autoGfx.strokeRoundedRect(x, y, bw, bh, rad);

      // Glass highlight
      this.autoGfx.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.4, 0.4, 0.05, 0.05);
      this.autoGfx.fillRoundedRect(x + 2, y + 2, bw - 4, bh * 0.45, { tl: rad - 1, tr: rad - 1, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);

      const label = remaining > 0 ? `STOP (${remaining})` : 'STOP';
      this.autoTxt.setText(label)
                  .setColor('#ffffff')
                  .setShadow(0, 2, '#661100', 0, false, true);
    } else {
      // Inactive AUTOPLAY state: Violet gummy pill
      this.autoGfx.fillGradientStyle(0x9944ff, 0x8833ff, 0x6611cc, 0x5500aa, 1);
      this.autoGfx.fillRoundedRect(x, y, bw, bh, rad);

      // Inner border glow
      this.autoGfx.lineStyle(3, 0xffffff, 1);
      this.autoGfx.strokeRoundedRect(x, y, bw, bh, rad);

      // Glass highlight
      this.autoGfx.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.3, 0.3, 0.05, 0.05);
      this.autoGfx.fillRoundedRect(x + 2, y + 2, bw - 4, bh * 0.45, { tl: rad - 1, tr: rad - 1, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);

      this.autoTxt.setText('AUTOPLAY')
                  .setColor('#ffffff')
                  .setShadow(0, 2, '#330066', 0, false, true);
    }
  }

  hideAll() {
    this.spinOuterRing.setVisible(false);
    this.spinInnerPulse.setVisible(false);
    this.spinGfx.setVisible(false);
    this.spinHit.setVisible(false);
    this.spinLabel.setVisible(false);
    this.betMinusGfx.setVisible(false);
    this.betMinusHit.setVisible(false);
    this.betPlusGfx.setVisible(false);
    this.betPlusHit.setVisible(false);
    this.autoGfx.setVisible(false);
    this.autoHit.setVisible(false);
    this.autoTxt.setVisible(false);
  }
}
