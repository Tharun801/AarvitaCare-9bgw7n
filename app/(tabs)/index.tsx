/**
 * app/(tabs)/index.tsx
 * Dashboard with gamification badge system:
 *  - Badge evaluation runs on every refresh/load
 *  - Earned badge chips displayed below the hero banner
 *  - "New Badge!" celebration modal with react-native-reanimated spring entry
 *  - Full badge catalogue accessible via "View All" sheet
 */
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withDelay,
  withSequence, FadeIn, FadeInDown, ZoomIn,
  runOnJS,
} from 'react-native-reanimated';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { MedicineCard, WeeklyGraph, FamilyMemberCard } from '@/components';
import { useApp } from '@/hooks/useApp';
import { getMemberRoleColor } from '@/services/familyService';
import { speakReminder } from '@/services/voiceService';
import { useAlert } from '@/template';
import {
  Badge, evaluateBadges, getEarnedBadges, getAllBadges,
  rarityColor, rarityLabel,
} from '@/services/badgeService';

// ─── Badge Celebration Modal ──────────────────────────────────────────────────
function CelebrationModal({
  badge,
  visible,
  onClose,
}: {
  badge: Badge | null;
  visible: boolean;
  onClose: () => void;
}) {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);
  const iconBounce = useSharedValue(1);

  useEffect(() => {
    if (visible && badge) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 12, stiffness: 180 });
      // Icon bounce loop × 3
      iconBounce.value = withSequence(
        withDelay(300, withSpring(1.3, { damping: 6 })),
        withSpring(1, { damping: 8 }),
        withDelay(100, withSpring(1.2, { damping: 6 })),
        withSpring(1, { damping: 8 }),
      );
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(0.5, { duration: 180 });
    }
  }, [visible, badge]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value * 0.65 }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconBounce.value }],
  }));

  if (!badge) return null;

  const rc = rarityColor(badge.rarity);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[celebStyles.backdrop, backdropStyle]} />

      {/* Card */}
      <View style={celebStyles.centerer}>
        <Animated.View style={[celebStyles.card, cardStyle]}>
          {/* Rarity strip */}
          <View style={[celebStyles.rarityStrip, { backgroundColor: rc }]}>
            <Text style={celebStyles.rarityText}>{rarityLabel(badge.rarity)} BADGE UNLOCKED!</Text>
          </View>

          {/* Sparkles */}
          <View style={celebStyles.sparkleRow}>
            {['✨', '🎉', '⭐', '🎉', '✨'].map((s, i) => (
              <Animated.Text
                key={i}
                entering={ZoomIn.delay(i * 80).springify()}
                style={celebStyles.sparkle}
              >
                {s}
              </Animated.Text>
            ))}
          </View>

          {/* Icon */}
          <Animated.View style={[celebStyles.iconRing, { backgroundColor: badge.color + '22', borderColor: badge.color + '66' }, iconStyle]}>
            <View style={[celebStyles.iconInner, { backgroundColor: badge.color }]}>
              <MaterialIcons name={badge.icon as any} size={40} color={Colors.white} />
            </View>
          </Animated.View>

          {/* Title + description */}
          <Animated.View entering={FadeInDown.delay(200)}>
            <Text style={celebStyles.title}>{badge.title}</Text>
            <Text style={celebStyles.description}>{badge.description}</Text>
          </Animated.View>

          {/* Rarity chip */}
          <Animated.View entering={FadeIn.delay(350)} style={[celebStyles.rarityChip, { borderColor: rc, backgroundColor: rc + '18' }]}>
            <Text style={[celebStyles.rarityChipText, { color: rc }]}>{rarityLabel(badge.rarity)}</Text>
          </Animated.View>

          {/* CTA */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              celebStyles.closeBtn,
              { backgroundColor: badge.color },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={celebStyles.closeBtnText}>Awesome! 🎊</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Badge Chip (earned) ──────────────────────────────────────────────────────
function BadgeChip({ badge, delay = 0 }: { badge: Badge; delay?: number }) {
  const rc = rarityColor(badge.rarity);
  return (
    <Animated.View entering={ZoomIn.delay(delay).springify()}>
      <View style={[chipStyles.chip, { borderColor: rc + '55', backgroundColor: badge.color + '12' }]}>
        <View style={[chipStyles.iconBg, { backgroundColor: badge.color }]}>
          <MaterialIcons name={badge.icon as any} size={14} color={Colors.white} />
        </View>
        <Text style={[chipStyles.title, { color: badge.color }]} numberOfLines={1}>
          {badge.title}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Badge Catalogue Sheet ────────────────────────────────────────────────────
function BadgeCatalogueModal({
  visible,
  onClose,
  allBadges,
}: {
  visible: boolean;
  onClose: () => void;
  allBadges: Badge[];
}) {
  const insets = useSafeAreaInsets();
  const earned = allBadges.filter(b => !!b.earnedAt);
  const locked = allBadges.filter(b => !b.earnedAt);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[catStyles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={catStyles.header}>
          <Text style={catStyles.headerTitle}>All Badges</Text>
          <Text style={catStyles.headerSub}>{earned.length}/{allBadges.length} earned</Text>
          <Pressable onPress={onClose} style={catStyles.closeX} hitSlop={8}>
            <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={catStyles.scroll} showsVerticalScrollIndicator={false}>
          {/* Progress bar */}
          <View style={catStyles.progressCard}>
            <View style={catStyles.progressRow}>
              <Text style={catStyles.progressLabel}>Collection Progress</Text>
              <Text style={catStyles.progressPct}>
                {Math.round((earned.length / allBadges.length) * 100)}%
              </Text>
            </View>
            <View style={catStyles.progressTrack}>
              <View style={[catStyles.progressFill, { width: `${(earned.length / allBadges.length) * 100}%` }]} />
            </View>
          </View>

          {/* Earned */}
          {earned.length > 0 ? (
            <>
              <Text style={catStyles.sectionTitle}>Earned ({earned.length})</Text>
              {earned.map((badge, i) => (
                <Animated.View key={badge.id} entering={FadeInDown.delay(i * 40).springify()}>
                  <CatalogueRow badge={badge} earned />
                </Animated.View>
              ))}
            </>
          ) : null}

          {/* Locked */}
          {locked.length > 0 ? (
            <>
              <Text style={catStyles.sectionTitle}>Locked ({locked.length})</Text>
              {locked.map((badge, i) => (
                <Animated.View key={badge.id} entering={FadeInDown.delay(i * 30).springify()}>
                  <CatalogueRow badge={badge} earned={false} />
                </Animated.View>
              ))}
            </>
          ) : null}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function CatalogueRow({ badge, earned }: { badge: Badge; earned: boolean }) {
  const rc = rarityColor(badge.rarity);
  return (
    <View style={[catStyles.row, !earned && catStyles.rowLocked]}>
      <View style={[catStyles.rowIcon, { backgroundColor: earned ? badge.color : Colors.textMuted + '40' }]}>
        <MaterialIcons
          name={earned ? (badge.icon as any) : 'lock'}
          size={22}
          color={earned ? Colors.white : Colors.textMuted}
        />
      </View>
      <View style={catStyles.rowInfo}>
        <View style={catStyles.rowTitleRow}>
          <Text style={[catStyles.rowTitle, !earned && catStyles.rowTitleLocked]}>
            {badge.title}
          </Text>
          <View style={[catStyles.rarityPill, { backgroundColor: rc + '22', borderColor: rc + '55' }]}>
            <Text style={[catStyles.rarityPillText, { color: rc }]}>{rarityLabel(badge.rarity)}</Text>
          </View>
        </View>
        <Text style={catStyles.rowDesc}>{badge.description}</Text>
        {earned && badge.earnedAt ? (
          <Text style={catStyles.rowDate}>
            Earned {new Date(badge.earnedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        ) : null}
      </View>
      {earned ? (
        <MaterialIcons name="check-circle" size={20} color={Colors.success} />
      ) : (
        <MaterialIcons name="lock" size={18} color={Colors.textMuted} />
      )}
    </View>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const {
    user, activeMember, familyMembers,
    todaySchedule, adherenceStats, medicines,
    markMedicine, refreshMedicines, setActiveMember,
  } = useApp();

  const [refreshing, setRefreshing] = React.useState(false);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [celebQueue, setCelebQueue] = useState<Badge[]>([]);
  const [currentCeleb, setCurrentCeleb] = useState<Badge | null>(null);
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const isEvaluating = useRef(false);

  // Load earned badges from storage on mount
  useEffect(() => {
    getEarnedBadges().then(setEarnedBadges).catch(console.warn);
    getAllBadges().then(setAllBadges).catch(console.warn);
  }, []);

  // Evaluate badges whenever adherence stats or schedule changes
  useEffect(() => {
    if (!activeMember || isEvaluating.current) return;
    if (adherenceStats.percentage === 0 && adherenceStats.streak === 0) return;

    isEvaluating.current = true;
    evaluateBadges({
      memberId: activeMember.id,
      todaySchedule: todaySchedule.map(s => ({
        status: s.status,
        scheduledTime: s.scheduledTime,
      })),
      familyMembers,
      medicines,
      adherenceStats: {
        streak: adherenceStats.streak,
        percentage: adherenceStats.percentage,
      },
    })
      .then(newBadges => {
        if (newBadges.length > 0) {
          setCelebQueue(q => [...q, ...newBadges]);
        }
        return getEarnedBadges();
      })
      .then(allEarned => {
        setEarnedBadges(allEarned);
        return getAllBadges();
      })
      .then(setAllBadges)
      .catch(console.warn)
      .finally(() => { isEvaluating.current = false; });
  }, [adherenceStats.streak, adherenceStats.percentage, activeMember?.id]);

  // Drain the celebration queue one badge at a time
  useEffect(() => {
    if (celebQueue.length > 0 && !currentCeleb) {
      const [next, ...rest] = celebQueue;
      setCurrentCeleb(next);
      setCelebQueue(rest);
    }
  }, [celebQueue, currentCeleb]);

  const handleCelebClose = useCallback(() => {
    setCurrentCeleb(null);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshMedicines();
    const allEarned = await getEarnedBadges();
    setEarnedBadges(allEarned);
    setAllBadges(await getAllBadges());
    setRefreshing(false);
  }, [refreshMedicines]);

  const handleTake = useCallback(async (medicineId: string, time: string, medName: string) => {
    await markMedicine(medicineId, time, 'taken');
    if (activeMember) {
      await speakReminder(activeMember.name, medName, '', activeMember.language, activeMember.voiceGender);
    }
  }, [markMedicine, activeMember]);

  const handleMiss = useCallback(async (medicineId: string, time: string) => {
    await markMedicine(medicineId, time, 'missed');
  }, [markMedicine]);

  const roleColor = activeMember ? getMemberRoleColor(activeMember.role) : Colors.primary;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const upcomingDoses = todaySchedule.filter(s => s.status === 'upcoming').length;
  const takenToday = todaySchedule.filter(s => s.status === 'taken').length;
  const missedToday = todaySchedule.filter(s => s.status === 'missed').length;

  // Show up to 6 recent badges in the chip strip
  const chipBadges = earnedBadges.slice(0, 6);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.userName}>{activeMember?.name || user?.name || 'Friend'} 👋</Text>
        </View>
        <Pressable
          onPress={() => router.push('/add-medicine')}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
        >
          <MaterialIcons name="add" size={22} color={Colors.white} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Family Switcher */}
        {familyMembers.length > 1 ? (
          <View style={styles.section}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.familyRow}>
              {familyMembers.map(m => (
                <FamilyMemberCard
                  key={m.id}
                  member={m}
                  isActive={m.id === activeMember?.id}
                  onPress={() => setActiveMember(m)}
                  compact
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Health Score Banner */}
        <View style={[styles.heroBanner, { backgroundColor: roleColor }]}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroLabel}>Health Score</Text>
            <Text style={styles.heroScore}>{adherenceStats.healthScore}</Text>
            <View style={styles.streakRow}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakText}>{adherenceStats.streak} day streak</Text>
            </View>
          </View>
          <View style={styles.heroRight}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{adherenceStats.percentage}%</Text>
              <Text style={styles.statLabel}>Adherence</Text>
            </View>
            <View style={[styles.statCard, { marginTop: Spacing[2] }]}>
              <Text style={styles.statNumber}>{takenToday}/{takenToday + missedToday + upcomingDoses}</Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>
          </View>
        </View>

        {/* ── BADGE STRIP ── */}
        {earnedBadges.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <View style={badgeStyles.section}>
              <View style={badgeStyles.sectionHeader}>
                <View style={badgeStyles.sectionTitleRow}>
                  <MaterialIcons name="military-tech" size={18} color={Colors.accent} />
                  <Text style={badgeStyles.sectionTitle}>
                    My Badges
                  </Text>
                  <View style={badgeStyles.countPill}>
                    <Text style={badgeStyles.countPillText}>{earnedBadges.length}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setShowCatalogue(true)}
                  style={({ pressed }) => [badgeStyles.viewAllBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={badgeStyles.viewAllText}>View All</Text>
                  <MaterialIcons name="chevron-right" size={16} color={Colors.primary} />
                </Pressable>
              </View>

              {/* Horizontal chip scroll */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={badgeStyles.chipRow}
              >
                {chipBadges.map((badge, i) => (
                  <BadgeChip key={badge.id} badge={badge} delay={i * 60} />
                ))}
                {earnedBadges.length > 6 ? (
                  <Pressable
                    onPress={() => setShowCatalogue(true)}
                    style={({ pressed }) => [badgeStyles.moreChip, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={badgeStyles.moreChipText}>+{earnedBadges.length - 6} more</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          </Animated.View>
        ) : (
          /* Teaser card when no badges yet */
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <Pressable
              onPress={() => setShowCatalogue(true)}
              style={({ pressed }) => [badgeStyles.teaserCard, pressed && { opacity: 0.85 }]}
            >
              <View style={badgeStyles.teaserLeft}>
                <MaterialIcons name="military-tech" size={28} color={Colors.accent} />
              </View>
              <View style={badgeStyles.teaserText}>
                <Text style={badgeStyles.teaserTitle}>Earn your first badge!</Text>
                <Text style={badgeStyles.teaserSub}>Take 3 doses in a row to unlock "Getting Started"</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </Pressable>
          </Animated.View>
        )}

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={[styles.quickStat, { backgroundColor: Colors.successLight }]}>
            <MaterialIcons name="check-circle" size={22} color={Colors.success} />
            <Text style={[styles.quickStatNum, { color: Colors.success }]}>{takenToday}</Text>
            <Text style={styles.quickStatLabel}>Taken</Text>
          </View>
          <View style={[styles.quickStat, { backgroundColor: Colors.errorLight }]}>
            <MaterialIcons name="cancel" size={22} color={Colors.error} />
            <Text style={[styles.quickStatNum, { color: Colors.error }]}>{missedToday}</Text>
            <Text style={styles.quickStatLabel}>Missed</Text>
          </View>
          <View style={[styles.quickStat, { backgroundColor: Colors.primaryLight }]}>
            <MaterialIcons name="schedule" size={22} color={Colors.primary} />
            <Text style={[styles.quickStatNum, { color: Colors.primary }]}>{upcomingDoses}</Text>
            <Text style={styles.quickStatLabel}>Upcoming</Text>
          </View>
        </View>

        {/* Today's Schedule */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          <Pressable onPress={() => router.push('/add-medicine')}>
            <Text style={styles.seeAll}>+ Add</Text>
          </Pressable>
        </View>

        {todaySchedule.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="medication" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No medicines today</Text>
            <Text style={styles.emptySubtitle}>Tap + to add your first medicine</Text>
            <Pressable
              onPress={() => router.push('/add-medicine')}
              style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.emptyBtnText}>Add Medicine</Text>
            </Pressable>
          </View>
        ) : (
          todaySchedule.map((item) => (
            <MedicineCard
              key={`${item.medicine.id}-${item.scheduledTime}`}
              medicine={item.medicine}
              scheduledTime={item.scheduledTime}
              status={item.status}
              onTake={item.status === 'upcoming' ? () => handleTake(item.medicine.id, item.scheduledTime, item.medicine.name) : undefined}
              onMiss={item.status === 'upcoming' ? () => handleMiss(item.medicine.id, item.scheduledTime) : undefined}
              onPress={() => router.push({ pathname: '/medicine-detail', params: { id: item.medicine.id } })}
            />
          ))
        )}

        {/* Weekly Graph */}
        {adherenceStats.weeklyData.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>This Week</Text>
            </View>
            <View style={styles.graphCard}>
              <WeeklyGraph data={adherenceStats.weeklyData} />
            </View>
          </>
        ) : null}

        <View style={{ height: Spacing[8] }} />
      </ScrollView>

      {/* ── BADGE CELEBRATION MODAL ── */}
      <CelebrationModal
        badge={currentCeleb}
        visible={!!currentCeleb}
        onClose={handleCelebClose}
      />

      {/* ── BADGE CATALOGUE SHEET ── */}
      <BadgeCatalogueModal
        visible={showCatalogue}
        onClose={() => setShowCatalogue(false)}
        allBadges={allBadges}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[3],
    paddingTop: Spacing[2],
    backgroundColor: Colors.white,
    ...Shadow.sm,
  },
  headerLeft: {},
  greeting: { fontSize: Typography.sm, color: Colors.textMuted },
  userName: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  addBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.colored,
  },
  scroll: { padding: Spacing[4] },
  section: { marginBottom: Spacing[4] },
  familyRow: { paddingBottom: Spacing[1] },
  heroBanner: {
    borderRadius: Radius.xl,
    padding: Spacing[5],
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing[4],
    ...Shadow.lg,
  },
  heroLeft: {},
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.sm, fontWeight: Typography.medium },
  heroScore: {
    fontSize: Typography.display, fontWeight: Typography.extrabold,
    color: Colors.white, lineHeight: Typography.display * 1.1,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  streakFire: { fontSize: 18 },
  streakText: { color: 'rgba(255,255,255,0.9)', fontSize: Typography.sm, fontWeight: Typography.semibold },
  heroRight: { justifyContent: 'center' },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    alignItems: 'center', minWidth: 80,
  },
  statNumber: { color: Colors.white, fontSize: Typography.xl, fontWeight: Typography.bold },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.xs },
  quickStats: { flexDirection: 'row', gap: Spacing[3], marginBottom: Spacing[4] },
  quickStat: {
    flex: 1, alignItems: 'center', padding: Spacing[3],
    borderRadius: Radius.lg, gap: 4,
  },
  quickStatNum: { fontSize: Typography.xl, fontWeight: Typography.bold },
  quickStatLabel: { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.medium },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3], marginTop: Spacing[1],
  },
  sectionTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  seeAll: { color: Colors.primary, fontSize: Typography.sm, fontWeight: Typography.semibold },
  emptyState: {
    alignItems: 'center', padding: Spacing[8],
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    marginBottom: Spacing[4], ...Shadow.sm,
  },
  emptyTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary, marginTop: Spacing[3] },
  emptySubtitle: { fontSize: Typography.base, color: Colors.textMuted, marginTop: Spacing[2] },
  emptyBtn: {
    marginTop: Spacing[4], backgroundColor: Colors.primary,
    paddingHorizontal: Spacing[6], paddingVertical: Spacing[3],
    borderRadius: Radius.full,
  },
  emptyBtnText: { color: Colors.white, fontWeight: Typography.semibold },
  graphCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing[4], marginBottom: Spacing[4], ...Shadow.md,
  },
});

// Badge strip styles
const badgeStyles = StyleSheet.create({
  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    ...Shadow.md,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing[3],
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  sectionTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  countPill: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing[2], paddingVertical: 2,
    borderRadius: Radius.full,
  },
  countPillText: { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.accent },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.primary },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingVertical: 2,
  },
  teaserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    gap: Spacing[3],
    borderWidth: 1.5,
    borderColor: Colors.accentLight,
    borderStyle: 'dashed',
    ...Shadow.sm,
  },
  teaserLeft: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },
  teaserText: { flex: 1 },
  teaserTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  teaserSub: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 3, lineHeight: 18 },
  moreChip: {
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryMuted,
  },
  moreChipText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.semibold },
});

