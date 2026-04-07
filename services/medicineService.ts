import { getSupabaseClient } from '@/template';

export interface Medicine {
  id: string;
  memberId: string;
  name: string;
  dosage: string;
  type: string;
  frequency: string;
  times: string[];
  duration: number; // -1 = ongoing
  startDate: string;
  endDate?: string;
  totalTablets?: number;
  remainingTablets?: number;
  instructions?: string;
  color: string;
  active: boolean;
  createdAt: string;
}

export interface MedicineLog {
  id: string;
  medicineId: string;
  memberId: string;
  scheduledTime: string;
  scheduledDate: string;
  status: 'taken' | 'missed' | 'pending' | 'skipped';
  takenAt?: string;
  note?: string;
}

const MEDICINE_COLORS = [
  '#0D9B76', '#3B82F6', '#8B5CF6', '#F97316',
  '#EF4444', '#EAB308', '#EC4899', '#14B8A6',
];

function randomColor(): string {
  return MEDICINE_COLORS[Math.floor(Math.random() * MEDICINE_COLORS.length)];
}

function medicineFromRow(row: any): Medicine {
  return {
    id: row.id,
    memberId: row.member_id,
    name: row.name,
    dosage: row.dosage,
    type: row.type,
    frequency: row.frequency,
    times: row.times || [],
    duration: row.duration,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    totalTablets: row.total_tablets ?? undefined,
    remainingTablets: row.remaining_tablets ?? undefined,
    instructions: row.instructions ?? undefined,
    color: row.color,
    active: row.active,
    createdAt: row.created_at,
  };
}

function logFromRow(row: any): MedicineLog {
  return {
    id: row.id,
    medicineId: row.medicine_id,
    memberId: row.member_id,
    scheduledTime: row.scheduled_time,
    scheduledDate: row.scheduled_date,
    status: row.status,
    takenAt: row.taken_at ?? undefined,
    note: row.note ?? undefined,
  };
}

export async function getMedicines(memberId?: string): Promise<Medicine[]> {
  const sb = getSupabaseClient();
  let query = sb.from('medicines').select('*').eq('active', true);
  if (memberId) query = query.eq('member_id', memberId);
  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) { console.error('getMedicines:', error); return []; }
  return (data || []).map(medicineFromRow);
}

export async function getAllMedicines(): Promise<Medicine[]> {
  return getMedicines();
}

