/**
 * services/backgroundTaskService.ts
 *
 * Background missed-dose detection using expo-background-fetch + expo-task-manager.
 *
 * What it does every ~15 minutes:
 *  1. Fetches all family members for the authenticated user
 *  2. For each member, builds today's medicine schedule
 *  3. Detects every time-slot that is past-due and has no 'taken' or 'missed' log
 *  4. Writes a 'missed' log to Supabase (upsert — safe to run multiple times)
 *  5. Fires an instant push notification (missed-dose alert)
 *  6. Fires a caregiver family-alert notification for every caregiver member
 *
 * Voice reminders are intentionally NOT fired from the background task because
 * expo-speech requires an active foreground/audio session on iOS/Android.
 * Voice is triggered instead when the user taps the foreground notification
 * (handled in _layout.tsx via addNotificationResponseReceivedListener).
 */

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { getSupabaseClient } from '@/template';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  sendMissedDoseAlert,
  sendFamilyAlert,
  sendRefillAlert,
} from '@/services/notificationService';

// ─── Constants ────────────────────────────────────────────────────────────────
export const MISSED_DOSE_TASK = 'AARVITA_MISSED_DOSE_CHECK';

/** How many minutes past the scheduled time before we mark it as missed */
const GRACE_PERIOD_MINUTES = 10;

/** AsyncStorage key: stores { [memberId_medicineId_time_date]: true } for doses
 *  already processed in the background — avoids duplicate alerts in same day */
