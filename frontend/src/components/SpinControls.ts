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
      spinY = safeH * 0.55;
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

    // ── Outer glow (subtle, layered) ──
    g.fillStyle(0xff006a, 0.06);
    g.fillCircle(x, y, r + 22);
    g.fillStyle(0xff006a, 0.03);
    g.fillCircle(x, y, r + 32);

    // ── Drop shadow ──
    g.fillStyle(0x000000, 0.45);
    g.fillCircle(x, y + 3, r + 5);

    // ── Gold outer bezel ──
    g.fillGradientStyle(0xeebb44, 0xddaa33, 0xaa7722, 0x886611, 1);
    g.fillCircle(x, y, r + 4);

    // ── Chrome mid ring ──
    g.fillGradientStyle(0xdddddd, 0xeeeeee, 0xbbbbbb, 0x999999, 1);
    g.fillCircle(x, y, r + 1);

    // ── Gold inner bezel ──
    g.fillGradientStyle(0xddaa33, 0xeebb44, 0x997722, 0x886611, 1);
    g.fillCircle(x, y, r - 2);

    // ── Main face gradient (candy berry) ──
    g.fillGradientStyle(0xff4488, 0xff2266, 0xcc0044, 0x990033, 1);
    g.fillCircle(x, y, r - 5);

    // ── Glossy top hemisphere ──
    g.beginPath();
    g.arc(x, y - 1, r - 5, Math.PI, 0, false);
    g.closePath();
    g.fillStyle(0xffffff, 0.22);
    g.fillPath();

    // ── Inner rim highlight ──
    g.lineStyle(1, 0xffffff, 0.15);
    g.strokeCircle(x, y, r - 5);

    // ── Play triangle icon ──
    const tri = r * 0.38;
    const tx = x + tri * 0.12;

    // Shadow
    g.fillStyle(0x000000, 0.18);
    g.beginPath();
    g.moveTo(tx - tri * 0.48, y - tri * 0.58 + 2);
    g.lineTo(tx + tri * 0.62, y + 2);
    g.lineTo(tx - tri * 0.48, y + tri * 0.58 + 2);
    g.closePath();
    g.fillPath();

    // White triangle
    g.fillStyle(0xffffff, 0.95);
    g.beginPath();
    g.moveTo(tx - tri * 0.48, y - tri * 0.58);
    g.lineTo(tx + tri * 0.62, y);
    g.lineTo(tx - tri * 0.48, y + tri * 0.58);
    g.closePath();
    g.fillPath();

    // ── Sparkle dots on gold ring ──
    g.fillStyle(0xffffff, 0.55);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      g.fillCircle(x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2), 1.2);
    }
  }

  /** Draw a bet +/- button */
  drawBetButton(gfx: Phaser.GameObjects.Graphics, tx: number, ty: number, size: number, isPlus: boolean) {
    gfx.clear();
    gfx.setPosition(tx, ty);
    const r = size / 2;

    // Dark backdrop halo
    gfx.fillStyle(0x0a0515, 0.45);
    gfx.fillCircle(0, 0, r + 5);

    // Accent glow ring
    gfx.lineStyle(1.5, 0xff006a, 0.5);
    gfx.strokeCircle(0, 0, r + 5);

    // Drop shadow
    gfx.fillStyle(0x000000, 0.55);
    gfx.fillCircle(0, 2, r);

    // Gold bezel
    gfx.fillGradientStyle(0xddaa33, 0xeebb44, 0xaa7722, 0x886611, 1);
    gfx.fillCircle(0, 0, r);

    // Chrome inner ring
    gfx.fillGradientStyle(0xcccccc, 0xdddddd, 0xaaaaaa, 0x888888, 1);
    gfx.fillCircle(0, 0, r - 1.5);

    // Candy-pink face
    gfx.fillGradientStyle(0xff2266, 0xff2266, 0xaa0033, 0xaa0033, 1);
    gfx.fillCircle(0, 0, r - 3);

    // Glossy top
    gfx.beginPath();
    gfx.arc(0, 0, r - 3, Math.PI, 0, false);
    gfx.closePath();
    gfx.fillStyle(0xffffff, 0.28);
    gfx.fillPath();

    // Inner rim
    gfx.lineStyle(0.8, 0xffffff, 0.25);
    gfx.strokeCircle(0, 0, r - 3);

    // Icon (+/-)
    gfx.fillStyle(0xffffff, 1);
    const arm = size * 0.20;
    const thick = Math.max(2.5, size * 0.08);
    if (isPlus) {
      gfx.fillRoundedRect(-thick / 2, -arm, thick, arm * 2, 1.5);
      gfx.fillRoundedRect(-arm, -thick / 2, arm * 2, thick, 1.5);
    } else {
      gfx.fillRoundedRect(-arm, -thick / 2, arm * 2, thick, 1.5);
    }
  }

  /** Draw the autoplay button at its last known position */
  drawAutoButton(spinX: number, spinY: number, spinSize: number, isActive: boolean, remaining: number) {
    if (!this.autoGfx.visible) return;
    const autoY = spinY + spinSize / 2 + 14;
    this.autoGfx.clear();
    this.autoGfx.setPosition(spinX, autoY);

    const bw = 64, bh = 22, rad = bh / 2;
    if (isActive) {
      this.autoGfx.fillStyle(0x000000, 0.25);
      this.autoGfx.fillRoundedRect(-bw / 2 + 1, -bh / 2 + 2, bw, bh, rad);
      this.autoGfx.fillGradientStyle(0xff006a, 0xff006a, 0xaa0044, 0xaa0044, 1);
      this.autoGfx.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, rad);
      this.autoGfx.lineStyle(1, 0xffffff, 0.25);
      this.autoGfx.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, rad);
      this.autoTxt.setText(remaining > 0 ? `AUTO ${remaining}` : 'AUTO ∞').setColor('#ffffff');
    } else {
      this.autoGfx.fillStyle(0x000000, 0.25);
      this.autoGfx.fillRoundedRect(-bw / 2 + 1, -bh / 2 + 2, bw, bh, rad);
      this.autoGfx.fillGradientStyle(0x1a0a24, 0x1a0a24, 0x0d0518, 0x0d0518, 0.8);
      this.autoGfx.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, rad);
      this.autoGfx.lineStyle(1, 0x442266, 0.5);
      this.autoGfx.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, rad);
      this.autoTxt.setText('AUTO').setColor('#8877aa');
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
