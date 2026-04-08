/**
 * app/_layout.tsx
 * Root layout: sets up providers, notification permission request,
 * and the notification response listener (tap → voice reminder).
 */
import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AlertProvider } from '@/template';
import { AppProvider } from '@/contexts/AppContext';
import {
  requestNotificationPermission,
} from '@/services/notificationService';
import { speakReminder, speakMissedAlert } from '@/services/voiceService';

export default function RootLayout() {
  const notifListenerRef = useRef<Notifications.EventSubscription | null>(null);
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // 1. Request permission + create Android channels
    requestNotificationPermission().catch(console.warn);

    // 2. Foreground notification listener — when notification arrives while app is open
    notifListenerRef.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as Record<string, any>;

      if (data?.type === 'medicine_reminder') {
        // Trigger voice reminder on foreground receipt
        const { memberName, medicineName, dosage } = data;
        if (memberName && medicineName && dosage) {
          speakReminder(memberName, medicineName, dosage, 'en-IN', 'female').catch(console.warn);
        }
      }
    });

    // 3. Response listener — when user taps on a notification
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, any>;

      if (data?.type === 'missed_dose') {
        const { memberName, medicineName } = data;
        if (memberName && medicineName) {
          speakMissedAlert(memberName, medicineName, 'en-IN', 'female').catch(console.warn);
        }
      }
    });

    return () => {
      notifListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, []);

  return (
    <AlertProvider>
      <SafeAreaProvider>
        <AppProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="add-medicine" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="add-family" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="medicine-detail" options={{ headerShown: false }} />
          </Stack>
        </AppProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
