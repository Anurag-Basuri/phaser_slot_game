/**
 * LayoutEngine — Single source of truth for responsive layout metrics.
 *
 * Design principles:
 *  1. All sizes derive from ONE base metric: gridSize
 *  2. Screen classification is a single enum, not scattered booleans
 *  3. Every ratio is a named constant, not a magic number
 *  4. Sizes are clamped to guaranteed min/max for usability
 *
 * Usage:
 *   const metrics = computeLayout(w, h);
 *   // All components use metrics.* for positioning and sizing
 */

// ═══════════════════════════════════════════════════════════════
// SCREEN CLASSIFICATION
// ═══════════════════════════════════════════════════════════════

export type LayoutMode = 'portrait' | 'landscape-compact' | 'landscape-wide';

export function getLayoutMode(w: number, h: number): LayoutMode {
  if (h > w || w < 650) return 'portrait';
  if (h < 500) return 'landscape-compact';
  return 'landscape-wide';
}

// ═══════════════════════════════════════════════════════════════
// SIZE RATIOS (relative to gridSize)
// ═══════════════════════════════════════════════════════════════

const R = {
  // Spin button diameter as fraction of gridSize
  spinPortrait: 0.22,
  spinLandscape: 0.26,

  // Bet +/- button diameter as fraction of spinSize
  betBtn: 0.55,

  // Autoplay pill dimensions as fraction of spinSize
  autoPillW: 1.15,
  autoPillH: 0.32,
  autoGapPortrait: 0.35,   // Increased gap to separate auto pill from spin button
  autoGapLandscape: 0.40,

  // Toolbar icon radius as fraction of gridSize
  toolbarIcon: 0.05,

  // Bottom bar height as fraction of gridSize
  barH: 0.10,

  // Logo base dimensions (design-time pixel size of the logo container)
  logoBaseW: 460,
  logoBaseH: 150,
} as const;

// Absolute clamps to guarantee usability
const CLAMP = {
  spinMin: 48,
  spinMax: 160,
  betBtnMin: 24,
  betBtnMax: 80,
  toolbarIconMin: 14,
  toolbarIconMax: 28,
  barHMin: 42,
  barHMax: 60,
  gridMin: 140,
  logoScaleMin: 0.15,
  logoScaleMax: 0.85,
} as const;

// ═══════════════════════════════════════════════════════════════
// LAYOUT METRICS (computed output)
// ═══════════════════════════════════════════════════════════════

export interface LayoutMetrics {
  // Screen
  mode: LayoutMode;
  isMobile: boolean;
  w: number;
  h: number;

  // Bottom bar
  barH: number;
  safeH: number; // h - barH

  // Toolbar
  toolbarY: number;
  toolbarH: number;
  toolbarPad: number;
  toolbarGap: number;
  toolbarIconSize: number;

  // Grid (always square)
  gridX: number;
  gridY: number;
  gridSize: number;
  cellSize: number;

  // Spin button
  spinX: number;
  spinY: number;
  spinSize: number;

  // Bet +/- buttons
  betBtnSize: number;

  // Autoplay pill
  autoPillW: number;
  autoPillH: number;
  autoGap: number;
  autoY: number;

  // Logo
  logoX: number;
  logoY: number;
  logoScale: number;
  logoVisible: boolean;
}

