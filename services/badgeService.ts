/**
 * services/badgeService.ts
 *
 * Gamification badge system for AarvitaCare.
 *
 * Badge definitions, evaluation logic, and AsyncStorage persistence.
 * Badges are evaluated fresh on each dashboard load; newly unlocked ones
 * are stored and surfaced to the UI for celebration.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMedicineLogs, calculateAdherence } from '@/services/medicineService';
import { getFamilyMembers } from '@/services/familyService';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;           // MaterialIcons name
  color: string;          // Background accent color
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt?: string;      // ISO date string when earned
}

interface BadgeStore {
  earned: Record<string, string>; // badgeId → ISO earned date
}

// ─── Badge Catalogue ──────────────────────────────────────────────────────────
export const BADGE_CATALOGUE: Omit<Badge, 'earnedAt'>[] = [
  // ── Streak badges
  {
    id: 'streak_3',
    title: 'Getting Started',
    description: '3-day medicine streak',
    icon: 'local-fire-department',
    color: '#F97316',
    rarity: 'common',
  },
  {
    id: 'streak_7',
    title: 'Week Warrior',
    description: '7-day unbroken streak',
    icon: 'military-tech',
    color: '#EAB308',
    rarity: 'rare',
  },
  {
    id: 'streak_14',
    title: 'Fortnight Fighter',
    description: '14-day unbroken streak',
    icon: 'workspace-premium',
    color: '#8B5CF6',
    rarity: 'rare',
  },
  {
    id: 'streak_30',
    title: 'Perfect Month',
    description: '30-day unbroken streak',
    icon: 'emoji-events',
    color: '#F59E0B',
    rarity: 'legendary',
  },
  // ── Adherence badges
  {
    id: 'adherence_80',
    title: 'Consistent',
    description: '80%+ adherence over 7 days',
    icon: 'trending-up',
    color: '#0D9B76',
    rarity: 'common',
  },
  {
    id: 'adherence_100',
    title: 'Perfect Week',
    description: '100% adherence for 7 days',
    icon: 'stars',
    color: '#22C55E',
    rarity: 'epic',
  },
  // ── Dose count badges
  {
    id: 'doses_10',
    title: 'First Ten',
    description: 'Took 10 doses total',
    icon: 'medication',
    color: '#3B82F6',
    rarity: 'common',
  },
  {
    id: 'doses_50',
    title: 'Half Century',
    description: 'Took 50 doses total',
    icon: 'medical-services',
    color: '#6366F1',
    rarity: 'rare',
  },
  {
    id: 'doses_100',
    title: 'Centurion',
    description: 'Took 100 doses total',
    icon: 'verified',
    color: '#EC4899',
    rarity: 'epic',
  },
  // ── Family badges
  {
    id: 'family_added',
    title: 'Family Builder',
    description: 'Added a family member',
    icon: 'group-add',
    color: '#14B8A6',
    rarity: 'common',
  },
  {
    id: 'family_guardian',
    title: 'Family Guardian',
    description: 'All family members 100% today',
    icon: 'shield',
    color: '#1A2F4E',
    rarity: 'epic',
  },
  // ── Early-bird / timing badges
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Marked a dose taken before 8 AM',
    icon: 'wb-sunny',
    color: '#FBBF24',
    rarity: 'common',
  },
  // ── Refill badge
  {
    id: 'refill_master',
    title: 'Refill Master',
    description: 'Added a medicine with tablet tracking',
    icon: 'local-pharmacy',
    color: '#059669',
    rarity: 'common',
  },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────
const STORE_KEY = '@aarvita_badges_v1';

async function loadStore(): Promise<BadgeStore> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : { earned: {} };
  } catch {
    return { earned: {} };
  }
}

async function saveStore(store: BadgeStore): Promise<void> {
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

/** Returns all currently earned badges (with earnedAt dates). */
export async function getEarnedBadges(): Promise<Badge[]> {
  const store = await loadStore();
  return BADGE_CATALOGUE
    .filter(b => store.earned[b.id])
    .map(b => ({ ...b, earnedAt: store.earned[b.id] }));
}

