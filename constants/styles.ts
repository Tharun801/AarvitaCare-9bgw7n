import { StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadow } from './theme';

export const GlobalStyles = StyleSheet.create({
  flex1: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  screenBg: { flex: 1, backgroundColor: Colors.background },
  
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    ...Shadow.md,
  },
  cardTinted: {
    backgroundColor: Colors.surfaceTinted,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  
  // Text styles
  heading1: {
    fontSize: Typography['3xl'],
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    lineHeight: Typography['3xl'] * Typography.tight,
  },
  heading2: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  heading3: {
    fontSize: Typography.xl,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  bodyLarge: {
    fontSize: Typography.md,
    fontWeight: Typography.regular,
    color: Colors.textSecondary,
    lineHeight: Typography.md * Typography.relaxed,
  },
  body: {
    fontSize: Typography.base,
    fontWeight: Typography.regular,
    color: Colors.textSecondary,
    lineHeight: Typography.base * Typography.normal,
  },
  caption: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },

  // Input
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    fontSize: Typography.md,
    color: Colors.textPrimary,
    minHeight: 52,
  },
  inputFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing[3],
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3],
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
});