// ═══════════════════════════════════════════════════════════════
// CORE COMPUTATION
// ═══════════════════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeLayout(w: number, h: number): LayoutMetrics {
  const mode = getLayoutMode(w, h);
  const isMobile = w < 768;

  // ── 1. Bottom bar ──
  const barH = clamp(Math.round(h * 0.065), CLAMP.barHMin, CLAMP.barHMax);
  const safeH = h - barH;

  // ── 2. Toolbar ──
  // Base Y is the center of the icons. Provide enough padding so the top edge of the icons never clips.
  const toolbarY = clamp(Math.round(safeH * 0.04), 30, 48);
  const toolbarH = isMobile ? 32 : 40;
  const toolbarPad = isMobile ? 20 : 35; // slightly increased horizontal padding too
  const toolbarGap = mode === 'landscape-compact' ? 38 : isMobile ? 38 : 50;

  // ── 3. Grid sizing ──
  let gridSize: number;
  let gridX: number;
  let gridY: number;

  if (mode === 'portrait') {
    // Top reserved: toolbar + gap for FS/Tumble text
    const fsGap = clamp(Math.round(h * 0.08), 50, 75); // Larger gap to ensure both fit
    const topReserved = toolbarY + toolbarH + fsGap;

    // Bottom reserved: spin + autoplay + larger buy panels + padding
    const bottomEstimate = clamp(Math.round(h * 0.30), 200, 300);

    const availableH = safeH - topReserved - bottomEstimate;
    const maxGridW = w * 0.82;

    gridSize = Math.min(maxGridW, availableH);
    gridSize = Math.max(gridSize, CLAMP.gridMin);

    gridX = (w - gridSize) / 2;
    gridY = topReserved + Math.max(0, (availableH - gridSize) / 2);
  } else if (mode === 'landscape-compact') {
    // Landscape compact: grid centered but slightly right to leave room for features menu toggle
    gridSize = Math.min(safeH * 0.88, w * 0.42);
    gridSize = Math.max(gridSize, CLAMP.gridMin);
    gridX = (w - gridSize) / 2;
    gridY = (safeH - gridSize) / 2 + 5;
  } else {
    // landscape-wide: reduced grid width from 42% to 36% to allow massive buy panels on the left
    gridSize = Math.min(w * 0.36, safeH * 0.80);
    gridSize = Math.max(gridSize, CLAMP.gridMin);
    gridX = (w - gridSize) / 2;
    gridY = (safeH - gridSize) / 2 + 10;
  }

  gridSize = Math.round(gridSize);
  gridX = Math.round(gridX);
  gridY = Math.round(gridY);
  const cellSize = gridSize / 7;

  // ── 4. Toolbar icon size (from grid) ──
  const toolbarIconSize = clamp(
    Math.round(gridSize * R.toolbarIcon),
    CLAMP.toolbarIconMin,
    CLAMP.toolbarIconMax
  );

  // ── 5. Spin button (from grid) ──
  const spinRatio = mode === 'portrait' ? R.spinPortrait : R.spinLandscape;
  const spinSize = clamp(Math.round(gridSize * spinRatio), CLAMP.spinMin, CLAMP.spinMax);

  // Bet buttons (from spin)
  const betBtnSize = clamp(Math.round(spinSize * R.betBtn), CLAMP.betBtnMin, CLAMP.betBtnMax);

  // Autoplay pill
  const autoPillW = Math.max(70, Math.round(spinSize * R.autoPillW));
  const autoPillH = Math.max(24, Math.round(spinSize * R.autoPillH));
  const autoGap = mode === 'portrait'
    ? Math.max(12, Math.round(spinSize * R.autoGapPortrait))
    : Math.max(20, Math.round(spinSize * R.autoGapLandscape));

  // ── 6. Spin position ──
  let spinX: number;
  let spinY: number;

  if (mode === 'portrait') {
    spinX = w / 2;
    const gridBottom = gridY + gridSize;
    const availBottom = safeH - gridBottom;
    // Total vertical space needed: spinSize + autoGap + autoPillH
    const totalControlsH = spinSize + autoGap + autoPillH;
    
    // Push the control group towards the bottom bar to leave a large open space above it
    // for the Buy Feature and Ante Bet panels.
    const pushDownFactor = 0.85; // 0.5 = center, 1.0 = flush to bottom
    const controlsTopY = gridBottom + Math.max(10, (availBottom - totalControlsH) * pushDownFactor);
    spinY = controlsTopY + spinSize / 2;

    // Safety clamps — ensure controls never overlap grid or bottom bar
    const minSpinY = gridBottom + spinSize / 2 + 12;
    const maxSpinY = safeH - spinSize / 2 - autoGap - autoPillH - 5;
    if (maxSpinY > minSpinY) {
      spinY = clamp(spinY, minSpinY, maxSpinY);
    } else {
      spinY = minSpinY;
    }
  } else {
    // Landscape: spin in the right column
    const rightMargin = w - gridX - gridSize;
    const rightColCenter = gridX + gridSize + rightMargin / 2;
    spinX = rightColCenter;
    spinY = safeH * 0.72;
  }

  spinX = Math.round(spinX);
  spinY = Math.round(spinY);

  const autoY = Math.round(spinY + spinSize / 2 + autoGap);

  // ── 7. Logo placement ──
  let logoX = 0;
  let logoY = 0;
  let logoScale = 0;
  let logoVisible = false;

  if (mode === 'portrait') {
    const maxLogoW = clamp(w * 0.38, 100, 180); // 38% of screen width max
    const maxLogoH = toolbarH * 1.6; // allow slightly taller

    const scaleW = maxLogoW / R.logoBaseW;
    const scaleH = maxLogoH / R.logoBaseH;
    logoScale = clamp(Math.min(scaleW, scaleH), CLAMP.logoScaleMin, CLAMP.logoScaleMax);
    
    logoVisible = true;
    const actualLogoWidth = R.logoBaseW * logoScale;
    const actualLogoHeight = R.logoBaseH * logoScale;
    logoX = w - toolbarPad - (actualLogoWidth / 2);
    // Align logo top edge with the toolbar's top edge so it is never cut off
    logoY = (toolbarY - toolbarIconSize / 2) + (actualLogoHeight / 2); 
  } else if (mode === 'landscape-compact') {
    const availW = w * 0.5;
    const availH = gridY - 5;

    if (availH > 15) {
      const scaleW = availW / R.logoBaseW;
      const scaleH = availH / R.logoBaseH;
      logoScale = clamp(Math.min(scaleW, scaleH), CLAMP.logoScaleMin, CLAMP.logoScaleMax);
      logoVisible = true;
      logoX = w / 2;
      logoY = gridY / 2;
    }
  } else {
    // landscape-wide: right column above spin
    const rightMargin = w - gridX - gridSize;
    const availW = rightMargin * 0.9;
    const logoRegionTop = gridY;
    const logoRegionBot = spinY - spinSize / 2 - 20;
    const availH = logoRegionBot - logoRegionTop;

    if (availW > 80 && availH > 50) {
      const scaleW = availW / R.logoBaseW;
      const scaleH = availH / R.logoBaseH;
      logoScale = clamp(Math.min(scaleW, scaleH), CLAMP.logoScaleMin, CLAMP.logoScaleMax);
      logoVisible = true;
      const actualLogoWidth = R.logoBaseW * logoScale;
      logoX = w - actualLogoWidth / 2 - 20;
      logoY = logoRegionTop + availH * 0.25;
    }
  }

  return {
    mode,
    isMobile,
    w,
    h,
    barH,
    safeH,
    toolbarY,
    toolbarH,
    toolbarPad,
    toolbarGap,
    toolbarIconSize,
    gridX,
    gridY,
    gridSize,
    cellSize,
    spinX,
    spinY,
    spinSize,
    betBtnSize,
    autoPillW,
    autoPillH,
    autoGap,
    autoY,
    logoX,
    logoY,
    logoScale,
    logoVisible,
  };
}
