import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medicine-reminders', {
      name: 'Medicine Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0D9B76',
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('family-alerts', {
      name: 'Family Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#EF4444',
      sound: 'default',
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleMedicineReminder(
  medicineId: string,
  medicineName: string,
  memberName: string,
  time: string,
  dosage: string
): Promise<string | null> {
  try {
    const [hour, minute] = time.split(':').map(Number);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Medicine Reminder 💊`,
        body: `${memberName}, time to take ${medicineName} - ${dosage}`,
        data: { medicineId, type: 'reminder' },
        sound: 'default',
        color: '#0D9B76',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return id;
  } catch (error) {
    console.error('Schedule notification error:', error);
    return null;
  }
}

export async function sendMissedAlert(
  memberName: string,
  medicineName: string,
  caregiverName?: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `⚠️ Missed Medicine Alert`,
      body: caregiverName
        ? `Your ${memberName} missed ${medicineName}. Please check on them.`
        : `${memberName}, you missed your ${medicineName}. Please take it now.`,
      data: { type: 'missed_alert' },
      sound: 'default',
      color: '#EF4444',
    },
    trigger: null,
  });
}

export async function sendFamilyAlert(
  patientName: string,
  medicineName: string,
  time: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `👨‍👩‍👧 Family Health Alert`,
      body: `${patientName} missed their ${medicineName} at ${time}`,
      data: { type: 'family_alert' },
      sound: 'default',
      color: '#F97316',
    },
    trigger: null,
  });
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
