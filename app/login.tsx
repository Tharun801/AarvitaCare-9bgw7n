import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, KeyboardAvoidingView,
  Platform, Pressable, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { Button } from '@/components';
import { useApp } from '@/hooks/useApp';
import { useAlert, getSupabaseClient } from '@/template';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useApp();
  const { showAlert } = useAlert();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [loading, setLoading] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);

  const handleSendOtp = async () => {
    if (!name.trim()) {
      showAlert('Name Required', 'Please enter your name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      showAlert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const sb = getSupabaseClient();
      const { error } = await sb.auth.signInWithOtp({ email: email.trim() });
      if (error) {
        showAlert('Error', error.message);
        return;
      }
      setStep('otp');
      showAlert('OTP Sent', `A verification code has been sent to ${email.trim()}`);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) {
      showAlert('Invalid OTP', 'Please enter the verification code from your email');
      return;
    }
    setLoading(true);
    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email',
      });
      if (error) {
        showAlert('Verification Failed', error.message);
        return;
      }
      if (data.session) {
        await login(name.trim(), email.trim());
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing[8], paddingBottom: insets.bottom + Spacing[6] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoRing}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              contentFit="contain"
            />
          </View>
          <Text style={styles.appName}>AarvitaCare</Text>
          <Text style={styles.tagline}>Your family health guardian ❤️</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {step === 'details' ? (
            <>
              <Text style={styles.formTitle}>Welcome! Let's get started</Text>
              <Text style={styles.formSubtitle}>Enter your details to set up your family health profile</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  style={[styles.input, nameFocused && styles.inputFocused]}
                  placeholder="e.g. Priya Sharma"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  autoCapitalize="words"
                  accessibilityLabel="Your name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={[styles.input, emailFocused && styles.inputFocused]}
                  placeholder="e.g. priya@example.com"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  accessibilityLabel="Email address"
                />
              </View>

              <Button
                label="Send Verification Code"
                onPress={handleSendOtp}
                loading={loading}
                fullWidth
                size="lg"
                style={styles.cta}
                icon={<MaterialIcons name="email" size={18} color={Colors.white} />}
              />
            </>
          ) : (
            <>
              <Pressable onPress={() => setStep('details')} style={styles.backRow}>
                <MaterialIcons name="arrow-back" size={18} color={Colors.primary} />
                <Text style={styles.backText}>Change email</Text>
              </Pressable>

              <Text style={styles.formTitle}>Check Your Email</Text>
              <Text style={styles.formSubtitle}>
                Enter the code sent to{'\n'}{email}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={[styles.input, styles.otpInput, otpFocused && styles.inputFocused]}
                  placeholder="• • • •"
                  placeholderTextColor={Colors.textMuted}
                  value={otp}
                  onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                  onFocus={() => setOtpFocused(true)}
                  onBlur={() => setOtpFocused(false)}
                  keyboardType="number-pad"
                  maxLength={6}
                  accessibilityLabel="Verification code"
                />
              </View>

              <Button
                label="Verify & Continue"
                onPress={handleVerifyOtp}
                loading={loading}
                fullWidth
                size="lg"
                style={styles.cta}
                icon={<MaterialIcons name="verified-user" size={18} color={Colors.white} />}
              />

              <Pressable onPress={handleSendOtp} style={styles.resendRow}>
                <Text style={styles.resendText}>Did not receive? </Text>
                <Text style={[styles.resendText, { color: Colors.primary, fontWeight: '600' }]}>Resend Code</Text>
              </Pressable>
            </>
          )}
        </View>

        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: Spacing[6] },
  hero: { alignItems: 'center', marginBottom: Spacing[6] },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[3],
    borderWidth: 3,
    borderColor: Colors.primary + '40',
  },
  logo: { width: 56, height: 56 },
  appName: { fontSize: Typography['2xl'], fontWeight: Typography.extrabold, color: Colors.textPrimary },
  tagline: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 4 },
  form: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing[5],
    ...Shadow.md,
    marginBottom: Spacing[5],
  },
  formTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing[1] },
  formSubtitle: { fontSize: Typography.sm, color: Colors.textMuted, marginBottom: Spacing[5], lineHeight: 20 },
  inputGroup: { marginBottom: Spacing[4] },
  label: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary, marginBottom: Spacing[2] },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    fontSize: Typography.md,
    color: Colors.textPrimary,
    minHeight: 52,
  },
  inputFocused: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  otpInput: { textAlign: 'center', fontSize: Typography['2xl'], letterSpacing: 12, fontWeight: Typography.bold },
  cta: { marginTop: Spacing[2], borderRadius: Radius.full },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing[4] },
  backText: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '500' },
  resendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing[3] },
  resendText: { fontSize: Typography.sm, color: Colors.textMuted },
  terms: { textAlign: 'center', fontSize: Typography.xs, color: Colors.textMuted, lineHeight: 18 },
});
