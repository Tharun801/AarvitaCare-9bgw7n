import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { MedicineCard } from '@/components';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';

export default function MedicinesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { medicines, activeMember, removeMed } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filtered = medicines.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const handleDelete = (id: string, name: string) => {
    showAlert(`Remove ${name}?`, 'This medicine will be removed from the schedule.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMed(id) },
    ]);
  };

  const FILTERS = ['all', 'active', 'completed'];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Medicines</Text>
          {activeMember ? (
            <Text style={styles.headerSub}>for {activeMember.name}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => router.push('/add-medicine')}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
        >
          <MaterialIcons name="add" size={22} color={Colors.white} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search medicines..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search medicines"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <MaterialIcons name="clear" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="medication-liquid" size={60} color={Colors.primaryMuted} />
            <Text style={styles.emptyTitle}>
              {search ? 'No medicines found' : 'No medicines yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? 'Try a different search term'
                : 'Add your first medicine to start tracking'}
            </Text>
            {!search ? (
              <Pressable
                onPress={() => router.push('/add-medicine')}
                style={({ pressed }) => [styles.addFirstBtn, pressed && { opacity: 0.8 }]}
              >
                <MaterialIcons name="add" size={18} color={Colors.white} />
                <Text style={styles.addFirstBtnText}>Add Medicine</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <Text style={styles.count}>{filtered.length} medicine{filtered.length !== 1 ? 's' : ''}</Text>
            {filtered.map(med => (
              <View key={med.id} style={styles.medWrapper}>
                <MedicineCard
                  medicine={med}
                  onPress={() => router.push({ pathname: '/medicine-detail', params: { id: med.id } })}
                />
                <View style={styles.medActions}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/add-medicine', params: { editId: med.id } })}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: Colors.primaryLight }, pressed && { opacity: 0.7 }]}
                  >
                    <MaterialIcons name="edit" size={16} color={Colors.primary} />
                    <Text style={[styles.actionText, { color: Colors.primary }]}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(med.id, med.name)}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: Colors.errorLight }, pressed && { opacity: 0.7 }]}
                  >
                    <MaterialIcons name="delete-outline" size={16} color={Colors.error} />
                    <Text style={[styles.actionText, { color: Colors.error }]}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    margin: Spacing[4],
    paddingHorizontal: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.border,
    height: 48,
    ...Shadow.sm,
  },
  searchIcon: { marginRight: Spacing[2] },
  searchInput: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary, includeFontPadding: false },
  scroll: { paddingHorizontal: Spacing[4] },
  count: { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: Spacing[3], fontWeight: Typography.medium },
  medWrapper: { marginBottom: Spacing[1] },
  medActions: { flexDirection: 'row', gap: Spacing[2], marginBottom: Spacing[4], marginTop: -Spacing[2] },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing[2], borderRadius: Radius.md, gap: 4,
  },
  actionText: { fontSize: Typography.sm, fontWeight: Typography.semibold },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing[12],
    gap: Spacing[2],
  },
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
});
