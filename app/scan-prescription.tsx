/**
 * app/scan-prescription.tsx
 * Prescription scanner screen using expo-image-picker + OnSpace AI (Gemini 3 Flash).
 * Extracts medicine name, dosage, frequency, duration from a prescription photo
 * and navigates to Add Medicine with pre-filled data.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  withRepeat, withTiming, Easing, FadeIn, FadeInDown,
} from 'react-native-reanimated';
import { Colors, Typography, Spacing, Radius, Shadow } from '@/constants/theme';
import { Button } from '@/components';
import { useAlert } from '@/template';
import {
  pickPrescriptionImage,
  scanPrescription,
  ScannedMedicine,
  ScanResult,
} from '@/services/prescriptionService';
import { FREQUENCIES, MEDICINE_TYPES } from '@/constants/config';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function FrequencyLabel({ id }: { id: string }) {
  const freq = FREQUENCIES.find(f => f.id === id);
  return <Text style={styles.tagText}>{freq?.label || id}</Text>;
}

function MedicineTypeIcon({ type }: { type: string }) {
  const t = MEDICINE_TYPES.find(m => m.id === type);
  return <MaterialIcons name={(t?.icon as any) || 'medication'} size={16} color={Colors.primary} />;
}

function ScannedMedicineCard({
  medicine,
  index,
  onSelect,
  selected,
}: {
  medicine: ScannedMedicine;
  index: number;
  onSelect: (m: ScannedMedicine) => void;
  selected: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()} style={animStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        onPress={() => onSelect(medicine)}
        style={[styles.medicineCard, selected && styles.medicineCardSelected]}
      >
        {/* Selection indicator */}
        <View style={[styles.selectionCircle, selected && styles.selectionCircleActive]}>
          {selected ? (
            <MaterialIcons name="check" size={14} color={Colors.white} />
          ) : null}
        </View>

        <View style={styles.medicineCardHeader}>
          <View style={styles.medicineIconBg}>
            <MedicineTypeIcon type={medicine.type} />
          </View>
          <View style={styles.medicineCardTitleBlock}>
            <Text style={styles.medicineName} numberOfLines={2}>{medicine.name}</Text>
            <Text style={styles.medicineDosage}>{medicine.dosage}</Text>
          </View>
        </View>

        <View style={styles.medicineCardTags}>
          <View style={styles.tag}>
            <MaterialIcons name="repeat" size={12} color={Colors.primary} />
            <FrequencyLabel id={medicine.frequency} />
          </View>
          {medicine.duration > 0 ? (
            <View style={styles.tag}>
              <MaterialIcons name="date-range" size={12} color={Colors.accent} />
              <Text style={[styles.tagText, { color: Colors.accent }]}>{medicine.duration} days</Text>
            </View>
          ) : (
            <View style={styles.tag}>
              <MaterialIcons name="all-inclusive" size={12} color={Colors.textMuted} />
              <Text style={[styles.tagText, { color: Colors.textMuted }]}>Ongoing</Text>
            </View>
          )}
          <View style={[styles.tag, { backgroundColor: Colors.secondaryMuted }]}>
            <Text style={[styles.tagText, { color: Colors.secondary, textTransform: 'capitalize' }]}>
              {medicine.type}
            </Text>
          </View>
        </View>

        {medicine.instructions ? (
          <View style={styles.instructionRow}>
            <MaterialIcons name="info-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.instructionText} numberOfLines={2}>{medicine.instructions}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

type ScreenState = 'idle' | 'preview' | 'scanning' | 'results';

export default function ScanPrescriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();

  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedMedicines, setSelectedMedicines] = useState<Set<number>>(new Set());
  const [scanProgress, setScanProgress] = useState(0);

  // Pulsing animation for scan state
  const pulseAnim = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: pulseAnim.value,
  }));

  const startPulse = useCallback(() => {
    pulseAnim.value = withRepeat(
      withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const stopPulse = useCallback(() => {
    pulseAnim.value = withSpring(1);
  }, []);

  const handlePickImage = async (source: 'camera' | 'gallery') => {
    try {
      const result = await pickPrescriptionImage(source);
      if (!result) return;
      setImageUri(result.uri);
      setImageBase64(result.base64);
      setImageMimeType(result.mimeType);
      setScreenState('preview');
      setScanResult(null);
      setSelectedMedicines(new Set());
    } catch (err: any) {
      showAlert('Permission Required', err.message || 'Unable to access image source');
    }
  };

  const handleScan = async () => {
    if (!imageBase64) return;
    setScreenState('scanning');
    startPulse();
    setScanProgress(0);

    // Fake progress indicator while AI processes
    const progressTimer = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 85) { clearInterval(progressTimer); return 85; }
        return prev + Math.random() * 12;
      });
    }, 400);

    try {
      const result = await scanPrescription(imageBase64, imageMimeType);
      clearInterval(progressTimer);
      setScanProgress(100);
      stopPulse();

      if (!result.medicines || result.medicines.length === 0) {
        setScreenState('preview');
        showAlert(
          'No Medicines Found',
          result.notes || 'Could not detect any medicines in this image. Please try a clearer photo.',
          [{ text: 'Try Again' }]
        );
        return;
      }

      setScanResult(result);
      // Auto-select all by default
      setSelectedMedicines(new Set(result.medicines.map((_, i) => i)));
      setScreenState('results');
    } catch (err: any) {
      clearInterval(progressTimer);
      stopPulse();
      setScreenState('preview');
      showAlert('Scan Failed', err.message || 'Unable to process prescription. Please try again.');
    }
  };

  const toggleMedicineSelection = useCallback((index: number) => {
    setSelectedMedicines(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleAddSelected = useCallback(() => {
    if (!scanResult || selectedMedicines.size === 0) {
      showAlert('None Selected', 'Please select at least one medicine to add.');
      return;
    }

    const selected = [...selectedMedicines].map(i => scanResult.medicines[i]);
    // Navigate to add-medicine with the first selected medicine pre-filled
    // Pass extra data via params for subsequent medicines
    const first = selected[0];
    const params = new URLSearchParams({
      prefillName: first.name,
      prefillDosage: first.dosage,
      prefillFrequency: first.frequency,
      prefillDuration: String(first.duration),
      prefillInstructions: first.instructions,
      prefillType: first.type,
    });

    if (selected.length > 1) {
      // Store remaining in params as JSON
      params.set('extraMedicines', JSON.stringify(selected.slice(1)));
    }

    router.push(`/add-medicine?${params.toString()}`);
  }, [scanResult, selectedMedicines, router, showAlert]);

  const reset = useCallback(() => {
    setScreenState('idle');
    setImageUri(null);
    setImageBase64(null);
    setScanResult(null);
    setSelectedMedicines(new Set());
    setScanProgress(0);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Scan Prescription</Text>
          <Text style={styles.headerSub}>AI-powered medicine extraction</Text>
        </View>
        {screenState !== 'idle' ? (
          <Pressable onPress={reset} style={styles.resetBtn} hitSlop={8}>
            <MaterialIcons name="refresh" size={20} color={Colors.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* ── IDLE STATE ── */}
        {screenState === 'idle' ? (
          <Animated.View entering={FadeIn.duration(400)}>
            {/* Hero illustration */}
            <View style={styles.heroContainer}>
              <View style={styles.heroIconBg}>
                <MaterialIcons name="document-scanner" size={64} color={Colors.primary} />
              </View>
              <Text style={styles.heroTitle}>Scan Your Prescription</Text>
              <Text style={styles.heroDesc}>
                Take a photo or upload an image of your prescription. Our AI will automatically extract all medicines, dosages, and instructions.
              </Text>
            </View>

            {/* AI badge */}
            <View style={styles.aiBadge}>
              <View style={styles.aiDot} />
              <Text style={styles.aiBadgeText}>Powered by Gemini 3 Flash Vision AI</Text>
            </View>

            {/* Tips */}
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>📸 Tips for best results</Text>
              {[
                'Ensure good lighting — avoid shadows',
                'Keep the prescription flat and fully visible',
                'Capture entire prescription including doctor name',
                'Avoid blur — hold phone steady',
              ].map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={styles.tipDot} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [styles.sourceBtn, pressed && { opacity: 0.8 }]}
                onPress={() => handlePickImage('camera')}
              >
                <View style={styles.sourceBtnIcon}>
                  <MaterialIcons name="camera-alt" size={32} color={Colors.primary} />
                </View>
                <Text style={styles.sourceBtnTitle}>Take Photo</Text>
                <Text style={styles.sourceBtnSub}>Use camera</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.sourceBtn, pressed && { opacity: 0.8 }]}
                onPress={() => handlePickImage('gallery')}
              >
                <View style={styles.sourceBtnIcon}>
                  <MaterialIcons name="photo-library" size={32} color={Colors.secondary} />
                </View>
                <Text style={styles.sourceBtnTitle}>From Gallery</Text>
                <Text style={styles.sourceBtnSub}>Choose image</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {/* ── PREVIEW STATE ── */}
        {screenState === 'preview' && imageUri ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.previewImage}
                contentFit="contain"
                transition={200}
              />
              <View style={styles.previewOverlay}>
                <View style={styles.previewCornerTL} />
                <View style={styles.previewCornerTR} />
                <View style={styles.previewCornerBL} />
                <View style={styles.previewCornerBR} />
              </View>
            </View>

            <View style={styles.previewActions}>
              <Pressable
                onPress={() => handlePickImage('camera')}
                style={styles.retakeBtn}
              >
                <MaterialIcons name="camera-alt" size={18} color={Colors.textSecondary} />
                <Text style={styles.retakeBtnText}>Retake</Text>
              </Pressable>
              <Pressable
                onPress={() => handlePickImage('gallery')}
                style={styles.retakeBtn}
              >
                <MaterialIcons name="photo-library" size={18} color={Colors.textSecondary} />
                <Text style={styles.retakeBtnText}>Gallery</Text>
              </Pressable>
            </View>

            <Button
              label="Extract Medicines with AI"
              onPress={handleScan}
              fullWidth
              size="lg"
              style={{ borderRadius: Radius.full, marginTop: Spacing[2] }}
              icon={<MaterialIcons name="auto-fix-high" size={20} color={Colors.white} />}
            />
          </Animated.View>
        ) : null}

        {/* ── SCANNING STATE ── */}
        {screenState === 'scanning' ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.scanningContainer}>
            {imageUri ? (
              <View style={styles.scanningImageWrapper}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.scanningImage}
                  contentFit="cover"
                  transition={200}
                />
                <View style={styles.scanningOverlay}>
                  {/* Scanning line animation */}
                  <Animated.View style={[styles.scanLine, pulseStyle]} />
                </View>
              </View>
            ) : null}

            <View style={styles.scanningInfo}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.scanningTitle}>Analyzing Prescription...</Text>
              <Text style={styles.scanningDesc}>
                Gemini AI is reading your prescription and extracting medicine details
              </Text>

              {/* Progress bar */}
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(scanProgress, 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(Math.min(scanProgress, 100))}%</Text>

              <View style={styles.scanSteps}>
                {[
                  { label: 'Preprocessing image', done: scanProgress > 15 },
                  { label: 'Detecting text regions', done: scanProgress > 35 },
                  { label: 'Extracting medicine names', done: scanProgress > 55 },
                  { label: 'Parsing dosage & frequency', done: scanProgress > 75 },
                  { label: 'Finalizing results', done: scanProgress >= 100 },
                ].map((step, i) => (
                  <View key={i} style={styles.scanStep}>
                    <MaterialIcons
                      name={step.done ? 'check-circle' : 'radio-button-unchecked'}
                      size={16}
                      color={step.done ? Colors.success : Colors.textMuted}
                    />
                    <Text style={[styles.scanStepText, step.done && { color: Colors.success }]}>
                      {step.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        ) : null}

        {/* ── RESULTS STATE ── */}
        {screenState === 'results' && scanResult ? (
          <Animated.View entering={FadeIn.duration(300)}>
            {/* Success banner */}
            <View style={styles.successBanner}>
              <MaterialIcons name="check-circle" size={24} color={Colors.success} />
              <View style={styles.successBannerText}>
                <Text style={styles.successTitle}>
                  {scanResult.medicines.length} medicine{scanResult.medicines.length !== 1 ? 's' : ''} detected!
                </Text>
                {scanResult.doctorName ? (
                  <Text style={styles.successSub}>Dr. {scanResult.doctorName}</Text>
                ) : null}
              </View>
              <Pressable onPress={() => setScreenState('preview')} hitSlop={8}>
                <MaterialIcons name="edit" size={20} color={Colors.textMuted} />
              </Pressable>
            </View>

            {/* Prescription thumbnail */}
            {imageUri ? (
              <Pressable onPress={() => setScreenState('preview')} style={styles.thumbnailRow}>
                <Image source={{ uri: imageUri }} style={styles.thumbnail} contentFit="cover" />
                <View style={styles.thumbnailInfo}>
                  <Text style={styles.thumbnailTitle}>Prescription Image</Text>
                  {scanResult.date ? <Text style={styles.thumbnailSub}>Date: {scanResult.date}</Text> : null}
                  {scanResult.patientName ? <Text style={styles.thumbnailSub}>Patient: {scanResult.patientName}</Text> : null}
                </View>
                <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
              </Pressable>
            ) : null}

            {/* Selection header */}
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>
                Select medicines to add ({selectedMedicines.size}/{scanResult.medicines.length})
              </Text>
              <Pressable
                onPress={() => {
                  if (selectedMedicines.size === scanResult.medicines.length) {
                    setSelectedMedicines(new Set());
                  } else {
                    setSelectedMedicines(new Set(scanResult.medicines.map((_, i) => i)));
                  }
                }}
              >
                <Text style={styles.selectAllText}>
                  {selectedMedicines.size === scanResult.medicines.length ? 'Deselect All' : 'Select All'}
                </Text>
              </Pressable>
            </View>

            {/* Medicine cards */}
            {scanResult.medicines.map((med, i) => (
              <ScannedMedicineCard
                key={i}
                medicine={med}
                index={i}
                onSelect={() => toggleMedicineSelection(i)}
                selected={selectedMedicines.has(i)}
              />
            ))}

            {/* General notes */}
            {scanResult.notes ? (
              <View style={styles.notesCard}>
                <MaterialIcons name="notes" size={18} color={Colors.textMuted} />
                <Text style={styles.notesText}>{scanResult.notes}</Text>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* ── STICKY FOOTER for RESULTS ── */}
      {screenState === 'results' ? (
        <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + Spacing[2] }]}>
          <Button
            label={
              selectedMedicines.size === 0
                ? 'Select Medicines'
                : selectedMedicines.size === 1
                  ? 'Add 1 Medicine'
                  : `Add ${selectedMedicines.size} Medicines`
            }
            onPress={handleAddSelected}
            fullWidth
            size="lg"
            style={{ borderRadius: Radius.full }}
            disabled={selectedMedicines.size === 0}
            icon={<MaterialIcons name="add-circle" size={20} color={Colors.white} />}
          />
        </View>
      ) : null}
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
    paddingVertical: Spacing[3],
    backgroundColor: Colors.white,
    ...Shadow.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  resetBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  headerSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },

  scroll: { padding: Spacing[4] },

  // ── IDLE ──
  heroContainer: { alignItems: 'center', paddingVertical: Spacing[6] },
  heroIconBg: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[5],
    ...Shadow.colored,
  },
  heroTitle: {
    fontSize: Typography.xl, fontWeight: Typography.bold,
    color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing[2],
  },
  heroDesc: {
    fontSize: Typography.base, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 24, paddingHorizontal: Spacing[2],
  },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing[2], marginBottom: Spacing[4],
  },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  aiBadgeText: { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: Typography.medium },

  tipsCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing[4], marginBottom: Spacing[5], ...Shadow.sm,
  },
  tipsTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary, marginBottom: Spacing[3] },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[2], marginBottom: Spacing[2] },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 6 },
  tipText: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },

  actionRow: { flexDirection: 'row', gap: Spacing[3] },
  sourceBtn: {
    flex: 1, backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing[5], alignItems: 'center', ...Shadow.md,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  sourceBtnIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.background, alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing[3],
  },
  sourceBtnTitle: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary },
  sourceBtnSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  // ── PREVIEW ──
  previewContainer: {
    borderRadius: Radius.xl, overflow: 'hidden',
    marginBottom: Spacing[4], ...Shadow.md, position: 'relative',
  },
  previewImage: { width: '100%', height: 420, backgroundColor: Colors.borderLight },
  previewOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: Radius.xl, pointerEvents: 'none',
  },
  previewCornerTL: { position: 'absolute', top: 12, left: 12, width: 24, height: 24, borderTopWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary },
  previewCornerTR: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderTopWidth: 3, borderRightWidth: 3, borderColor: Colors.primary },
  previewCornerBL: { position: 'absolute', bottom: 12, left: 12, width: 24, height: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary },
  previewCornerBR: { position: 'absolute', bottom: 12, right: 12, width: 24, height: 24, borderBottomWidth: 3, borderRightWidth: 3, borderColor: Colors.primary },

  previewActions: {
    flexDirection: 'row', gap: Spacing[3], marginBottom: Spacing[4],
  },
  retakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing[2], backgroundColor: Colors.white, borderRadius: Radius.md,
    paddingVertical: Spacing[3], borderWidth: 1.5, borderColor: Colors.border,
  },
  retakeBtnText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },

  // ── SCANNING ──
  scanningContainer: { alignItems: 'center' },
  scanningImageWrapper: {
    width: '100%', height: 200, borderRadius: Radius.xl,
    overflow: 'hidden', marginBottom: Spacing[5], position: 'relative',
  },
  scanningImage: { width: '100%', height: '100%' },
  scanningOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13, 155, 118, 0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  scanLine: {
    width: '80%', height: 3,
    backgroundColor: Colors.primary, borderRadius: 2,
  },
  scanningInfo: { width: '100%', alignItems: 'center' },
  scanningTitle: {
    fontSize: Typography.xl, fontWeight: Typography.bold,
    color: Colors.textPrimary, marginTop: Spacing[4], marginBottom: Spacing[2],
  },
  scanningDesc: {
    fontSize: Typography.base, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22, marginBottom: Spacing[5],
    paddingHorizontal: Spacing[4],
  },
  progressBar: {
    width: '100%', height: 8, backgroundColor: Colors.borderLight,
    borderRadius: Radius.full, overflow: 'hidden', marginBottom: Spacing[2],
  },
  progressFill: {
    height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full,
  },
  progressText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.bold, marginBottom: Spacing[5] },
  scanSteps: { width: '100%', gap: Spacing[3] },
  scanStep: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  scanStepText: { fontSize: Typography.base, color: Colors.textMuted },

  // ── RESULTS ──
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    backgroundColor: Colors.successLight, borderRadius: Radius.lg,
    padding: Spacing[4], marginBottom: Spacing[3], borderWidth: 1,
    borderColor: Colors.success + '40',
  },
  successBannerText: { flex: 1 },
  successTitle: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary },
  successSub: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },

  thumbnailRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing[3], marginBottom: Spacing[4], ...Shadow.sm,
  },
  thumbnail: { width: 56, height: 56, borderRadius: Radius.md },
  thumbnailInfo: { flex: 1 },
  thumbnailTitle: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  thumbnailSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },

  selectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing[3],
  },
  selectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary },
  selectAllText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: Typography.semibold },

  // Medicine card
  medicineCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing[4], marginBottom: Spacing[3], ...Shadow.sm,
    borderWidth: 2, borderColor: Colors.border,
  },
  medicineCardSelected: {
    borderColor: Colors.primary, backgroundColor: Colors.primaryLight,
  },
  selectionCircle: {
    position: 'absolute', top: Spacing[3], right: Spacing[3],
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  selectionCircleActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  medicineCardHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: Spacing[3], marginBottom: Spacing[3], paddingRight: 32,
  },
  medicineIconBg: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  medicineCardTitleBlock: { flex: 1 },
  medicineName: {
    fontSize: Typography.md, fontWeight: Typography.bold,
    color: Colors.textPrimary, lineHeight: 24,
  },
  medicineDosage: {
    fontSize: Typography.sm, color: Colors.primary,
    fontWeight: Typography.semibold, marginTop: 2,
  },
  medicineCardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], marginBottom: Spacing[2] },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing[2],
    paddingVertical: 4, borderRadius: Radius.sm,
  },
  tagText: { fontSize: Typography.xs, color: Colors.primary, fontWeight: Typography.medium },
  instructionRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[2],
    backgroundColor: Colors.background, borderRadius: Radius.sm, padding: Spacing[2],
  },
  instructionText: { flex: 1, fontSize: Typography.xs, color: Colors.textSecondary, lineHeight: 18 },

  notesCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[2],
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing[4], marginTop: Spacing[2], ...Shadow.sm,
  },
  notesText: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },

  stickyFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white, padding: Spacing[4],
    borderTopWidth: 1, borderTopColor: Colors.border, ...Shadow.md,
  },
});
