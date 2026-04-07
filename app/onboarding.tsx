import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Pressable, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { storageSet } from '@/services/storageService';
import { STORAGE_KEYS } from '@/constants/config';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    image: require('@/assets/images/onboarding1.png'),
    title: 'Never Miss a Medicine',
    subtitle: 'Smart reminders that care for your entire family, right on time — every time.',
    accent: Colors.primary,
  },
  {
    id: '2',
    image: require('@/assets/images/onboarding2.png'),
    title: 'Smart Reminders',
    subtitle: 'Voice reminders in your language — English, Hindi, Telugu, Tamil and more.',
    accent: Colors.accent,
  },
  {
    id: '3',
    image: require('@/assets/images/onboarding3.png'),
    title: 'Care Remotely',
    subtitle: 'Monitor your family\'s health from anywhere. Get instant alerts if they miss a dose.',
    accent: '#8B5CF6',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const handleNext = async () => {
    if (current < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: current + 1, animated: true });
      setCurrent(current + 1);
    } else {
      await storageSet(STORAGE_KEYS.ONBOARDING_DONE, true);
      router.replace('/login');
    }
  };

  const handleSkip = async () => {
    await storageSet(STORAGE_KEYS.ONBOARDING_DONE, true);
    router.replace('/login');
  };

  const slide = SLIDES[current];

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + Spacing[4] }]}>
      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Image
              source={item.image}
              style={styles.image}
              contentFit="cover"
              transition={300}
            />
            <View style={[styles.overlay, { backgroundColor: item.accent + '22' }]} />
          </View>
        )}
      />

      <View style={styles.content}>
        <View style={styles.indicators}>
          {SLIDES.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.indicator,
                idx === current && { backgroundColor: slide.accent, width: 28 },
                idx !== current && { backgroundColor: Colors.borderLight },
              ]}
            />
          ))}
        </View>

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>

        <View style={styles.actions}>
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.nextBtn,
              { backgroundColor: slide.accent },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.nextBtnText}>
              {current === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
            </Text>
          </Pressable>

          {current < SLIDES.length - 1 ? (
            <Pressable onPress={handleSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.secondary },
  slide: { width, height: height * 0.55, position: 'relative' },
  image: { width, height: height * 0.55 },
  overlay: { ...StyleSheet.absoluteFillObject },
  content: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: Spacing[6],
    paddingTop: Spacing[5],
    marginTop: -32,
  },
  indicators: { flexDirection: 'row', gap: 6, marginBottom: Spacing[5] },
  indicator: { height: 4, width: 10, borderRadius: 2 },
  title: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.extrabold,
    color: Colors.textPrimary,
    marginBottom: Spacing[3],
    lineHeight: Typography['2xl'] * 1.2,
  },
  subtitle: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    lineHeight: Typography.base * 1.6,
    marginBottom: Spacing[6],
    flex: 1,
  },
  actions: { gap: Spacing[3] },
  nextBtn: {
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.colored,
  },
  nextBtnText: {
    color: Colors.white,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
  skipBtn: { alignItems: 'center', paddingVertical: Spacing[2] },
  skipText: { color: Colors.textMuted, fontSize: Typography.base },
});
