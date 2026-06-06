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

    // === RIGID CARTOON CANDY MACHINE GRID FRAME ===
    this.gridFrame.clear();
    const f = this.gridFrame;

    const borderThickness = Math.max(8, Math.min(gridW, gridH) * 0.028);
    const framePadding = borderThickness + 4;
    const frameW = gridW + framePadding * 2;
    const frameH = gridH + framePadding * 2;
    const frameX = gridX - framePadding;
    const frameY = gridY - framePadding;
    const frameR = Math.max(12, Math.min(gridW, gridH) * 0.025);

    // --- Layer 1: Hard drop shadow (no blur, comic-book) ---
    f.fillStyle(0x000000, 0.6);
    f.fillRoundedRect(frameX + 5, frameY + 7, frameW, frameH, frameR + 2);

    // --- Layer 2: Thick solid candy rim (hyper-saturated pink) ---
    f.fillStyle(0xff3399, 1);
    f.fillRoundedRect(frameX, frameY, frameW, frameH, frameR);

    // Top half brighter highlight
    f.fillGradientStyle(0xff66bb, 0xff66bb, 0xff3399, 0xff3399, 1);
    f.fillRoundedRect(frameX, frameY, frameW, frameH * 0.4, {
      tl: frameR,
      tr: frameR,
      bl: 0,
      br: 0,
    } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);

    // Hard glossy white stripe on top edge
    f.fillStyle(0xffffff, 0.5);
    f.fillRoundedRect(
      frameX + 6,
      frameY + 3,
      frameW - 12,
      borderThickness * 0.4,
      { tl: frameR - 2, tr: frameR - 2, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius,
    );

    // --- Layer 3: Inner recess (dark well holding the grid) ---
    const innerX = frameX + borderThickness;
    const innerY = frameY + borderThickness;
    const innerW = frameW - borderThickness * 2;
    const innerH = frameH - borderThickness * 2;
    const innerR = Math.max(6, frameR - 4);

    // Dark inset shadow
    f.fillStyle(0x000000, 0.5);
    f.fillRoundedRect(
      innerX - 2,
      innerY - 2,
      innerW + 4,
      innerH + 4,
      innerR + 2,
    );

    // Inner border (bright saturated)
    f.lineStyle(2.5, 0xffdd00, 0.8);
    f.strokeRoundedRect(innerX, innerY, innerW, innerH, innerR);

    // --- Layer 4: Thick outer rim border (gold/yellow) ---
    f.lineStyle(3, 0xffee44, 0.9);
    f.strokeRoundedRect(frameX, frameY, frameW, frameH, frameR);

    // --- Layer 5: Decorative candy-bolt corner accents ---
    const minGridDim = Math.min(gridW, gridH);
    if (minGridDim > 250) {
      const boltR = Math.max(5, minGridDim * 0.014);
      const boltInset = borderThickness * 0.5;
      const boltPositions = [
        { x: frameX + boltInset, y: frameY + boltInset },
        { x: frameX + frameW - boltInset, y: frameY + boltInset },
        { x: frameX + boltInset, y: frameY + frameH - boltInset },
        { x: frameX + frameW - boltInset, y: frameY + frameH - boltInset },
      ];
      for (const bp of boltPositions) {
        // Hard shadow bolt
        f.fillStyle(0x000000, 0.5);
        f.fillCircle(bp.x + 2, bp.y + 2, boltR);
        // Bolt body — bright yellow/gold
        f.fillStyle(0xffdd44, 1);
        f.fillCircle(bp.x, bp.y, boltR);
        // Bolt highlight
        f.fillStyle(0xffffff, 0.7);
        f.fillCircle(bp.x - boltR * 0.25, bp.y - boltR * 0.25, boltR * 0.4);
        // Thick bolt rim
        f.lineStyle(2, 0xcc8800, 1);
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
        // Space is extremely tight on this screen.
        // Shrink the buttons aggressively and center them in the exact gap.
        buyH = Math.max(30, Math.min(buyH, (gapBetweenGridAndSpin - 16) * 0.6));
        buyRowH = buyH;
        buyY1 = gridBottom + gapBetweenGridAndSpin / 2;
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

      // Cartoon arcade popup backdrop
      this.featuresMenuPopupBg.fillStyle(0x000000, 0.7);
      this.featuresMenuPopupBg.fillRoundedRect(
        popupX - popupW / 2 + 6,
        popupY - popupH / 2 + 8,
        popupW,
        popupH,
        16,
      );
      
      // Main Solid Panel (vivid purple)
      this.featuresMenuPopupBg.fillStyle(0x330066, 1);
      this.featuresMenuPopupBg.fillRoundedRect(
        popupX - popupW / 2,
        popupY - popupH / 2,
        popupW,
        popupH,
        14,
      );
      
      // Header Background (Solid candy pink)
      this.featuresMenuPopupBg.fillStyle(0xff0070, 1);
      this.featuresMenuPopupBg.fillRoundedRect(
        popupX - popupW / 2,
        popupY - popupH / 2,
        popupW,
        headerH + 20,
        { tl: 14, tr: 14, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius
      );

      // Hard glossy highlight on header
      this.featuresMenuPopupBg.fillStyle(0xffffff, 0.25);
      this.featuresMenuPopupBg.fillRoundedRect(
        popupX - popupW / 2 + 4,
        popupY - popupH / 2 + 3,
        popupW - 8,
        (headerH + 20) * 0.3,
        { tl: 12, tr: 12, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius
      );

      // Thick cartoon border
      this.featuresMenuPopupBg.lineStyle(3, 0xffdd44, 1);
      this.featuresMenuPopupBg.strokeRoundedRect(
        popupX - popupW / 2,
        popupY - popupH / 2,
        popupW,
        popupH,
        14,
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
    
    // Ante bet only elevates to popup depth if it is physically located INSIDE the popup
    const anteDepthBase = (this.isFeaturesMenuOpen && !isStacked) ? 1501 : 20;

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

    this.anteBetBtn.setVisible(showFeatures).setDepth(anteDepthBase);
    this.anteBetHit.setVisible(showFeatures).setDepth(anteDepthBase + 1);
    this.anteBetTxt.setVisible(showFeatures).setDepth(anteDepthBase + 1);
    this.anteBetIcon.setVisible(showFeatures).setDepth(anteDepthBase + 1);

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
      .setFontFamily('"Poppins", sans-serif')
      .setFontStyle('normal')
      .setLineSpacing(0)
      .setColor('#ffffff')
      .setStroke(strokeCol, strokeThick)
      .setShadow(0, 2, '#000000', 0, false, true)
      .setAlpha(alpha)
      .setAlign('center')
      .setOrigin(0.5); // Ensure origin is 0.5 explicitly

    txt2
      .setText(subText)
      .setPosition(x, y + yOffset2)
      .setFontSize(fsSub)
      .setFontFamily('"Poppins", sans-serif')
      .setFontStyle('normal')
      .setAlign('center')
      .setShadow(0, 2, '#000000', 0, false, true)
      .setOrigin(0.5);
  }

  export function drawBuyPanel(this: Game, 
    gfx: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    isSuper: boolean,
  ) {
    gfx.clear();
    const r = Math.min(h * 0.2, 10);
    const disabled = options.anteBetEnabled;

    if (disabled) {
      // Disabled state — muted and rigid
      gfx.fillStyle(0x000000, 0.5);
      gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, r);
      gfx.fillStyle(0x444444, 1);
      gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      gfx.lineStyle(2.5, 0x666666, 0.8);
      gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
      return;
    }

    // CARTOON ARCADE ACTIVE STATE
    // 0. Hard drop shadow (comic-book offset)
    gfx.fillStyle(0x000000, 0.65);
    gfx.fillRoundedRect(-w / 2 + 4, -h / 2 + 5, w, h, r);

    // 1. Solid vivid base color
    const baseColor = isSuper ? 0xff0055 : 0xffaa00;
    const topColor = isSuper ? 0xff4488 : 0xffcc44;
    gfx.fillStyle(baseColor, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);

    // 2. Brighter top half for 3D pop
    gfx.fillGradientStyle(topColor, topColor, baseColor, baseColor, 1);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h * 0.5, { tl: r, tr: r, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);

    // 3. Hard glossy highlight on top
    gfx.fillStyle(0xffffff, 0.4);
    gfx.fillRoundedRect(-w / 2 + 4, -h / 2 + 2, w - 8, h * 0.25, { tl: r - 2, tr: r - 2, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);

    // 4. Thick border (rigid cartoon outline)
    const borderColor = isSuper ? 0xffddee : 0xffee88;
    gfx.lineStyle(3, borderColor, 1);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

    // 5. Sparkle dots
    gfx.fillStyle(0xffffff, 0.8);
    gfx.fillCircle(-w/3, -h/4, 2.5);
    gfx.fillCircle(w/4, h/3, 3);
    gfx.fillCircle(w/2.5, -h/3, 2);
    gfx.fillCircle(-w/4, h/4, 2.5);
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
      // ── ACTIVE STATE: Neon Green Gummy ──
      
      // Drop shadow (comic style)
      g.fillStyle(0x3a0055, 0.6);
      g.fillRoundedRect(x + 2, y + 4, bw, bh, rad);

      // Deep green base plate
      g.fillStyle(0x00b359, 1);
      g.fillRoundedRect(x, y, bw, bh, rad);

      // Inner glowing panel
      g.fillGradientStyle(0x00e676, 0x00e676, 0x00cc66, 0x00cc66, 1);
      g.fillRoundedRect(x + 2, y + 2, bw - 4, bh - 4, rad - 1);

      // Glossy upper hemisphere
      if (!isSmall) {
        g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.4, 0.4, 0, 0);
        g.fillRoundedRect(x + 2, y + 2, bw - 4, bh * 0.4, { tl: rad - 1, tr: rad - 1, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);
      }

      // Bright neon border rim
      g.lineStyle(isSmall ? 2 : 3, 0xffffff, 1);
      g.strokeRoundedRect(x, y, bw, bh, rad);
      
      // Secondary specular rim highlight
      g.lineStyle(1, 0xffffff, 0.4);
      g.strokeRoundedRect(x + 1, y + 1, bw - 2, bh - 2, rad - 1);

      this.anteBetTxt
        .setText('ANTE BET ON\nDouble Chance')
        .setFontFamily('"Poppins", sans-serif')
        .setFontStyle('normal')
        .setColor('#ffffff')
        .setLineSpacing(isSmall ? -4 : -2)
        .setStroke('#004422', isSmall ? 0 : 3)
        .setShadow(0, 2, '#000000', 0, false, true);
        
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
        .setFontFamily('"Poppins", sans-serif')
        .setFontStyle('normal')
        .setColor('#8877aa')
        .setLineSpacing(isSmall ? -4 : -2)
        .setStroke('#000000', 0)
        .setShadow(0, 2, '#000000', 0, false, true);
        
      this.anteBetIcon
        .setText('\u25CF')
        .setColor('#665588')
        .setShadow(0, 0, '#000', 0, false, false);
    }
  }
