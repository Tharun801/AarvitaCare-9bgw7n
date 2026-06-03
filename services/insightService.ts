/**
 * services/insightService.ts
 *
 * AsyncStorage-backed daily cache for the AI health insight.
 * One insight per family member per calendar day.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@aarvita_insight_v1_';

interface InsightEntry {
  date: string;   // YYYY-MM-DD
  text: string;
}

function todayKey(memberId: string): string {
  return `${CACHE_PREFIX}${memberId}`;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Returns the cached insight for today, or null if stale / missing. */
export async function getInsight(memberId: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(todayKey(memberId));
    if (!raw) return null;
    const entry: InsightEntry = JSON.parse(raw);
    if (entry.date !== todayStr()) return null;   // stale — new day
    return entry.text;
  } catch {
    return null;
  }
}

/** Caches the insight for today. */
export async function cacheInsight(memberId: string, text: string): Promise<void> {
  try {
    const entry: InsightEntry = { date: todayStr(), text };
    await AsyncStorage.setItem(todayKey(memberId), JSON.stringify(entry));
  } catch {}
}

// Re-export type for convenience
export type InsightCache = InsightEntry;
