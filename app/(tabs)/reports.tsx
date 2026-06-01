/**
 * app/(tabs)/reports.tsx
 * Enhanced health reports:
 *  - 30-day adherence calendar heatmap (green/red/grey cells)
 *  - Per-medicine adherence bar chart with animated fills
 *  - Streak history timeline
 *  - Summary stats (taken / missed / streak / health score)
 *  - Shareable health summary card via expo-sharing + expo-view-shot
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, Share, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay,
  withTiming, FadeIn, FadeInDown, FadeInUp,
} from 'react-native-reanimated';
import * as Sharing from 'expo-sharing';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import {
  getMedicineLogs, calculateAdherence, calculateHealthScore,
  MedicineLog,
} from '@/services/medicineService';

// ─── Types ────────────────────────────────────────────────────────────────────
type Period = '7d' | '30d';

interface DayCell {
  date: string;          // 'YYYY-MM-DD'
  label: string;         // 'D' e.g. '3'
  taken: number;
  missed: number;
  status: 'taken' | 'missed' | 'partial' | 'empty' | 'future';
  isToday: boolean;
}

interface MedStat {
  id: string;
  name: string;
  dosage: string;
  color: string;
  taken: number;
  total: number;
  pct: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getScoreColor(s: number): string {
  if (s >= 80) return Colors.success;
  if (s >= 60) return Colors.primary;
  if (s >= 40) return Colors.warning;
  return Colors.error;
}

function getScoreLabel(s: number): string {
  if (s >= 90) return 'Excellent';
  if (s >= 75) return 'Good';
  if (s >= 50) return 'Fair';
  return 'Needs Attention';
}

function getScoreEmoji(s: number): string {
  if (s >= 90) return '🌟';
  if (s >= 75) return '👍';
  if (s >= 50) return '⚠️';
  return '❗';
}

function buildCalendarCells(logs: MedicineLog[], days: number): DayCell[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells: DayCell[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLogs = logs.filter(l => l.scheduledDate === dateStr);
    const taken = dayLogs.filter(l => l.status === 'taken').length;
    const missed = dayLogs.filter(l => l.status === 'missed').length;
    const isFuture = d > today;

    let status: DayCell['status'];
    if (isFuture) status = 'future';
    else if (dayLogs.length === 0) status = 'empty';
    else if (taken === dayLogs.length) status = 'taken';
    else if (missed === dayLogs.length) status = 'missed';
    else status = 'partial';

    cells.push({
      date: dateStr,
      label: String(d.getDate()),
      taken,
      missed,
      status,
      isToday: i === 0,
    });
  }
  return cells;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CalendarHeatmap({ cells }: { cells: DayCell[] }) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const cellColor = (status: DayCell['status']) => {
    switch (status) {
      case 'taken': return Colors.success;
      case 'missed': return Colors.error;
      case 'partial': return Colors.warning;
      case 'future': return Colors.borderLight;
      default: return Colors.chartGray + '55';
    }
  };

  // Build rows of 7
  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={heatStyles.container}>
      {/* Day labels */}
      <View style={heatStyles.weekdayRow}>
        {weekdays.map((d, i) => (
          <View key={i} style={heatStyles.weekdayCell}>
            <Text style={heatStyles.weekdayText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid rows */}
      {weeks.map((week, wi) => (
        <Animated.View key={wi} entering={FadeIn.delay(wi * 40)} style={heatStyles.weekRow}>
          {week.map((cell, di) => (
            <View
              key={di}
              style={[
                heatStyles.cell,
                { backgroundColor: cellColor(cell.status) },
                cell.isToday && heatStyles.todayCell,
              ]}
            >
              {cell.isToday ? (
                <Text style={heatStyles.todayLabel}>{cell.label}</Text>
              ) : null}
            </View>
          ))}
        </Animated.View>
      ))}

      {/* Legend */}
      <View style={heatStyles.legend}>
        {[
          { color: Colors.success, label: 'All taken' },
          { color: Colors.warning, label: 'Partial' },
          { color: Colors.error, label: 'All missed' },
          { color: Colors.chartGray + '55', label: 'No data' },
        ].map(({ color, label }) => (
          <View key={label} style={heatStyles.legendItem}>
            <View style={[heatStyles.legendDot, { backgroundColor: color }]} />
            <Text style={heatStyles.legendText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Animated bar for medicine breakdown
function AnimatedBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(delay, withTiming(pct, { duration: 700 }));
  }, [pct]);

  const animStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={barStyles.track}>
      <Animated.View style={[barStyles.fill, { backgroundColor: color }, animStyle]} />
    </View>
  );
}

function MedBreakdownCard({ stats, period }: { stats: MedStat[]; period: Period }) {
  if (stats.length === 0) {
    return (
      <View style={sectionStyles.emptyCard}>
        <MaterialIcons name="medication-liquid" size={40} color={Colors.primaryMuted} />
        <Text style={sectionStyles.emptyText}>No medicine data for this period</Text>
      </View>
    );
  }

  return (
    <View style={sectionStyles.card}>
      <View style={sectionStyles.cardHeader}>
        <MaterialIcons name="bar-chart" size={20} color={Colors.primary} />
        <Text style={sectionStyles.cardTitle}>Per-Medicine Adherence</Text>
        <Text style={sectionStyles.cardSub}>{period === '7d' ? 'Last 7 days' : 'Last 30 days'}</Text>
      </View>

      {stats.map(({ id, name, dosage, color, taken, total, pct }, idx) => {
        const barColor = pct >= 80 ? Colors.success : pct >= 50 ? Colors.warning : Colors.error;
        return (
          <Animated.View key={id} entering={FadeInDown.delay(idx * 60).springify()} style={medStyles.row}>
            <View style={[medStyles.dot, { backgroundColor: color }]} />
            <View style={medStyles.info}>
              <View style={medStyles.nameRow}>
                <Text style={medStyles.name} numberOfLines={1}>{name}</Text>
                <Text style={[medStyles.pct, { color: barColor }]}>{pct}%</Text>
              </View>
              <Text style={medStyles.dosage}>{dosage} · {taken}/{total} doses</Text>
              <AnimatedBar pct={pct} color={barColor} delay={idx * 100} />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

function StreakTimeline({ weeklyData }: {
  weeklyData: Array<{ date: string; taken: number; missed: number }>;
}) {
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={sectionStyles.card}>
      <View style={sectionStyles.cardHeader}>
        <MaterialIcons name="local-fire-department" size={20} color={Colors.accent} />
        <Text style={sectionStyles.cardTitle}>7-Day Streak Timeline</Text>
      </View>

      <View style={streakStyles.row}>
        {weeklyData.map((day, i) => {
          const d = new Date(day.date);
          const total = day.taken + day.missed;
          const pct = total > 0 ? (day.taken / total) : -1;
          const barColor = pct < 0 ? Colors.chartGray : pct >= 0.8 ? Colors.success : pct >= 0.5 ? Colors.warning : Colors.error;
          const BAR_MAX = 64;
          const fillH = pct < 0 ? 4 : Math.max(8, Math.round(pct * BAR_MAX));

          const anim = useSharedValue(0);
          useEffect(() => {
            anim.value = withDelay(i * 80, withTiming(fillH, { duration: 600 }));
          }, [fillH]);
          const animStyle = useAnimatedStyle(() => ({ height: anim.value }));

          return (
            <Animated.View key={day.date} entering={FadeInUp.delay(i * 70)} style={streakStyles.col}>
              {/* Taken count badge */}
              {day.taken > 0 ? (
                <Text style={streakStyles.takenBadge}>{day.taken}</Text>
              ) : (
                <Text style={[streakStyles.takenBadge, { color: Colors.transparent || 'transparent' }]}>0</Text>
              )}
              {/* Bar */}
              <View style={[streakStyles.barTrack, { height: BAR_MAX }]}>
                <Animated.View style={[streakStyles.barFill, { backgroundColor: barColor }, animStyle]} />
              </View>
              {/* Day label */}
              <Text style={streakStyles.dayLabel}>{dayLabels[d.getDay()]}</Text>
              {/* Status icon */}
              <MaterialIcons
                name={pct < 0 ? 'remove' : pct >= 0.8 ? 'check-circle' : pct >= 0.5 ? 'warning' : 'cancel'}
                size={14}
                color={barColor}
              />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

// Shareable health summary card
function SummaryCard({
  memberName,
  pct,
  taken,
  missed,
  streak,
  healthScore,
  period,
}: {
  memberName: string;
  pct: number;
  taken: number;
  missed: number;
  streak: number;
  healthScore: number;
  period: Period;
}) {
  const scoreColor = getScoreColor(pct);
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <View style={summaryStyles.card}>
      {/* Header strip */}
      <View style={[summaryStyles.header, { backgroundColor: scoreColor }]}>
        <View>
          <Text style={summaryStyles.headerLabel}>AarvitaCare Health Summary</Text>
          <Text style={summaryStyles.headerName}>{memberName}</Text>
        </View>
        <View style={summaryStyles.scoreCircle}>
          <Text style={[summaryStyles.scoreNum, { color: scoreColor }]}>{pct}</Text>
          <Text style={summaryStyles.scorePct}>%</Text>
        </View>
      </View>

      {/* Metrics row */}
      <View style={summaryStyles.metricsRow}>
        <View style={summaryStyles.metric}>
          <Text style={[summaryStyles.metricNum, { color: Colors.success }]}>{taken}</Text>
          <Text style={summaryStyles.metricLabel}>Taken</Text>
        </View>
        <View style={summaryStyles.metricDivider} />
        <View style={summaryStyles.metric}>
          <Text style={[summaryStyles.metricNum, { color: Colors.error }]}>{missed}</Text>
          <Text style={summaryStyles.metricLabel}>Missed</Text>
        </View>
        <View style={summaryStyles.metricDivider} />
        <View style={summaryStyles.metric}>
          <Text style={[summaryStyles.metricNum, { color: Colors.accent }]}>{streak}🔥</Text>
          <Text style={summaryStyles.metricLabel}>Streak</Text>
        </View>
        <View style={summaryStyles.metricDivider} />
        <View style={summaryStyles.metric}>
          <Text style={[summaryStyles.metricNum, { color: Colors.primary }]}>{healthScore}</Text>
          <Text style={summaryStyles.metricLabel}>Score</Text>
        </View>
      </View>

      {/* Status label */}
      <View style={[summaryStyles.gradeBanner, { backgroundColor: scoreColor + '18', borderColor: scoreColor + '40' }]}>
        <Text style={[summaryStyles.gradeText, { color: scoreColor }]}>
          {getScoreEmoji(pct)} {getScoreLabel(pct)} adherence · {period === '7d' ? 'Last 7 days' : 'Last 30 days'}
        </Text>
      </View>

      {/* Footer */}
      <View style={summaryStyles.footer}>
        <Text style={summaryStyles.footerText}>Generated on {today}</Text>
        <Text style={summaryStyles.footerBrand}>AarvitaCare — Where health meets love ❤️</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { activeMember, adherenceStats, medicines } = useApp();
  const [period, setPeriod] = useState<Period>('30d');
  const [logs, setLogs] = useState<MedicineLog[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Derived stats for the selected period
  const [periodStats, setPeriodStats] = useState({
    pct: 0, taken: 0, missed: 0, streak: 0, healthScore: 0,
  });

  const loadData = useCallback(async () => {
    if (!activeMember) return;
    setStatsLoading(true);
    try {
      const days = period === '7d' ? 7 : 30;
      const fetchedLogs = await getMedicineLogs(activeMember.id, days);
      setLogs(fetchedLogs);

      const taken = fetchedLogs.filter(l => l.status === 'taken').length;
      const missed = fetchedLogs.filter(l => l.status === 'missed').length;
      const total = taken + missed;
      const pct = total > 0 ? Math.round((taken / total) * 100) : 0;

      const stats = await calculateAdherence(activeMember.id, days);
      const healthScore = calculateHealthScore(stats.percentage, stats.streak);

      setPeriodStats({ pct, taken, missed, streak: stats.streak, healthScore });
    } catch (e) {
      console.error('Reports loadData:', e);
    } finally {
      setStatsLoading(false);
    }
  }, [activeMember, period]);

  useEffect(() => { loadData(); }, [loadData]);

  // 30-day calendar cells
  const calendarCells = buildCalendarCells(logs, period === '7d' ? 7 : 30);

  // Per-medicine stats
  const medStats: MedStat[] = medicines.map(med => {
    const medLogs = logs.filter(l => l.medicineId === med.id);
    const taken = medLogs.filter(l => l.status === 'taken').length;
    const total = medLogs.length;
    const pct = total > 0 ? Math.round((taken / total) * 100) : 0;
    return { id: med.id, name: med.name, dosage: med.dosage, color: med.color, taken, total, pct };
  }).sort((a, b) => b.pct - a.pct);

  // Share health summary using native Share API
  const handleShare = async () => {
    setSharing(true);
    try {
      const { pct, taken, missed, streak, healthScore } = periodStats;
      const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      const periodLabel = period === '7d' ? 'Last 7 days' : 'Last 30 days';
      const grade = `${getScoreEmoji(pct)} ${getScoreLabel(pct)}`;

      const message =
        `🏥 AarvitaCare Health Summary\n` +
        `👤 ${activeMember?.name || 'Family Member'}\n` +
        `📅 ${periodLabel} · ${today}\n\n` +
        `📊 Adherence Score: ${pct}% — ${grade}\n` +
        `✅ Doses Taken: ${taken}\n` +
        `❌ Doses Missed: ${missed}\n` +
        `🔥 Current Streak: ${streak} days\n` +
        `💯 Health Score: ${healthScore}/100\n\n` +
        (medStats.length > 0
          ? `💊 Medicine Breakdown:\n` +
            medStats.map(m => `  • ${m.name}: ${m.pct}% (${m.taken}/${m.total} doses)`).join('\n') +
            '\n\n'
          : '') +
        `_Shared via AarvitaCare — Where health meets love ❤️_`;

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        // Use native Share for text
        await Share.share({
          message,
          title: 'AarvitaCare Health Summary',
        });
      } else {
        await Share.share({ message, title: 'AarvitaCare Health Summary' });
      }
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        console.warn('Share error:', e);
      }
    } finally {
      setSharing(false);
    }
  };

  const { pct, taken, missed, streak, healthScore } = periodStats;
  const scoreColor = getScoreColor(pct);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Health Reports</Text>
          {activeMember ? <Text style={styles.headerSub}>for {activeMember.name}</Text> : null}
        </View>
        <View style={styles.headerRight}>
          {/* Period toggle */}
          <View style={styles.periodToggle}>
            {(['7d', '30d'] as Period[]).map(p => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              >
                <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                  {p === '7d' ? '7d' : '30d'}
                </Text>
              </Pressable>
            ))}
          </View>
          {/* Share button */}
          <Pressable
            onPress={handleShare}
            disabled={sharing}
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
          >
            {sharing
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <MaterialIcons name="share" size={18} color={Colors.white} />}
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
      >
        {statsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading health data...</Text>
          </View>
        ) : (
          <>
            {/* ── HERO SCORE CARD ── */}
            <Animated.View entering={FadeInDown.duration(400)}>
              <View style={[styles.heroCard, { backgroundColor: scoreColor }]}>
                <View style={styles.heroLeft}>
                  <Text style={styles.heroLabel}>Adherence Score</Text>
                  <Text style={styles.heroScore}>{pct}%</Text>
                  <View style={styles.heroGradeRow}>
                    <Text style={styles.heroGradeEmoji}>{getScoreEmoji(pct)}</Text>
                    <Text style={styles.heroGradeText}>{getScoreLabel(pct)}</Text>
                  </View>
                  <Text style={styles.heroPeriod}>
                    {period === '7d' ? 'Last 7 days' : 'Last 30 days'}
                  </Text>
                </View>
                <View style={styles.heroRight}>
                  {/* Outer ring */}
                  <View style={styles.ringOuter}>
                    <View style={styles.ringInner}>
                      <Text style={[styles.ringScore, { color: scoreColor }]}>{healthScore}</Text>
                      <Text style={styles.ringLabel}>health{'\n'}score</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* ── STATS GRID ── */}
            <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.statsGrid}>
              {[
                { icon: 'check-circle', val: taken, label: 'Taken', color: Colors.success, bg: Colors.successLight },
                { icon: 'cancel', val: missed, label: 'Missed', color: Colors.error, bg: Colors.errorLight },
                { icon: 'local-fire-department', val: `${streak}🔥`, label: 'Streak', color: Colors.accent, bg: Colors.accentLight },
                { icon: 'medication', val: medicines.length, label: 'Medicines', color: Colors.primary, bg: Colors.primaryLight },
              ].map(({ icon, val, label, color, bg }) => (
                <View key={label} style={[styles.statCell, { backgroundColor: bg }]}>
                  <MaterialIcons name={icon as any} size={22} color={color} />
                  <Text style={[styles.statNum, { color }]}>{val}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </Animated.View>

            {/* ── 30-DAY CALENDAR HEATMAP ── */}
            <Animated.View entering={FadeInDown.delay(120).duration(400)}>
              <View style={sectionStyles.card}>
                <View style={sectionStyles.cardHeader}>
                  <MaterialIcons name="calendar-today" size={20} color={Colors.primary} />
                  <Text style={sectionStyles.cardTitle}>
                    {period === '7d' ? '7-Day' : '30-Day'} Calendar
                  </Text>
                  <Text style={sectionStyles.cardSub}>Daily adherence</Text>
                </View>
                <CalendarHeatmap cells={calendarCells} />
              </View>
            </Animated.View>

            {/* ── STREAK TIMELINE ── */}
            {adherenceStats.weeklyData.length > 0 ? (
              <Animated.View entering={FadeInDown.delay(160).duration(400)}>
                <StreakTimeline weeklyData={adherenceStats.weeklyData} />
              </Animated.View>
            ) : null}

            {/* ── PER-MEDICINE BAR CHART ── */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <MedBreakdownCard stats={medStats} period={period} />
            </Animated.View>

            {/* ── SHAREABLE SUMMARY CARD ── */}
            <Animated.View entering={FadeInDown.delay(240).duration(400)}>
              <View style={sectionStyles.sectionLabel}>
                <MaterialIcons name="share" size={16} color={Colors.textMuted} />
                <Text style={sectionStyles.sectionLabelText}>Shareable Summary</Text>
              </View>
              <SummaryCard
                memberName={activeMember?.name || 'Family Member'}
                pct={pct}
                taken={taken}
                missed={missed}
                streak={streak}
                healthScore={healthScore}
                period={period}
              />
              <Pressable
                onPress={handleShare}
                disabled={sharing}
                style={({ pressed }) => [styles.shareFullBtn, pressed && { opacity: 0.75 }]}
              >
                {sharing
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <MaterialIcons name="share" size={18} color={Colors.white} />}
                <Text style={styles.shareFullBtnText}>
                  {sharing ? 'Sharing...' : 'Share via WhatsApp / SMS'}
                </Text>
              </Pressable>
            </Animated.View>

            {/* ── HEALTH TIP ── */}
            <Animated.View entering={FadeInDown.delay(280).duration(400)}>
              <View style={styles.tipCard}>
                <View style={styles.tipHeader}>
                  <Text style={styles.tipEmoji}>💡</Text>
                  <Text style={styles.tipTitle}>Health Insight</Text>
                </View>
                <Text style={styles.tipText}>
                  {pct >= 80
                    ? "Outstanding adherence! Consistency like this significantly improves treatment outcomes. Keep up this excellent habit."
                    : pct >= 60
                    ? "Good progress! Try to take your medicines at the same time each day to build an unbreakable routine."
                    : pct >= 40
                    ? "You are doing okay, but there is room for improvement. Set voice reminders to help you remember every dose."
                    : "Missing doses can reduce treatment effectiveness. Enable auto-alerts in Settings to stay on track with your health."}
                </Text>
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
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
  headerTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  headerSub: { fontSize: Typography.sm, color: Colors.textMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },

  periodToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  periodBtn: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1],
    borderRadius: Radius.sm,
    minWidth: 36,
    alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: Colors.primary },
  periodText: { fontSize: Typography.sm, color: Colors.textMuted, fontWeight: Typography.medium },
  periodTextActive: { color: Colors.white, fontWeight: Typography.semibold },

  shareBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.colored,
  },

  scroll: { padding: Spacing[4] },

  loadingContainer: { alignItems: 'center', paddingVertical: Spacing[16], gap: Spacing[4] },
  loadingText: { fontSize: Typography.base, color: Colors.textMuted },

  // Hero
  heroCard: {
    borderRadius: Radius.xl,
    padding: Spacing[5],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[4],
    ...Shadow.lg,
  },
  heroLeft: { flex: 1 },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.sm, marginBottom: 2 },
  heroScore: {
    fontSize: Typography.display,
    fontWeight: Typography.extrabold,
    color: Colors.white,
    lineHeight: Typography.display * 1.05,
  },
  heroGradeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1], marginTop: Spacing[1] },
  heroGradeEmoji: { fontSize: Typography.xl },
  heroGradeText: { color: 'rgba(255,255,255,0.9)', fontSize: Typography.md, fontWeight: Typography.semibold },
  heroPeriod: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.xs, marginTop: Spacing[2] },
  heroRight: { alignItems: 'center', justifyContent: 'center', paddingLeft: Spacing[4] },
  ringOuter: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  ringInner: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  ringScore: { fontSize: Typography['2xl'], fontWeight: Typography.extrabold },
  ringLabel: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', lineHeight: 12 },

  // Stats grid
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
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.lg,
    gap: 4,
    ...Shadow.sm,
  },
  statNum: { fontSize: Typography['2xl'], fontWeight: Typography.bold },
  statLabel: { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center' },

  // Share full button
  shareFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing[3],
    marginTop: Spacing[3],
    ...Shadow.colored,
  },
  shareFullBtnText: { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.base },

  // Tip
  tipCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.primaryMuted,
    marginTop: Spacing[2],
  },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: Spacing[2] },
  tipEmoji: { fontSize: Typography.lg },
  tipTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.primary },
  tipText: { fontSize: Typography.base, color: Colors.textSecondary, lineHeight: Typography.base * 1.6 },
});

// Section card styles (shared)
const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    ...Shadow.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[4],
  },
  cardTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  cardSub: { fontSize: Typography.xs, color: Colors.textMuted },

  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[2],
  },
  sectionLabelText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[8],
    marginBottom: Spacing[4],
    alignItems: 'center',
    gap: Spacing[3],
    ...Shadow.sm,
  },
  emptyText: { fontSize: Typography.base, color: Colors.textMuted, textAlign: 'center' },
});

