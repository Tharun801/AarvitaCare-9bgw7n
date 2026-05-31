import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Switch, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/hooks/useApp';
import { useAlert, getSupabaseClient } from '@/template';
import { LANGUAGES } from '@/constants/config';
import { speakMessage } from '@/services/voiceService';
import { triggerAutoCall } from '@/services/callService';
import {
  getScheduledCount,
  cancelAllNotifications,
  sendMissedDoseAlert,
} from '@/services/notificationService';
import {
  getBackgroundTaskStatus,
  registerBackgroundTask,
  detectAndMarkMissedDoses,
} from '@/services/backgroundTaskService';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { user, settings, updateSettings, logout, activeMember } = useApp();
  const [testingVoice, setTestingVoice] = useState(false);
  const [testingCall, setTestingCall] = useState(false);
  const [runningBgTask, setRunningBgTask] = useState(false);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [bgTaskStatus, setBgTaskStatus] = useState<{
    isRegistered: boolean;
    fetchStatusLabel: string;
  } | null>(null);

  useEffect(() => {
    getScheduledCount().then(setScheduledCount).catch(console.warn);
    getBackgroundTaskStatus().then(setBgTaskStatus).catch(console.warn);
  }, []);

  const runBgTaskNow = async () => {
    setRunningBgTask(true);
    try {
      const result = await detectAndMarkMissedDoses();
      showAlert(
        'Background Check Complete',
        `Checked all family medicine schedules.\n\nMissed doses detected & logged: ${result.processed}\nErrors: ${result.errors}`,
      );
      // Refresh status
      const status = await getBackgroundTaskStatus();
      setBgTaskStatus(status);
    } catch (err: any) {
      showAlert('Check Failed', err.message || 'Unable to run missed dose check');
    } finally {
      setRunningBgTask(false);
    }
  };

  const reRegisterBgTask = async () => {
    await registerBackgroundTask();
    const status = await getBackgroundTaskStatus();
    setBgTaskStatus(status);
    showAlert('Background Task', status.isRegistered ? 'Task registered successfully.' : 'Registration failed — check device settings.');
  };

  const testVoiceReminder = async () => {
    setTestingVoice(true);
    await speakMessage(
      `Hello ${activeMember?.name || 'Friend'}, this is a test voice reminder from AarvitaCare. Please take your medicine.`,
      settings.defaultLanguage,
    );
    setTestingVoice(false);
  };

  const testMissedAlert = async () => {
    await sendMissedDoseAlert({
      memberName: activeMember?.name || 'You',
      medicineName: 'Metformin 500mg',
      dosage: '1 tablet',
      scheduledTime: '08:00 AM',
    });
    showAlert('Test Sent', 'A missed dose notification was sent. Check your notification shade.');
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
      {
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          const sb = getSupabaseClient();
          await sb.auth.signOut();
          await logout();
          router.replace('/login');
        }
      },
    ]);
  };

  const SettingRow = ({
    icon, title, subtitle, value, onValueChange, onPress, danger, badge,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    value?: boolean;
    onValueChange?: (v: boolean) => void;
    onPress?: () => void;
    danger?: boolean;
    badge?: string;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.settingRow, pressed && onPress && { opacity: 0.7 }]}
      disabled={!onPress && onValueChange === undefined}
    >
      <View style={[styles.settingIcon, { backgroundColor: danger ? Colors.errorLight : Colors.primaryLight }]}>
        <MaterialIcons name={icon as any} size={20} color={danger ? Colors.error : Colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && { color: Colors.error }]}>{title}</Text>
        {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{badge}</Text>
        </View>
      ) : null}
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
            <Text style={styles.profileEmail}>{user?.phone || '—'}</Text>
          </View>
          <View style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>Family Admin</Text>
          </View>
        </View>

        {/* Background task status card */}
        <View style={styles.bgTaskCard}>
          <View style={styles.bgTaskRow}>
            <View style={styles.bgTaskIconBg}>
              <MaterialIcons name="schedule" size={20} color={Colors.secondary} />
            </View>
            <View style={styles.bgTaskText}>
              <Text style={styles.bgTaskTitle}>Auto Missed-Dose Detection</Text>
              <Text style={styles.bgTaskSub}>
                Runs every 15 min · Marks overdue doses · Alerts caregivers
              </Text>
            </View>
          </View>

          <View style={styles.bgTaskStatusRow}>
            <View style={styles.bgTaskBadge}>
              <View style={[
                styles.bgStatusDot,
                { backgroundColor: bgTaskStatus?.isRegistered ? Colors.success : Colors.error }
              ]} />
              <Text style={[
                styles.bgStatusLabel,
                { color: bgTaskStatus?.isRegistered ? Colors.success : Colors.error }
              ]}>
                {bgTaskStatus?.isRegistered ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <Text style={styles.bgFetchStatus}>
              OS status: {bgTaskStatus?.fetchStatusLabel || 'Loading...'}
            </Text>
          </View>

          <View style={styles.bgTaskBtnRow}>
            <Pressable
              onPress={runningBgTask ? undefined : runBgTaskNow}
              style={({ pressed }) => [
                styles.bgTaskBtn,
                { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryMuted },
                pressed && !runningBgTask && { opacity: 0.75 },
              ]}
            >
              {runningBgTask
                ? <MaterialIcons name="hourglass-empty" size={15} color={Colors.primary} />
                : <MaterialIcons name="play-arrow" size={15} color={Colors.primary} />}
              <Text style={[styles.bgTaskBtnText, { color: Colors.primary }]}>
                {runningBgTask ? 'Checking...' : 'Run Check Now'}
              </Text>
            </Pressable>

            {!bgTaskStatus?.isRegistered ? (
              <Pressable
                onPress={reRegisterBgTask}
                style={({ pressed }) => [
                  styles.bgTaskBtn,
                  { backgroundColor: Colors.secondaryMuted, borderColor: Colors.border },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <MaterialIcons name="refresh" size={15} color={Colors.secondary} />
                <Text style={[styles.bgTaskBtnText, { color: Colors.secondary }]}>Re-register</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Notification status banner */}
        <View style={styles.notifBanner}>
          <View style={styles.notifBannerLeft}>
            <MaterialIcons name="notifications-active" size={22} color={Colors.primary} />
            <View>
              <Text style={styles.notifBannerTitle}>Active Reminders</Text>
              <Text style={styles.notifBannerSub}>
                {scheduledCount > 0
                  ? `${scheduledCount} notification${scheduledCount !== 1 ? 's' : ''} scheduled daily`
                  : 'No reminders scheduled yet'}
              </Text>
            </View>
          </View>
          <View style={[
            styles.notifDot,
            { backgroundColor: scheduledCount > 0 ? Colors.success : Colors.textMuted },
          ]} />
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
            title={testingVoice ? 'Speaking...' : 'Test Voice Reminder'}
            subtitle="Hear a sample in your selected language"
            onPress={testingVoice ? undefined : testVoiceReminder}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="notifications-none"
            title="Test Missed Dose Alert"
            subtitle="Send a sample missed-dose notification"
            onPress={testMissedAlert}
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
            title="Scan Prescription (AI)"
            subtitle="Extract medicines using Gemini Vision AI"
            onPress={() => router.push('/scan-prescription')}
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
    marginBottom: Spacing[4],
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
  profileEmail: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.sm, marginTop: 2 },
  profileBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1],
    borderRadius: Radius.full,
  },
  profileBadgeText: { color: Colors.white, fontSize: Typography.xs, fontWeight: Typography.semibold },

  notifBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.primaryMuted,
  },
  notifBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  notifBannerTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  notifBannerSub: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  notifDot: { width: 10, height: 10, borderRadius: 5 },

  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: Spacing[3],
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
  countBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing[2],
    paddingVertical: 3,
    borderRadius: Radius.full,
    marginRight: Spacing[1],
  },
  countBadgeText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: Typography.bold },
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
  langChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  langLabelActive: { color: Colors.white },
  langSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },
  footer: { textAlign: 'center', color: Colors.textMuted, fontSize: Typography.sm, marginTop: Spacing[4] },

  // Background task card
  bgTaskCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    marginBottom: Spacing[4],
    borderWidth: 1.5,
    borderColor: Colors.secondaryMuted,
    ...Shadow.sm,
  },
  bgTaskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], marginBottom: Spacing[3] },
  bgTaskIconBg: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.secondaryMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  bgTaskText: { flex: 1 },
  bgTaskTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  bgTaskSub: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 2, lineHeight: 18 },
  bgTaskStatusRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing[3],
  },
  bgTaskBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1] },
  bgStatusDot: { width: 8, height: 8, borderRadius: 4 },
  bgStatusLabel: { fontSize: Typography.sm, fontWeight: Typography.bold },
  bgFetchStatus: { fontSize: Typography.xs, color: Colors.textMuted },
  bgTaskBtnRow: { flexDirection: 'row', gap: Spacing[2] },
  bgTaskBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: Spacing[2], borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  bgTaskBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold },
});
