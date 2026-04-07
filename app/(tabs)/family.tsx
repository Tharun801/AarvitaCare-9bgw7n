import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { FamilyMemberCard } from '@/components';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { getMemberRoleColor } from '@/services/familyService';

export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { familyMembers, activeMember, setActiveMember, removeMember, medicines } = useApp();

  const getMedCount = (memberId: string) =>
    medicines.filter(m => m.memberId === memberId).length;

  const handleRemove = (id: string, name: string) => {
    showAlert(`Remove ${name}?`, 'All their medicine data will also be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMember(id) },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Family Members</Text>
          <Text style={styles.headerSub}>{familyMembers.length} member{familyMembers.length !== 1 ? 's' : ''}</Text>
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
        contentContainerStyle={styles.scroll}
      >
        {/* Currently viewing */}
        {activeMember ? (
          <View style={styles.activeSection}>
            <Text style={styles.sectionTitle}>Currently Viewing</Text>
            <View style={[styles.activeBanner, { borderColor: getMemberRoleColor(activeMember.role) }]}>
              <View style={[styles.activeAvatar, { backgroundColor: getMemberRoleColor(activeMember.role) }]}>
                <Text style={styles.activeAvatarText}>
                  {activeMember.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.activeInfo}>
                <Text style={styles.activeName}>{activeMember.name}</Text>
                <Text style={styles.activeRole}>{activeMember.role} · {getMedCount(activeMember.id)} medicines</Text>
              </View>
              <View style={[styles.viewingBadge, { backgroundColor: getMemberRoleColor(activeMember.role) }]}>
                <Text style={styles.viewingText}>Active</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* All Members */}
        <Text style={styles.sectionTitle}>All Members</Text>
        {familyMembers.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="group-add" size={60} color={Colors.primaryMuted} />
            <Text style={styles.emptyTitle}>Add Family Members</Text>
            <Text style={styles.emptySubtitle}>
              Track medicines for your entire family from one place
            </Text>
            <Pressable
              onPress={() => router.push('/add-family')}
              style={({ pressed }) => [styles.addFirstBtn, pressed && { opacity: 0.8 }]}
            >
              <MaterialIcons name="person-add" size={18} color={Colors.white} />
              <Text style={styles.addFirstBtnText}>Add Member</Text>
            </Pressable>
          </View>
        ) : (
          familyMembers.map(member => (
            <View key={member.id} style={styles.memberWrapper}>
              <FamilyMemberCard
                member={member}
                isActive={member.id === activeMember?.id}
                medicineCount={getMedCount(member.id)}
                onPress={() => setActiveMember(member)}
                onEdit={() => router.push({ pathname: '/add-family', params: { editId: member.id } })}
              />
              <Pressable
                onPress={() => handleRemove(member.id, member.name)}
                style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="delete-outline" size={16} color={Colors.error} />
                <Text style={styles.removeBtnText}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}

        {/* Caregiver tip */}
        <View style={styles.tipCard}>
          <MaterialIcons name="tips-and-updates" size={22} color={Colors.accent} />
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Caregiver Mode</Text>
            <Text style={styles.tipText}>
              Tap any member to switch and manage their medicines. Receive alerts when they miss a dose.
            </Text>
          </View>
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
  addBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.colored,
  },
  scroll: { padding: Spacing[4] },
  activeSection: { marginBottom: Spacing[5] },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing[3],
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[3],
    borderWidth: 2,
    ...Shadow.sm,
  },
  activeAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing[3],
  },
  activeAvatarText: { color: Colors.white, fontWeight: Typography.bold, fontSize: Typography.md },
  activeInfo: { flex: 1 },
  activeName: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary },
  activeRole: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  viewingBadge: { paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderRadius: Radius.full },
  viewingText: { color: Colors.white, fontSize: Typography.xs, fontWeight: Typography.bold },
  memberWrapper: { marginBottom: Spacing[1] },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.errorLight,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
    marginBottom: Spacing[4],
    alignSelf: 'flex-start',
  },
  removeBtnText: { color: Colors.error, fontSize: Typography.sm, fontWeight: Typography.semibold },
  emptyState: { alignItems: 'center', paddingVertical: Spacing[12], gap: Spacing[2] },
  emptyTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary },
  emptySubtitle: { fontSize: Typography.base, color: Colors.textMuted, textAlign: 'center' },
  addFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderRadius: Radius.full,
    marginTop: Spacing[4],
    ...Shadow.colored,
  },
  addFirstBtnText: { color: Colors.white, fontWeight: Typography.semibold, fontSize: Typography.base },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.accentMuted,
  },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: 4 },
  tipText: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
});