export async function addMedicine(
  data: Omit<Medicine, 'id' | 'createdAt' | 'color' | 'active'>,
  userId: string
): Promise<Medicine> {
  const sb = getSupabaseClient();
  const { data: row, error } = await sb
    .from('medicines')
    .insert({
      user_id: userId,
      member_id: data.memberId,
      name: data.name,
      dosage: data.dosage,
      type: data.type,
      frequency: data.frequency,
      times: data.times,
      duration: data.duration,
      start_date: data.startDate,
      end_date: data.endDate ?? null,
      total_tablets: data.totalTablets ?? null,
      remaining_tablets: data.remainingTablets ?? null,
      instructions: data.instructions ?? null,
      color: randomColor(),
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return medicineFromRow(row);
}

export async function updateMedicine(id: string, data: Partial<Medicine>): Promise<boolean> {
  const sb = getSupabaseClient();
  const update: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) update.name = data.name;
  if (data.dosage !== undefined) update.dosage = data.dosage;
  if (data.type !== undefined) update.type = data.type;
  if (data.frequency !== undefined) update.frequency = data.frequency;
  if (data.times !== undefined) update.times = data.times;
  if (data.duration !== undefined) update.duration = data.duration;
  if (data.startDate !== undefined) update.start_date = data.startDate;
  if (data.endDate !== undefined) update.end_date = data.endDate;
  if (data.totalTablets !== undefined) update.total_tablets = data.totalTablets;
  if (data.remainingTablets !== undefined) update.remaining_tablets = data.remainingTablets;
  if (data.instructions !== undefined) update.instructions = data.instructions;
  if (data.active !== undefined) update.active = data.active;

  const { error } = await sb.from('medicines').update(update).eq('id', id);
  if (error) { console.error('updateMedicine:', error); return false; }
  return true;
}

export async function deleteMedicine(id: string): Promise<boolean> {
  return updateMedicine(id, { active: false });
}

export async function getMedicineLogs(memberId?: string, days = 7): Promise<MedicineLog[]> {
  const sb = getSupabaseClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  let query = sb
    .from('medicine_logs')
    .select('*')
    .gte('scheduled_date', cutoffStr);
  if (memberId) query = query.eq('member_id', memberId);
  const { data, error } = await query.order('scheduled_date', { ascending: false });
  if (error) { console.error('getMedicineLogs:', error); return []; }
  return (data || []).map(logFromRow);
}

export async function addOrUpdateLog(
  log: Omit<MedicineLog, 'id'> & { id?: string },
  userId: string
): Promise<MedicineLog> {
  const sb = getSupabaseClient();
  const { data: row, error } = await sb
    .from('medicine_logs')
    .upsert(
      {
        user_id: userId,
        medicine_id: log.medicineId,
        member_id: log.memberId,
        scheduled_time: log.scheduledTime,
        scheduled_date: log.scheduledDate,
        status: log.status,
        taken_at: log.takenAt ?? null,
        note: log.note ?? null,
      },
      { onConflict: 'medicine_id,scheduled_date,scheduled_time' }
    )
    .select()
    .single();
  if (error) throw error;
  return logFromRow(row);
}

export async function getTodaySchedule(memberId: string): Promise<Array<{
  medicine: Medicine;
  log?: MedicineLog;
  scheduledTime: string;
  status: 'taken' | 'missed' | 'pending' | 'upcoming';
}>> {
  const medicines = await getMedicines(memberId);
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const logs = await getMedicineLogs(memberId, 1);

  const schedule: Array<{
    medicine: Medicine;
    log?: MedicineLog;
    scheduledTime: string;
    status: 'taken' | 'missed' | 'pending' | 'upcoming';
  }> = [];

  for (const medicine of medicines) {
    for (const time of medicine.times) {
      const log = logs.find(
        l => l.medicineId === medicine.id && l.scheduledDate === today && l.scheduledTime === time
      );
      const [h, m] = time.split(':').map(Number);
      const scheduled = new Date();
      scheduled.setHours(h, m, 0, 0);

      let status: 'taken' | 'missed' | 'pending' | 'upcoming';
      if (log?.status === 'taken') status = 'taken';
      else if (log?.status === 'missed') status = 'missed';
      else if (scheduled < now) status = 'missed';
      else status = 'upcoming';

      schedule.push({ medicine, log, scheduledTime: time, status });
    }
  }
  schedule.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  return schedule;
}

export async function calculateAdherence(memberId: string, days = 7): Promise<{
  percentage: number;
  streak: number;
  taken: number;
  missed: number;
  weeklyData: Array<{ date: string; taken: number; missed: number }>;
}> {
  const logs = await getMedicineLogs(memberId, Math.max(days, 30));
  const today = new Date();

  const taken = logs.filter(l => l.status === 'taken').length;
  const missed = logs.filter(l => l.status === 'missed').length;
  const total = taken + missed;
  const percentage = total > 0 ? Math.round((taken / total) * 100) : 0;

  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLogs = logs.filter(l => l.scheduledDate === dateStr);
    if (dayLogs.length === 0 && i > 0) break;
    const dayMissed = dayLogs.some(l => l.status === 'missed');
    if (!dayMissed && dayLogs.length > 0) streak++;
    else if (dayMissed) break;
  }

  const weeklyData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayLogs = logs.filter(l => l.scheduledDate === dateStr);
    weeklyData.push({
      date: dateStr,
      taken: dayLogs.filter(l => l.status === 'taken').length,
      missed: dayLogs.filter(l => l.status === 'missed').length,
    });
  }

  return { percentage, streak, taken, missed, weeklyData };
}

export function calculateHealthScore(adherence: number, streak: number): number {
  const base = adherence * 0.7;
  const streakBonus = Math.min(streak * 2, 30);
  return Math.min(Math.round(base + streakBonus), 100);
}
