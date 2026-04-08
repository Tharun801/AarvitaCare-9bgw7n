/**
 * notificationService.ts
 * Full local notification scheduling for AarvitaCare.
 *
 * Responsibilities:
 *  - Request permissions + create Android channels on first run
 *  - Schedule repeating daily notifications for every medicine × time slot
 *  - Cancel notifications when a medicine is removed / updated
 *  - Persist notificationId → { medicineId, time } map in AsyncStorage
 *  - Fire instant "missed" + "family alert" banners
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Notification handler (must be set at module level) ──────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Storage key for the notificationId registry ─────────────────────────────
const NOTIF_REGISTRY_KEY = '@aarvita_notif_registry';

// Registry shape:  { [notificationId]: { medicineId: string; time: string } }
type NotifRegistry = Record<string, { medicineId: string; time: string }>;

async function loadRegistry(): Promise<NotifRegistry> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveRegistry(registry: NotifRegistry): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_REGISTRY_KEY, JSON.stringify(registry));
  } catch {}
}

// ─── Permission + Android channels ───────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medicine-reminders', {
      name: 'Medicine Reminders',
      description: 'Daily reminders to take your medicines',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0D9B76',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync('missed-alerts', {
      name: 'Missed Dose Alerts',
      description: 'Alerts when a medicine dose is missed',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#EF4444',
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('family-alerts', {
      name: 'Family Health Alerts',
      description: 'Caregiver notifications for missed doses',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#F97316',
      sound: 'default',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Schedule all reminders for ONE medicine ─────────────────────────────────
/**
 * Schedules one repeating daily notification per time slot.
 * Cancels any previously scheduled notifications for this medicineId first.
 *
 * @returns array of newly created notificationIds
 */
export async function scheduleMedicineReminders(params: {
  medicineId: string;
  medicineName: string;
  memberName: string;
  dosage: string;
  times: string[];          // ['08:00', '20:00']
  language?: string;
  instructions?: string;
}): Promise<string[]> {
  const { medicineId, medicineName, memberName, dosage, times, instructions } = params;

  // Cancel existing notifications for this medicine first
  await cancelMedicineReminders(medicineId);

  const registry = await loadRegistry();
  const newIds: string[] = [];

  for (const time of times) {
    const [hour, minute] = time.split(':').map(Number);
    if (isNaN(hour) || isNaN(minute)) continue;

    try {
      const timeLabel = formatTime(hour, minute);
      const body = instructions
        ? `${memberName} • ${dosage} — ${instructions}`
        : `${memberName}, take ${dosage} now`;

      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `💊 ${medicineName} at ${timeLabel}`,
          body,
          data: {
            type: 'medicine_reminder',
            medicineId,
            memberName,
            medicineName,
            dosage,
            scheduledTime: time,
          },
          sound: 'default',
          ...(Platform.OS === 'android' ? { color: '#0D9B76', channelId: 'medicine-reminders' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });

      registry[notifId] = { medicineId, time };
      newIds.push(notifId);
    } catch (err) {
      console.error(`Failed to schedule notification for ${medicineName} at ${time}:`, err);
    }
  }

  await saveRegistry(registry);
  return newIds;
}

// ─── Cancel all scheduled notifications for a medicine ───────────────────────
export async function cancelMedicineReminders(medicineId: string): Promise<void> {
  const registry = await loadRegistry();
  const toCancel = Object.entries(registry).filter(([, v]) => v.medicineId === medicineId);

  await Promise.all(
    toCancel.map(([notifId]) =>
      Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {})
    )
  );

  // Remove from registry
  for (const [notifId] of toCancel) {
    delete registry[notifId];
  }
  await saveRegistry(registry);
}

// ─── Cancel ALL scheduled notifications (e.g. on logout) ─────────────────────
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(NOTIF_REGISTRY_KEY);
}

// ─── Reschedule all medicines for a member (used on login / sync) ─────────────
export async function rescheduleAllReminders(medicines: Array<{
  id: string;
  name: string;
  dosage: string;
  times: string[];
  instructions?: string;
  active: boolean;
}>, memberName: string): Promise<void> {
  for (const med of medicines) {
    if (!med.active) {
      await cancelMedicineReminders(med.id);
      continue;
    }
    await scheduleMedicineReminders({
      medicineId: med.id,
      medicineName: med.name,
      memberName,
      dosage: med.dosage,
      times: med.times,
      instructions: med.instructions,
    });
  }
}

// ─── Instant "missed dose" notification ──────────────────────────────────────
export async function sendMissedDoseAlert(params: {
  memberName: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
}): Promise<void> {
  const { memberName, medicineName, dosage, scheduledTime } = params;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `⚠️ Missed Dose — ${medicineName}`,
      body: `${memberName} missed ${dosage} scheduled at ${scheduledTime}. Please take it now.`,
      data: { type: 'missed_dose', medicineName, memberName },
      sound: 'default',
      ...(Platform.OS === 'android' ? { color: '#EF4444', channelId: 'missed-alerts' } : {}),
    },
    trigger: null, // immediate
  });
}

// ─── Instant "family caregiver" notification ─────────────────────────────────
export async function sendFamilyAlert(params: {
  patientName: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  caregiverName?: string;
}): Promise<void> {
  const { patientName, medicineName, dosage, scheduledTime, caregiverName } = params;
  const recipient = caregiverName ? `${caregiverName}, ` : '';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `👨‍👩‍👧 Family Alert — ${patientName}`,
      body: `${recipient}${patientName} missed ${medicineName} (${dosage}) at ${scheduledTime}.`,
      data: { type: 'family_alert', patientName, medicineName },
      sound: 'default',
      ...(Platform.OS === 'android' ? { color: '#F97316', channelId: 'family-alerts' } : {}),
    },
    trigger: null,
  });
}

// ─── Refill warning notification ─────────────────────────────────────────────
export async function sendRefillAlert(params: {
  medicineName: string;
  remainingTablets: number;
}): Promise<void> {
  const { medicineName, remainingTablets } = params;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔔 Low Stock — ${medicineName}`,
      body: `Only ${remainingTablets} tablet${remainingTablets !== 1 ? 's' : ''} left. Time to refill!`,
      data: { type: 'refill_alert', medicineName },
      sound: 'default',
      ...(Platform.OS === 'android' ? { color: '#EAB308', channelId: 'medicine-reminders' } : {}),
    },
    trigger: null,
  });
}

// ─── Get count of all scheduled notifications ────────────────────────────────
export async function getScheduledCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}

// ─── Helper: format hour/minute to "8:00 AM" ─────────────────────────────────
function formatTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = String(minute).padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}

// ─── Legacy compat shim (used in old code paths) ─────────────────────────────
export async function scheduleMedicineReminder(
  medicineId: string,
  medicineName: string,
  memberName: string,
  time: string,
  dosage: string
): Promise<string | null> {
  const ids = await scheduleMedicineReminders({
    medicineId,
    medicineName,
    memberName,
    dosage,
    times: [time],
  });
  return ids[0] ?? null;
}

// ─── Re-export old name for backward compat ──────────────────────────────────
export { sendMissedDoseAlert as sendMissedAlert };
