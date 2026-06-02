/**
 * app/(tabs)/family.tsx
 *
 * Caregiver Monitoring Dashboard:
 *  - Per-member animated adherence ring (react-native-reanimated SVG)
 *  - Today-adherence mini status card: green ✓ all taken / red badge with missed count
 *  - Quick-call button via Linking.openURL('tel:') from stored phone number
 *  - Missed-dose activity feed sorted by most recent (across ALL members)
 *  - Member management: add, edit, switch, remove
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  Linking, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withDelay, withTiming, withSpring,
  FadeIn, FadeInDown, FadeInRight,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { getMemberRoleColor, getMemberInitials, FamilyMember } from '@/services/familyService';
import { getMedicineLogs, getMedicines, MedicineLog } from '@/services/medicineService';
import { getSupabaseClient } from '@/template';

// ─── Animated SVG circle ─────────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING = 72;
const STROKE = 7;
const RADIUS = (RING - STROKE) / 2;
const CIRCUM = 2 * Math.PI * RADIUS;

// ─── Types ────────────────────────────────────────────────────────────────────
interface MemberStat {
  memberId: string;
  totalToday: number;
  takenToday: number;
  missedToday: number;
  pendingToday: number;
  adherencePct: number;      // 0–100
  allTaken: boolean;
  hasMissed: boolean;
}

interface MissedFeedItem {
  id: string;
  memberName: string;
  memberRole: string;
  roleColor: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  scheduledDate: string;
  minutesAgo: number | null;
  dateLabel: string;
}

// ─── Per-member adherence ring ────────────────────────────────────────────────
function AdherenceRing({
  pct,
  color,
  delay = 0,
  size = RING,
  stroke = STROKE,
}: {
  pct: number;
  color: string;
  delay?: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(pct / 100, { duration: 850 }));
  }, [pct]);

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - progress.value),
  }));

  const ringColor =
    pct >= 80 ? Colors.success
    : pct >= 50 ? Colors.warning
    : pct > 0  ? Colors.error
    : Colors.borderLight;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={Colors.borderLight}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          stroke={ringColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          animatedProps={animProps}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Center percentage */}
      <Text style={[ringLabel.pct, { color: ringColor, fontSize: size < 70 ? 11 : 13 }]}>
        {pct}%
      </Text>
    </View>
  );
}

const ringLabel = StyleSheet.create({
  pct: { fontWeight: Typography.bold },
});

// ─── Today-status badge ───────────────────────────────────────────────────────
function TodayStatusBadge({ stat }: { stat: MemberStat }) {
  if (stat.totalToday === 0) {
    return (
      <View style={[statusBadge.pill, { backgroundColor: Colors.borderLight }]}>
        <MaterialIcons name="remove" size={12} color={Colors.textMuted} />
        <Text style={[statusBadge.text, { color: Colors.textMuted }]}>No meds</Text>
      </View>
    );
  }
  if (stat.allTaken) {
    return (
      <View style={[statusBadge.pill, { backgroundColor: Colors.successLight }]}>
        <MaterialIcons name="check-circle" size={12} color={Colors.success} />
        <Text style={[statusBadge.text, { color: Colors.success }]}>All taken</Text>
      </View>
    );
  }
  if (stat.hasMissed) {
    return (
      <View style={[statusBadge.pill, { backgroundColor: Colors.errorLight }]}>
        <View style={statusBadge.countDot}>
          <Text style={statusBadge.countDotText}>{stat.missedToday}</Text>
        </View>
        <Text style={[statusBadge.text, { color: Colors.error }]}>missed</Text>
      </View>
    );
  }
  return (
    <View style={[statusBadge.pill, { backgroundColor: Colors.primaryLight }]}>
      <MaterialIcons name="schedule" size={12} color={Colors.primary} />
      <Text style={[statusBadge.text, { color: Colors.primary }]}>{stat.pendingToday} pending</Text>
    </View>
  );
}

