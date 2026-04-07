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
import { FAMILY_ROLES, LANGUAGES } from '@/constants/config';
import { getFamilyMembers, getMemberRoleColor } from '@/services/familyService';

export default function AddFamilyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { showAlert } = useAlert();
  const { addMember, updateMember } = useApp();

  const [name, setName] = useState('');
  const [role, setRole] = useState('father');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [emergency, setEmergency] = useState('');
  const [language, setLanguage] = useState('en-IN');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const [isCaregiver, setIsCaregiver] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEditing = !!editId;

  useEffect(() => {
    if (editId) {
      getFamilyMembers().then(members => {
        const m = members.find(x => x.id === editId);
        if (m) {
          setName(m.name);
          setRole(m.role);
          setAge(m.age ? String(m.age) : '');
          setPhone(m.phone || '');
          setEmergency(m.emergencyContact || '');
          setLanguage(m.language);
          setVoiceGender(m.voiceGender);
          setIsCaregiver(m.isCaregiver);
        }
      });
    }
  }, [editId]);

  const handleSave = async () => {
    if (!name.trim()) { showAlert('Missing Name', 'Please enter the member name'); return; }
    setLoading(true);
    const data = {
      name: name.trim(),
      role,
      age: age ? parseInt(age) : undefined,
      phone: phone.trim() || undefined,
      emergencyContact: emergency.trim() || undefined,
      language,
      voiceGender,
      isCaregiver,
    };
    if (isEditing) {
      await updateMember(editId, data);
    } else {
      await addMember(data);
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
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Member' : 'Add Family Member'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Role Selection */}
          <View style={styles.field}>
            <Text style={styles.label}>Relationship *</Text>
            <View style={styles.roleGrid}>
              {FAMILY_ROLES.filter(r => r.id !== 'self').map(r => (
                <Pressable
                  key={r.id}
                  onPress={() => setRole(r.id)}
                  style={[
                    styles.roleChip,
                    role === r.id && { backgroundColor: getMemberRoleColor(r.id), borderColor: getMemberRoleColor(r.id) },
                  ]}
                >
                  <MaterialIcons
                    name={r.icon as any}
                    size={16}
                    color={role === r.id ? Colors.white : Colors.textMuted}
                  />
                  <Text style={[styles.roleText, role === r.id && { color: Colors.white }]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Ramesh Kumar"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              accessibilityLabel="Member name"
            />
          </View>

          {/* Age & Phone */}
          <View style={styles.row}>
            <View style={[styles.field, styles.flex]}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 65"
                placeholderTextColor={Colors.textMuted}
                value={age}
                onChangeText={t => setAge(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={3}
                accessibilityLabel="Age"
              />
            </View>
            <View style={[styles.field, styles.flex]}>
              <Text style={styles.label}>Mobile</Text>
              <TextInput
                style={styles.input}
                placeholder="10-digit"
                placeholderTextColor={Colors.textMuted}
                value={phone}
                onChangeText={t => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                accessibilityLabel="Mobile number"
              />
            </View>
          </View>

          {/* Emergency Contact */}
          <View style={styles.field}>
            <Text style={styles.label}>Emergency Contact (Caregiver's Number)</Text>
            <TextInput
              style={styles.input}
              placeholder="Caregiver mobile number"
              placeholderTextColor={Colors.textMuted}
              value={emergency}
              onChangeText={t => setEmergency(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              accessibilityLabel="Emergency contact"
            />
          </View>

          {/* Language */}
          <View style={styles.field}>
            <Text style={styles.label}>Preferred Language</Text>
            <View style={styles.langGrid}>
              {LANGUAGES.map(l => (
                <Pressable
                  key={l.code}
                  onPress={() => setLanguage(l.code)}
                  style={[styles.langChip, language === l.code && styles.langChipActive]}
                >
                  <Text style={[styles.langLabel, language === l.code && { color: Colors.white }]}>
                    {l.nativeLabel}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Voice Gender */}
          <View style={styles.field}>
            <Text style={styles.label}>Voice Type</Text>
            <View style={styles.voiceRow}>
              {(['female', 'male'] as const).map(g => (
                <Pressable
                  key={g}
                  onPress={() => setVoiceGender(g)}
                  style={[styles.voiceBtn, voiceGender === g && styles.voiceBtnActive]}
                >
                  <MaterialIcons
                    name={g === 'female' ? 'face' : 'face-3'}
                    size={20}
                    color={voiceGender === g ? Colors.white : Colors.textMuted}
                  />
                  <Text style={[styles.voiceText, voiceGender === g && { color: Colors.white }]}>
                    {g === 'female' ? 'Female Voice' : 'Male Voice'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Caregiver toggle */}
          <View style={styles.caregiverRow}>
            <View style={styles.caregiverInfo}>
              <MaterialIcons name="supervisor-account" size={20} color={Colors.primary} />
              <View style={styles.caregiverText}>
                <Text style={styles.caregiverTitle}>Mark as Caregiver</Text>
                <Text style={styles.caregiverSubtitle}>Receives alerts if patient misses medicine</Text>
              </View>
            </View>
            <Pressable
              onPress={() => setIsCaregiver(!isCaregiver)}
              style={[styles.toggleBtn, isCaregiver && styles.toggleBtnActive]}
            >
              <MaterialIcons
                name={isCaregiver ? 'check' : 'add'}
                size={18}
                color={isCaregiver ? Colors.white : Colors.textMuted}
              />
            </Pressable>
          </View>

          <View style={{ height: Spacing[4] }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing[4] }]}>
        <Button
          label={isEditing ? 'Update Member' : 'Add Family Member'}
          onPress={handleSave}
          loading={loading}
          fullWidth
          size="lg"
          style={{ borderRadius: Radius.full }}
          icon={<MaterialIcons name={isEditing ? 'save' : 'person-add'} size={20} color={Colors.white} />}
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
  field: { marginBottom: Spacing[4] },
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
  row: { flexDirection: 'row', gap: Spacing[3] },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  roleText: { fontSize: Typography.sm, color: Colors.textMuted, fontWeight: Typography.medium },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  langChip: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  langChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langLabel: { fontSize: Typography.sm, color: Colors.textMuted, fontWeight: Typography.medium },
  voiceRow: { flexDirection: 'row', gap: Spacing[3] },
  voiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  voiceBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  voiceText: { fontSize: Typography.sm, color: Colors.textMuted, fontWeight: Typography.medium },
  caregiverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    gap: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
    marginBottom: Spacing[4],
  },
  caregiverInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  caregiverText: {},
  caregiverTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  caregiverSubtitle: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2 },
  toggleBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.borderLight,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  toggleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  footer: {
    padding: Spacing[4],
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Shadow.md,
  },
});
