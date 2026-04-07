import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { getAllMedicines, getMedicineLogs, Medicine, MedicineLog } from '@/services/medicineService';
import { speakReminder } from '@/services/voiceService';
import { sendMissedAlert } from '@/services/notificationService';

export default function MedicineDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showAlert } = useAlert();
  const { activeMember, markMedicine, removeMed } = useApp();
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [logs, setLogs] = useState<MedicineLog[]>([]);

  useEffect(() => {
    if (!id) return;
    getAllMedicines().then(meds => {
      setMedicine(meds.find(m => m.id === id) || null);
    });
    if (activeMember) {
      getMedicineLogs(activeMember.id, 14).then(l => setLogs(l.filter(x => x.medicineId === id)));
    }
  }, [id, activeMember]);

  if (!medicine) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
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

  const handleTestVoice = async () => {
    if (!activeMember) return;
    await speakReminder(
      activeMember.name,
      medicine.name,
      medicine.dosage,
      activeMember.language,
      activeMember.voiceGender,
    );
  };

  const handleDelete = () => {
    showAlert(`Remove ${medicine.name}?`, 'Medicine and all history will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await removeMed(medicine.id); router.back(); } },
    ]);
  };

  const recentLogs = logs.slice(-7).reverse();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: medicine.color }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.white} />
        </Pressable>
        <View style={styles.headerContent}>
          <View style={styles.medIcon}>
            <MaterialIcons name="medication" size={28} color={medicine.color} />
          </View>
          <Text style={styles.medName}>{medicine.name}</Text>
          <Text style={styles.medDosage}>{medicine.dosage} · {medicine.type}</Text>
          <View style={styles.headerBadges}>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{medicine.frequency.replace('_', ' ')}</Text>
            </View>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{medicine.times.join(', ')}</Text>
            </View>
          </View>
        </View>
        <Pressable
          onPress={() => router.push({ pathname: '/add-medicine', params: { editId: medicine.id } })}
          style={styles.editBtn}
          hitSlop={8}
        >
          <MaterialIcons name="edit" size={20} color={Colors.white} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: Colors.successLight }]}>
            <Text style={[styles.statNum, { color: Colors.success }]}>{taken}</Text>
            <Text style={styles.statLabel}>Taken</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: Colors.errorLight }]}>
            <Text style={[styles.statNum, { color: Colors.error }]}>{missed}</Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: Colors.primaryLight }]}>
            <Text style={[styles.statNum, { color: Colors.primary }]}>{adherence}%</Text>
            <Text style={styles.statLabel}>Adherence</Text>
          </View>
          {medicine.remainingTablets !== undefined ? (
            <View style={[styles.stat, { backgroundColor: medicine.remainingTablets <= 5 ? Colors.errorLight : Colors.warningLight }]}>
              <Text style={[styles.statNum, { color: medicine.remainingTablets <= 5 ? Colors.error : Colors.warning }]}>
                {medicine.remainingTablets}
              </Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
          ) : null}
        </View>

        {/* Refill Alert */}
        {medicine.remainingTablets !== undefined && medicine.remainingTablets <= 5 ? (
          <View style={styles.refillAlert}>
            <MaterialIcons name="warning" size={20} color={Colors.error} />
            <Text style={styles.refillAlertText}>
              Only {medicine.remainingTablets} tablet{medicine.remainingTablets !== 1 ? 's' : ''} left! Time to refill.
            </Text>
          </View>
        ) : null}

        {/* Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Medicine Details</Text>
          <View style={styles.detailRow}>
            <MaterialIcons name="schedule" size={16} color={Colors.textMuted} />
            <Text style={styles.detailLabel}>Times:</Text>
            <Text style={styles.detailValue}>{medicine.times.join(', ')}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialIcons name="repeat" size={16} color={Colors.textMuted} />
            <Text style={styles.detailLabel}>Frequency:</Text>
            <Text style={styles.detailValue}>{medicine.frequency.replace(/_/g, ' ')}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialIcons name="calendar-today" size={16} color={Colors.textMuted} />
            <Text style={styles.detailLabel}>Started:</Text>
            <Text style={styles.detailValue}>{medicine.startDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialIcons name="timer" size={16} color={Colors.textMuted} />
            <Text style={styles.detailLabel}>Duration:</Text>
            <Text style={styles.detailValue}>{medicine.duration === -1 ? 'Ongoing' : `${medicine.duration} days`}</Text>
          </View>
          {medicine.instructions ? (
            <View style={styles.instructionRow}>
              <MaterialIcons name="info" size={16} color={Colors.primary} />
              <Text style={styles.instructions}>{medicine.instructions}</Text>
            </View>
          ) : null}
        </View>

        {/* Recent History */}
        {recentLogs.length > 0 ? (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Recent History</Text>
            {recentLogs.map(log => {
              const date = new Date(log.scheduledDate);
              const dayName = weekDays[date.getDay()];
              const dateStr = `${date.getDate()}/${date.getMonth() + 1}`;
              const isTaken = log.status === 'taken';
              return (
                <View key={log.id} style={styles.historyRow}>
                  <View style={[styles.historyDot, { backgroundColor: isTaken ? Colors.success : Colors.error }]} />
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyDate}>{dayName}, {dateStr}</Text>
                    <Text style={styles.historyTime}>{log.scheduledTime}</Text>
                  </View>
                  <View style={[styles.historyStatus, { backgroundColor: isTaken ? Colors.successLight : Colors.errorLight }]}>
                    <MaterialIcons name={isTaken ? 'check' : 'close'} size={14} color={isTaken ? Colors.success : Colors.error} />
                    <Text style={[styles.historyStatusText, { color: isTaken ? Colors.success : Colors.error }]}>
                      {isTaken ? 'Taken' : 'Missed'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>Actions</Text>
          <Pressable
            onPress={handleTestVoice}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: Colors.primaryLight }, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="volume-up" size={20} color={Colors.primary} />
            <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Test Voice Reminder</Text>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: Colors.errorLight }, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="delete-forever" size={20} color={Colors.error} />
            <Text style={[styles.actionBtnText, { color: Colors.error }]}>Remove Medicine</Text>
          </Pressable>
        </View>

        <View style={{ height: Spacing[8] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingBottom: Spacing[6],
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
    flexDirection: 'column',
    position: 'relative',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[3],
    alignSelf: 'flex-start',
  },
  headerContent: { alignItems: 'center', paddingBottom: Spacing[2] },
  medIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[3],
    ...Shadow.md,
  },
  medName: { fontSize: Typography['2xl'], fontWeight: Typography.extrabold, color: Colors.white, textAlign: 'center' },
  medDosage: { color: 'rgba(255,255,255,0.8)', fontSize: Typography.base, marginTop: 4 },
  headerBadges: { flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[3] },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1],
    borderRadius: Radius.full,
  },
  headerBadgeText: { color: Colors.white, fontSize: Typography.xs, fontWeight: Typography.semibold, textTransform: 'capitalize' },
  editBtn: {
    position: 'absolute',
    right: Spacing[4],
    top: Spacing[2] + 8,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { padding: Spacing[4] },
  statsRow: { flexDirection: 'row', gap: Spacing[3], marginBottom: Spacing[4] },
  stat: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing[3],
    borderRadius: Radius.lg,
  },
  statNum: { fontSize: Typography.xl, fontWeight: Typography.bold },
  statLabel: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  refillAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.lg,
    padding: Spacing[3],
    marginBottom: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.error + '40',
  },
  refillAlertText: { flex: 1, color: Colors.error, fontSize: Typography.sm, fontWeight: Typography.semibold },
  detailsCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    ...Shadow.md,
  },
  detailsTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing[3] },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: Spacing[3] },
  detailLabel: { fontSize: Typography.sm, color: Colors.textMuted, width: 80 },
  detailValue: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium, flex: 1, textTransform: 'capitalize' },
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
  historyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    ...Shadow.md,
  },
  historyTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing[3] },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing[3],
  },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyLeft: { flex: 1 },
  historyDate: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  historyTime: { fontSize: Typography.xs, color: Colors.textMuted },
  historyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
    borderRadius: Radius.full,
    gap: 3,
  },
  historyStatusText: { fontSize: Typography.xs, fontWeight: Typography.semibold },
  actionsCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    gap: Spacing[3],
    ...Shadow.md,
  },
  actionsTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.lg,
  },
  actionBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted, fontSize: Typography.base },
});