const statusBadge = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing[2],
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  text: { fontSize: 11, fontWeight: Typography.semibold },
  countDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  countDotText: { color: Colors.white, fontSize: 9, fontWeight: Typography.bold },
});

// ─── Member monitoring card ───────────────────────────────────────────────────
function MemberMonitorCard({
  member,
  stat,
  isActive,
  medCount,
  index,
  onSwitch,
  onCall,
  onEdit,
  onRemove,
}: {
  member: FamilyMember;
  stat: MemberStat | null;
  isActive: boolean;
  medCount: number;
  index: number;
  onSwitch: () => void;
  onCall: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const roleColor = getMemberRoleColor(member.role);
  const pct = stat?.adherencePct ?? 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 70).springify()}>
      <View style={[memberCard.card, isActive && { borderColor: roleColor, borderWidth: 2 }]}>
        {/* Active glow strip */}
        {isActive ? <View style={[memberCard.activeStrip, { backgroundColor: roleColor }]} /> : null}

        {/* Top row: avatar + name + badges + ring */}
        <View style={memberCard.topRow}>
          {/* Avatar */}
          <Pressable onPress={onSwitch} style={[memberCard.avatar, { backgroundColor: roleColor }]}>
            <Text style={memberCard.avatarText}>{getMemberInitials(member.name)}</Text>
          </Pressable>

          {/* Name + meta */}
          <View style={memberCard.nameBlock}>
            <View style={memberCard.nameRow}>
              <Text style={memberCard.name} numberOfLines={1}>{member.name}</Text>
              {isActive ? (
                <View style={[memberCard.activePill, { backgroundColor: roleColor }]}>
                  <Text style={memberCard.activePillText}>Active</Text>
                </View>
              ) : null}
              {member.isCaregiver ? (
                <View style={memberCard.caregiverPill}>
                  <MaterialIcons name="supervisor-account" size={10} color={Colors.secondary} />
                  <Text style={memberCard.caregiverText}>Caregiver</Text>
                </View>
              ) : null}
            </View>
            <Text style={memberCard.meta}>
              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
              {member.age ? ` · ${member.age}y` : ''}
              {' · '}
              {medCount} med{medCount !== 1 ? 's' : ''}
            </Text>
            {/* Today status badge */}
            {stat ? <View style={{ marginTop: Spacing[1] }}><TodayStatusBadge stat={stat} /></View> : null}
          </View>

          {/* Adherence ring */}
          <AdherenceRing pct={pct} color={roleColor} delay={index * 80} />
        </View>

        {/* Stats row */}
        {stat && stat.totalToday > 0 ? (
          <View style={memberCard.statsRow}>
            <View style={[memberCard.statCell, { backgroundColor: Colors.successLight }]}>
              <Text style={[memberCard.statNum, { color: Colors.success }]}>{stat.takenToday}</Text>
              <Text style={memberCard.statLabel}>Taken</Text>
            </View>
            <View style={[memberCard.statCell, { backgroundColor: Colors.errorLight }]}>
              <Text style={[memberCard.statNum, { color: Colors.error }]}>{stat.missedToday}</Text>
              <Text style={memberCard.statLabel}>Missed</Text>
            </View>
            <View style={[memberCard.statCell, { backgroundColor: Colors.primaryLight }]}>
              <Text style={[memberCard.statNum, { color: Colors.primary }]}>{stat.pendingToday}</Text>
              <Text style={memberCard.statLabel}>Pending</Text>
            </View>
            <View style={[memberCard.statCell, { backgroundColor: Colors.background }]}>
              <Text style={[memberCard.statNum, { color: Colors.textSecondary }]}>{stat.totalToday}</Text>
              <Text style={memberCard.statLabel}>Total</Text>
            </View>
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={memberCard.actions}>
          {/* Switch to member */}
          <Pressable
            onPress={onSwitch}
            style={({ pressed }) => [
              memberCard.actionBtn,
              { backgroundColor: isActive ? roleColor : Colors.primaryLight },
              pressed && { opacity: 0.75 },
            ]}
          >
            <MaterialIcons
              name={isActive ? 'visibility' : 'swap-horiz'}
              size={14}
              color={isActive ? Colors.white : Colors.primary}
            />
            <Text style={[memberCard.actionBtnText, { color: isActive ? Colors.white : Colors.primary }]}>
              {isActive ? 'Viewing' : 'Switch'}
            </Text>
          </Pressable>

          {/* Call button */}
          {member.phone ? (
            <Pressable
              onPress={onCall}
              style={({ pressed }) => [
                memberCard.actionBtn,
                { backgroundColor: Colors.successLight },
                pressed && { opacity: 0.75 },
              ]}
            >
              <MaterialIcons name="phone" size={14} color={Colors.success} />
              <Text style={[memberCard.actionBtnText, { color: Colors.success }]}>Call</Text>
            </Pressable>
          ) : null}

          {/* Edit */}
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              memberCard.actionBtn,
              { backgroundColor: Colors.secondaryMuted },
              pressed && { opacity: 0.75 },
            ]}
          >
            <MaterialIcons name="edit" size={14} color={Colors.secondary} />
            <Text style={[memberCard.actionBtnText, { color: Colors.secondary }]}>Edit</Text>
          </Pressable>

          {/* Remove */}
          <Pressable
            onPress={onRemove}
            style={({ pressed }) => [
              memberCard.actionBtn,
              { backgroundColor: Colors.errorLight },
              pressed && { opacity: 0.75 },
            ]}
          >
            <MaterialIcons name="delete-outline" size={14} color={Colors.error} />
            <Text style={[memberCard.actionBtnText, { color: Colors.error }]}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const memberCard = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    marginBottom: Spacing[4],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.md,
  },
  activeStrip: {
    height: 3,
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing[4],
    gap: Spacing[3],
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: Colors.white, fontSize: Typography.md, fontWeight: Typography.bold },
  nameBlock: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], flexWrap: 'wrap' },
  name: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, flex: 1 },
  activePill: {
    paddingHorizontal: Spacing[2], paddingVertical: 2,
    borderRadius: Radius.full,
  },
  activePillText: { color: Colors.white, fontSize: 10, fontWeight: Typography.bold },
  caregiverPill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: Colors.secondaryMuted,
    paddingHorizontal: Spacing[2], paddingVertical: 2,
    borderRadius: Radius.full,
  },
  caregiverText: { color: Colors.secondary, fontSize: 10, fontWeight: Typography.semibold },
  meta: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 3, textTransform: 'capitalize' },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing[4],
    marginBottom: Spacing[3],
    gap: Spacing[2],
  },
  statCell: {
    flex: 1, alignItems: 'center',
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
  },
  statNum: { fontSize: Typography.md, fontWeight: Typography.bold },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },

  actions: {
    flexDirection: 'row',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[4],
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.md,
  },
  actionBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold },
});

