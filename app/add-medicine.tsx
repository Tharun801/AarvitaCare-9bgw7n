import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { Button } from '@/components';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { FREQUENCIES, MEDICINE_TYPES } from '@/constants/config';
import { getAllMedicines } from '@/services/medicineService';
import { scheduleMedicineReminders, cancelMedicineReminders } from '@/services/notificationService';

export default function AddMedicineScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { editId, prefillName, prefillDosage, prefillFrequency, prefillDuration, prefillInstructions, prefillType } = useLocalSearchParams<{
    editId?: string;
    prefillName?: string;
    prefillDosage?: string;
    prefillFrequency?: string;
    prefillDuration?: string;
    prefillInstructions?: string;
    prefillType?: string;
  }>();
  const { showAlert } = useAlert();
  const { activeMember, addMed, updateMed } = useApp();

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [type, setType] = useState('tablet');
  const [frequency, setFrequency] = useState('once_daily');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [duration, setDuration] = useState('-1');
  const [totalTablets, setTotalTablets] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditing = !!editId;

  useEffect(() => {
    if (editId) {
      getAllMedicines().then(meds => {
        const m = meds.find(x => x.id === editId);
        if (m) {
          setName(m.name);
          setDosage(m.dosage);
          setType(m.type);
          setFrequency(m.frequency);
          setTimes(m.times);
          setDuration(String(m.duration));
          setTotalTablets(m.totalTablets ? String(m.totalTablets) : '');
          setInstructions(m.instructions || '');
        }
      });
    } else if (prefillName) {
      // Pre-fill from prescription scanner
      if (prefillName) setName(prefillName);
      if (prefillDosage) setDosage(prefillDosage);
      if (prefillType) setType(prefillType);
      if (prefillFrequency) {
        setFrequency(prefillFrequency);
        const freq = FREQUENCIES.find(f => f.id === prefillFrequency);
        if (freq && freq.times.length > 0) setTimes(freq.times);
      }
      if (prefillDuration) setDuration(prefillDuration);
      if (prefillInstructions) setInstructions(prefillInstructions);
    }
  }, [editId, prefillName]);

  const handleFrequencySelect = (freqId: string) => {
    setFrequency(freqId);
    const freq = FREQUENCIES.find(f => f.id === freqId);
    if (freq && freq.times.length > 0) setTimes(freq.times);
  };

  const updateTime = (idx: number, val: string) => {
    const updated = [...times];
    updated[idx] = val;
    setTimes(updated);
  };

  const handleSave = async () => {
    if (!name.trim()) { showAlert('Missing Info', 'Please enter medicine name'); return; }
    if (!dosage.trim()) { showAlert('Missing Info', 'Please enter dosage'); return; }
    if (!activeMember) { showAlert('No Member', 'Please select a family member first'); return; }

    setLoading(true);
    const data = {
      memberId: activeMember.id,
      name: name.trim(),
      dosage: dosage.trim(),
      type,
      frequency,
      times,
      duration: parseInt(duration) || -1,
      startDate: new Date().toISOString().split('T')[0],
      totalTablets: totalTablets ? parseInt(totalTablets) : undefined,
      remainingTablets: totalTablets ? parseInt(totalTablets) : undefined,
      instructions: instructions.trim() || undefined,
    };

    if (isEditing) {
      await updateMed(editId, data);
      // Reschedule notifications with updated times
      await cancelMedicineReminders(editId);
      await scheduleMedicineReminders({
        medicineId: editId,
        medicineName: data.name,
        memberName: activeMember.name,
        dosage: data.dosage,
        times: data.times,
        instructions: data.instructions,
      });
    } else {
      const newMed = await addMed(data);
      // Schedule repeating daily notifications for each time slot
      await scheduleMedicineReminders({
        medicineId: newMed.id,
        medicineName: newMed.name,
        memberName: activeMember.name,
        dosage: newMed.dosage,
        times: newMed.times,
        instructions: newMed.instructions,
      });
    }
    setLoading(false);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <MaterialIcons name="close" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Medicine' : 'Add Medicine'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Member indicator */}
          {activeMember ? (
            <View style={styles.memberBanner}>
              <MaterialIcons name="person" size={16} color={Colors.primary} />
              <Text style={styles.memberText}>Adding for: <Text style={styles.memberName}>{activeMember.name}</Text></Text>
            </View>
          ) : null}

          {/* Medicine Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Medicine Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Metformin, Amlodipine"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              accessibilityLabel="Medicine name"
            />
          </View>

          {/* Dosage */}
          <View style={styles.field}>
            <Text style={styles.label}>Dosage *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 500mg, 1 tablet, 5ml"
              placeholderTextColor={Colors.textMuted}
              value={dosage}
              onChangeText={setDosage}
              accessibilityLabel="Dosage"
            />
          </View>

          {/* Type */}
          <View style={styles.field}>
            <Text style={styles.label}>Medicine Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {MEDICINE_TYPES.map(t => (
                <Pressable
                  key={t.id}
                  onPress={() => setType(t.id)}
                  style={[styles.chip, type === t.id && styles.chipActive]}
                >
                  <MaterialIcons name={t.icon as any} size={16} color={type === t.id ? Colors.white : Colors.textMuted} />
                  <Text style={[styles.chipText, type === t.id && styles.chipTextActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Frequency */}
          <View style={styles.field}>
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.freqGrid}>
              {FREQUENCIES.filter(f => f.id !== 'custom').map(f => (
                <Pressable
                  key={f.id}
                  onPress={() => handleFrequencySelect(f.id)}
                  style={[styles.freqChip, frequency === f.id && styles.freqChipActive]}
                >
                  <Text style={[styles.freqText, frequency === f.id && styles.freqTextActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Times */}
          <View style={styles.field}>
            <Text style={styles.label}>Reminder Times</Text>
            {times.map((t, idx) => (
              <View key={idx} style={styles.timeRow}>
                <MaterialIcons name="schedule" size={18} color={Colors.primary} />
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  value={t}
                  onChangeText={val => updateTime(idx, val)}
                  placeholder="HH:MM"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  maxLength={5}
                  accessibilityLabel={`Reminder time ${idx + 1}`}
                />
              </View>
            ))}
          </View>

          {/* Duration */}
          <View style={styles.field}>
            <Text style={styles.label}>Duration (days)</Text>
            <View style={styles.durationRow}>
              <Pressable
                onPress={() => setDuration('-1')}
                style={[styles.durationBtn, duration === '-1' && styles.durationBtnActive]}
              >
                <Text style={[styles.durationText, duration === '-1' && styles.durationTextActive]}>Ongoing</Text>
              </Pressable>
              {['7', '14', '30', '90'].map(d => (
                <Pressable
                  key={d}
                  onPress={() => setDuration(d)}
                  style={[styles.durationBtn, duration === d && styles.durationBtnActive]}
                >
                  <Text style={[styles.durationText, duration === d && styles.durationTextActive]}>{d}d</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Total Tablets (for refill tracking) */}
          <View style={styles.field}>
            <Text style={styles.label}>Total Tablets (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 30 (for refill alerts)"
              placeholderTextColor={Colors.textMuted}
              value={totalTablets}
              onChangeText={t => setTotalTablets(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              accessibilityLabel="Total tablets"
            />
          </View>

          {/* Instructions */}
          <View style={styles.field}>
            <Text style={styles.label}>Special Instructions (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Take after food, avoid dairy"
              placeholderTextColor={Colors.textMuted}
              value={instructions}
              onChangeText={setInstructions}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              accessibilityLabel="Special instructions"
            />
          </View>

          <View style={{ height: Spacing[4] }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing[4] }]}>
        <Button
          label={isEditing ? 'Update Medicine' : 'Add Medicine'}
          onPress={handleSave}
          loading={loading}
          fullWidth
          size="lg"
          style={{ borderRadius: Radius.full }}
          icon={<MaterialIcons name={isEditing ? 'save' : 'add'} size={20} color={Colors.white} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    backgroundColor: Colors.white,
    ...Shadow.sm,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  scroll: { padding: Spacing[4] },
  memberBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginBottom: Spacing[4],
  },
  memberText: { fontSize: Typography.sm, color: Colors.textSecondary },
  memberName: { color: Colors.primary, fontWeight: Typography.semibold },
  field: { marginBottom: Spacing[5] },
  label: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary, marginBottom: Spacing[2] },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    fontSize: Typography.md,
    color: Colors.textPrimary,
    minHeight: 52,
    ...Shadow.sm,
  },
  textArea: { minHeight: 90, paddingTop: Spacing[3] },
  chipRow: { gap: Spacing[2], paddingRight: Spacing[4] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: Typography.sm, color: Colors.textMuted, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.white, fontWeight: Typography.semibold },
  freqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  freqChip: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  freqChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  freqText: { fontSize: Typography.sm, color: Colors.textMuted, fontWeight: Typography.medium },
  freqTextActive: { color: Colors.white, fontWeight: Typography.semibold },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginBottom: Spacing[2],
  },
  timeInput: { flex: 1, textAlign: 'center', letterSpacing: 2, fontWeight: Typography.semibold },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  durationBtn: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  durationBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  durationText: { fontSize: Typography.sm, color: Colors.textMuted, fontWeight: Typography.medium },
  durationTextActive: { color: Colors.white, fontWeight: Typography.semibold },
  footer: {
    padding: Spacing[4],
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadow.md,
  },
});
