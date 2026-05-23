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
    this.spinGfx = this.scene.add.graphics().setDepth(20);
    this.spinHit = this.scene.add.rectangle(0, 0, 150, 150, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(21);
    this.spinLabel = this.scene.add.text(0, 0, '', {
      resolution: 2,
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
      resolution: 2,
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
      this.scene.tweens.add({
        targets: [gfx, hit],
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 100,
        ease: 'Quad.easeOut'
      });
    });

    hit.on('pointerout', () => {
      this.scene.tweens.add({
        targets: [gfx, hit],
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 100,
        ease: 'Quad.easeOut'
      });
    });

    hit.on('pointerdown', () => {
      this.scene.tweens.add({
        targets: [gfx, hit],
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 50,
        ease: 'Quad.easeOut'
      });
    });

    hit.on('pointerup', () => {
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
    const r = size / 2;

    // ── Outer ambient glow for visibility ──
    // Tighter glow for a cleaner look
    g.fillStyle(0xff006a, 0.10);
    g.fillCircle(x, y, r + 10);
    g.fillStyle(0xff3388, 0.15);
    g.fillCircle(x, y, r + 5);

    // Drop shadow (deeper for more lift)
    g.fillStyle(0x000000, 0.6);
    g.fillCircle(x, y + 5, r + 8);

    // Thick multi-layered gold bezel
    // Layer 1: Outer dark gold edge
    g.fillGradientStyle(0x774400, 0x553300, 0x996611, 0x664400, 1);
    g.fillCircle(x, y, r + 6);
    // Layer 2: Main bright gold ring — brighter for visibility
    g.fillGradientStyle(0xffe866, 0xffcc33, 0xdd9900, 0xbb7700, 1);
    g.fillCircle(x, y, r + 4);
    // Layer 3: Bezel inner slope
    g.fillGradientStyle(0xbb7700, 0x995500, 0xffdd44, 0xeeaa22, 1);
    g.fillCircle(x, y, r - 2);

    // Jewel Center (Spherical Candy Look)
    const candyR = r - 6;
    // Base dark ruby
    g.fillStyle(0x990033, 1);
    g.fillCircle(x, y, candyR);
    // Mid layer — vivid hot pink gradient
    g.fillGradientStyle(0xdd0055, 0xbb0044, 0xff3377, 0xee1155, 1);
    g.fillCircle(x, y - 2, candyR * 0.95);
    // Bright center — shifted up-left for 3D illusion
    g.fillGradientStyle(0xff4488, 0xff2266, 0xff77aa, 0xff4477, 1);
    g.fillCircle(x - 2, y - 4, candyR * 0.85);

    // High-gloss crescent highlight at the top-left
    g.beginPath();
    g.arc(x - 4, y - 4, candyR * 0.7, Math.PI * 0.7, Math.PI * 1.8, false);
    g.arc(x - 2, y - 2, candyR * 0.7, Math.PI * 1.8, Math.PI * 0.7, true);
    g.closePath();
    g.fillStyle(0xffffff, 0.55);
    g.fillPath();

    // Secondary subtle highlight on bottom right
    g.beginPath();
    g.arc(x + 4, y + 4, candyR * 0.7, 0, Math.PI * 0.5, false);
    g.arc(x + 2, y + 2, candyR * 0.6, Math.PI * 0.5, 0, true);
    g.closePath();
    g.fillStyle(0xffffff, 0.20);
    g.fillPath();

    // Specular dot highlight removed. The crescent is enough for the glass effect.

    // Play triangle icon — slightly bigger for clarity
    const triSize = candyR * 0.48;
    const triX = x + triSize * 0.12;
    
    // Triangle shadow for depth
    g.fillStyle(0x550022, 0.8);
    g.beginPath();
    g.moveTo(triX - triSize * 0.5, y - triSize * 0.6 + 3);
    g.lineTo(triX + triSize * 0.65, y + 3);
    g.lineTo(triX - triSize * 0.5, y + triSize * 0.6 + 3);
    g.closePath();
    g.fillPath();

    // Triangle body — pure white
    g.fillStyle(0xffffff, 1.0);
    g.beginPath();
    g.moveTo(triX - triSize * 0.5, y - triSize * 0.6);
    g.lineTo(triX + triSize * 0.65, y);
    g.lineTo(triX - triSize * 0.5, y + triSize * 0.6);
    g.closePath();
    g.fillPath();

    // Sparkle dots on the gold ring — brighter
    const sparkleR = Math.max(1.5, r * 0.04);
    g.fillStyle(0xffffff, 0.85);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
      const sx = x + Math.cos(angle) * (r + 1);
      const sy = y + Math.sin(angle) * (r + 1);
      g.fillCircle(sx, sy, sparkleR);
    }
  }

  /** Draw the STOP button (visually replaces spin during active spin) */
  drawStopButton(x: number, y: number, size: number) {
    const g = this.spinGfx;
    g.clear();
    const r = size / 2;

    // Drop shadow
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(x, y + 6, r + 8);

    // Same thick multi-layered gold bezel as spin
    g.fillGradientStyle(0x774400, 0x553300, 0x996611, 0x664400, 1);
    g.fillCircle(x, y, r + 6);
    g.fillGradientStyle(0xffdd55, 0xffbb22, 0xcc8800, 0xaa5500, 1);
    g.fillCircle(x, y, r + 4);
    g.fillGradientStyle(0xaa6600, 0x884400, 0xffcc33, 0xdd9900, 1);
    g.fillCircle(x, y, r - 2);

    // Crimson/Red Jewel Center (STOP state)
    const candyR = r - 6;
    g.fillStyle(0x550000, 1);
    g.fillCircle(x, y, candyR);
    g.fillGradientStyle(0x990000, 0x880000, 0xcc2200, 0xaa1100, 1);
    g.fillCircle(x, y - 2, candyR * 0.95);
    g.fillGradientStyle(0xdd3300, 0xbb1100, 0xee4422, 0xcc2200, 1);
    g.fillCircle(x - 2, y - 4, candyR * 0.85);

    // High-gloss crescent highlight at the top-left
    g.beginPath();
    g.arc(x - 4, y - 4, candyR * 0.7, Math.PI * 0.7, Math.PI * 1.8, false);
    g.arc(x - 2, y - 2, candyR * 0.7, Math.PI * 1.8, Math.PI * 0.7, true);
    g.closePath();
    g.fillStyle(0xffffff, 0.55);
    g.fillPath();

    // White square STOP icon
    const sqSize = candyR * 0.35;

    // Square shadow
    g.fillStyle(0x440000, 0.8);
    g.fillRoundedRect(x - sqSize / 2, y - sqSize / 2 + 3, sqSize, sqSize, 3);

    // Square body
    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(x - sqSize / 2, y - sqSize / 2, sqSize, sqSize, 3);

    // Sparkle dots on the gold ring
    const sparkleR = 2;
    g.fillStyle(0xffffff, 0.7);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
      const sx = x + Math.cos(angle) * (r + 1);
      const sy = y + Math.sin(angle) * (r + 1);
      g.fillCircle(sx, sy, sparkleR);
    }
  }

  /** Draw a bet +/- button */
  drawBetButton(gfx: Phaser.GameObjects.Graphics, tx: number, ty: number, size: number, isPlus: boolean) {
    gfx.clear();
    gfx.setPosition(tx, ty);
    const cx = 0;
    const cy = 0;
    const r = size / 2;

    // ── Outer ambient glow for visibility ──
    gfx.fillStyle(0xff006a, 0.10);
    gfx.fillCircle(cx, cy, r + 8);
    gfx.fillStyle(0xff3388, 0.15);
    gfx.fillCircle(cx, cy, r + 4);

    // Drop shadow
    gfx.fillStyle(0x000000, 0.55);
    gfx.fillCircle(cx, cy + 3, r + 4);

    // Thick multi-layered gold bezel — brighter
    gfx.fillGradientStyle(0x774400, 0x553300, 0x996611, 0x664400, 1);
    gfx.fillCircle(cx, cy, r + 4);
    gfx.fillGradientStyle(0xffe866, 0xffcc33, 0xdd9900, 0xbb7700, 1);
    gfx.fillCircle(cx, cy, r + 2);
    gfx.fillGradientStyle(0xbb7700, 0x995500, 0xffdd44, 0xeeaa22, 1);
    gfx.fillCircle(cx, cy, r - 2);

    // Jewel Center (Spherical Candy Look)
    const candyR = r - 4;
    gfx.fillStyle(0x990033, 1);
    gfx.fillCircle(cx, cy, candyR);
    gfx.fillGradientStyle(0xdd0055, 0xbb0044, 0xff3377, 0xee1155, 1);
    gfx.fillCircle(cx, cy - 1, candyR * 0.95);
    gfx.fillGradientStyle(0xff4488, 0xff2266, 0xff77aa, 0xff4477, 1);
    gfx.fillCircle(cx - 1, cy - 2, candyR * 0.85);

    // High-gloss crescent highlight at the top-left
    gfx.beginPath();
    gfx.arc(cx - 2, cy - 2, candyR * 0.7, Math.PI * 0.7, Math.PI * 1.8, false);
    gfx.arc(cx - 1, cy - 1, candyR * 0.7, Math.PI * 1.8, Math.PI * 0.7, true);
    gfx.closePath();
    gfx.fillStyle(0xffffff, 0.55);
    gfx.fillPath();

    // Specular highlight removed

    // Icon (plus/minus) — thicker and drop shadowed
    const arm = size * 0.22;
    const thick = Math.max(3, size * 0.13);
    
    // Icon shadow (inset into the candy)
    gfx.fillStyle(0x550022, 0.8);
    if (isPlus) {
      gfx.fillRoundedRect(cx - thick / 2, cy - arm + 2, thick, arm * 2, 2);
      gfx.fillRoundedRect(cx - arm, cy - thick / 2 + 2, arm * 2, thick, 2);
    } else {
      gfx.fillRoundedRect(cx - arm, cy - thick / 2 + 2, arm * 2, thick, 2);
    }

    // Icon Body (Pure White)
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
    // Clean, sharp premium edges to match the buy panels
    const rad = Math.min(bh * 0.2, 8);
    const x = -bw / 2;
    const y = -bh / 2;

    // Drop shadow
    this.autoGfx.fillStyle(0x000000, 0.5);
    this.autoGfx.fillRoundedRect(x, y + 3, bw, bh, rad);

    if (isActive) {
      // Active STOP state: White pill with pink border (Sugar Rush 1000 standard)
      this.autoGfx.fillGradientStyle(0xeebb44, 0xddaa33, 0xaa7722, 0x886611, 1);
      this.autoGfx.fillRoundedRect(x - 2, y - 2, bw + 4, bh + 4, rad + 2);

      this.autoGfx.fillStyle(0xffffff, 1);
      this.autoGfx.fillRoundedRect(x, y, bw, bh, rad);

      // Pink border stroke
      this.autoGfx.lineStyle(2.5, 0xff0066, 1);
      this.autoGfx.strokeRoundedRect(x, y, bw, bh, rad);

      // Glass highlight
      this.autoGfx.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.6, 0.6, 0.1, 0.1);
      this.autoGfx.fillRoundedRect(x + 1, y + 1, bw - 2, bh * 0.45, { tl: rad - 1, tr: rad - 1, bl: 0, br: 0 } as any);

      const label = remaining > 0 ? `STOP (${remaining})` : 'STOP';
      this.autoTxt.setText(label)
                  .setColor('#ff0066')
                  .setShadow(0, 0, '#000000', 0, false, false);
    } else {
      // Inactive: Chrome/Dark metal bezel, dark violet face — high contrast for visibility
      this.autoGfx.fillGradientStyle(0xaaaaaa, 0x888888, 0x555555, 0x333333, 1);
      this.autoGfx.fillRoundedRect(x - 2, y - 2, bw + 4, bh + 4, rad + 2);

      this.autoGfx.fillGradientStyle(0x1a0a24, 0x1a0a24, 0x0d0518, 0x0d0518, 0.98);
      this.autoGfx.fillRoundedRect(x, y, bw, bh, rad);

      // Inner border glow
      this.autoGfx.lineStyle(1, 0xff006a, 0.3);
      this.autoGfx.strokeRoundedRect(x, y, bw, bh, rad);

      // Glass highlight
      this.autoGfx.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.18, 0.18, 0, 0);
      this.autoGfx.fillRoundedRect(x + 1, y + 1, bw - 2, bh * 0.45, { tl: rad - 1, tr: rad - 1, bl: 0, br: 0 } as any);

      this.autoTxt.setText('AUTOPLAY')
                  .setColor('#e0e0e0')
                  .setShadow(0, 1, '#000000', 2, true, true);
    }
  }

  hideAll() {
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
