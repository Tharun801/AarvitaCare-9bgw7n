import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { WeeklyGraph } from '@/components';
import { useApp } from '@/hooks/useApp';
import { getMedicineLogs, MedicineLog } from '@/services/medicineService';

type Period = '7d' | '30d';

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { activeMember, adherenceStats, medicines } = useApp();
  const [period, setPeriod] = useState<Period>('7d');
  const [logs, setLogs] = useState<MedicineLog[]>([]);

  useEffect(() => {
    if (!activeMember) return;
    getMedicineLogs(activeMember.id, period === '7d' ? 7 : 30).then(setLogs);
  }, [activeMember, period]);

  const taken = logs.filter(l => l.status === 'taken').length;
  const missed = logs.filter(l => l.status === 'missed').length;
  const total = taken + missed;
  const pct = total > 0 ? Math.round((taken / total) * 100) : 0;

  const getScoreColor = (s: number) => {
    if (s >= 80) return Colors.success;
    if (s >= 60) return Colors.primary;
    if (s >= 40) return Colors.warning;
    return Colors.error;
  };

  const getScoreLabel = (s: number) => {
    if (s >= 90) return 'Excellent 🌟';
    if (s >= 75) return 'Good 👍';
    if (s >= 50) return 'Fair ⚠️';
    return 'Needs Attention ❗';
  };

  // Medicine-wise stats
  const medStats = medicines.map(med => {
    const medLogs = logs.filter(l => l.medicineId === med.id);
    const medTaken = medLogs.filter(l => l.status === 'taken').length;
    const medTotal = medLogs.length;
    const medPct = medTotal > 0 ? Math.round((medTaken / medTotal) * 100) : 0;
    return { med, taken: medTaken, total: medTotal, pct: medPct };
  }).sort((a, b) => b.pct - a.pct);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Health Reports</Text>
          {activeMember ? <Text style={styles.headerSub}>for {activeMember.name}</Text> : null}
        </View>
        <View style={styles.periodToggle}>
          {(['7d', '30d'] as Period[]).map(p => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p === '7d' ? '7 Days' : '30 Days'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Score Card */}
        <View style={[styles.scoreCard, { backgroundColor: getScoreColor(pct) }]}>
          <View style={styles.scoreLeft}>
            <Text style={styles.scoreLabel}>Adherence Score</Text>
            <Text style={styles.scoreNumber}>{pct}%</Text>
            <Text style={styles.scoreGrade}>{getScoreLabel(pct)}</Text>
          </View>
          <View style={styles.scoreRight}>
            <View style={styles.scoreCircle}>
              <Text style={[styles.scoreCircleNum, { color: getScoreColor(pct) }]}>{pct}</Text>
              <Text style={styles.scoreCircleLabel}>score</Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCell, { backgroundColor: Colors.successLight }]}>
            <MaterialIcons name="check-circle" size={24} color={Colors.success} />
            <Text style={[styles.statNum, { color: Colors.success }]}>{taken}</Text>
            <Text style={styles.statLabel}>Doses Taken</Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: Colors.errorLight }]}>
            <MaterialIcons name="cancel" size={24} color={Colors.error} />
            <Text style={[styles.statNum, { color: Colors.error }]}>{missed}</Text>
            <Text style={styles.statLabel}>Doses Missed</Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: Colors.accentLight }]}>
            <MaterialIcons name="local-fire-department" size={24} color={Colors.accent} />
            <Text style={[styles.statNum, { color: Colors.accent }]}>{adherenceStats.streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: Colors.primaryLight }]}>
            <MaterialIcons name="medication" size={24} color={Colors.primary} />
            <Text style={[styles.statNum, { color: Colors.primary }]}>{medicines.length}</Text>
            <Text style={styles.statLabel}>Total Meds</Text>
          </View>
        </View>

        {/* Weekly Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Weekly Overview</Text>
          <WeeklyGraph data={adherenceStats.weeklyData} />
        </View>

        {/* Per-Medicine Breakdown */}
        {medStats.length > 0 ? (
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Medicine Breakdown</Text>
            {medStats.map(({ med, taken: t, total: tot, pct: p }) => (
              <View key={med.id} style={styles.breakdownRow}>
                <View style={[styles.medDot, { backgroundColor: med.color }]} />
                <View style={styles.breakdownInfo}>
                  <Text style={styles.breakdownName}>{med.name}</Text>
                  <View style={styles.breakdownBarRow}>
                    <View style={styles.breakdownBar}>
                      <View style={[styles.breakdownFill, {
                        width: `${p}%` as any,
                        backgroundColor: p >= 80 ? Colors.success : p >= 50 ? Colors.warning : Colors.error,
                      }]} />
                    </View>
                    <Text style={[styles.breakdownPct, { color: p >= 80 ? Colors.success : p >= 50 ? Colors.warning : Colors.error }]}>
                      {p}%
                    </Text>
                  </View>
                  <Text style={styles.breakdownDetail}>{t}/{tot} doses</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Health Tips */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 Health Tip</Text>
          <Text style={styles.tipText}>
            {pct >= 80
              ? "Great adherence! Keep up the excellent work. Consistency is the key to better health outcomes."
              : pct >= 50
              ? "You are doing well! Try to take your medicines at the same time each day to build a routine."
              : "Missing doses can reduce treatment effectiveness. Set voice reminders to stay on track!"}
          </Text>
        </View>

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
  headerTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  headerSub: { fontSize: Typography.sm, color: Colors.textMuted },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: 2,
  },
  periodBtn: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1],
    borderRadius: Radius.sm,
  },
  periodBtnActive: { backgroundColor: Colors.primary },
  periodText: { fontSize: Typography.sm, color: Colors.textMuted, fontWeight: Typography.medium },
  periodTextActive: { color: Colors.white, fontWeight: Typography.semibold },
  scroll: { padding: Spacing[4] },
  scoreCard: {
    borderRadius: Radius.xl,
    padding: Spacing[5],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[4],
    ...Shadow.lg,
  },
  scoreLeft: {},
  scoreLabel: { color: 'rgba(255,255,255,0.8)', fontSize: Typography.sm },
  scoreNumber: {
    fontSize: Typography.display,
    fontWeight: Typography.extrabold,
    color: Colors.white,
    lineHeight: Typography.display * 1.1,
  },
  scoreGrade: { color: 'rgba(255,255,255,0.9)', fontSize: Typography.md, fontWeight: Typography.medium },
  scoreRight: {},
  scoreCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCircleNum: { fontSize: Typography['2xl'], fontWeight: Typography.bold },
  scoreCircleLabel: { fontSize: Typography.xs, color: Colors.textMuted },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  statCell: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: Spacing[4],
    borderRadius: Radius.lg,
    gap: 4,
  },
  statNum: { fontSize: Typography['2xl'], fontWeight: Typography.bold },
  statLabel: { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center' },
  chartCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    ...Shadow.md,
  },
  chartTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing[3] },
  breakdownCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    ...Shadow.md,
  },
  breakdownTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing[4] },
  breakdownRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing[4], gap: Spacing[3] },
  medDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  breakdownInfo: { flex: 1 },
  breakdownName: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary, marginBottom: 4 },
  breakdownBarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: 2 },
  breakdownBar: { flex: 1, height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: 3 },
  breakdownPct: { fontSize: Typography.sm, fontWeight: Typography.bold, minWidth: 36, textAlign: 'right' },
  breakdownDetail: { fontSize: Typography.xs, color: Colors.textMuted },
  tipCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.primaryMuted,
    marginBottom: Spacing[4],
  },
  tipTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.primary, marginBottom: Spacing[2] },
  tipText: { fontSize: Typography.base, color: Colors.textSecondary, lineHeight: Typography.base * 1.6 },
});
