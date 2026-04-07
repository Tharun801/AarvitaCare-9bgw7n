import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '@/constants/theme';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface HealthScoreRingProps {
  score: number;
  size?: number;
  label?: string;
}

export function HealthScoreRing({ score, size = 100, label = 'Health Score' }: HealthScoreRingProps) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return Colors.success;
    if (s >= 60) return Colors.primary;
    if (s >= 40) return Colors.warning;
    return Colors.error;
  };

  const color = getScoreColor(score);
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDash = circumference - (score / 100) * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={styles.svgPlaceholder}>
        <View style={[styles.outerRing, {
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: Colors.borderLight,
        }]} />
        <View style={[styles.progressArc, {
          position: 'absolute',
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          borderTopColor: color,
          borderRightColor: score > 25 ? color : 'transparent',
          borderBottomColor: score > 50 ? color : 'transparent',
          borderLeftColor: score > 75 ? color : 'transparent',
          transform: [{ rotate: '-90deg' }],
        }]} />
      </View>
      <View style={styles.center}>
        <Text style={[styles.score, { color, fontSize: size * 0.22 }]}>{score}</Text>
        <Text style={[styles.label, { fontSize: size * 0.1 }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgPlaceholder: {
    position: 'absolute',
  },
  outerRing: {},
  progressArc: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontWeight: '800',
  },
  label: {
    color: Colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
});
