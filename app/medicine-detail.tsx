/**
 * app/medicine-detail.tsx
 * Enhanced medicine detail view with:
 *  - Animated circular progress ring for remaining tablets (react-native-reanimated)
 *  - Low-stock warning card at ≤5 tablets
 *  - Refill Now button that calls pharmacy via Linking.openURL('tel:')
 *  - Recent history timeline
 *  - Voice + delete actions
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withTiming, withDelay, withSpring, FadeInDown, FadeInUp,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import {
  getMedicines, getMedicineLogs,
  Medicine, MedicineLog,
} from '@/services/medicineService';
import { speakReminder } from '@/services/voiceService';

// ─── Animated SVG circle ─────────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 160;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUM = 2 * Math.PI * RING_RADIUS;

function RefillRing({
  remaining,
  total,
  color,
}: {
  remaining: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.min(remaining / total, 1) : 0;
  const progress = useSharedValue(0);
  const labelScale = useSharedValue(0.6);

  useEffect(() => {
    progress.value = withDelay(200, withTiming(pct, { duration: 900 }));
    labelScale.value = withDelay(300, withSpring(1, { damping: 12 }));
  }, [pct]);

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUM * (1 - progress.value),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: labelScale.value }],
  }));

  const ringColor =
    remaining <= 3 ? Colors.error
      : remaining <= 5 ? Colors.warning
      : remaining <= 10 ? Colors.accent
      : color || Colors.primary;

  const pctLabel = total > 0 ? Math.round(pct * 100) : 0;

  return (
    <View style={ringStyles.container}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={ringStyles.svg}>
        {/* Track */}
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={Colors.borderLight}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        {/* Animated fill */}
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={ringColor}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUM}
          animatedProps={animProps}
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      {/* Center label */}
      <Animated.View style={[ringStyles.center, labelStyle]}>
        <Text style={[ringStyles.count, { color: ringColor }]}>{remaining}</Text>
        <Text style={ringStyles.label}>left</Text>
        <Text style={[ringStyles.pct, { color: ringColor }]}>{pctLabel}%</Text>
      </Animated.View>
    </View>
  );
}