// Chip styles
const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing[2], paddingVertical: Spacing[2],
    paddingRight: Spacing[3], paddingLeft: Spacing[2],
    borderRadius: Radius.full, borderWidth: 1.5,
    maxWidth: 140,
  },
  iconBg: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: Typography.sm, fontWeight: Typography.semibold, flexShrink: 1 },
});

// Celebration modal styles
const celebStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  centerer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius['2xl'],
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: Spacing[6],
    ...Shadow.lg,
  },
  rarityStrip: {
    width: '100%',
    paddingVertical: Spacing[2],
    alignItems: 'center',
    marginBottom: Spacing[4],
  },
  rarityText: {
    color: Colors.white, fontSize: Typography.xs,
    fontWeight: Typography.extrabold, letterSpacing: 1.5,
  },
  sparkleRow: {
    flexDirection: 'row', gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  sparkle: { fontSize: 22 },
  iconRing: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[4],
  },
  iconInner: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.md,
  },
  title: {
    fontSize: Typography['2xl'], fontWeight: Typography.extrabold,
    color: Colors.textPrimary, textAlign: 'center',
    paddingHorizontal: Spacing[6],
  },
  description: {
    fontSize: Typography.base, color: Colors.textSecondary,
    textAlign: 'center', marginTop: Spacing[2],
    paddingHorizontal: Spacing[6], lineHeight: Typography.base * 1.5,
  },
  rarityChip: {
    borderWidth: 1.5, borderRadius: Radius.full,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1],
    marginTop: Spacing[4],
  },
  rarityChipText: { fontSize: Typography.xs, fontWeight: Typography.extrabold, letterSpacing: 1 },
  closeBtn: {
    marginTop: Spacing[5],
    paddingHorizontal: Spacing[8], paddingVertical: Spacing[3],
    borderRadius: Radius.full, ...Shadow.colored,
  },
  closeBtnText: {
    color: Colors.white, fontSize: Typography.base, fontWeight: Typography.bold,
  },
});