// ─── Missed feed item ─────────────────────────────────────────────────────────
function MissedFeedRow({ item, index }: { item: MissedFeedItem; index: number }) {
  return (
    <Animated.View entering={FadeInRight.delay(index * 50).springify()}>
      <View style={feedStyles.row}>
        {/* Timeline */}
        <View style={feedStyles.timeline}>
          <View style={[feedStyles.dot, { backgroundColor: item.roleColor }]} />
          <View style={feedStyles.line} />
        </View>

        {/* Content */}
        <View style={feedStyles.content}>
          <View style={feedStyles.topRow}>
            <View style={[feedStyles.memberChip, { backgroundColor: item.roleColor + '18', borderColor: item.roleColor + '44' }]}>
              <Text style={[feedStyles.memberChipText, { color: item.roleColor }]}>
                {item.memberName}
              </Text>
            </View>
            <Text style={feedStyles.timeAgo}>
              {item.minutesAgo !== null && item.minutesAgo < 1440
                ? item.minutesAgo < 60
                  ? `${item.minutesAgo}m ago`
                  : `${Math.floor(item.minutesAgo / 60)}h ago`
                : item.dateLabel}
            </Text>
          </View>
          <Text style={feedStyles.medName}>{item.medicineName}</Text>
          <View style={feedStyles.metaRow}>
            <View style={feedStyles.missedChip}>
              <MaterialIcons name="cancel" size={11} color={Colors.error} />
              <Text style={feedStyles.missedText}>Missed {item.scheduledTime}</Text>
            </View>
            <Text style={feedStyles.dosage}>{item.dosage}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const feedStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: Spacing[2],
  },
  timeline: {
    width: 20,
    alignItems: 'center',
    paddingTop: 4,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { flex: 1, width: 2, backgroundColor: Colors.borderLight, marginTop: 3 },
  content: {
    flex: 1,
    paddingLeft: Spacing[3],
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing[1] },
  memberChip: {
    paddingHorizontal: Spacing[2], paddingVertical: 2,
    borderRadius: Radius.full, borderWidth: 1,
  },
  memberChipText: { fontSize: 11, fontWeight: Typography.bold },
  timeAgo: { fontSize: 11, color: Colors.textMuted },
  medName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  missedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.errorLight,
    paddingHorizontal: Spacing[2], paddingVertical: 2,
    borderRadius: Radius.full,
  },
  missedText: { fontSize: 11, color: Colors.error, fontWeight: Typography.semibold },
  dosage: { fontSize: 11, color: Colors.textMuted },
});

