import Phaser from 'phaser';
import type { Game } from './Game';
import options from '../options';
import { T } from '../helpers/I18n';
import { computeLayout } from '../constants/LayoutEngine';
import { DisplayBalance } from '../helpers/Currency';

  export function layoutAll(this: Game) {
    const w = this.scale.width;
    const h = this.scale.height;

    // === BACKGROUND ===
    if (this.backgroundManager) {
      this.backgroundManager.resize(w, h);
    }

    // â•â•â• Unified layout computation (single source of truth) â•â•â•
    const m = computeLayout(w, h);

    // Backward-compatible aliases used by downstream code in this method
    const isStacked = m.mode === 'portrait';
    const isMobile = m.isMobile;
    const isLandscapeMobile = m.mode === 'landscape-compact';
    const barH = m.barH;
    const safeH = m.safeH;
    const toolPad = m.toolbarPad;
    const toolGap = m.toolbarGap;
    const toolY = m.toolbarY;
    const toolbarH = m.toolbarH;

    const gridX = m.gridX;
    const gridY = m.gridY;
    const gridW = m.gridSize;
    const gridH = m.gridSize;

    this.grid.offsetX = gridX;
    this.grid.offsetY = gridY;
    this.grid.cellW = m.cellSize;
    this.grid.cellH = m.cellSize;
    this.grid.drawCellBackgrounds();
    this.grid.repositionSprites();

    // === GRID PANEL IMAGE ===
    this.gridPanel.setVisible(false); // Hide the old background image

    // === PREMIUM CANDY MACHINE GRID FRAME ===
    this.gridFrame.clear();
    const f = this.gridFrame;

    const borderThickness = Math.max(6, Math.min(gridW, gridH) * 0.022);
    const framePadding = borderThickness + 4;
    const frameW = gridW + framePadding * 2;
    const frameH = gridH + framePadding * 2;
    const frameX = gridX - framePadding;
    const frameY = gridY - framePadding;
    const frameR = Math.max(16, Math.min(gridW, gridH) * 0.03);

    // --- Layer 1: Deep outer shadow ---
    f.fillStyle(0x000000, 0.45);
    f.fillRoundedRect(frameX + 4, frameY + 6, frameW, frameH, frameR + 2);

    // --- Layer 2: Thick glossy plastic rim (outer ring) ---
    // Bottom half (darker) for 3D depth - Premium glossy candy pink
    f.fillGradientStyle(0xffaadd, 0xffaadd, 0xff3388, 0xff3388, 1);
    f.fillRoundedRect(frameX, frameY, frameW, frameH, frameR);

    // Top half highlight overlay (lighter plastic shine)
    f.fillGradientStyle(
      0xffffff,
      0xffffff,
      0xffaadd,
      0xffaadd,
      0.9,
      0.9,
      0.1,
      0.1,
    );
    f.fillRoundedRect(frameX, frameY, frameW, frameH * 0.4, {
      tl: frameR,
      tr: frameR,
      bl: 0,
      br: 0,
    } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);

    // Glass sheen on top edge of rim
    f.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.8, 0.8, 0, 0);
    f.fillRoundedRect(
      frameX + 4,
      frameY + 2,
      frameW - 8,
      borderThickness * 0.5,
      { tl: frameR - 2, tr: frameR - 2, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius,
    );

    // --- Layer 3: Inner recess (dark well holding the grid) ---
    const innerX = frameX + borderThickness;
    const innerY = frameY + borderThickness;
    const innerW = frameW - borderThickness * 2;
    const innerH = frameH - borderThickness * 2;
    const innerR = Math.max(8, frameR - 4);

    // Dark inset shadow to create depth (just a border rim shadow now)
    f.fillStyle(0x000000, 0.35);
    f.fillRoundedRect(
      innerX - 2,
      innerY - 2,
      innerW + 4,
      innerH + 4,
      innerR + 2,
    );

    // We intentionally do NOT draw a solid background here (like the old dark purple plate).
    // This allows the Grid.ts Phase 1 frosted glass background to shine through organically,
    // matching the original Sugar Blast 1000 aesthetic.

    // Inner border for definition
    f.lineStyle(1.5, 0xff006a, 0.5);
    f.strokeRoundedRect(innerX, innerY, innerW, innerH, innerR);

    // --- Layer 4: Outer rim border & highlight ---
    f.lineStyle(2, 0xffccdd, 0.7);
    f.strokeRoundedRect(frameX, frameY, frameW, frameH, frameR);
    f.lineStyle(1, 0xffffff, 0.2);
    f.strokeRoundedRect(
      frameX + 1,
      frameY + 1,
      frameW - 2,
      frameH - 2,
      frameR - 1,
    );

    // --- Layer 5: Glass glare diagonal across the grid ---
    f.beginPath();
    const glareW = gridW * 0.15;
    f.moveTo(gridX + gridW * 0.05, gridY);
    f.lineTo(gridX + gridW * 0.05 + glareW, gridY);
    f.lineTo(gridX, gridY + gridH * 0.3);
    f.lineTo(gridX, gridY + gridH * 0.15);
    f.closePath();
    f.fillStyle(0xffffff, 0.08);
    f.fillPath();

    // --- Layer 6: Decorative candy-bolt corner accents (hidden on very small grids) ---
    const minGridDim = Math.min(gridW, gridH);
    if (minGridDim > 300) {
      const boltR = Math.max(4, minGridDim * 0.012);
      const boltInset = borderThickness * 0.55;
      const boltPositions = [
        { x: frameX + boltInset, y: frameY + boltInset },
        { x: frameX + frameW - boltInset, y: frameY + boltInset },
        { x: frameX + boltInset, y: frameY + frameH - boltInset },
        { x: frameX + frameW - boltInset, y: frameY + frameH - boltInset },
      ];
      for (const bp of boltPositions) {
        // Bolt shadow
        f.fillStyle(0x000000, 0.4);
        f.fillCircle(bp.x + 1, bp.y + 2, boltR);
        // Bolt body â€” silver gradient
        f.fillGradientStyle(0xdddddd, 0xeeeeee, 0x999999, 0xaaaaaa, 1);
        f.fillCircle(bp.x, bp.y, boltR);
        // Bolt highlight
        f.fillStyle(0xffffff, 0.6);
        f.fillCircle(bp.x - boltR * 0.25, bp.y - boltR * 0.25, boltR * 0.4);
        // Bolt rim
        f.strokeCircle(bp.x, bp.y, boltR);
      }
    }

    // ==========================================
    // 2. SPIN BUTTON GROUP (Calculated early for anchoring)
    // ==========================================
    const { spinX, spinY, spinSize } = this.spinControls.layout(m);
    this.updateSpinButtonState();
    this.updateAutoSpinDisplay();

    // ==========================================
    // 3. BUY PANELS & ANTE BET
    // ==========================================
    const availableWidthForFeatures = gridX;
    const availableHeightForFeatures = safeH - (gridY + gridH);

    const useFeaturesMenu =
      isLandscapeMobile || (!isStacked && availableWidthForFeatures < 160);

    // Larger premium buy buttons
    let buyW = isStacked
      ? Math.min(180, w * 0.40)
      : Math.min(280, gridX * 0.85);
    let buyH = isStacked
      ? Math.min(50, safeH * 0.07)
      : Math.min(110, safeH * 0.16);
    let buyGap = 12; // Standard fixed balanced gap
    let anteW = isStacked ? buyW * 2 + buyGap : buyW;
    let anteH = isStacked ? Math.min(42, buyH * 0.85) : 55;

    let buyX1: number = 0;
    let buyX2: number = 0;
    let anteX: number = 0;
    let buyY1: number = 0;
    let buyY2: number = 0;
    let anteY: number = 0;

    let showFeaturesToggle = useFeaturesMenu;
    const showPopup = this.isFeaturesMenuOpen;

    if (showFeaturesToggle) {
      // Show the toggle button
      this.btnFeaturesMenuGraphics.setVisible(true).clear();
      this.btnFeaturesMenuHit.setVisible(true);
      this.btnFeaturesMenuIcon.setVisible(true);

      // Position toggle to the left of the grid â€” never overlapping
      const toggleSize = isLandscapeMobile ? 44 : 52;
      const toggleX = Math.min(gridX / 2, gridX - toggleSize / 2 - 8);
      const clampedToggleX = Math.max(toggleSize / 2 + 6, toggleX);
      const toggleY = gridY + gridH / 2;

      this.btnFeaturesMenuHit.setPosition(clampedToggleX, toggleY).setSize(toggleSize, toggleSize);
      // Glassmorphic toggle pill for BUY feature
      this.btnFeaturesMenuGraphics.fillStyle(0x000000, 0.5);
      this.btnFeaturesMenuGraphics.fillRoundedRect(
        clampedToggleX - toggleSize / 2,
        toggleY - toggleSize / 2 + 4,
        toggleSize,
        toggleSize,
        Math.round(toggleSize * 0.25),
      );
      this.btnFeaturesMenuGraphics.fillGradientStyle(
        0xff006a,
        0xff006a,
        0xcc0055,
        0xcc0055,
        1,
      );
      this.btnFeaturesMenuGraphics.fillRoundedRect(
        clampedToggleX - toggleSize / 2,
        toggleY - toggleSize / 2,
        toggleSize,
        toggleSize,
        Math.round(toggleSize * 0.25),
      );
      this.btnFeaturesMenuGraphics.lineStyle(2, 0xffffff, 0.8);
      this.btnFeaturesMenuGraphics.strokeRoundedRect(
        clampedToggleX - toggleSize / 2,
        toggleY - toggleSize / 2,
        toggleSize,
        toggleSize,
        Math.round(toggleSize * 0.25),
      );

      this.btnFeaturesMenuIcon.setPosition(clampedToggleX, toggleY);
    } else {
      this.btnFeaturesMenuGraphics.setVisible(false);
      this.btnFeaturesMenuHit.setVisible(false);
      this.btnFeaturesMenuIcon.setVisible(false);
    }

    // Determine base layout before popup
    if (isStacked) {
      // Stacked mobile: compact "BUY" + "ANTE" side by side
      // Position them between gridBottom and spinY with proper spacing
      const borderThickness = Math.max(6, Math.min(gridW, gridH) * 0.022);
      const framePadding = borderThickness + 4;
      const gridBottom = gridY + gridH + framePadding;
      
      const spinGlowSize = 12; // Extra visual padding for the ambient pink glow
      const spinTop = spinY - spinSize / 2 - spinGlowSize;
      const gapBetweenGridAndSpin = spinTop - gridBottom;

      // Buy panel row sits in the upper portion of the gap
      let buyRowH = Math.max(buyH, 45);
      const verticalPad = Math.max(12, gapBetweenGridAndSpin * 0.10);

      // Place buy row just below grid with padding
      buyY1 = gridBottom + verticalPad + buyRowH / 2;

      // Clamp to never overlap spin button
      const maxBuyY = spinTop - buyRowH / 2 - 12;
      if (buyY1 > maxBuyY) {
        buyY1 = maxBuyY;
        // If still too tight, shrink buy buttons slightly
        buyH = Math.max(36, Math.min(buyH, (gapBetweenGridAndSpin - 24) * 0.45));
        buyRowH = buyH;
        buyY1 = gridBottom + verticalPad + buyH / 2;
      }

      // Allow tablets to have much wider buttons (up to 240px instead of the old 130px hard cap)
      anteW = Math.min(240, w * 0.44);
      buyW = anteW;
      anteH = Math.min(50, buyH * 0.95);

      anteY = buyY1;
      
      const totalW = buyW + anteW + buyGap;
      buyX1 = w / 2 - totalW / 2 + buyW / 2;
      anteX = w / 2 + totalW / 2 - anteW / 2;

      // Super buy is hidden unless popup is open
      buyX2 = -9999;
      buyY2 = -9999;
    } else {
      // Desktop placement: stacked vertically on the left side
      buyX1 = Math.max(gridX / 2, buyW / 2 + 10);
      buyY1 = gridY + gridH / 2 - buyH / 2 - buyGap / 2;

      buyX2 = buyX1;
      buyY2 = gridY + gridH / 2 + buyH / 2 + buyGap / 2;

      anteX = buyX1;
      anteY = buyY2 + buyH / 2 + buyGap * 1.5 + anteH / 2;
    }

    if (showPopup) {
      this.featuresMenuHitOverlay
        .setVisible(true)
        .setPosition(w / 2, h / 2)
        .setSize(w, h);
      this.featuresMenuTitleTxt.setVisible(true);
      this.featuresMenuCloseBtn.setVisible(true);

      buyW = Math.min(220, w * 0.78);
      buyH = 58;
      buyGap = 14;
      
      if (!isStacked) {
        anteW = buyW;
        anteH = 42;
      }

      // Calculate heights with cleaner header
      const headerH = 44;
      const contentH = isStacked ? (buyH * 2 + buyGap) : (buyH * 2 + anteH + buyGap * 2);
      const popupW = buyW + 50;
      const popupH = contentH + headerH + 55;
      const popupX = w / 2;
      const popupY = h / 2;

      // Premium popup backdrop
      this.featuresMenuPopupBg.fillStyle(0x000000, 0.6);
      this.featuresMenuPopupBg.fillRoundedRect(
        popupX - popupW / 2 + 6,
        popupY - popupH / 2 + 8,
        popupW,
        popupH,
        24,
      );
      
      // Main Glass Panel
      this.featuresMenuPopupBg.fillGradientStyle(
        0x2d1b4e,
        0x2d1b4e,
        0x150b29,
        0x150b29,
        0.98,
      );
      this.featuresMenuPopupBg.fillRoundedRect(
        popupX - popupW / 2,
        popupY - popupH / 2,
        popupW,
        popupH,
        20,
      );
      
      // Header Background (Candy Pink)
      this.featuresMenuPopupBg.fillGradientStyle(
        0xff006a,
        0xff006a,
        0xcc0055,
        0xcc0055,
        1,
      );
      this.featuresMenuPopupBg.fillRoundedRect(
        popupX - popupW / 2,
        popupY - popupH / 2,
        popupW,
        headerH + 20,
        { tl: 20, tr: 20, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius
      );

      // Inner Header Highlight
      this.featuresMenuPopupBg.fillGradientStyle(
        0xffffff,
        0xffffff,
        0xffffff,
        0xffffff,
        0.2,
        0.2,
        0,
        0,
      );
      this.featuresMenuPopupBg.fillRoundedRect(
        popupX - popupW / 2 + 2,
        popupY - popupH / 2 + 2,
        popupW - 4,
        (headerH + 20) * 0.4,
        { tl: 18, tr: 18, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius
      );

      // Border Outline
      this.featuresMenuPopupBg.lineStyle(2, 0xff88bb, 0.9);
      this.featuresMenuPopupBg.strokeRoundedRect(
        popupX - popupW / 2,
        popupY - popupH / 2,
        popupW,
        popupH,
        20,
      );
      this.featuresMenuPopupBg.lineStyle(1, 0xffffff, 0.3);
      this.featuresMenuPopupBg.strokeRoundedRect(
        popupX - popupW / 2 + 2,
        popupY - popupH / 2 + 2,
        popupW - 4,
        popupH - 4,
        18,
      );

      // Position Header â€” title left-aligned, X right-aligned for clarity
      this.featuresMenuTitleTxt
        .setPosition(popupX - popupW / 2 + 24, popupY - popupH / 2 + headerH / 2 + 10)
        .setOrigin(0, 0.5)
        .setFontSize(18)
        .setShadow(0, 2, '#000000', 3, true, true);
        
      this.featuresMenuCloseBtn
        .setPosition(popupX + popupW / 2 - 24, popupY - popupH / 2 + headerH / 2 + 10)
        .setOrigin(1, 0.5)
        .setFontSize(20)
        .setShadow(0, 2, '#000000', 2, true, true);

      buyX1 = popupX;
      buyX2 = popupX;
      buyY1 = popupY - popupH / 2 + headerH + 28 + buyH / 2;
      buyY2 = buyY1 + buyH + buyGap;
      
      if (!isStacked) {
        anteX = popupX;
        anteY = buyY2 + buyH / 2 + buyGap + anteH / 2;
      }
    } else {
      this.featuresMenuHitOverlay.setVisible(false);
      this.featuresMenuPopupBg.setVisible(false);
      this.featuresMenuTitleTxt.setVisible(false);
      this.featuresMenuCloseBtn.setVisible(false);
    }

    const showFeatures = !useFeaturesMenu || this.isFeaturesMenuOpen;
    const featuresDepthBase = this.isFeaturesMenuOpen ? 1501 : 20;

    this.panelSuperGraphics
      .setVisible(showFeatures)
      .setDepth(featuresDepthBase);
    this.buySuperHit.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.buySuperTxt1.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.buySuperTxt2.setVisible(showFeatures).setDepth(featuresDepthBase + 1);

    this.panelRegularGraphics
      .setVisible(showFeatures)
      .setDepth(featuresDepthBase);
    this.buyRegularHit.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.buyRegularTxt1
      .setVisible(showFeatures)
      .setDepth(featuresDepthBase + 1);
    this.buyRegularTxt2
      .setVisible(showFeatures)
      .setDepth(featuresDepthBase + 1);

    this.anteBetBtn.setVisible(showFeatures).setDepth(featuresDepthBase);
    this.anteBetHit.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.anteBetTxt.setVisible(showFeatures).setDepth(featuresDepthBase + 1);
    this.anteBetIcon.setVisible(showFeatures).setDepth(featuresDepthBase + 1);

    if (showFeatures) {
      // Regular Buy
      drawBuyPanel.call(this, this.panelRegularGraphics, buyW, buyH, false);
      this.buyRegularHit.setPosition(buyX1, buyY1).setSize(buyW, buyH);
      this.panelRegularGraphics.setPosition(buyX1, buyY1);
      updateBuyText.call(this, 
        this.buyRegularTxt1,
        this.buyRegularTxt2,
        buyX1,
        buyY1,
        buyW,
        buyH,
        'REGULAR',
      );

      // Super Buy
      drawBuyPanel.call(this, this.panelSuperGraphics, buyW, buyH, true);
      this.buySuperHit.setPosition(buyX2, buyY2).setSize(buyW, buyH);
      this.panelSuperGraphics.setPosition(buyX2, buyY2);
      updateBuyText.call(this, 
        this.buySuperTxt1,
        this.buySuperTxt2,
        buyX2,
        buyY2,
        buyW,
        buyH,
        'SUPER',
      );

      this.anteBetHit.setPosition(anteX, anteY).setSize(anteW, anteH);
      this.anteBetBtn.setPosition(anteX, anteY);
      drawAnteBetButton.call(this, anteW, anteH);
      
      // Icon + Text layout: LED on the far left, text centered in remaining space
      const anteFontSize = Math.max(8, Math.min(14, anteH * 0.35, anteW * 0.085));
      const iconSize = Math.max(12, Math.min(24, anteH * 0.45, anteW * 0.15));
      
      this.anteBetIcon
        .setPosition(anteX - anteW * 0.36, anteY)
        .setFontSize(iconSize)
        .setOrigin(0.5, 0.5);
        
      this.anteBetTxt
        .setPosition(anteX + anteW * 0.08, anteY)
        .setOrigin(0.5, 0.5)
        .setAlign('center')
        .setFontSize(anteFontSize);
    }

    // ==========================================
    // 4. BOTTOM BAR & HUD (delegated to BottomBarHUD)
    // ==========================================
    this.bottomBarHUD.layout(w, h, barH, isStacked, isMobile);

    // ==========================================
    // 5. TOOLBAR ICONS (Top Left)
    // ==========================================
    this.btnSettings.setPosition(toolPad, toolY);
    this.btnPaytable.setPosition(toolPad + toolGap, toolY);
    this.soundToggle.setPosition(toolPad + toolGap * 2, toolY);
    this.btnFullscreen.setPosition(toolPad + toolGap * 3, toolY);

    // Reposition icon images on top of their parent toolbar buttons
    const targetSize = isMobile ? 14 : 24;
    [
      this.iconSettings,
      this.iconPaytable,
      this.iconSound,
      this.iconFullscreen,
    ].forEach((icon, i) => {
      icon
        .setPosition(toolPad + toolGap * i, toolY)
        .setDisplaySize(targetSize, targetSize);
      this.baseScaleMap.set(icon, { x: icon.scaleX, y: icon.scaleY });
    });
    this.drawToolbarIcons();

    // ==========================================
    // 6. LOGO â€” uses pre-computed metrics from LayoutEngine
    // ==========================================
    if (m.logoVisible) {
      this.logoWrapper
        .setVisible(true)
        .setPosition(m.logoX, m.logoY)
        .setScale(m.logoScale);
    } else {
      this.logoWrapper.setVisible(false);
    }

    // FS Counter — cleanly above the grid frame in the reserved gap strip
    const fsFS = isStacked ? Math.min(22, w * 0.05) : Math.min(32, w * 0.055);
    const fsCounterY = gridY - 6;
    this.txtFSRemaining
      .setPosition(w / 2, fsCounterY)
      .setOrigin(0.5, 1) // anchor to bottom so text sits above gridY
      .setFontSize(fsFS);

    if (this.stakeEngine.isReplayMode()) {
      const replayScale = Math.min(1.5, Math.max(0.4, w / 800));
      // Position at spinY so it replaces the spin button rather than overlapping the grid
      const replayY = m.spinY;
      this.replayBtnHit.setPosition(w / 2, replayY).setSize(240 * replayScale, 70 * replayScale);
      this.replayBtnTxt.setPosition(w / 2, replayY).setFontSize(24 * replayScale);
    }
  }

  export function drawToolbarIcons(this: Game) {
    const isMobile = this.scale.width < 768;
    const iconR = isMobile ? 13 : 20;
    const positions = [
      { obj: this.btnSettings, icon: this.iconSettings, type: 'settings' },
      { obj: this.btnPaytable, icon: this.iconPaytable, type: 'info' },
      {
        obj: this.soundToggle,
        icon: this.iconSound,
        type: this.musicEnabled || this.sfxEnabled ? 'sound_on' : 'sound_off',
      },
      {
        obj: this.btnFullscreen,
        icon: this.iconFullscreen,
        type: 'fullscreen',
      },
    ];
    for (const { obj, icon, type } of positions) {
      if (!obj) continue;
      obj.clear();
      const cx = 0,
        cy = 0;
      const radius = iconR;
      const isSoundOff = type === 'sound_off';
      
      const borderColor = isSoundOff ? 0xff006a : 0xff006a;
      const borderAlpha = isSoundOff ? 0.35 : 1.0;
      const rimColor = isSoundOff ? 0xff88ff : 0xff88ff;

      // 1. Soft Drop Shadow
      obj.fillStyle(0x000000, 0.55);
      obj.fillCircle(cx, cy + 2.5, radius + 2);

      // 2. Main Glass Face (Deep gradient)
      obj.fillGradientStyle(
        0x2d174d, // Top-Left
        0x2d174d, // Top-Right
        0x0f0722, // Bottom-Left
        0x0f0722, // Bottom-Right
        0.9, 0.9, 0.95, 0.95 // Transparent alpha blend
      );
      obj.fillCircle(cx, cy, radius);

      // 3. Glare Sheen (Top Hemisphere highlight)
      obj.fillStyle(0xffffff, 0.16);
      obj.beginPath();
      obj.arc(cx, cy, radius - 1, Math.PI, 0, false);
      obj.closePath();
      obj.fillPath();

      // 4. Sharp Neon Pink Outer Rim
      obj.lineStyle(2, borderColor, borderAlpha);
      obj.strokeCircle(cx, cy, radius + 1);

      // 5. Beveled Inner Inner Edge Glow
      obj.lineStyle(1.0, rimColor, isSoundOff ? 0.15 : 0.4);
      obj.strokeCircle(cx, cy, radius - 0.5);

      // 6. Outer Subtle Glow Ring
      if (!isSoundOff) {
        obj.lineStyle(0.5, 0xffffff, 0.2);
        obj.strokeCircle(cx, cy, radius + 2.5);
      }

      // Update icon state
      if (icon) {
        icon.setAlpha(isSoundOff ? 0.35 : 0.95);
      }
      if (type === 'sound_on' && this.iconSound)
        this.iconSound.setTexture('icon_sound');
      if (type === 'sound_off' && this.iconSound)
        this.iconSound.setTexture('icon_sound_off');

      // Dynamically define non-overlapping hit areas
      const hitRadius = isMobile ? 17 : 23;
      obj.setInteractive(
        new Phaser.Geom.Circle(cx, cy, hitRadius),
        Phaser.Geom.Circle.Contains,
      );
      if (obj.input) obj.input.cursor = 'pointer';
    }
  }

  export function updateBuyText(this: Game, 
    txt1: Phaser.GameObjects.Text,
    txt2: Phaser.GameObjects.Text,
    x: number,
    y: number,
    w: number,
    h: number,
    type: string,
  ) {
    const isStacked = this.scale.width < 650 || this.scale.height > this.scale.width;
    const isCombinedButton = isStacked && type === 'REGULAR' && !this.isFeaturesMenuOpen;
    const isSmall = h < 50;

    // Adaptive font sizes: factor in both width and height to prevent text overlap
    const fsTitle = Math.max(8, Math.min(16, h * 0.22, w * 0.1));
    const fsSub = Math.max(9, Math.min(22, h * 0.32, w * (isCombinedButton ? 0.08 : 0.12)));

    const title = isCombinedButton ? 'BUY FEATURE' : (type === 'SUPER' ? 'SUPER FREE SPINS' : 'ULTRA FREE SPINS');
    const costMult = type === 'SUPER' ? 500 : 1000;
    const subText = isCombinedButton ? '1000X / 500X' : `${costMult}X BET`;

    const disabled = options.anteBetEnabled;
    const alpha = disabled ? 0.4 : 1;

    // At small sizes: NO stroke, only a tight 1px shadow for contrast.
    const strokeThick = isSmall ? 0 : Math.max(1, fsTitle * 0.08);
    const strokeCol = type === 'SUPER' ? '#550022' : '#553300';

    // Move text closer to center if height is small
    const yOffset1 = isSmall ? h * 0.12 : h * 0.16;
    const yOffset2 = isSmall ? h * 0.20 : h * 0.18;

    txt1
      .setText(title)
      .setPosition(x, y - yOffset1)
      .setFontSize(fsTitle)
      .setFontFamily('"Inter", "Outfit", sans-serif')
      .setFontStyle('800')
      .setLineSpacing(0)
      .setColor('#ffffff')
      .setStroke(strokeCol, strokeThick)
      .setShadow(0, 1, '#000000', isSmall ? 1 : 3, true, true)
      .setAlpha(alpha)
      .setAlign('center')
      .setOrigin(0.5); // Ensure origin is 0.5 explicitly

    txt2
      .setText(subText)
      .setPosition(x, y + yOffset2)
      .setFontSize(fsSub)
      .setFontFamily('"Inter", "Outfit", sans-serif')
      .setFontStyle('900')
      .setColor('#ffe600')
      .setStroke(strokeCol, isSmall ? 0 : Math.max(1, fsSub * 0.08))
      .setShadow(0, 1, '#000000', isSmall ? 1 : 2, true, true)
      .setAlpha(alpha)
      .setAlign('center')
      .setOrigin(0.5);
  }

  export function drawBuyPanel(this: Game, 
    gfx: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    isSuper: boolean,
  ) {
    gfx.clear();
    // Clean, sharp premium edges (no more overly rounded pills)
    const r = Math.min(h * 0.15, 8);
    const accentTop = isSuper ? 0xff4499 : 0xffdd44;
    const accentBot = isSuper ? 0xcc0055 : 0xcc8800;
    const accentMid = isSuper ? 0xff0066 : 0xffaa00;
    const isSmall = h < 50;

    const disabled = options.anteBetEnabled;

    // 0. Outer ambient glow for premium visibility
    if (!disabled) {
      gfx.fillStyle(accentMid, 0.15);
      gfx.fillRoundedRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, r + 4);
      gfx.fillStyle(accentMid, 0.25);
      gfx.fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, r + 2);
    }

    // 1. Drop shadow
    gfx.fillStyle(0x000000, disabled ? 0.3 : 0.6);
    gfx.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, r);

    // 2. Main body â€” bolder gradient
    if (disabled) {
      gfx.fillGradientStyle(0x555555, 0x555555, 0x333333, 0x333333, 1);
    } else {
      gfx.fillGradientStyle(accentTop, accentTop, accentBot, accentBot, 1);
    }
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);

    // 3. Top highlight â€” crisp, not blurred
    if (!isSmall) {
      gfx.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.4, 0.4, 0, 0);
      gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 1, w - 4, h * 0.35, {
        tl: r - 1, tr: r - 1, bl: 0, br: 0,
      } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);
    }

    // ULTRA-specific visual flair: Gold stars / sparkles inside the button
    if (!isSuper && !disabled) {
      gfx.fillStyle(0xffffff, 0.6);
      gfx.fillCircle(-w/3, -h/4, 2);
      gfx.fillCircle(w/4, h/3, 2.5);
      gfx.fillCircle(w/2.5, -h/3, 1.5);
      gfx.fillCircle(-w/4, h/4, 2);
      
      // Distinct inner gold glow
      gfx.lineStyle(2, 0xffffee, 0.5);
      gfx.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r - 2);
    }

    // 4. Single clean border â€” thicker and brighter
    gfx.lineStyle(isSmall ? 2 : 3, disabled ? 0x777777 : accentMid, disabled ? 0.6 : 1);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }

  export function drawAnteBetButton(this: Game, bw: number, bh: number) {
    this.anteBetBtn.clear();
    const x = -bw / 2;
    const y = -bh / 2;
    // Sharp modern edges for the outer panel
    const rad = Math.min(bh * 0.15, 8);
    const isSmall = bh < 40;
    const g = this.anteBetBtn;

    this.anteBetIcon.setVisible(true);

    if (options.anteBetEnabled) {
      // â”€â”€ ACTIVE STATE: Neon Green / Gold glowing track â”€â”€
      
      // Outer ambient glow (emerald/gold)
      g.fillStyle(0x00ff88, 0.15);
      g.fillRoundedRect(x - 8, y - 8, bw + 16, bh + 16, rad + 4);
      g.fillStyle(0xffcc00, 0.2);
      g.fillRoundedRect(x - 4, y - 4, bw + 8, bh + 8, rad + 2);

      // Deep dark base plate
      g.fillStyle(0x0a1a0f, 1);
      g.fillRoundedRect(x, y, bw, bh, rad);

      // Inner glowing panel (recessed)
      g.fillGradientStyle(0x006633, 0x003311, 0x002200, 0x001100, 1);
      g.fillRoundedRect(x + 2, y + 2, bw - 4, bh - 4, rad - 1);

      // Top inner shadow for depth
      g.fillStyle(0x000000, 0.6);
      g.fillRoundedRect(x + 2, y + 2, bw - 4, 6, { tl: rad - 1, tr: rad - 1, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);

      // Bright neon border rim
      g.lineStyle(isSmall ? 2 : 2.5, 0x00ff88, 1);
      g.strokeRoundedRect(x, y, bw, bh, rad);
      
      // Secondary specular rim highlight
      g.lineStyle(1, 0xffffff, 0.4);
      g.strokeRoundedRect(x + 1, y + 1, bw - 2, bh - 2, rad - 1);

      this.anteBetTxt
        .setText('ANTE BET ON\nDouble Chance')
        .setFontFamily('"Inter", "Outfit", sans-serif')
        .setFontStyle('900')
        .setColor('#ffffff')
        .setLineSpacing(isSmall ? -4 : -2)
        .setStroke('#004422', isSmall ? 0 : 3)
        .setShadow(0, 0, '#00ff88', 8, true, true);
        
      this.anteBetIcon
        .setText('\u25CF')
        .setColor('#00ff88')
        .setShadow(0, 0, '#00ff88', 8, true, true);
        
    } else {
      // â”€â”€ INACTIVE STATE: Deep sleek violet / black glass â”€â”€
      
      // Outer ambient drop shadow
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(x - 4, y - 2, bw + 8, bh + 8, rad + 2);

      // Outer bezel (chrome/dark metal)
      g.fillGradientStyle(0x443355, 0x221133, 0x11051a, 0x0a0211, 1);
      g.fillRoundedRect(x, y, bw, bh, rad);

      // Inner recessed track (very dark violet)
      g.fillStyle(0x05010a, 1);
      g.fillRoundedRect(x + 2, y + 2, bw - 4, bh - 4, rad - 1);

      // Top inner shadow
      g.fillStyle(0x000000, 0.8);
      g.fillRoundedRect(x + 2, y + 2, bw - 4, 8, { tl: rad - 1, tr: rad - 1, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);

      // Glass reflection across the top half
      if (!isSmall) {
        g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.08, 0.08, 0, 0);
        g.fillRoundedRect(x + 2, y + 2, bw - 4, bh * 0.4, { tl: rad - 1, tr: rad - 1, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);
      }

      // Sleek metallic border
      g.lineStyle(isSmall ? 1 : 1.5, 0x554477, 0.8);
      g.strokeRoundedRect(x, y, bw, bh, rad);

      this.anteBetTxt
        .setText('ANTE BET OFF\nDouble Chance')
        .setFontFamily('"Inter", "Outfit", sans-serif')
        .setFontStyle('700')
        .setColor('#8877aa')
        .setLineSpacing(isSmall ? -4 : -2)
        .setStroke('#000000', 0)
        .setShadow(0, 2, '#000000', 2, true, true);
        
      this.anteBetIcon
        .setText('\u25CF')
        .setColor('#665588')
        .setShadow(0, 0, '#000', 0, false, false);
    }
  }
