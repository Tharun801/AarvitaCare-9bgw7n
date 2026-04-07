export const APP_CONFIG = {
  name: 'AarvitaCare',
  tagline: 'Where health meets love ❤️',
  version: '1.0.0',
};

export const LANGUAGES = [
  { code: 'en-IN', label: 'English', nativeLabel: 'English' },
  { code: 'hi-IN', label: 'Hindi', nativeLabel: 'हिंदी' },
  { code: 'te-IN', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'ta-IN', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'kn-IN', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
];

export const FAMILY_ROLES = [
  { id: 'self', label: 'Self', icon: 'person' },
  { id: 'father', label: 'Father', icon: 'elderly' },
  { id: 'mother', label: 'Mother', icon: 'face' },
  { id: 'spouse', label: 'Spouse', icon: 'favorite' },
  { id: 'child', label: 'Child', icon: 'child-care' },
  { id: 'grandfather', label: 'Grandfather', icon: 'elderly' },
  { id: 'grandmother', label: 'Grandmother', icon: 'face-retouching-natural' },
  { id: 'sibling', label: 'Sibling', icon: 'group' },
  { id: 'other', label: 'Other', icon: 'person-outline' },
];

export const FREQUENCIES = [
  { id: 'once_daily', label: 'Once Daily', times: ['08:00'] },
  { id: 'twice_daily', label: 'Twice Daily', times: ['08:00', '20:00'] },
  { id: 'thrice_daily', label: 'Thrice Daily', times: ['08:00', '14:00', '20:00'] },
  { id: 'four_times', label: 'Four Times Daily', times: ['08:00', '12:00', '16:00', '20:00'] },
  { id: 'weekly', label: 'Weekly', times: ['08:00'] },
  { id: 'custom', label: 'Custom', times: [] },
];

export const MEDICINE_TYPES = [
  { id: 'tablet', label: 'Tablet', icon: 'medication' },
  { id: 'capsule', label: 'Capsule', icon: 'science' },
  { id: 'syrup', label: 'Syrup', icon: 'local-drink' },
  { id: 'injection', label: 'Injection', icon: 'vaccines' },
  { id: 'drops', label: 'Drops', icon: 'opacity' },
  { id: 'cream', label: 'Cream/Ointment', icon: 'spa' },
  { id: 'inhaler', label: 'Inhaler', icon: 'air' },
  { id: 'patch', label: 'Patch', icon: 'healing' },
];

export const VOICE_GREETINGS: Record<string, { morning: string; afternoon: string; evening: string; night: string }> = {
  'en-IN': {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    night: 'Good night',
  },
  'hi-IN': {
    morning: 'Suprabhat',
    afternoon: 'Namaskar',
    evening: 'Shubh sandhya',
    night: 'Shubh ratri',
  },
  'te-IN': {
    morning: 'Subhodayam',
    afternoon: 'Namaskar',
    evening: 'Shubha sayantram',
    night: 'Shubha ratri',
  },
  'ta-IN': {
    morning: 'Kalai vanakkam',
    afternoon: 'Madiya vanakkam',
    evening: 'Maalai vanakkam',
    night: 'Iravu vanakkam',
  },
  'kn-IN': {
    morning: 'Shubhodaya',
    afternoon: 'Namaskar',
    evening: 'Shubha sandhya',
    night: 'Shubha ratri',
  },
};

export const STORAGE_KEYS = {
  USER: '@aarvita_user',
  FAMILY_MEMBERS: '@aarvita_family',
  MEDICINES: '@aarvita_medicines',
  MEDICINE_LOGS: '@aarvita_logs',
  SETTINGS: '@aarvita_settings',
  ONBOARDING_DONE: '@aarvita_onboarded',
  ACTIVE_MEMBER: '@aarvita_active_member',
};