const PROCESSED_KEY = '@aarvita_bg_processed';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function isOverdue(time: string, graceMinutes = GRACE_PERIOD_MINUTES): boolean {
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return false;
  const now = new Date();
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  const diffMinutes = (now.getTime() - scheduled.getTime()) / 60000;
  return diffMinutes >= graceMinutes;
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

async function loadProcessed(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(PROCESSED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveProcessed(processed: Record<string, boolean>): Promise<void> {
  try {
    // Prune entries older than today to prevent unbounded growth
    const today = todayStr();
    const pruned: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(processed)) {
      if (key.endsWith(`_${today}`)) pruned[key] = val;
    }
    await AsyncStorage.setItem(PROCESSED_KEY, JSON.stringify(pruned));
  } catch {}
}

// ─── Core detection logic (exported for foreground use too) ──────────────────
export async function detectAndMarkMissedDoses(): Promise<{
  processed: number;
  errors: number;
}> {
  const sb = getSupabaseClient();
  const today = todayStr();

  // Must be authenticated
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return { processed: 0, errors: 0 };

  const userId = session.user.id;
  let processedCount = 0;
  let errorCount = 0;

  try {
    // 1. Load all active family members
    const { data: membersData, error: membersError } = await sb
      .from('family_members')
      .select('id, name, is_caregiver, language, voice_gender')
      .eq('user_id', userId)
      .eq('active', true);

    if (membersError || !membersData?.length) return { processed: 0, errors: 0 };

    const caregivers = membersData.filter((m: any) => m.is_caregiver);
    const processed = await loadProcessed();

    for (const member of membersData) {
      try {
        // 2. Load active medicines for this member
        const { data: medsData, error: medsError } = await sb
          .from('medicines')
          .select('id, name, dosage, times, remaining_tablets, instructions')
          .eq('member_id', member.id)
          .eq('active', true);

        if (medsError || !medsData?.length) continue;

        // 3. Load today's logs for this member
        const { data: logsData } = await sb
          .from('medicine_logs')
          .select('medicine_id, scheduled_time, status')
          .eq('member_id', member.id)
          .eq('scheduled_date', today);

        const logMap = new Map<string, string>();
        for (const log of (logsData || [])) {
          logMap.set(`${log.medicine_id}_${log.scheduled_time}`, log.status);
        }

        for (const med of medsData) {
          const times: string[] = med.times || [];

          for (const time of times) {
            // Skip if not yet overdue
            if (!isOverdue(time)) continue;

            // Skip if already logged (taken / missed / skipped)
            const existingStatus = logMap.get(`${med.id}_${time}`);
            if (existingStatus) continue;

            // Dedup key: avoid re-processing same dose in same background tick
            const dedupKey = `${member.id}_${med.id}_${time}_${today}`;
            if (processed[dedupKey]) continue;

            // 4. Write 'missed' log to Supabase
            try {
              await sb.from('medicine_logs').upsert(
                {
                  user_id: userId,
                  medicine_id: med.id,
                  member_id: member.id,
                  scheduled_time: time,
                  scheduled_date: today,
                  status: 'missed',
                },
                { onConflict: 'medicine_id,scheduled_date,scheduled_time' }
              );
            } catch (upsertErr) {
              console.error('BG: upsert missed log failed:', upsertErr);
              errorCount++;
              continue;
            }

            const timeLabel = formatTime12(time);

            // 5a. Missed-dose notification to the patient
            await sendMissedDoseAlert({
              memberName: member.name,
              medicineName: med.name,
              dosage: med.dosage,
              scheduledTime: timeLabel,
            }).catch(console.warn);

            // 5b. Caregiver family-alert notifications
            for (const cg of caregivers) {
              if (cg.id === member.id) continue; // don't notify self
              await sendFamilyAlert({
                patientName: member.name,
                medicineName: med.name,
                dosage: med.dosage,
                scheduledTime: timeLabel,
                caregiverName: cg.name,
              }).catch(console.warn);
            }

            // 5c. Refill alert if running low (≤ 3 tablets)
            const remaining = med.remaining_tablets;
            if (remaining !== null && remaining !== undefined && remaining <= 3) {
              await sendRefillAlert({
                medicineName: med.name,
                remainingTablets: remaining,
              }).catch(console.warn);
            }

            processed[dedupKey] = true;
            processedCount++;
          }
        }
      } catch (memberErr) {
        console.error(`BG: error processing member ${member.id}:`, memberErr);
        errorCount++;
      }
    }

    await saveProcessed(processed);
  } catch (err) {
    console.error('BG: detectAndMarkMissedDoses fatal error:', err);
    errorCount++;
  }

  return { processed: processedCount, errors: errorCount };
}

// ─── Task definition ─────────────────────────────────────────────────────────
/**
 * Register the TaskManager task definition.
 * MUST be called at the top level of a module that runs on app startup
 * (before any Suspense / navigation renders).
 * We call this from the bottom of this file so importing the module
 * is enough to register the task.
 */
TaskManager.defineTask(MISSED_DOSE_TASK, async () => {
  console.log('[BackgroundFetch] Missed dose check running at', new Date().toISOString());
  try {
    const result = await detectAndMarkMissedDoses();
    console.log(`[BackgroundFetch] Done — processed: ${result.processed}, errors: ${result.errors}`);
    return result.errors > 0
      ? BackgroundFetch.BackgroundFetchResult.Failed
      : result.processed > 0
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (err) {
    console.error('[BackgroundFetch] Task threw:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Registration helpers ─────────────────────────────────────────────────────
/**
 * Register the background fetch task with the OS.
 * Call this once after the user grants notification permissions.
 * Safe to call multiple times — will not register duplicates.
 */
export async function registerBackgroundTask(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.warn('[BackgroundFetch] Status restricted/denied — skipping registration');
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(MISSED_DOSE_TASK);
    if (isRegistered) {
      console.log('[BackgroundFetch] Task already registered');
      return;
    }

    await BackgroundFetch.registerTaskAsync(MISSED_DOSE_TASK, {
      minimumInterval: 15 * 60,  // 15 minutes (OS may delay longer on low-power mode)
      stopOnTerminate: false,     // continue even if app is force-quit (Android)
      startOnBoot: true,          // restart after device reboot (Android)
    });
    console.log('[BackgroundFetch] Task registered successfully');
  } catch (err) {
    console.error('[BackgroundFetch] registerBackgroundTask failed:', err);
  }
}

/**
 * Unregister the background task (e.g. on logout).
 */
export async function unregisterBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(MISSED_DOSE_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(MISSED_DOSE_TASK);
      console.log('[BackgroundFetch] Task unregistered');
    }
  } catch (err) {
    console.error('[BackgroundFetch] unregisterBackgroundTask failed:', err);
  }
}

/**
 * Check current registration + fetch status (for debug/settings UI).
 */
export async function getBackgroundTaskStatus(): Promise<{
  isRegistered: boolean;
  fetchStatus: BackgroundFetch.BackgroundFetchStatus | null;
  fetchStatusLabel: string;
}> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(MISSED_DOSE_TASK);
    const fetchStatus = await BackgroundFetch.getStatusAsync();
    const labels: Record<number, string> = {
      [BackgroundFetch.BackgroundFetchStatus.Available]: 'Available',
      [BackgroundFetch.BackgroundFetchStatus.Restricted]: 'Restricted',
      [BackgroundFetch.BackgroundFetchStatus.Denied]: 'Denied',
    };
    return {
      isRegistered,
      fetchStatus,
      fetchStatusLabel: fetchStatus !== null ? (labels[fetchStatus] ?? 'Unknown') : 'Unknown',
    };
  } catch {
    return { isRegistered: false, fetchStatus: null, fetchStatusLabel: 'Unknown' };
  }
}
