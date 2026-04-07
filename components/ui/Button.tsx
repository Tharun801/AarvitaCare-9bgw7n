import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  label, onPress, variant = 'primary', size = 'md',
  loading, disabled, fullWidth, icon, style, textStyle,
}: ButtonProps) {
  const variantStyles = {
    primary: {
      bg: Colors.primary,
      text: Colors.white,
      border: Colors.primary,
      pressedBg: Colors.primaryDark,
    },
    secondary: {
      bg: Colors.secondary,
      text: Colors.white,
      border: Colors.secondary,
      pressedBg: Colors.secondaryLight,
    },
    outline: {
      bg: 'transparent',
      text: Colors.primary,
      border: Colors.primary,
      pressedBg: Colors.primaryLight,
    },
    ghost: {
      bg: 'transparent',
      text: Colors.textSecondary,
      border: 'transparent',
      pressedBg: Colors.borderLight,
    },
    danger: {
      bg: Colors.error,
      text: Colors.white,
      border: Colors.error,
      pressedBg: '#DC2626',
    },
  };

  const sizeStyles = {
    sm: { paddingH: Spacing[3], paddingV: Spacing[2], fontSize: Typography.sm, height: 40 },
    md: { paddingH: Spacing[5], paddingV: Spacing[3], fontSize: Typography.base, height: 52 },
    lg: { paddingH: Spacing[6], paddingV: Spacing[4], fontSize: Typography.md, height: 60 },
  };

  const vs = variantStyles[variant];
  const ss = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? vs.pressedBg : vs.bg,
          borderColor: vs.border,
          height: ss.height,
          paddingHorizontal: ss.paddingH,
          opacity: isDisabled ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        fullWidth && styles.fullWidth,
        variant === 'primary' && Shadow.colored,
        style,
      ]}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      {loading ? (
        <ActivityIndicator color={vs.text} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: vs.text, fontSize: ss.fontSize }, icon ? styles.labelWithIcon : null, textStyle]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  fullWidth: { width: '100%' },
  label: {
    fontWeight: Typography.semibold,
    textAlign: 'center',
  },
  labelWithIcon: { marginLeft: Spacing[2] },
});
