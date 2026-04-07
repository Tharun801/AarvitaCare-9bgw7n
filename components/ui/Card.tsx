import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Shadow } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'tinted' | 'colored' | 'outlined';
  color?: string;
  padding?: number;
}

export function Card({ children, style, variant = 'default', color, padding = Spacing[4] }: CardProps) {
  const variantStyle = {
    default: { backgroundColor: Colors.surface, ...Shadow.md },
    tinted: { backgroundColor: Colors.surfaceTinted, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
    colored: { backgroundColor: color || Colors.primary, ...Shadow.colored },
    outlined: { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: color || Colors.border },
  };

  return (
    <View style={[styles.base, variantStyle[variant], { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
});
