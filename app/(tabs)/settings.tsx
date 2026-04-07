import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { LANGUAGES } from '@/constants/config';
import { speakMessage } from '@/services/voiceService';
import { triggerAutoCall } from '@/services/callService';
import { getSupabaseClient } from '@/template';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { user, settings, updateSettings, logout, activeMember } = useApp();
  const [testingVoice, setTestingVoice] = useState(false);
  const [testingCall, setTestingCall] = useState(false);

  const testVoiceReminder = async () => {
    setTestingVoice(true);
    await speakMessage(
      `Hello ${activeMember?.name || 'Friend'}, this is a test voice reminder from AarvitaCare. Please take your medicine.`,
      settings.defaultLanguage,
    );
    setTestingVoice(false);
  };

  const testAutoCall = async () => {
    setTestingCall(true);
    const result = await triggerAutoCall({
      patientPhone: user?.phone || '9999999999',
      patientName: activeMember?.name || 'Patient',
      medicineName: 'Test Medicine',
      missedCount: 2,
    });
    setTestingCall(false);
    showAlert('Auto Call Test', result.success
      ? `Call simulation successful!\nCall ID: ${result.callSid?.slice(0, 16)}...\n\nIn production, real calls via Twilio/Exotel will be triggered.`
      : 'Call failed. Please check your configuration.');
  };

  const handleLogout = () => {
    showAlert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        const sb = getSupabaseClient();
        await sb.auth.signOut();
        await logout();
        router.replace('/login');
      } },
    ]);
  };

  const SettingRow = ({ icon, title, subtitle, value, onValueChange, onPress, danger }: {
    icon: string;
    title: string;
    subtitle?: string;
    value?: boolean;
    onValueChange?: (v: boolean) => void;
    onPress?: () => void;
    danger?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.settingRow, pressed && onPress && { opacity: 0.7 }]}
      disabled={!onPress && !onValueChange}
    >
      <View style={[styles.settingIcon, { backgroundColor: danger ? Colors.errorLight : Colors.primaryLight }]}>
        <MaterialIcons name={icon as any} size={20} color={danger ? Colors.error : Colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && { color: Colors.error }]}>{title}</Text>
        {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
      </View>
      {onValueChange !== undefined ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: Colors.borderLight, true: Colors.primaryMuted }}
          thumbColor={value ? Colors.primary : Colors.white}
        />
      ) : onPress ? (
        <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
      ) : null}
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{user?.name?.slice(0, 2).toUpperCase() || 'ME'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profilePhone}>+91 {user?.phone || '—'}</Text>
          </View>
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>Family Admin</Text>
          </View>
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.settingGroup}>
          <SettingRow
            icon="notifications"
            title="Medicine Reminders"
            subtitle="Get notified at scheduled times"
            value={settings.notificationsEnabled}
            onValueChange={v => updateSettings({ notificationsEnabled: v })}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="record-voice-over"
            title="Voice Reminders"
            subtitle="Speak reminders in your language"
            value={settings.voiceRemindersEnabled}
            onValueChange={v => updateSettings({ voiceRemindersEnabled: v })}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="group"
            title="Family Alerts"
            subtitle="Alert caregivers on missed doses"
            value={settings.familyAlertsEnabled}
            onValueChange={v => updateSettings({ familyAlertsEnabled: v })}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="phone"
            title="Auto Call System"
            subtitle="Auto-call on 2+ missed doses (Twilio)"
            value={settings.autoCallEnabled}
            onValueChange={v => updateSettings({ autoCallEnabled: v })}
          />
        </View>

        {/* Language */}
        <Text style={styles.sectionLabel}>LANGUAGE</Text>
        <View style={styles.settingGroup}>
          <Text style={styles.langTitle}>Voice Reminder Language</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map(lang => (
              <Pressable
                key={lang.code}
                onPress={() => updateSettings({ defaultLanguage: lang.code })}
                style={({ pressed }) => [
                  styles.langChip,
                  settings.defaultLanguage === lang.code && styles.langChipActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.langLabel, settings.defaultLanguage === lang.code && styles.langLabelActive]}>
                  {lang.nativeLabel}
                </Text>
                <Text style={[styles.langSub, settings.defaultLanguage === lang.code && { color: Colors.white }]}>
                  {lang.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Test Features */}
        <Text style={styles.sectionLabel}>TEST FEATURES</Text>
        <View style={styles.settingGroup}>
          <SettingRow
            icon="volume-up"
            title={testingVoice ? 'Playing...' : 'Test Voice Reminder'}
            subtitle="Hear a sample voice reminder"
            onPress={testingVoice ? undefined : testVoiceReminder}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="phone-in-talk"
            title={testingCall ? 'Simulating...' : 'Test Auto Call'}
            subtitle="Simulate Twilio/Exotel auto call"
            onPress={testingCall ? undefined : testAutoCall}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="document-scanner"
            title="Scan Prescription (OCR)"
            subtitle="Extract medicine from prescription image"
            onPress={() => showAlert('OCR Scanner', 'Prescription scanner uses ML Kit OCR to extract medicine name, dosage and duration. Integration coming in next version!', [{ text: 'OK' }])}
          />
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.settingGroup}>
          <SettingRow
            icon="info"
            title="App Version"
            subtitle="AarvitaCare v1.0.0"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="privacy-tip"
            title="Privacy Policy"
            onPress={() => Linking.openURL('https://aarvitacare.com/privacy')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="description"
            title="Terms of Service"
            onPress={() => Linking.openURL('https://aarvitacare.com/terms')}
          />
        </View>

        {/* Logout */}
        <View style={styles.settingGroup}>
          <SettingRow
            icon="logout"
            title="Sign Out"
            danger
            onPress={handleLogout}
          />
        </View>

        <Text style={styles.footer}>AarvitaCare — Where health meets love ❤️</Text>
        <View style={{ height: Spacing[8] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[3],
    paddingTop: Spacing[2],
    backgroundColor: Colors.white,
    ...Shadow.sm,
  },
  headerTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  scroll: { padding: Spacing[4] },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary,
    borderRadius: Radius.xl,
    padding: Spacing[4],
    marginBottom: Spacing[5],
    gap: Spacing[3],
    ...Shadow.lg,
  },
  profileAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { color: Colors.white, fontSize: Typography.lg, fontWeight: Typography.bold },
  profileInfo: { flex: 1 },
  profileName: { color: Colors.white, fontSize: Typography.md, fontWeight: Typography.bold },
  profilePhone: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.sm, marginTop: 2 },
  profileBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1],
    borderRadius: Radius.full,
  },
  profileBadgeText: { color: Colors.white, fontSize: Typography.xs, fontWeight: Typography.semibold },
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: Spacing[4],
    marginBottom: Spacing[2],
    paddingLeft: Spacing[1],
  },
  settingGroup: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing[2],
    ...Shadow.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing[4],
    gap: Spacing[3],
    minHeight: 64,
  },
  settingIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  settingContent: { flex: 1 },
  settingTitle: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  settingSubtitle: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginHorizontal: Spacing[4] },
  langTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    padding: Spacing[4],
    paddingBottom: Spacing[2],
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing[3],
    gap: Spacing[2],
  },
  langChip: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  langChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  langLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  langLabelActive: { color: Colors.white },
  langSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },
  footer: { textAlign: 'center', color: Colors.textMuted, fontSize: Typography.sm, marginTop: Spacing[4] },
});
