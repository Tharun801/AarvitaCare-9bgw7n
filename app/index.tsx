import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '@/constants/theme';
import { storageGet } from '@/services/storageService';
import { STORAGE_KEYS } from '@/constants/config';
import { useApp } from '@/hooks/useApp';
import { getSupabaseClient } from '@/template';

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading } = useApp();

  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(async () => {
      const onboarded = await storageGet<boolean>(STORAGE_KEYS.ONBOARDING_DONE);
      if (!onboarded) {
        router.replace('/onboarding');
        return;
      }
      const sb = getSupabaseClient();
      const { data: { session } } = await sb.auth.getSession();
      if (session && user?.isLoggedIn) {
        router.replace('/(tabs)');
      } else if (session && !user?.isLoggedIn) {
        // Has Supabase session but no local user — treat as logged in
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }, 2200);
    return () => clearTimeout(timer);
  }, [isLoading, user]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + Spacing[6] }]}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
            transition={200}
          />
        </View>
        <Text style={styles.appName}>AarvitaCare</Text>
        <Text style={styles.tagline}>Where health meets love ❤️</Text>
      </View>
      <View style={styles.footer}>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <Text style={styles.footerText}>Family Health Companion</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 80,
  },
  content: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[6],
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logo: { width: 80, height: 80 },
  appName: {
    fontSize: Typography.display,
    fontWeight: Typography.extrabold,
    color: Colors.white,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: Typography.md,
    color: 'rgba(255,255,255,0.7)',
    marginTop: Spacing[2],
    fontWeight: Typography.medium,
  },
  footer: { alignItems: 'center', gap: Spacing[3], paddingBottom: Spacing[4] },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: Colors.primary, width: 24 },
  footerText: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.sm },
});
