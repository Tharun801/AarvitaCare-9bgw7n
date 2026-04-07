import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

interface BadgeProps {
  label: string;
  color?: string;
  bgColor?: string;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function Badge({ label, color, bgColor, size = 'md', dot }: BadgeProps) {
  const textColor = color || Colors.primary;
  const bg = bgColor || Colors.primaryLight;
  const fontSize = size === 'sm' ? Typography.xs : Typography.sm;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {dot && <View style={[styles.dot, { backgroundColor: textColor }]} />}
      <Text style={[styles.label, { color: textColor, fontSize }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  label: {
    fontWeight: '600',
  },
});
