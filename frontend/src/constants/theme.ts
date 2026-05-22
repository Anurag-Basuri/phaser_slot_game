/**
 * PREMIUM DESIGN SYSTEM — Unified theme for all UI components
 *
 * Provides consistent:
 * - Color palette (primary, secondary, accents, backgrounds)
 * - Typography (fonts, sizes, weights)
 * - Shadows and depth
 * - Border radius and spacing
 * - Gradients and visual effects
 */

export const Theme = {
  // ═════════════════════ COLORS ═════════════════════
  colors: {
    // Primary Palette
    primary: '#ff006a',
    primaryDark: '#cc0055',
    primaryLight: '#ff4d94',
    primaryLighter: '#ffb3d9',

    // Secondary & Accents
    secondary: '#ffe600',
    accent: '#00d9ff',
    accentDark: '#00a3cc',
    gold: '#ffe600',
    gold_light: '#ffcc00',
    gold_dark: '#ccaa00',

    // Status Colors
    success: '#00cc88',
    warning: '#ffaa00',
    error: '#ff4444',

    // Backgrounds
    bgDarkest: '#0a0f1a',
    bgDark: '#12131f',
    bgCard: '#15131f',
    bgPanel: '#1a1530',
    bgOverlay: '#0a0515',

    // Text
    textPrimary: '#ffffff',
    textSecondary: '#d0d0e0',
    textMuted: '#888899',
    textDark: '#444455',

    // Borders & Dividers
    border: '#2a2a3a',
    borderLight: '#3a3a4a',
    borderDim: '#1a1a2a',

    // Special
    transparent: 'rgba(0,0,0,0)',
  },

  // ═════════════════════ TYPOGRAPHY ═════════════════════
  fonts: {
    // Font families
    sans: '"Poppins", "Outfit", sans-serif',
    display: '"Montserrat", "Poppins", sans-serif',
    mono: '"Montserrat", "Inter", sans-serif',
    brand: '"Luckiest Guy", cursive, sans-serif', // Legacy brand font

    // Text styles
    h1: { size: 48, weight: 800, family: '"Montserrat"' },
    h2: { size: 36, weight: 700, family: '"Montserrat"' },
    h3: { size: 28, weight: 600, family: '"Outfit"' },
    h4: { size: 22, weight: 600, family: '"Outfit"' },
    h5: { size: 18, weight: 600, family: '"Outfit"' },

    body: { size: 16, weight: 400, family: '"Outfit"' },
    bodySmall: { size: 14, weight: 400, family: '"Outfit"' },
    bodyTiny: { size: 12, weight: 400, family: '"Outfit"' },

    label: { size: 13, weight: 500, family: '"Outfit"' },
    button: { size: 14, weight: 600, family: '"Outfit"' },
    buttonLarge: { size: 16, weight: 700, family: '"Outfit"' },

    numeric: { size: 24, weight: 700, family: '"Montserrat"' },
  },

  // ═════════════════════ SHADOWS ═════════════════════
  shadows: {
    none: 'none',
    sm: '0 2px 8px rgba(0, 0, 0, 0.3)',
    md: '0 4px 16px rgba(0, 0, 0, 0.4)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.5)',
    xl: '0 12px 48px rgba(0, 0, 0, 0.6)',
    glow: '0 0 20px rgba(255, 0, 106, 0.3)',
    glowAlt: '0 0 24px rgba(0, 217, 255, 0.2)',
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
    darkBg: 'linear-gradient(135deg, #0a0f1a 0%, #1a0f2e 100%)',
    cardBg:
      'linear-gradient(135deg, rgba(21, 19, 31, 0.8) 0%, rgba(18, 19, 31, 0.9) 100%)',
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