// Heatmap styles
const heatStyles = StyleSheet.create({
  container: { gap: 4 },
  weekdayRow: { flexDirection: 'row', marginBottom: 2 },
  weekdayCell: { flex: 1, alignItems: 'center' },
  weekdayText: { fontSize: 10, color: Colors.textMuted, fontWeight: Typography.semibold },
  weekRow: { flexDirection: 'row', gap: 4 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  todayLabel: { fontSize: 9, fontWeight: Typography.bold, color: Colors.white },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[3],
    marginTop: Spacing[3],
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 10, color: Colors.textMuted },
});

// Bar styles
const barStyles = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: { height: '100%', borderRadius: Radius.full },
});

// Medicine row styles
const medStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, flex: 1 },
  pct: { fontSize: Typography.base, fontWeight: Typography.bold, marginLeft: Spacing[2] },
  dosage: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2, marginBottom: 2 },
});

// Streak styles
const streakStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: Spacing[2],
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  takenBadge: {
    fontSize: 10,
    fontWeight: Typography.bold,
    color: Colors.textSecondary,
    minHeight: 14,
  },
  barTrack: {
    width: 24,
    backgroundColor: Colors.borderLight,
    borderRadius: Radius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: Radius.sm },
  dayLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: Typography.medium },
});

// Summary card styles
const summaryStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing[5],
  },
  headerLabel: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.xs, marginBottom: 2 },
  headerName: { color: Colors.white, fontSize: Typography.xl, fontWeight: Typography.bold },
  scoreCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    alignContent: 'center',
  },
  scoreNum: { fontSize: Typography['2xl'], fontWeight: Typography.extrabold },
  scorePct: { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: -4, alignSelf: 'flex-end' },

  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  metric: { flex: 1, alignItems: 'center' },
  metricNum: { fontSize: Typography.lg, fontWeight: Typography.bold },
  metricLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  metricDivider: { width: 1, backgroundColor: Colors.borderLight, alignSelf: 'stretch' },

  gradeBanner: {
    marginHorizontal: Spacing[5],
    marginTop: Spacing[4],
    borderRadius: Radius.md,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
    borderWidth: 1,
    alignItems: 'center',
  },
  gradeText: { fontSize: Typography.base, fontWeight: Typography.semibold },

  footer: {
    padding: Spacing[4],
    alignItems: 'center',
    gap: 4,
  },
  footerText: { fontSize: Typography.xs, color: Colors.textMuted },
  footerBrand: { fontSize: Typography.xs, color: Colors.primary, fontWeight: Typography.medium },
});