// Catalogue modal styles
const catStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[4],
    backgroundColor: Colors.white, ...Shadow.sm,
  },
  headerTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, flex: 1 },
  headerSub: { fontSize: Typography.sm, color: Colors.textMuted, marginRight: Spacing[3] },
  closeX: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { padding: Spacing[4] },
  progressCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    ...Shadow.sm,
  },
  progressRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing[3],
  },
  progressLabel: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  progressPct: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.primary },
  progressTrack: {
    height: 10, backgroundColor: Colors.borderLight,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full,
  },
  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.extrabold,
    color: Colors.textMuted, letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: Spacing[3], marginBottom: Spacing[2],
    paddingLeft: Spacing[1],
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing[4], marginBottom: Spacing[2],
    gap: Spacing[3], ...Shadow.sm,
  },
  rowLocked: { opacity: 0.55 },
  rowIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: 3 },
  rowTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  rowTitleLocked: { color: Colors.textMuted },
  rowDesc: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 18 },
  rowDate: { fontSize: Typography.xs, color: Colors.primary, marginTop: 3, fontWeight: Typography.medium },
  rarityPill: {
    borderWidth: 1, borderRadius: Radius.full,
    paddingHorizontal: Spacing[2], paddingVertical: 2,
  },
  rarityPillText: { fontSize: 9, fontWeight: Typography.extrabold, letterSpacing: 0.5 },
});
