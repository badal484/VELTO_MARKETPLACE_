/**
 * Velto Premium Design System
 *
 * Curated HSL-tailored colors for a modern, high-fidelity experience.
 */

export const theme = {
  colors: {
    // Brand Colors
    primary: '#0F172A', // Deep Navy (Slate 900)
    secondary: '#1E293B', // Navy (Slate 800)
    accent: '#F59E0B', // Amber 500
    accentLight: '#FEF3C7', // Amber 100

    // UI Colors
    background: '#F8FAFC', // Slate 50
    surface: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E2E8F0', // Slate 200

    // Text Colors
    text: '#0F172A', // Slate 900
    textSecondary: '#475569', // Slate 600
    muted: '#94A3B8', // Slate 400

    // Feedback Colors
    success: '#10B981', // Emerald 500
    danger: '#EF4444', // Red 500
    warning: '#FBBF24', // Amber 400
    info: '#3B82F6', // Blue 500

    // Miscellaneous
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
    shadow: 'rgba(15, 23, 42, 0.08)',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  radius: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    full: 999,
  },

  fontSize: {
    tiny: 10,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    hero: 40,
  },

  shadow: {
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: {width: 0, height: 10},
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 10,
    },
  },
};