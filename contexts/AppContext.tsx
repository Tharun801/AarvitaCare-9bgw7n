import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { STORAGE_KEYS } from '@/constants/config';
import { storageGet, storageSet } from '@/services/storageService';
import { getSupabaseClient } from '@/template';
import {
  getFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  initDefaultMember,
  FamilyMember,
} from '@/services/familyService';
import {
  getMedicines,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getMedicineLogs,
  addOrUpdateLog,
  getTodaySchedule,
  calculateAdherence,
  calculateHealthScore,
  Medicine,
  MedicineLog,
} from '@/services/medicineService';
import {
  cancelMedicineReminders,
  cancelAllNotifications,
  rescheduleAllReminders,
} from '@/services/notificationService';

export interface User {
  id: string;
  name: string;
  phone: string;
  isLoggedIn: boolean;
}

export interface AppSettings {
  defaultLanguage: string;
  notificationsEnabled: boolean;
  voiceRemindersEnabled: boolean;
  familyAlertsEnabled: boolean;
  autoCallEnabled: boolean;
  theme: 'light' | 'dark';
}

export interface TodayScheduleItem {
  medicine: Medicine;
  log?: MedicineLog;
  scheduledTime: string;
  status: 'taken' | 'missed' | 'pending' | 'upcoming';
}

export interface AdherenceStats {
  percentage: number;
  streak: number;
  taken: number;
  missed: number;
  healthScore: number;
  weeklyData: Array<{ date: string; taken: number; missed: number }>;
}

