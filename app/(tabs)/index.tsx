import React, { useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { MedicineCard, WeeklyGraph, FamilyMemberCard } from '@/components';
import { useApp } from '@/hooks/useApp';
import { getMemberRoleColor } from '@/services/familyService';
import { speakReminder } from '@/services/voiceService';
import { useAlert } from '@/template';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const {
    user, activeMember, familyMembers,
    todaySchedule, adherenceStats,
    markMedicine, refreshMedicines, setActiveMember,
  } = useApp();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshMedicines();
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
          todaySchedule.map((item, idx) => (
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
    </View>
  );
}

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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: Typography.display,
    fontWeight: Typography.extrabold,
    color: Colors.white,
    lineHeight: Typography.display * 1.1,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  streakFire: { fontSize: 18 },
  streakText: { color: 'rgba(255,255,255,0.9)', fontSize: Typography.sm, fontWeight: Typography.semibold },
  heroRight: { justifyContent: 'center' },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    alignItems: 'center',
    minWidth: 80,
  },
  statNumber: { color: Colors.white, fontSize: Typography.xl, fontWeight: Typography.bold },
  statLabel: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.xs },
  quickStats: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing[3],
    borderRadius: Radius.lg,
    gap: 4,
  },
  quickStatNum: { fontSize: Typography.xl, fontWeight: Typography.bold },
  quickStatLabel: { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.medium },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3],
    marginTop: Spacing[1],
  },
  sectionTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  seeAll: { color: Colors.primary, fontSize: Typography.sm, fontWeight: Typography.semibold },
  emptyState: {
    alignItems: 'center',
    padding: Spacing[8],
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    marginBottom: Spacing[4],
    ...Shadow.sm,
  },
  emptyTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary, marginTop: Spacing[3] },
  emptySubtitle: { fontSize: Typography.base, color: Colors.textMuted, marginTop: Spacing[2] },
  emptyBtn: {
    marginTop: Spacing[4],
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.full,
  },
  emptyBtnText: { color: Colors.white, fontWeight: Typography.semibold },
  graphCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    ...Shadow.md,
  },
});