/** Returns all badges with earned status merged in (for full catalogue display). */
export async function getAllBadges(): Promise<Badge[]> {
  const store = await loadStore();
  return BADGE_CATALOGUE.map(b => ({
    ...b,
    earnedAt: store.earned[b.id] ?? undefined,
  }));
}

// ─── Evaluation logic ─────────────────────────────────────────────────────────
export interface BadgeEvalContext {
  memberId: string;
  todaySchedule: Array<{ status: string; scheduledTime?: string }>;
  familyMembers: Array<{ id: string }>;
  medicines: Array<{ totalTablets?: number }>;
  adherenceStats: {
    streak: number;
    percentage: number;
  };
}

/**
 * Evaluate which badges the user qualifies for.
 * Returns an array of NEW (not previously earned) badge IDs.
 * Also persists any newly unlocked badges to AsyncStorage.
 */
export async function evaluateBadges(ctx: BadgeEvalContext): Promise<Badge[]> {
  const store = await loadStore();
  const now = new Date().toISOString();
  const newlyEarned: Badge[] = [];

  // Helper: award if not already earned
  const award = (id: string) => {
    if (!store.earned[id]) {
      store.earned[id] = now;
      const def = BADGE_CATALOGUE.find(b => b.id === id);
      if (def) newlyEarned.push({ ...def, earnedAt: now });
    }
  };

  // ── Streak badges
  const { streak } = ctx.adherenceStats;
  if (streak >= 3) award('streak_3');
  if (streak >= 7) award('streak_7');
  if (streak >= 14) award('streak_14');
  if (streak >= 30) award('streak_30');

  // ── Adherence badges (7-day)
  const { percentage } = ctx.adherenceStats;
  if (percentage >= 80) award('adherence_80');
  if (percentage >= 100) award('adherence_100');

  // ── Dose count badges — fetch total taken from DB
  try {
    const logs = await getMedicineLogs(ctx.memberId, 365);
    const totalTaken = logs.filter(l => l.status === 'taken').length;
    if (totalTaken >= 10) award('doses_10');
    if (totalTaken >= 50) award('doses_50');
    if (totalTaken >= 100) award('doses_100');

    // ── Early bird badge: taken a dose with scheduledTime before 08:00
    const hasEarlyDose = logs.some(l => {
      if (l.status !== 'taken') return false;
      const [h] = l.scheduledTime.split(':').map(Number);
      return h < 8;
    });
    if (hasEarlyDose) award('early_bird');
  } catch {}

  // ── Family badges
  if (ctx.familyMembers.length > 1) award('family_added');

  // ── Refill master badge
  const hasTabletTracking = ctx.medicines.some(
    m => m.totalTablets !== undefined && m.totalTablets > 0
  );
  if (hasTabletTracking) award('refill_master');

  // ── Family Guardian: all family members 100% today
  // Check if every family member has taken all their today doses
  try {
    if (ctx.familyMembers.length > 1) {
      let allPerfect = true;
      for (const member of ctx.familyMembers) {
        const memberLogs = await getMedicineLogs(member.id, 1);
        const today = new Date().toISOString().split('T')[0];
        const todayLogs = memberLogs.filter(l => l.scheduledDate === today);
        if (todayLogs.length === 0) { allPerfect = false; break; }
        const hasMissed = todayLogs.some(l => l.status === 'missed');
        if (hasMissed) { allPerfect = false; break; }
      }
      if (allPerfect) award('family_guardian');
    }
  } catch {}

  if (newlyEarned.length > 0) {
    await saveStore(store);
  }

  return newlyEarned;
}

// ─── Rarity display helpers ───────────────────────────────────────────────────
export function rarityColor(rarity: Badge['rarity']): string {
  switch (rarity) {
    case 'legendary': return '#F59E0B';
    case 'epic':      return '#8B5CF6';
    case 'rare':      return '#3B82F6';
    default:          return '#6B7280';
  }
}

export function rarityLabel(rarity: Badge['rarity']): string {
  switch (rarity) {
    case 'legendary': return 'LEGENDARY';
    case 'epic':      return 'EPIC';
    case 'rare':      return 'RARE';
    default:          return 'COMMON';
  }
}