interface AppContextType {
  user: User | null;
  supabaseUserId: string | null;
  isLoading: boolean;
  login: (name: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;

  familyMembers: FamilyMember[];
  activeMember: FamilyMember | null;
  setActiveMember: (member: FamilyMember) => void;
  addMember: (data: Omit<FamilyMember, 'id' | 'userId' | 'createdAt' | 'active'>) => Promise<FamilyMember>;
  updateMember: (id: string, data: Partial<FamilyMember>) => Promise<boolean>;
  removeMember: (id: string) => Promise<boolean>;
  refreshFamily: () => Promise<void>;

  medicines: Medicine[];
  todaySchedule: TodayScheduleItem[];
  adherenceStats: AdherenceStats;
  addMed: (data: Omit<Medicine, 'id' | 'createdAt' | 'color' | 'active'>) => Promise<Medicine>;
  updateMed: (id: string, data: Partial<Medicine>) => Promise<boolean>;
  removeMed: (id: string) => Promise<boolean>;
  markMedicine: (medicineId: string, scheduledTime: string, status: 'taken' | 'missed' | 'skipped') => Promise<void>;
  refreshMedicines: () => Promise<void>;

  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_SETTINGS: AppSettings = {
  defaultLanguage: 'en-IN',
  notificationsEnabled: true,
  voiceRemindersEnabled: true,
  familyAlertsEnabled: true,
  autoCallEnabled: false,
  theme: 'light',
};

const EMPTY_STATS: AdherenceStats = {
  percentage: 0, streak: 0, taken: 0, missed: 0, healthScore: 0, weeklyData: [],
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [activeMember, setActiveMemberState] = useState<FamilyMember | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<TodayScheduleItem[]>([]);
  const [adherenceStats, setAdherenceStats] = useState<AdherenceStats>(EMPTY_STATS);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const refreshFamily = useCallback(async () => {
    try {
      const members = await getFamilyMembers();
      setFamilyMembers(members);
      const savedActiveId = await storageGet<string>(STORAGE_KEYS.ACTIVE_MEMBER);
      const active = (savedActiveId ? members.find(m => m.id === savedActiveId) : null) ?? members[0] ?? null;
      setActiveMemberState(active);
    } catch (e) {
      console.error('refreshFamily:', e);
    }
  }, []);

  const refreshMedicines = useCallback(async () => {
    if (!activeMember) return;
    try {
      const meds = await getMedicines(activeMember.id);
      setMedicines(meds);
      const schedule = await getTodaySchedule(activeMember.id);
      setTodaySchedule(schedule);
      const stats = await calculateAdherence(activeMember.id, 7);
      const healthScore = calculateHealthScore(stats.percentage, stats.streak);
      setAdherenceStats({ ...stats, healthScore });
    } catch (e) {
      console.error('refreshMedicines:', e);
    }
  }, [activeMember]);

  // Watch Supabase auth state
  useEffect(() => {
    const sb = getSupabaseClient();
    const init = async () => {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (session?.user) {
          setSupabaseUserId(session.user.id);
          const savedUser = await storageGet<User>(STORAGE_KEYS.USER);
          const savedSettings = await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS);
          if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
          if (savedUser?.isLoggedIn) {
            setUser(savedUser);
            await initDefaultMember(session.user.id);
            await refreshFamily();
          }
        }
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setSupabaseUserId(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setSupabaseUserId(null);
        setFamilyMembers([]);
        setActiveMemberState(null);
        setMedicines([]);
        setTodaySchedule([]);
        setAdherenceStats(EMPTY_STATS);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (activeMember) refreshMedicines();
  }, [activeMember]);

  const setActiveMember = useCallback(async (member: FamilyMember) => {
    setActiveMemberState(member);
    await storageSet(STORAGE_KEYS.ACTIVE_MEMBER, member.id);
  }, []);

  const login = useCallback(async (name: string, phone: string) => {
    const sb = getSupabaseClient();
    const { data: { session } } = await sb.auth.getSession();
    const uid = session?.user?.id;

    const u: User = { id: uid || Date.now().toString(), name, phone, isLoggedIn: true };
    setUser(u);
    await storageSet(STORAGE_KEYS.USER, u);

    if (uid) {
      setSupabaseUserId(uid);
      await initDefaultMember(uid);
    }
    await refreshFamily();
    // After login, reschedule all existing medicines for the active member
    try {
      const members = await getFamilyMembers();
      const firstMember = members[0];
      if (firstMember) {
        const meds = await getMedicines(firstMember.id);
        await rescheduleAllReminders(meds, firstMember.name);
      }
    } catch (e) {
      console.warn('rescheduleAllReminders on login:', e);
    }
  }, [refreshFamily]);

  const logout = useCallback(async () => {
    // Cancel all notifications on sign-out
    await cancelAllNotifications();
    setUser(null);
    await storageSet(STORAGE_KEYS.USER, null);
  }, []);

  const addMember = useCallback(async (data: Omit<FamilyMember, 'id' | 'userId' | 'createdAt' | 'active'>) => {
    const member = await addFamilyMember(data);
    await refreshFamily();
    return member;
  }, [refreshFamily]);

  const updateMember = useCallback(async (id: string, data: Partial<FamilyMember>) => {
    const result = await updateFamilyMember(id, data);
    await refreshFamily();
    return result;
  }, [refreshFamily]);

  const removeMember = useCallback(async (id: string) => {
    const result = await deleteFamilyMember(id);
    await refreshFamily();
    return result;
  }, [refreshFamily]);

  const addMed = useCallback(async (data: Omit<Medicine, 'id' | 'createdAt' | 'color' | 'active'>) => {
    if (!supabaseUserId) throw new Error('Not authenticated');
    const med = await addMedicine(data, supabaseUserId);
    await refreshMedicines();
    return med;
  }, [supabaseUserId, refreshMedicines]);

  const updateMed = useCallback(async (id: string, data: Partial<Medicine>) => {
    const result = await updateMedicine(id, data);
    await refreshMedicines();
    return result;
  }, [refreshMedicines]);

  const removeMed = useCallback(async (id: string) => {
    // Cancel all scheduled notifications for this medicine first
    await cancelMedicineReminders(id);
    const result = await deleteMedicine(id);
    await refreshMedicines();
    return result;
  }, [refreshMedicines]);

  const markMedicine = useCallback(async (
    medicineId: string,
    scheduledTime: string,
    status: 'taken' | 'missed' | 'skipped'
  ) => {
    if (!activeMember || !supabaseUserId) return;
    const today = new Date().toISOString().split('T')[0];
    await addOrUpdateLog(
      {
        medicineId,
        memberId: activeMember.id,
        scheduledTime,
        scheduledDate: today,
        status,
        takenAt: status === 'taken' ? new Date().toISOString() : undefined,
      },
      supabaseUserId
    );

    // Fire missed-dose notifications + voice alert
    if (status === 'missed') {
      const med = medicines.find(m => m.id === medicineId);
      if (med) {
        // Instant missed-dose push notification
        import('@/services/notificationService').then(({ sendMissedDoseAlert, sendFamilyAlert }) => {
          sendMissedDoseAlert({
            memberName: activeMember.name,
            medicineName: med.name,
            dosage: med.dosage,
            scheduledTime,
          }).catch(console.warn);
          // Family caregiver alert if enabled
          const caregivers = familyMembers.filter(m => m.isCaregiver && m.id !== activeMember.id);
          caregivers.forEach(cg =>
            sendFamilyAlert({
              patientName: activeMember.name,
              medicineName: med.name,
              dosage: med.dosage,
              scheduledTime,
              caregiverName: cg.name,
            }).catch(console.warn)
          );
        });
        // Refill alert: if remaining tablets drop to 3 or below
        if (med.remainingTablets !== undefined && med.remainingTablets <= 3) {
          import('@/services/notificationService').then(({ sendRefillAlert }) => {
            sendRefillAlert({ medicineName: med.name, remainingTablets: med.remainingTablets! }).catch(console.warn);
          });
        }
      }
    }

    await refreshMedicines();
  }, [activeMember, supabaseUserId, medicines, familyMembers, refreshMedicines]);

  const updateSettings = useCallback(async (s: Partial<AppSettings>) => {
    const updated = { ...settings, ...s };
    setSettings(updated);
    await storageSet(STORAGE_KEYS.SETTINGS, updated);
  }, [settings]);

  return (
    <AppContext.Provider value={{
      user, supabaseUserId, isLoading, login, logout,
      familyMembers, activeMember, setActiveMember,
      addMember, updateMember, removeMember, refreshFamily,
      medicines, todaySchedule, adherenceStats,
      addMed, updateMed, removeMed, markMedicine, refreshMedicines,
      settings, updateSettings,
    }}>
      {children}
    </AppContext.Provider>
  );
}
