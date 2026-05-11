import Phaser from 'phaser';

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
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontStyle: '700',
    }).setOrigin(0.5).setDepth(21);

    this.betMinusGfx = this.scene.add.graphics().setDepth(20);
    this.betMinusHit = this.scene.add.rectangle(0, 0, 44, 44)
      .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(21);
    this.betPlusGfx = this.scene.add.graphics().setDepth(20);
    this.betPlusHit = this.scene.add.rectangle(0, 0, 44, 44)
      .setInteractive({ useHandCursor: true }).setAlpha(0.001).setDepth(21);

    this.autoGfx = this.scene.add.graphics().setDepth(21);
    this.autoHit = this.scene.add.rectangle(0, 0, 100, 30, 0xffffff, 0)
      .setInteractive({ useHandCursor: true }).setDepth(22);
    this.autoTxt = this.scene.add.text(0, 0, 'AUTO', {
      fontFamily: '"Inter", "Arial", sans-serif',
      fontStyle: '800',
      color: '#ffffff',
      shadow: { offsetX: 0, offsetY: 1, color: '#000000', blur: 2, fill: true }
    }).setOrigin(0.5).setDepth(23);
  }

  onSpin(cb: () => void) { this.spinHit.on('pointerdown', cb); }
  onBetMinus(cb: () => void) { this.betMinusHit.on('pointerdown', cb); }
  onBetPlus(cb: () => void) { this.betPlusHit.on('pointerdown', cb); }
  onAutoPlay(cb: () => void) { this.autoHit.on('pointerdown', cb); }

  /** Responsive layout engine */
  layout(w: number, h: number, gridX: number, gridY: number, gridTotalSize: number, barH: number, isStacked: boolean, isLandscapeMobile: boolean) {
    const safeH = h - barH;
    const rightMargin = w - gridX - gridTotalSize;
    const rightColCenter = gridX + gridTotalSize + rightMargin / 2;

    // ── Spin button size — proportional, clamped ──
    let spinSize: number;
    if (isStacked) {
      spinSize = Math.max(50, Math.min(80, w * 0.13, safeH * 0.1));
    } else if (isLandscapeMobile) {
      spinSize = Math.min(70, rightMargin * 0.40, safeH * 0.18);
    } else {
      spinSize = Math.min(100, rightMargin * 0.42, safeH * 0.16);
    }
    spinSize = Math.max(40, spinSize);

    // ── Spin position ──
    let spinX: number, spinY: number;
    if (isStacked) {
      // In stacked/portrait: spin sits above bottom bar, right side
      spinX = w - spinSize / 2 - 14;
      spinY = safeH - spinSize / 2 - 8;
    } else {
      spinX = rightColCenter;
      spinY = safeH * 0.72; // Moved lower down the screen
    }

    this._lastSpinX = spinX;
    this._lastSpinY = spinY;
    this._lastSpinSize = spinSize;

    this.spinHit.setPosition(spinX, spinY).setSize(spinSize * 1.3, spinSize * 1.3);
    this.spinGfx.setPosition(spinX, spinY);
    this.drawSpinButton(0, 0, spinSize);

    // ── AutoPlay pill — directly beneath spin ──
    const autoFS = isLandscapeMobile ? 10 : isStacked ? 10 : 12;
    const autoY = spinY + spinSize / 2 + (isStacked ? 10 : 14);
    if (isStacked && autoY > safeH - 2) {
      // Hide autoplay if it would clip into the bar
      this.autoHit.setVisible(false);
      this.autoTxt.setVisible(false);
      this.autoGfx.setVisible(false);
    } else {
      this.autoHit.setVisible(true).setPosition(spinX, autoY).setSize(70, 24);
      this.autoTxt.setVisible(true).setPosition(spinX, autoY).setFontSize(autoFS);
      this.autoGfx.setVisible(true);
    }

    // ── Bet +/- buttons ──
    let bBtnSize: number;
    if (isStacked) {
      bBtnSize = Math.max(24, Math.min(38, spinSize * 0.45));
    } else if (isLandscapeMobile) {
      bBtnSize = Math.max(28, Math.min(45, rightMargin * 0.14));
    } else {
      bBtnSize = Math.max(32, Math.min(55, rightMargin * 0.14, spinSize * 0.55));
    }

    if (isStacked) {
      // Portrait: place +/- on the left side of the spin button, horizontally
      const btnY = spinY;
      const gap = bBtnSize * 0.3;
      const minusX = spinX - spinSize / 2 - bBtnSize / 2 - gap - 4;
      const plusX = spinX - spinSize / 2 - bBtnSize / 2 - gap - 4 - bBtnSize - gap;

      // If they'd go off screen, stack vertically instead
      if (plusX - bBtnSize / 2 < 8) {
        // Vertical: above and below the spin button
        const vOffset = spinSize / 2 + bBtnSize / 2 + 6;
        this.betMinusHit.setPosition(spinX, spinY + vOffset).setSize(bBtnSize * 1.4, bBtnSize * 1.4);
        this.drawBetButton(this.betMinusGfx, spinX, spinY + vOffset, bBtnSize, false);
        this.betPlusHit.setPosition(spinX, spinY - vOffset).setSize(bBtnSize * 1.4, bBtnSize * 1.4);
        this.drawBetButton(this.betPlusGfx, spinX, spinY - vOffset, bBtnSize, true);
      } else {
        // Horizontal to the left
        this.betMinusHit.setPosition(minusX, btnY).setSize(bBtnSize * 1.4, bBtnSize * 1.4);
        this.drawBetButton(this.betMinusGfx, minusX, btnY, bBtnSize, false);
        this.betPlusHit.setPosition(plusX, btnY).setSize(bBtnSize * 1.4, bBtnSize * 1.4);
        this.drawBetButton(this.betPlusGfx, plusX, btnY, bBtnSize, true);
      }
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

    // Drop shadow
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(x, y + 6, r + 8);

    // Thick multi-layered gold bezel
    // Layer 1: Outer dark gold edge
    g.fillGradientStyle(0x774400, 0x553300, 0x996611, 0x664400, 1);
    g.fillCircle(x, y, r + 6);
    // Layer 2: Main bright gold ring
    g.fillGradientStyle(0xffdd55, 0xffbb22, 0xcc8800, 0xaa5500, 1);
    g.fillCircle(x, y, r + 4);
    // Layer 3: Bezel inner slope (darker)
    g.fillGradientStyle(0xaa6600, 0x884400, 0xffcc33, 0xdd9900, 1);
    g.fillCircle(x, y, r - 2);

    // Jewel Center (Spherical Candy Look)
    const candyR = r - 6;
    // Base dark ruby color
    g.fillStyle(0x880022, 1);
    g.fillCircle(x, y, candyR);
    // Mid layer shifted up
    g.fillGradientStyle(0xcc0044, 0xaa0033, 0xff2266, 0xdd1144, 1);
    g.fillCircle(x, y - 2, candyR * 0.95);
    // Bright center shifted further up-left
    g.fillGradientStyle(0xff3377, 0xee1155, 0xff6699, 0xdd3366, 1);
    g.fillCircle(x - 2, y - 4, candyR * 0.85);

    // High-gloss crescent highlight at the top-left
    g.beginPath();
    g.arc(x - 4, y - 4, candyR * 0.7, Math.PI * 0.7, Math.PI * 1.8, false);
    g.arc(x - 2, y - 2, candyR * 0.7, Math.PI * 1.8, Math.PI * 0.7, true);
    g.closePath();
    g.fillStyle(0xffffff, 0.65);
    g.fillPath();

    // Secondary subtle highlight on bottom right
    g.beginPath();
    g.arc(x + 4, y + 4, candyR * 0.7, 0, Math.PI * 0.5, false);
    g.arc(x + 2, y + 2, candyR * 0.6, Math.PI * 0.5, 0, true);
    g.closePath();
    g.fillStyle(0xffffff, 0.25);
    g.fillPath();

    // Play triangle icon
    const triSize = candyR * 0.45;
    const triX = x + triSize * 0.15; // slight offset right for visual centering
    
    // Triangle shadow for depth
    g.fillStyle(0x550022, 0.8);
    g.beginPath();
    g.moveTo(triX - triSize * 0.5, y - triSize * 0.6 + 4);
    g.lineTo(triX + triSize * 0.65, y + 4);
    g.lineTo(triX - triSize * 0.5, y + triSize * 0.6 + 4);
    g.closePath();
    g.fillPath();

    // Triangle body
    g.fillStyle(0xffffff, 0.95);
    g.beginPath();
    g.moveTo(triX - triSize * 0.5, y - triSize * 0.6);
    g.lineTo(triX + triSize * 0.65, y);
    g.lineTo(triX - triSize * 0.5, y + triSize * 0.6);
    g.closePath();
    g.fillPath();

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

    // Drop shadow
    gfx.fillStyle(0x000000, 0.6);
    gfx.fillCircle(cx, cy + 4, r + 4);

    // Thick multi-layered gold bezel
    gfx.fillGradientStyle(0x774400, 0x553300, 0x996611, 0x664400, 1);
    gfx.fillCircle(cx, cy, r + 4);
    gfx.fillGradientStyle(0xffdd55, 0xffbb22, 0xcc8800, 0xaa5500, 1);
    gfx.fillCircle(cx, cy, r + 2);
    gfx.fillGradientStyle(0xaa6600, 0x884400, 0xffcc33, 0xdd9900, 1);
    gfx.fillCircle(cx, cy, r - 2);

    // Jewel Center (Spherical Candy Look)
    const candyR = r - 4;
    gfx.fillStyle(0x880022, 1);
    gfx.fillCircle(cx, cy, candyR);
    gfx.fillGradientStyle(0xcc0044, 0xaa0033, 0xff2266, 0xdd1144, 1);
    gfx.fillCircle(cx, cy - 1, candyR * 0.95);
    gfx.fillGradientStyle(0xff3377, 0xee1155, 0xff6699, 0xdd3366, 1);
    gfx.fillCircle(cx - 1, cy - 2, candyR * 0.85);

    // High-gloss crescent highlight at the top-left
    gfx.beginPath();
    gfx.arc(cx - 2, cy - 2, candyR * 0.7, Math.PI * 0.7, Math.PI * 1.8, false);
    gfx.arc(cx - 1, cy - 1, candyR * 0.7, Math.PI * 1.8, Math.PI * 0.7, true);
    gfx.closePath();
    gfx.fillStyle(0xffffff, 0.65);
    gfx.fillPath();

    // Icon (plus/minus) — thicker and drop shadowed
    const arm = size * 0.22;
    const thick = Math.max(3, size * 0.12);
    
    // Icon shadow (inset into the candy)
    gfx.fillStyle(0x550022, 0.8);
    if (isPlus) {
      gfx.fillRoundedRect(cx - thick / 2, cy - arm + 2, thick, arm * 2, 2);
      gfx.fillRoundedRect(cx - arm, cy - thick / 2 + 2, arm * 2, thick, 2);
    } else {
      gfx.fillRoundedRect(cx - arm, cy - thick / 2 + 2, arm * 2, thick, 2);
    }

    // Icon Body (White)
    gfx.fillStyle(0xffffff, 1);
    if (isPlus) {
      gfx.fillRoundedRect(cx - thick / 2, cy - arm, thick, arm * 2, 2);
      gfx.fillRoundedRect(cx - arm, cy - thick / 2, arm * 2, thick, 2);
    } else {
      gfx.fillRoundedRect(cx - arm, cy - thick / 2, arm * 2, thick, 2);
    }
  }

  /** Draw the autoplay button at its last known position */
  drawAutoButton(spinX: number, spinY: number, spinSize: number, isActive: boolean, remaining: number) {
    if (!this.autoGfx.visible) return;
    const autoY = spinY + spinSize / 2 + 16; // Dropped slightly for bezel
    this.autoGfx.clear();
    this.autoGfx.setPosition(spinX, autoY);

    const bw = 76, bh = 24, rad = bh / 2;
    const x = -bw / 2;
    const y = -bh / 2;

    // Drop shadow
    this.autoGfx.fillStyle(0x000000, 0.5);
    this.autoGfx.fillRoundedRect(x, y + 3, bw, bh, rad);

    if (isActive) {
      // Active: Gold bezel, pink face
      this.autoGfx.fillGradientStyle(0xeebb44, 0xddaa33, 0xaa7722, 0x886611, 1);
      this.autoGfx.fillRoundedRect(x - 2, y - 2, bw + 4, bh + 4, rad + 2);
      
      this.autoGfx.fillGradientStyle(0xff006a, 0xff006a, 0xaa0044, 0xaa0044, 1);
      this.autoGfx.fillRoundedRect(x, y, bw, bh, rad);

      // Glass highlight
      this.autoGfx.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.4, 0.4, 0.05, 0.05);
      this.autoGfx.fillRoundedRect(x + 1, y + 1, bw - 2, bh * 0.45, { tl: rad - 1, tr: rad - 1, bl: 0, br: 0 } as any);

      this.autoTxt.setText(remaining > 0 ? `AUTO ${remaining}` : 'AUTO ∞')
                  .setColor('#ffffff')
                  .setShadow(0, 1, '#550022', 0, true, true);
    } else {
      // Inactive: Chrome/Dark metal bezel, dark violet face
      this.autoGfx.fillGradientStyle(0x999999, 0x777777, 0x444444, 0x222222, 1);
      this.autoGfx.fillRoundedRect(x - 2, y - 2, bw + 4, bh + 4, rad + 2);

      this.autoGfx.fillGradientStyle(0x1a0a24, 0x1a0a24, 0x0d0518, 0x0d0518, 0.95);
      this.autoGfx.fillRoundedRect(x, y, bw, bh, rad);

      // Glass highlight
      this.autoGfx.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.15, 0.15, 0, 0);
      this.autoGfx.fillRoundedRect(x + 1, y + 1, bw - 2, bh * 0.45, { tl: rad - 1, tr: rad - 1, bl: 0, br: 0 } as any);

      this.autoTxt.setText('AUTOPLAY')
                  .setColor('#cccccc')
                  .setShadow(0, 1, '#000000', 0, true, true);
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
