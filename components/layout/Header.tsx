import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Shadow } from '@/constants/theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  transparent?: boolean;
  dark?: boolean;
}

export function Header({ title, subtitle, showBack, rightAction, transparent, dark }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bg = transparent ? 'transparent' : Colors.white;
  const textColor = dark ? Colors.white : Colors.textPrimary;
  const subtitleColor = dark ? 'rgba(255,255,255,0.7)' : Colors.textMuted;

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top + Spacing[2], backgroundColor: bg },
      !transparent && Shadow.sm,
    ]}>
      <View style={styles.inner}>
        {showBack ? (
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={24} color={textColor} />
          </Pressable>
        ) : (
          <View style={styles.placeholder} />
        )}
        <View style={styles.titleArea}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text> : null}
        </View>
        <View style={styles.rightArea}>
          {rightAction || <View style={styles.placeholder} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing[3],
    paddingHorizontal: Spacing[4],
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
  },
  titleArea: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
  },
  subtitle: {
    fontSize: Typography.xs,
    marginTop: 2,
  },
  rightArea: {
    width: 40,
    alignItems: 'flex-end',
  },
  placeholder: {
    width: 40,
  },
});
