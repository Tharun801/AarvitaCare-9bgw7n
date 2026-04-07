import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { Medicine } from '@/services/medicineService';

interface MedicineCardProps {
  medicine: Medicine;
  scheduledTime?: string;
  status?: 'taken' | 'missed' | 'upcoming' | 'pending';
  onTake?: () => void;
  onMiss?: () => void;
  onPress?: () => void;
  compact?: boolean;
}

const STATUS_CONFIG = {
  taken: { color: Colors.success, bg: Colors.successLight, icon: 'check-circle', label: 'Taken' },
  missed: { color: Colors.error, bg: Colors.errorLight, icon: 'cancel', label: 'Missed' },
  upcoming: { color: Colors.primary, bg: Colors.primaryLight, icon: 'schedule', label: 'Upcoming' },
  pending: { color: Colors.warning, bg: Colors.warningLight, icon: 'warning', label: 'Due Now' },
};

export function MedicineCard({ medicine, scheduledTime, status, onTake, onMiss, onPress, compact }: MedicineCardProps) {
  const sc = status ? STATUS_CONFIG[status] : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] }]}
    >
      <View style={[styles.colorBar, { backgroundColor: medicine.color }]} />
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={[styles.iconCircle, { backgroundColor: medicine.color + '20' }]}>
            <MaterialIcons name="medication" size={20} color={medicine.color} />
          </View>
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{medicine.name}</Text>
            <Text style={styles.dosage}>{medicine.dosage} · {medicine.type}</Text>
            {scheduledTime ? (
              <Text style={styles.time}>⏰ {scheduledTime}</Text>
            ) : null}
          </View>
          {sc ? (
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <MaterialIcons name={sc.icon as any} size={14} color={sc.color} />
              <Text style={[styles.statusLabel, { color: sc.color }]}>{sc.label}</Text>
            </View>
          ) : null}
        </View>

        {!compact && status === 'upcoming' && (onTake || onMiss) ? (
          <View style={styles.actions}>
            {onTake ? (
              <Pressable
                onPress={onTake}
                style={({ pressed }) => [styles.actionBtn, styles.takeBtn, pressed && { opacity: 0.8 }]}
              >
                <MaterialIcons name="check" size={16} color={Colors.white} />
                <Text style={styles.actionBtnText}>Taken</Text>
              </Pressable>
            ) : null}
            {onMiss ? (
              <Pressable
                onPress={onMiss}
                style={({ pressed }) => [styles.actionBtn, styles.missBtn, pressed && { opacity: 0.8 }]}
              >
                <MaterialIcons name="close" size={16} color={Colors.error} />
                <Text style={[styles.actionBtnText, { color: Colors.error }]}>Skip</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {medicine.remainingTablets !== undefined && medicine.totalTablets ? (
          <View style={styles.refillRow}>
            <View style={styles.refillBar}>
              <View style={[styles.refillFill, {
                width: `${Math.min(100, (medicine.remainingTablets / medicine.totalTablets) * 100)}%` as any,
                backgroundColor: medicine.remainingTablets <= 5 ? Colors.error : Colors.primary,
              }]} />
            </View>
            <Text style={[styles.refillText, { color: medicine.remainingTablets <= 5 ? Colors.error : Colors.textMuted }]}>
              {medicine.remainingTablets} left
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    marginBottom: Spacing[3],
    ...Shadow.md,
    overflow: 'hidden',
  },
  colorBar: { width: 4 },
  content: { flex: 1, padding: Spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: Spacing[3] },
  info: { flex: 1 },
  name: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary },
  dosage: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2 },
  time: { fontSize: Typography.sm, color: Colors.primary, marginTop: 2, fontWeight: Typography.medium },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[2], paddingVertical: 4, borderRadius: Radius.full, gap: 3 },
  statusLabel: { fontSize: Typography.xs, fontWeight: Typography.semibold },
  actions: { flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[3], paddingTop: Spacing[2], borderTopWidth: 1, borderTopColor: Colors.borderLight },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing[2], borderRadius: Radius.md, gap: 4 },
  takeBtn: { backgroundColor: Colors.primary },
  missBtn: { backgroundColor: Colors.errorLight, borderWidth: 1, borderColor: Colors.error },
  actionBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.white },
  refillRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing[2], gap: Spacing[2] },
  refillBar: { flex: 1, height: 4, backgroundColor: Colors.borderLight, borderRadius: 2, overflow: 'hidden' },
  refillFill: { height: '100%', borderRadius: 2 },
  refillText: { fontSize: Typography.xs, fontWeight: Typography.medium, minWidth: 40, textAlign: 'right' },
});