// ─── Summary Header Banner ────────────────────────────────────────────────────
function FamilySummaryBanner({
  members,
  stats,
}: {
  members: FamilyMember[];
  stats: Map<string, MemberStat>;
}) {
  const allGood = members.every(m => {
    const s = stats.get(m.id);
    return !s || s.totalToday === 0 || s.allTaken;
  });
  const totalMissed = Array.from(stats.values()).reduce((acc, s) => acc + s.missedToday, 0);
  const totalPending = Array.from(stats.values()).reduce((acc, s) => acc + s.pendingToday, 0);
  const activeMembersToday = Array.from(stats.values()).filter(s => s.totalToday > 0).length;

  const bannerColor = allGood ? Colors.success : totalMissed > 0 ? Colors.error : Colors.primary;
  const bannerBg = allGood ? Colors.successLight : totalMissed > 0 ? Colors.errorLight : Colors.primaryLight;

  return (
    <Animated.View entering={FadeIn.duration(500)}>
      <View style={[summaryBanner.card, { backgroundColor: bannerBg, borderColor: bannerColor + '40' }]}>
        <View style={summaryBanner.left}>
          <MaterialIcons
            name={allGood ? 'shield' : totalMissed > 0 ? 'warning' : 'supervisor-account'}
            size={28}
            color={bannerColor}
          />
          <View>
            <Text style={[summaryBanner.title, { color: bannerColor }]}>
              {allGood
                ? 'Family is on track today!'
                : totalMissed > 0
                ? `${totalMissed} dose${totalMissed !== 1 ? 's' : ''} missed today`
                : `${totalPending} dose${totalPending !== 1 ? 's' : ''} pending`}
            </Text>
            <Text style={summaryBanner.sub}>
              {activeMembersToday} of {members.length} member{members.length !== 1 ? 's' : ''} have medicines today
            </Text>
          </View>
        </View>
        <View style={summaryBanner.right}>
          <Text style={[summaryBanner.bigNum, { color: bannerColor }]}>{members.length}</Text>
          <Text style={summaryBanner.bigLabel}>Members</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const summaryBanner = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    borderWidth: 1.5,
    ...Shadow.sm,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], flex: 1 },
  title: { fontSize: Typography.base, fontWeight: Typography.bold },
  sub: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  right: { alignItems: 'center', paddingLeft: Spacing[3] },
  bigNum: { fontSize: Typography['2xl'], fontWeight: Typography.extrabold },
  bigLabel: { fontSize: Typography.xs, color: Colors.textMuted },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const {
    familyMembers, activeMember, setActiveMember,
    removeMember, medicines, refreshFamily,
  } = useApp();

  const [memberStats, setMemberStats] = useState<Map<string, MemberStat>>(new Map());
  const [missedFeed, setMissedFeed] = useState<MissedFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllFeed, setShowAllFeed] = useState(false);

  const getMedCount = (memberId: string) =>
    medicines.filter(m => m.memberId === memberId).length;

  // Build per-member stats from today's logs
  const loadStats = useCallback(async () => {
    if (familyMembers.length === 0) {
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const newStats = new Map<string, MemberStat>();
    const allMissedItems: MissedFeedItem[] = [];
    const now = new Date();

    for (const member of familyMembers) {
      try {
        const logs = await getMedicineLogs(member.id, 7);
        const todayLogs = logs.filter(l => l.scheduledDate === today);
        const recentMissed = logs.filter(l => l.status === 'missed');

        const taken = todayLogs.filter(l => l.status === 'taken').length;
        const missed = todayLogs.filter(l => l.status === 'missed').length;
        // Pending = overdue but unmarked (status 'pending' or if it's past time)
        const pending = todayLogs.filter(l => l.status === 'pending').length;
        const total = todayLogs.length;
        const pct = total > 0 ? Math.round(((taken) / total) * 100) : 0;

        newStats.set(member.id, {
          memberId: member.id,
          totalToday: total,
          takenToday: taken,
          missedToday: missed,
          pendingToday: pending,
          adherencePct: pct,
          allTaken: total > 0 && taken === total,
          hasMissed: missed > 0,
        });

        // Build missed feed items for this member
        const roleColor = getMemberRoleColor(member.role);
        for (const log of recentMissed) {
          // Find medicine name from medicines list
          const allMeds = await getMedicines(member.id);
          const med = allMeds.find(m => m.id === log.medicineId);
          if (!med) continue;

          const scheduledDateTime = new Date(`${log.scheduledDate}T${log.scheduledTime}:00`);
          const diffMs = now.getTime() - scheduledDateTime.getTime();
          const minutesAgo = diffMs > 0 ? Math.floor(diffMs / 60000) : null;

          const dateObj = new Date(log.scheduledDate);
          const dateLabel = dateObj.toLocaleDateString('en-IN', {
            weekday: 'short', day: 'numeric', month: 'short',
          });

          allMissedItems.push({
            id: log.id,
            memberName: member.name,
            memberRole: member.role,
            roleColor,
            medicineName: med.name,
            dosage: med.dosage,
            scheduledTime: formatTime12(log.scheduledTime),
            scheduledDate: log.scheduledDate,
            minutesAgo,
            dateLabel,
          });
        }
      } catch (err) {
        console.warn(`loadStats for ${member.id}:`, err);
      }
    }

    // Sort feed: most recent first
    allMissedItems.sort((a, b) => {
      const aTime = a.minutesAgo !== null ? a.minutesAgo : 999999;
      const bTime = b.minutesAgo !== null ? b.minutesAgo : 999999;
      return aTime - bTime;
    });

    setMemberStats(newStats);
    setMissedFeed(allMissedItems);
    setLoading(false);
  }, [familyMembers, medicines]);

  useEffect(() => {
    setLoading(true);
    loadStats();
  }, [loadStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFamily();
    await loadStats();
    setRefreshing(false);
  }, [refreshFamily, loadStats]);

  const handleCall = (member: FamilyMember) => {
    const phone = member.phone?.replace(/\D/g, '');
    if (!phone) {
      showAlert('No Phone Number', `Add a phone number for ${member.name} in their profile to enable calling.`);
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      showAlert('Call Failed', 'Unable to initiate call. Please check your device settings.');
    });
  };

  const handleRemove = (id: string, name: string) => {
    showAlert(`Remove ${name}?`, 'All their medicine data will also be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMember(id) },
    ]);
  };

  const visibleFeed = showAllFeed ? missedFeed : missedFeed.slice(0, 5);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Family Care</Text>
          <Text style={styles.headerSub}>{familyMembers.length} member{familyMembers.length !== 1 ? 's' : ''} · Today</Text>
        </View>
        <Pressable
          onPress={() => router.push('/add-family')}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
        >
          <MaterialIcons name="person-add" size={20} color={Colors.white} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading family data...</Text>
          </View>
        ) : familyMembers.length === 0 ? (
          /* Empty state */
          <View style={styles.emptyState}>
            <MaterialIcons name="group-add" size={64} color={Colors.primaryMuted} />
            <Text style={styles.emptyTitle}>Add Your Family</Text>
            <Text style={styles.emptySubtitle}>
              Track medicines for your entire family from one place
            </Text>
            <Pressable
              onPress={() => router.push('/add-family')}
              style={({ pressed }) => [styles.addFirstBtn, pressed && { opacity: 0.8 }]}
            >
              <MaterialIcons name="person-add" size={18} color={Colors.white} />
              <Text style={styles.addFirstBtnText}>Add First Member</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── FAMILY SUMMARY BANNER ── */}
            <FamilySummaryBanner members={familyMembers} stats={memberStats} />

            {/* ── MEMBER MONITORING CARDS ── */}
            <View style={styles.sectionHeader}>
              <MaterialIcons name="people" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Members</Text>
            </View>

            {familyMembers.map((member, i) => (
              <MemberMonitorCard
                key={member.id}
                member={member}
                stat={memberStats.get(member.id) ?? null}
                isActive={member.id === activeMember?.id}
                medCount={getMedCount(member.id)}
                index={i}
                onSwitch={() => setActiveMember(member)}
                onCall={() => handleCall(member)}
                onEdit={() => router.push({ pathname: '/add-family', params: { editId: member.id } })}
                onRemove={() => handleRemove(member.id, member.name)}
              />
            ))}

            {/* ── MISSED DOSE ACTIVITY FEED ── */}
            <View style={[styles.sectionHeader, { marginTop: Spacing[2] }]}>
              <MaterialIcons name="history" size={18} color={Colors.error} />
              <Text style={styles.sectionTitle}>Missed Dose Activity</Text>
              {missedFeed.length > 0 ? (
                <View style={styles.feedCount}>
                  <Text style={styles.feedCountText}>{missedFeed.length}</Text>
                </View>
              ) : null}
            </View>

            {missedFeed.length === 0 ? (
              <Animated.View entering={FadeInDown.delay(300).springify()}>
                <View style={styles.feedEmpty}>
                  <MaterialIcons name="check-circle" size={40} color={Colors.success} />
                  <Text style={styles.feedEmptyTitle}>No missed doses!</Text>
                  <Text style={styles.feedEmptyText}>Your family is doing great.</Text>
                </View>
              </Animated.View>
            ) : (
              <View style={styles.feedCard}>
                {visibleFeed.map((item, i) => (
                  <MissedFeedRow key={item.id} item={item} index={i} />
                ))}
                {missedFeed.length > 5 ? (
                  <Pressable
                    onPress={() => setShowAllFeed(v => !v)}
                    style={({ pressed }) => [styles.showMoreBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.showMoreText}>
                      {showAllFeed ? 'Show less' : `Show ${missedFeed.length - 5} more`}
                    </Text>
                    <MaterialIcons
                      name={showAllFeed ? 'expand-less' : 'expand-more'}
                      size={18}
                      color={Colors.primary}
                    />
                  </Pressable>
                ) : null}
              </View>
            )}

            {/* ── QUICK CALL ALL ── */}
            {familyMembers.some(m => !!m.phone) ? (
              <Animated.View entering={FadeInDown.delay(400).springify()}>
                <View style={styles.quickCallCard}>
                  <View style={styles.quickCallHeader}>
                    <MaterialIcons name="phone" size={18} color={Colors.secondary} />
                    <Text style={styles.quickCallTitle}>Quick Call</Text>
                  </View>
                  <View style={styles.quickCallGrid}>
                    {familyMembers.filter(m => !!m.phone).map(m => {
                      const rc = getMemberRoleColor(m.role);
                      return (
                        <Pressable
                          key={m.id}
                          onPress={() => handleCall(m)}
                          style={({ pressed }) => [
                            styles.quickCallBtn,
                            { borderColor: rc + '55', backgroundColor: rc + '10' },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <View style={[styles.quickCallAvatar, { backgroundColor: rc }]}>
                            <Text style={styles.quickCallAvatarText}>{getMemberInitials(m.name)}</Text>
                          </View>
                          <Text style={styles.quickCallName} numberOfLines={1}>{m.name}</Text>
                          <MaterialIcons name="call" size={14} color={rc} />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>
            ) : null}

            {/* Caregiver tip */}
            <Animated.View entering={FadeInDown.delay(450).springify()}>
              <View style={styles.tipCard}>
                <MaterialIcons name="tips-and-updates" size={22} color={Colors.accent} />
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>Caregiver Mode</Text>
                  <Text style={styles.tipText}>
                    Switch between members to view their medicines. Add a phone number to enable one-tap calling. Mark a member as Caregiver to receive missed-dose alerts on their behalf.
                  </Text>
                </View>
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
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
  headerTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  headerSub: { fontSize: Typography.sm, color: Colors.textMuted },
  addBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.colored,
  },

  scroll: { padding: Spacing[4] },

  loadingBox: {
    alignItems: 'center',
    paddingVertical: Spacing[16],
    gap: Spacing[4],
  },
  loadingText: { fontSize: Typography.base, color: Colors.textMuted },

  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing[12],
    gap: Spacing[2],
  },
  emptyTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary },
  emptySubtitle: {
    fontSize: Typography.base, color: Colors.textMuted,
    textAlign: 'center', lineHeight: Typography.base * 1.5,
  },
  addFirstBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing[6], paddingVertical: Spacing[3],
    borderRadius: Radius.full, marginTop: Spacing[4],
    ...Shadow.colored,
  },
  addFirstBtnText: { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.base },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[3],
  },
  sectionTitle: {
    fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary,
    flex: 1,
  },
  feedCount: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: Spacing[2], paddingVertical: 2,
    borderRadius: Radius.full,
  },
  feedCountText: { fontSize: Typography.xs, color: Colors.error, fontWeight: Typography.bold },

  // Feed card
  feedCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    ...Shadow.md,
  },
  feedEmpty: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[8],
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[4],
    ...Shadow.sm,
  },
  feedEmptyTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary },
  feedEmptyText: { fontSize: Typography.base, color: Colors.textMuted },
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingTop: Spacing[2], marginTop: Spacing[1],
  },
  showMoreText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.semibold },

  // Quick call
  quickCallCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    ...Shadow.md,
  },
  quickCallHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing[2], marginBottom: Spacing[3],
  },
  quickCallTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary },
  quickCallGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2],
  },
  quickCallBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing[2], paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.full, borderWidth: 1.5,
  },
  quickCallAvatar: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  quickCallAvatarText: { color: Colors.white, fontSize: 10, fontWeight: Typography.bold },
  quickCallName: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary, maxWidth: 80 },

  // Tip
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: Spacing[3],
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.accentMuted,
    marginBottom: Spacing[4],
  },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: 4 },
  tipText: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
});
