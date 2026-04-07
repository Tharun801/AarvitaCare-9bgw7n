import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { FamilyMember, getMemberRoleColor, getMemberInitials } from '@/services/familyService';

interface FamilyMemberCardProps {
  member: FamilyMember;
  isActive?: boolean;
  medicineCount?: number;
  onPress?: () => void;
  onEdit?: () => void;
  compact?: boolean;
}

export function FamilyMemberCard({ member, isActive, medicineCount, onPress, onEdit, compact }: FamilyMemberCardProps) {
  const roleColor = getMemberRoleColor(member.role);
  const initials = getMemberInitials(member.name);

  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.compact,
          isActive && { borderColor: roleColor, borderWidth: 2, backgroundColor: roleColor + '10' },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: roleColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={[styles.compactName, isActive && { color: roleColor }]} numberOfLines={1}>
          {member.name.split(' ')[0]}
        </Text>
        {isActive ? <View style={[styles.activeDot, { backgroundColor: roleColor }]} /> : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isActive && { borderColor: roleColor, borderWidth: 2 },
        pressed && { opacity: 0.95 },
      ]}
    >
      <View style={[styles.avatarLg, { backgroundColor: roleColor }]}>
        <Text style={styles.avatarLgText}>{initials}</Text>
      </View>
      <View style={styles.details}>
        <Text style={styles.name}>{member.name}</Text>
        <View style={styles.roleRow}>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{member.role}</Text>
          </View>
          {member.language !== 'en-IN' ? (
            <View style={[styles.langBadge]}>
              <Text style={styles.langText}>{member.language.split('-')[0].toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        {member.phone ? (
          <Text style={styles.phone}>📞 {member.phone}</Text>
        ) : null}
        {medicineCount !== undefined ? (
          <Text style={styles.medCount}>💊 {medicineCount} medicine{medicineCount !== 1 ? 's' : ''}</Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {onEdit ? (
          <Pressable onPress={onEdit} style={styles.editBtn} hitSlop={8}>
            <MaterialIcons name="edit" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
        {isActive ? (
          <View style={[styles.activeIndicator, { backgroundColor: roleColor }]}>
            <MaterialIcons name="check" size={12} color={Colors.white} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    marginBottom: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
  },
  avatarText: {
    color: Colors.white,
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
  },
  compact: {
    alignItems: 'center',
    padding: Spacing[3],
    borderRadius: Radius.lg,
    backgroundColor: Colors.white,
    marginRight: Spacing[3],
    minWidth: 72,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  compactName: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3,
  },
  avatarLg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
  },
  avatarLgText: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  details: { flex: 1 },
  name: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginTop: 3 },
  roleBadge: { paddingHorizontal: Spacing[2], paddingVertical: 2, borderRadius: Radius.full },
  roleText: { fontSize: Typography.xs, fontWeight: Typography.semibold, textTransform: 'capitalize' },
  langBadge: { paddingHorizontal: Spacing[2], paddingVertical: 2, borderRadius: Radius.full, backgroundColor: Colors.infoLight },
  langText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.info },
  phone: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 3 },
  medCount: { fontSize: Typography.sm, color: Colors.primary, marginTop: 2, fontWeight: Typography.medium },
  actions: { gap: Spacing[2], alignItems: 'flex-end' },
  editBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: Colors.borderLight },
  activeIndicator: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
