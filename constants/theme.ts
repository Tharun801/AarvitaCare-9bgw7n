// AarvitaCare Design System
// Physical Metaphor: Clean Medical Paper with soft layered shadows

export const Colors = {
  // Primary brand
  primary: '#0D9B76',        // Teal green
  primaryDark: '#0A7D5E',
  primaryLight: '#E8F7F3',
  primaryMuted: '#B2DFDB',

  // Secondary
  secondary: '#1A2F4E',      // Deep navy
  secondaryLight: '#2A4568',
  secondaryMuted: '#E8EDF3',

  // Accent
  accent: '#F97316',         // Warm orange
  accentLight: '#FFF3E8',
  accentMuted: '#FED7AA',

  // Semantic
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#EAB308',
  warningLight: '#FEF9C3',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Neutrals
  white: '#FFFFFF',
  background: '#F0F7F5',
  surface: '#FFFFFF',
  surfaceTinted: '#F8FFFE',
  border: '#E2EDE9',
  borderLight: '#F0F5F3',

  // Text
  textPrimary: '#1A2F4E',
  textSecondary: '#4A6580',
  textMuted: '#8BA3B8',
  textOnPrimary: '#FFFFFF',
  textOnDark: '#FFFFFF',

  // Chart
  chartGreen: '#22C55E',
  chartRed: '#EF4444',
  chartGray: '#CBD5E1',

  // Streaks
  streakFire: '#F97316',
  streakGold: '#EAB308',

  // Family role colors
  familyFather: '#1A2F4E',
  familyMother: '#E91E8C',
  familyChild: '#F97316',
  familySelf: '#0D9B76',
  familyGrandparent: '#8B5CF6',
};

export const Typography = {
  // Font sizes (elder-friendly, base 17px)
  xs: 12,
  sm: 14,
  base: 17,
  md: 18,
  lg: 20,
  xl: 22,
  '2xl': 26,
  '3xl': 30,
  '4xl': 36,
  display: 42,

  // Font weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,

  // Line heights
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
};

export const Spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#1A2F4E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A2F4E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1A2F4E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  colored: {
    shadowColor: '#0D9B76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
};
