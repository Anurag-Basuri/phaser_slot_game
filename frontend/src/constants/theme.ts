/**
 * ARCADE CANDY DESIGN SYSTEM — Hyper-saturated cartoonish UI
 *
 * Provides consistent:
 * - Color palette (vivid, glossy, candy-store saturation)
 * - Typography (thick strokes, hard shadows, cartoon fonts)
 * - Hard drop shadows (comic-book style, zero blur)
 * - Border radius and spacing
 * - Gradients and visual effects
 */

export const Theme = {
  // ═════════════════════ COLORS ═════════════════════
  colors: {
    // Primary Palette — Vibrant Candy Pink
    primary: '#ff3388',
    primaryDark: '#dd0060',
    primaryLight: '#ff66aa',
    primaryLighter: '#ffbbdd',

    // Secondary & Accents — Saturated candy tones
    secondary: '#ffe800',
    accent: '#00e5ff',
    accentDark: '#00bbdd',
    gold: '#ffdd00',
    gold_light: '#ffee44',
    gold_dark: '#ddaa00',

    // Status Colors — Vivid neon
    success: '#00ee88',
    warning: '#ffbb00',
    error: '#ff3333',

    // Backgrounds — Deep Berry / Plum (Synced with Phaser UI)
    bgDarkest: '#1a001a',
    bgDark: '#380036',
    bgCard: '#9b1b6c',
    bgPanel: '#550055',
    bgOverlay: '#220022',

    // Text — Crisp white with vibrant highlights
    textPrimary: '#ffffff',
    textSecondary: '#ffccdd',
    textMuted: '#ffaadd',
    textDark: '#550055',

    // Borders & Dividers — Creamy White/Pink Icing
    border: '#fff0f5',
    borderLight: '#ffffff',
    borderDim: '#ffccdd',

    // Special
    transparent: 'rgba(0,0,0,0)',
  },

  // ═════════════════════ TYPOGRAPHY ═════════════════════
  fonts: {
    // Font families - full cartoon bubbly override
    sans: '"Fredoka One", "Comic Sans MS", cursive, sans-serif',
    display: '"Fredoka One", "Comic Sans MS", cursive, sans-serif',
    mono: '"Fredoka One", "Comic Sans MS", cursive, sans-serif',
    brand: '"Fredoka One", "Comic Sans MS", cursive, sans-serif',

    // Text styles
    h1: { size: 48, weight: 800, family: '"Fredoka One", "Comic Sans MS", cursive, sans-serif' },
    h2: { size: 36, weight: 700, family: '"Fredoka One", "Comic Sans MS", cursive, sans-serif' },
    h3: { size: 28, weight: 600, family: '"Fredoka One", "Comic Sans MS", cursive, sans-serif' },
    h4: { size: 22, weight: 600, family: '"Fredoka One", "Comic Sans MS", cursive, sans-serif' },
    h5: { size: 18, weight: 600, family: '"Fredoka One", "Comic Sans MS", cursive, sans-serif' },

    body: { size: 16, weight: 400, family: '"Fredoka One", "Comic Sans MS", cursive, sans-serif' },
    bodySmall: { size: 14, weight: 400, family: '"Fredoka One", "Comic Sans MS", cursive, sans-serif' },
    bodyTiny: { size: 12, weight: 400, family: '"Fredoka One", "Comic Sans MS", cursive, sans-serif' },

    label: { size: 13, weight: 600, family: '"Fredoka One", "Comic Sans MS", cursive, sans-serif' },
    button: { size: 14, weight: 600, family: '"Fredoka One", "Comic Sans MS", cursive, sans-serif' },
    buttonLarge: { size: 16, weight: 700, family: '"Fredoka One", "Comic Sans MS", cursive, sans-serif' },

    numeric: { size: 24, weight: 700, family: '"Fredoka One", "Comic Sans MS", cursive, sans-serif' },
  },

  // ═════════════════════ SHADOWS (Soft Glossy Candy Style) ═════════════════════
  shadows: {
    none: 'none',
    sm: '0px 2px 0px rgba(0,0,0,0.2), inset 0px 2px 0px rgba(255,255,255,0.4)',
    md: '0px 4px 0px rgba(0,0,0,0.3), inset 0px 2px 0px rgba(255,255,255,0.4)',
    lg: '0px 6px 0px rgba(0,0,0,0.3), inset 0px 3px 0px rgba(255,255,255,0.4)',
    xl: '0px 8px 0px rgba(0,0,0,0.4), inset 0px 4px 0px rgba(255,255,255,0.5)',
    glow: '0 0 12px rgba(255, 0, 112, 0.6)',
    glowAlt: '0 0 12px rgba(0, 229, 255, 0.5)',
  },

  // ═════════════════════ SPACING ═════════════════════
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  // ═════════════════════ BORDER RADIUS ═════════════════════
  radius: {
    sm: 6,
    md: 12,
    lg: 18,
    xl: 24,
    full: 999,
  },

  // ═════════════════════ GRADIENTS ═════════════════════
  gradients: {
    primary: 'linear-gradient(135deg, #ff006a 0%, #ff4d94 100%)',
    primaryAlt: 'linear-gradient(180deg, #ff4d94 0%, #ff006a 100%)',
    accent: 'linear-gradient(135deg, #00d9ff 0%, #00a3cc 100%)',
    gold: 'linear-gradient(135deg, #ffe600 0%, #ffcc00 100%)',
    darkBg: 'linear-gradient(135deg, #380036 0%, #1a001a 100%)',
    cardBg:
      'linear-gradient(135deg, rgba(155, 27, 108, 0.8) 0%, rgba(85, 0, 85, 0.9) 100%)',
  },

  // ═════════════════════ ANIMATION ═════════════════════
  animation: {
    durationFast: 150,
    durationNormal: 300,
    durationSlow: 500,
    durationVerySlow: 800,

    easeIn: 'Quad.easeIn',
    easeOut: 'Quad.easeOut',
    easeInOut: 'Quad.easeInOut',
    easeCirc: 'Circ.easeOut',
    easeBounce: 'Back.easeOut',
  },
};

// ═════════════════════ COMPONENT STYLES ═════════════════════

export const ButtonStyle = {
  primary: {
    fill: Theme.colors.primary,
    text: Theme.colors.textPrimary,
    border: Theme.colors.primaryLight,
    shadow: Theme.shadows.md,
  },
  secondary: {
    fill: Theme.colors.bgCard,
    text: Theme.colors.textSecondary,
    border: Theme.colors.border,
    shadow: Theme.shadows.sm,
  },
  success: {
    fill: Theme.colors.success,
    text: Theme.colors.textPrimary,
    border: Theme.colors.success,
    shadow: Theme.shadows.md,
  },
};

export const PanelStyle = {
  default: {
    bg: Theme.colors.bgPanel,
    border: Theme.colors.border,
    text: Theme.colors.textSecondary,
    shadow: Theme.shadows.lg,
  },
  dark: {
    bg: Theme.colors.bgDark,
    border: Theme.colors.borderDim,
    text: Theme.colors.textMuted,
    shadow: Theme.shadows.xl,
  },
  accent: {
    bg: 'rgba(255, 0, 106, 0.05)',
    border: Theme.colors.primary,
    text: Theme.colors.textPrimary,
    shadow: Theme.shadows.md,
  },
};

export const CardStyle = {
  default: {
    bg: Theme.colors.bgCard,
    border: Theme.colors.borderLight,
    shadow: Theme.shadows.md,
  },
  elevated: {
    bg: Theme.colors.bgCard,
    border: Theme.colors.borderDim,
    shadow: Theme.shadows.lg,
  },
};
