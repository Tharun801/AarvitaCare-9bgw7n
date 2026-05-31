/**
 * services/prescriptionService.ts
 * Handles image picking, base64 encoding, and calling the scan-prescription Edge Function.
 */
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { getSupabaseClient, FunctionsHttpError } from '@/template';

export interface ScannedMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: number;
  instructions: string;
  type: string;
}

export interface ScanResult {
  medicines: ScannedMedicine[];
  doctorName: string;
  patientName: string;
  date: string;
  notes: string;
}

export async function pickPrescriptionImage(source: 'camera' | 'gallery'): Promise<{
  uri: string;
  base64: string;
  mimeType: string;
} | null> {
  // Request permission
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') throw new Error('Camera permission denied');
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') throw new Error('Gallery permission denied');
  }

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.75,
        allowsEditing: true,
        aspect: [3, 4],
      })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.75,
        allowsEditing: true,
        aspect: [3, 4],
      });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const uri = asset.uri;
  const mimeType = asset.mimeType || 'image/jpeg';

  // Read as base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { uri, base64, mimeType };
}

export async function scanPrescription(base64: string, mimeType: string): Promise<ScanResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.functions.invoke('scan-prescription', {
    body: { imageBase64: base64, mimeType },
  });

  if (error) {
    let errorMessage = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const statusCode = error.context?.status ?? 500;
        const textContent = await error.context?.text();
        errorMessage = `[Code: ${statusCode}] ${textContent || error.message || 'Unknown error'}`;
      } catch {
        errorMessage = error.message || 'Failed to read response';
      }
    }
    throw new Error(errorMessage);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Scan failed');
  }

  return data.data as ScanResult;
}