// ─── Low-stock warning card ───────────────────────────────────────────────────
function LowStockCard({
  remaining,
  medicineName,
  pharmacyPhone,
}: {
  remaining: number;
  medicineName: string;
  pharmacyPhone?: string;
}) {
  const isOut = remaining === 0;
  const bgColor = isOut ? Colors.errorLight : Colors.warningLight;
  const borderColor = isOut ? Colors.error + '50' : Colors.warning + '50';
  const textColor = isOut ? Colors.error : Colors.warning;
  const icon = isOut ? 'error' : 'warning';

  const handleCall = () => {
    const phone = pharmacyPhone?.replace(/\D/g, '') || '';
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  return (
    <Animated.View entering={FadeInDown.springify()}>
      <View style={[lowStyles.card, { backgroundColor: bgColor, borderColor }]}>
        <View style={lowStyles.row}>
          <View style={[lowStyles.iconBg, { backgroundColor: isOut ? Colors.error : Colors.warning }]}>
            <MaterialIcons name={icon as any} size={20} color={Colors.white} />
          </View>
          <View style={lowStyles.textBlock}>
            <Text style={[lowStyles.title, { color: textColor }]}>
              {isOut ? 'Out of stock!' : `Low stock — only ${remaining} tablet${remaining !== 1 ? 's' : ''} left`}
            </Text>
            <Text style={lowStyles.sub}>
              {isOut
                ? `${medicineName} is finished. Refill immediately.`
                : `Refill ${medicineName} before you run out.`}
            </Text>
          </View>
        </View>

        {/* Refill Now button */}
        <Pressable
          onPress={handleCall}
          style={({ pressed }) => [
            lowStyles.refillBtn,
            { backgroundColor: isOut ? Colors.error : Colors.warning },
            pressed && { opacity: 0.75 },
          ]}
        >
          <MaterialIcons name="phone" size={16} color={Colors.white} />
          <Text style={lowStyles.refillBtnText}>
            {pharmacyPhone ? `Call Pharmacy (${pharmacyPhone})` : 'Add Pharmacy Number'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MedicineDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showAlert } = useAlert();
  const { activeMember, familyMembers, markMedicine, removeMed, medicines } = useApp();
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [logs, setLogs] = useState<MedicineLog[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    if (!id) return;
    // Prefer live context medicines (reflects decremented remaining after marking)
    const liveMed = medicines.find(m => m.id === id);
    if (liveMed) {
      setMedicine(liveMed);
    } else {
      const all = await getMedicines();
      setMedicine(all.find(m => m.id === id) || null);
    }
    if (activeMember) {
      const fetchedLogs = await getMedicineLogs(activeMember.id, 30);
      setLogs(fetchedLogs.filter(x => x.medicineId === id));
    }
  }, [id, activeMember, medicines, refreshKey]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!medicine) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtnDark}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const taken = logs.filter(l => l.status === 'taken').length;
  const missed = logs.filter(l => l.status === 'missed').length;
  const total = taken + missed;
  const adherence = total > 0 ? Math.round((taken / total) * 100) : 0;

  const hasRefill = medicine.totalTablets !== undefined && medicine.totalTablets > 0;
  const remaining = medicine.remainingTablets ?? 0;
  const isLowStock = hasRefill && remaining <= 5;

  // Find pharmacy phone from the family member who owns this medicine
  const ownerMember = familyMembers.find(m => m.id === medicine.memberId);
  const pharmacyPhone = ownerMember?.phone;

  const handleTestVoice = async () => {
    if (!activeMember) return;
    await speakReminder(
      activeMember.name, medicine.name, medicine.dosage,
      activeMember.language, activeMember.voiceGender,
    );
  };

  const handleMarkTaken = async () => {
    if (!activeMember) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const nearestTime = medicine.times[0] || `${hh}:${mm}`;
    await markMedicine(medicine.id, nearestTime, 'taken');
    setRefreshKey(k => k + 1);
    showAlert('Marked as Taken', `${medicine.name} recorded for today.`);
  };

  const handleDelete = () => {
    showAlert(`Remove ${medicine.name}?`, 'Medicine and all history will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await removeMed(medicine.id);
          router.back();
        },
      },
    ]);
  };

  const recentLogs = [...logs].sort((a, b) =>
    `${b.scheduledDate}_${b.scheduledTime}`.localeCompare(`${a.scheduledDate}_${a.scheduledTime}`)
  ).slice(0, 14);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Colored header */}
      <View style={[styles.header, { backgroundColor: medicine.color }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.white} />
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/add-medicine', params: { editId: medicine.id } })}
          style={styles.editBtn}
          hitSlop={8}
        >
          <MaterialIcons name="edit" size={20} color={Colors.white} />
        </Pressable>
        <View style={styles.headerContent}>
          <View style={styles.medIcon}>
            <MaterialIcons name="medication" size={28} color={medicine.color} />
          </View>
          <Text style={styles.medName}>{medicine.name}</Text>
          <Text style={styles.medDosage}>{medicine.dosage} · {medicine.type}</Text>
          <View style={styles.headerBadges}>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{medicine.frequency.replace(/_/g, ' ')}</Text>
            </View>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{medicine.times.join(' · ')}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* ── REFILL RING CARD ── */}
        {hasRefill ? (
          <Animated.View entering={FadeInDown.delay(60).duration(400)}>
            <View style={styles.refillCard}>
              <View style={styles.refillCardHeader}>
                <MaterialIcons name="local-pharmacy" size={20} color={Colors.primary} />
                <Text style={styles.refillCardTitle}>Tablet Inventory</Text>
                {isLowStock ? (
                  <View style={[styles.lowBadge, { backgroundColor: remaining === 0 ? Colors.error : Colors.warning }]}>
                    <Text style={styles.lowBadgeText}>{remaining === 0 ? 'Out' : 'Low'}</Text>
                  </View>
                ) : (
                  <View style={styles.okBadge}>
                    <Text style={styles.okBadgeText}>OK</Text>
                  </View>
                )}
              </View>

              <View style={styles.refillRingRow}>
                <RefillRing
                  remaining={remaining}
                  total={medicine.totalTablets!}
                  color={medicine.color}
                />

                <View style={styles.refillStats}>
                  <View style={styles.refillStat}>
                    <Text style={styles.refillStatNum}>{medicine.totalTablets}</Text>
                    <Text style={styles.refillStatLabel}>Total</Text>
                  </View>
                  <View style={[styles.refillStatDivider]} />
                  <View style={styles.refillStat}>
                    <Text style={[styles.refillStatNum, {
                      color: remaining <= 3 ? Colors.error
                        : remaining <= 5 ? Colors.warning
                        : Colors.success,
                    }]}>{remaining}</Text>
                    <Text style={styles.refillStatLabel}>Remaining</Text>
                  </View>
                  <View style={[styles.refillStatDivider]} />
                  <View style={styles.refillStat}>
                    <Text style={styles.refillStatNum}>{(medicine.totalTablets || 0) - remaining}</Text>
                    <Text style={styles.refillStatLabel}>Used</Text>
                  </View>
                </View>
              </View>

              {/* Inline refill button when low but not in danger zone */}
              {isLowStock && remaining > 0 && remaining > 3 ? (
                <Pressable
                  onPress={() => {
                    if (pharmacyPhone) Linking.openURL(`tel:${pharmacyPhone.replace(/\D/g, '')}`);
                    else showAlert('No Phone Number', 'Add a phone number to the family member profile to enable calling.');
                  }}
                  style={({ pressed }) => [styles.refillNowBtn, pressed && { opacity: 0.75 }]}
                >
                  <MaterialIcons name="phone" size={16} color={Colors.white} />
                  <Text style={styles.refillNowBtnText}>Refill Now</Text>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        {/* ── LOW STOCK / OUT-OF-STOCK WARNING ── */}
        {isLowStock ? (
          <LowStockCard
            remaining={remaining}
            medicineName={medicine.name}
            pharmacyPhone={pharmacyPhone}
          />
        ) : null}

        {/* ── ADHERENCE STATS ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.statsRow}>
            <View style={[styles.stat, { backgroundColor: Colors.successLight }]}>
              <MaterialIcons name="check-circle" size={20} color={Colors.success} />
              <Text style={[styles.statNum, { color: Colors.success }]}>{taken}</Text>
              <Text style={styles.statLabel}>Taken</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: Colors.errorLight }]}>
              <MaterialIcons name="cancel" size={20} color={Colors.error} />
              <Text style={[styles.statNum, { color: Colors.error }]}>{missed}</Text>
              <Text style={styles.statLabel}>Missed</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: Colors.primaryLight }]}>
              <MaterialIcons name="trending-up" size={20} color={Colors.primary} />
              <Text style={[styles.statNum, { color: Colors.primary }]}>{adherence}%</Text>
              <Text style={styles.statLabel}>Adherence</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: Colors.infoLight }]}>
              <MaterialIcons name="history" size={20} color={Colors.info} />
              <Text style={[styles.statNum, { color: Colors.info }]}>{total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── MEDICINE DETAILS ── */}
        <Animated.View entering={FadeInDown.delay(140).duration(400)}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Medicine Details</Text>
            {[
              { icon: 'schedule', label: 'Times', value: medicine.times.join(', ') },
              { icon: 'repeat', label: 'Frequency', value: medicine.frequency.replace(/_/g, ' ') },
              { icon: 'calendar-today', label: 'Started', value: medicine.startDate },
              {
                icon: 'timer', label: 'Duration',
                value: medicine.duration === -1 ? 'Ongoing' : `${medicine.duration} days`,
              },
              medicine.endDate ? { icon: 'event', label: 'End Date', value: medicine.endDate } : null,
            ].filter(Boolean).map(({ icon, label, value }: any) => (
              <View key={label} style={styles.detailRow}>
                <MaterialIcons name={icon} size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>{label}:</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
            ))}
            {medicine.instructions ? (
              <View style={styles.instructionRow}>
                <MaterialIcons name="info" size={16} color={Colors.primary} />
                <Text style={styles.instructions}>{medicine.instructions}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* ── HISTORY TIMELINE ── */}
        {recentLogs.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(180).duration(400)}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>30-Day History</Text>
              {recentLogs.map((log, idx) => {
                const date = new Date(log.scheduledDate);
                const dayName = weekDays[date.getDay()];
                const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
                const statusConfig = {
                  taken: { icon: 'check-circle', color: Colors.success, bg: Colors.successLight, label: 'Taken' },
                  missed: { icon: 'cancel', color: Colors.error, bg: Colors.errorLight, label: 'Missed' },
                  skipped: { icon: 'remove-circle', color: Colors.textMuted, bg: Colors.borderLight, label: 'Skipped' },
                  pending: { icon: 'radio-button-unchecked', color: Colors.warning, bg: Colors.warningLight, label: 'Pending' },
                }[log.status] || { icon: 'help', color: Colors.textMuted, bg: Colors.borderLight, label: log.status };

                return (
                  <View
                    key={log.id}
                    style={[styles.historyRow, idx === recentLogs.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    {/* Timeline line */}
                    <View style={styles.timelineLine}>
                      <View style={[styles.timelineDot, { backgroundColor: statusConfig.color }]} />
                      {idx < recentLogs.length - 1 ? (
                        <View style={[styles.timelineConnector, { backgroundColor: Colors.borderLight }]} />
                      ) : null}
                    </View>
                    <View style={styles.historyContent}>
                      <View style={styles.historyTop}>
                        <View>
                          <Text style={styles.historyDate}>{dayName}, {dateStr}</Text>
                          <Text style={styles.historyTime}>{log.scheduledTime}</Text>
                        </View>
                        <View style={[styles.statusChip, { backgroundColor: statusConfig.bg }]}>
                          <MaterialIcons name={statusConfig.icon as any} size={13} color={statusConfig.color} />
                          <Text style={[styles.statusText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                          </Text>
                        </View>
                      </View>
                      {log.takenAt ? (
                        <Text style={styles.takenAt}>
                          Recorded at {new Date(log.takenAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(180).duration(400)}>
            <View style={[styles.card, styles.emptyHistory]}>
              <MaterialIcons name="history" size={36} color={Colors.primaryMuted} />
              <Text style={styles.emptyHistoryText}>No history yet</Text>
              <Text style={styles.emptyHistorySub}>Logs will appear here after marking doses</Text>
            </View>
          </Animated.View>
        )}

        {/* ── ACTIONS ── */}
        <Animated.View entering={FadeInDown.delay(220).duration(400)}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <Pressable
                onPress={handleMarkTaken}
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: Colors.successLight }, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="check-circle" size={22} color={Colors.success} />
                <Text style={[styles.actionBtnText, { color: Colors.success }]}>Mark Taken</Text>
              </Pressable>
              <Pressable
                onPress={handleTestVoice}
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: Colors.primaryLight }, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="volume-up" size={22} color={Colors.primary} />
                <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Voice Test</Text>
              </Pressable>
            </View>

            {/* Refill pharmacy call — shown always if phone available */}
            {pharmacyPhone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${pharmacyPhone.replace(/\D/g, '')}`)}
                style={({ pressed }) => [styles.callBtn, pressed && { opacity: 0.75 }]}
              >
                <MaterialIcons name="phone" size={20} color={Colors.white} />
                <View>
                  <Text style={styles.callBtnTitle}>Call Pharmacy / Contact</Text>
                  <Text style={styles.callBtnPhone}>{pharmacyPhone}</Text>
                </View>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push({
                  pathname: '/add-family',
                  params: { editId: medicine.memberId },
                })}
                style={({ pressed }) => [styles.callBtnMuted, pressed && { opacity: 0.75 }]}
              >
                <MaterialIcons name="add-circle-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.callBtnMutedText}>Add pharmacy number to member profile</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnFull, { backgroundColor: Colors.errorLight }, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="delete-forever" size={22} color={Colors.error} />
              <Text style={[styles.actionBtnText, { color: Colors.error }]}>Remove Medicine</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ringStyles = StyleSheet.create({
  container: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: { position: 'absolute' },
  center: { alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: Typography['2xl'], fontWeight: Typography.extrabold, lineHeight: 30 },
  label: { fontSize: Typography.xs, color: Colors.textMuted },
  pct: { fontSize: Typography.sm, fontWeight: Typography.semibold, marginTop: 2 },
});

const lowStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    borderWidth: 1.5,
    gap: Spacing[3],
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  iconBg: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  textBlock: { flex: 1 },
  title: { fontSize: Typography.base, fontWeight: Typography.bold },
  sub: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  refillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    ...Shadow.sm,
  },
  refillBtnText: { color: Colors.white, fontWeight: Typography.bold, fontSize: Typography.base },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingBottom: Spacing[5],
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
    position: 'relative',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: Spacing[2],
  },
  backBtnDark: {
    margin: Spacing[4],
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  editBtn: {
    position: 'absolute',
    right: Spacing[4],
    top: Spacing[2] + 8,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerContent: { alignItems: 'center' },
  medIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[2],
    ...Shadow.md,
  },
  medName: {
    fontSize: Typography['2xl'], fontWeight: Typography.extrabold,
    color: Colors.white, textAlign: 'center',
  },
  medDosage: { color: 'rgba(255,255,255,0.8)', fontSize: Typography.base, marginTop: 4 },
  headerBadges: { flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[3], flexWrap: 'wrap', justifyContent: 'center' },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1],
    borderRadius: Radius.full,
  },
  headerBadgeText: {
    color: Colors.white, fontSize: Typography.xs,
    fontWeight: Typography.semibold, textTransform: 'capitalize',
  },

  scroll: { padding: Spacing[4] },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: Typography.base },

  // Refill ring card
  refillCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    ...Shadow.md,
  },
  refillCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[4],
  },
  refillCardTitle: {
    flex: 1,
    fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary,
  },
  lowBadge: {
    paddingHorizontal: Spacing[2], paddingVertical: 3,
    borderRadius: Radius.full,
  },
  lowBadgeText: { color: Colors.white, fontSize: Typography.xs, fontWeight: Typography.bold },
  okBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing[2], paddingVertical: 3,
    borderRadius: Radius.full,
  },
  okBadgeText: { color: Colors.success, fontSize: Typography.xs, fontWeight: Typography.bold },

  refillRingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[2],
  },
  refillStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginLeft: Spacing[4],
  },
  refillStat: { alignItems: 'center' },
  refillStatNum: {
    fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary,
  },
  refillStatLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  refillStatDivider: { width: 1, height: 40, backgroundColor: Colors.borderLight },

  refillNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    marginTop: Spacing[4],
    backgroundColor: Colors.warning,
    borderRadius: Radius.lg,
    paddingVertical: Spacing[3],
    ...Shadow.sm,
  },
  refillNowBtnText: { color: Colors.white, fontWeight: Typography.bold, fontSize: Typography.base },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginBottom: Spacing[4],
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    gap: 3,
    ...Shadow.sm,
  },
  statNum: { fontSize: Typography.lg, fontWeight: Typography.bold },
  statLabel: { fontSize: 10, color: Colors.textMuted },

  // Generic card
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    ...Shadow.md,
  },
  cardTitle: {
    fontSize: Typography.lg, fontWeight: Typography.bold,
    color: Colors.textPrimary, marginBottom: Spacing[3],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[3],
  },
  detailLabel: { fontSize: Typography.sm, color: Colors.textMuted, width: 76 },
  detailValue: {
    fontSize: Typography.sm, color: Colors.textPrimary,
    fontWeight: Typography.medium, flex: 1, textTransform: 'capitalize',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[2],
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginTop: Spacing[2],
  },
  instructions: { flex: 1, color: Colors.primary, fontSize: Typography.sm, lineHeight: 20 },

  // History timeline
  historyRow: {
    flexDirection: 'row',
    paddingVertical: Spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  timelineLine: {
    width: 24,
    alignItems: 'center',
    paddingTop: 4,
  },
  timelineDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  timelineConnector: {
    width: 2, flex: 1, marginTop: 3, marginBottom: -Spacing[2],
  },
  historyContent: { flex: 1, paddingLeft: Spacing[2] },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyDate: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  historyTime: { fontSize: Typography.xs, color: Colors.textMuted },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
    borderRadius: Radius.full,
    gap: 3,
  },
  statusText: { fontSize: Typography.xs, fontWeight: Typography.semibold },
  takenAt: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },

  emptyHistory: { alignItems: 'center', gap: Spacing[2], paddingVertical: Spacing[6] },
  emptyHistoryText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  emptyHistorySub: { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center' },

  // Actions
  actionsGrid: { flexDirection: 'row', gap: Spacing[3], marginBottom: Spacing[3] },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.lg,
  },
  actionBtnFull: { flex: 0 },
  actionBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold },

  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    marginBottom: Spacing[3],
    ...Shadow.colored,
  },
  callBtnTitle: { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.sm },
  callBtnPhone: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.xs, marginTop: 1 },

  callBtnMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    marginBottom: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  callBtnMutedText: { color: Colors.textMuted, fontSize: Typography.sm },
});
