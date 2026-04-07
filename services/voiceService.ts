import * as Speech from 'expo-speech';
import { VOICE_GREETINGS } from '@/constants/config';

function getGreeting(language: string): string {
  const hour = new Date().getHours();
  const greetings = VOICE_GREETINGS[language] || VOICE_GREETINGS['en-IN'];
  if (hour < 12) return greetings.morning;
  if (hour < 17) return greetings.afternoon;
  if (hour < 21) return greetings.evening;
  return greetings.night;
}

export function buildReminderMessage(
  name: string,
  medicineName: string,
  dosage: string,
  language: string
): string {
  const greeting = getGreeting(language);
  const messages: Record<string, string> = {
    'en-IN': `${greeting} ${name}, please take your ${medicineName}, ${dosage}. Remember, your health is our priority.`,
    'hi-IN': `${greeting} ${name}, kripya apni dawai ${medicineName}, ${dosage} lijiye. Aapki sehat humari zimmedari hai.`,
    'te-IN': `${greeting} ${name}, dayachesi mee ${medicineName}, ${dosage} medicine theesukondhi. Mee aarogya maku mukhyam.`,
    'ta-IN': `${greeting} ${name}, ungal ${medicineName}, ${dosage} marundhuthai edungal. Ungal udalnanmai engalukku mukhiyam.`,
    'kn-IN': `${greeting} ${name}, dayavittu nimage ${medicineName}, ${dosage} aushadhi thegedukolli. Nimma aarogya namma gaurava.`,
  };
  return messages[language] || messages['en-IN'];
}

export function buildMissedMessage(
  name: string,
  medicineName: string,
  language: string
): string {
  const messages: Record<string, string> = {
    'en-IN': `${name}, you missed your ${medicineName}. Please take it as soon as possible.`,
    'hi-IN': `${name}, aap apni ${medicineName} dawai lena bhool gaye. Kripya jaldi lijiye.`,
    'te-IN': `${name}, mee ${medicineName} medicine miss ayyindhi. Vantane theesukondhi.`,
    'ta-IN': `${name}, ungal ${medicineName} marundhuthai thavarvitten. Ungalal thavirkkappatta, ungal marundhuthai edunga.`,
    'kn-IN': `${name}, neevu nimage ${medicineName} aushadhi miss maadidiri. Dayavittu twarita thegedukolli.`,
  };
  return messages[language] || messages['en-IN'];
}

export async function speakReminder(
  name: string,
  medicineName: string,
  dosage: string,
  language: string,
  voiceGender: 'male' | 'female' = 'female'
): Promise<void> {
  const message = buildReminderMessage(name, medicineName, dosage, language);
  await speakMessage(message, language, voiceGender);
}

export async function speakMissedAlert(
  name: string,
  medicineName: string,
  language: string,
  voiceGender: 'male' | 'female' = 'female'
): Promise<void> {
  const message = buildMissedMessage(name, medicineName, language);
  await speakMessage(message, language, voiceGender);
}

export async function speakMessage(
  text: string,
  language: string,
  voiceGender: 'male' | 'female' = 'female'
): Promise<void> {
  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) await Speech.stop();

    Speech.speak(text, {
      language,
      pitch: voiceGender === 'female' ? 1.1 : 0.9,
      rate: 0.9,
    });
  } catch (error) {
    console.error('Speech error:', error);
  }
}

export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch {}
}
