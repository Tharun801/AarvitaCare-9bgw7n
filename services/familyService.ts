import { getSupabaseClient } from '@/template';

export interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  role: string;
  age?: number;
  phone?: string;
  emergencyContact?: string;
  language: string;
  voiceGender: 'male' | 'female';
  avatar?: string;
  isCaregiver: boolean;
  active: boolean;
  createdAt: string;
}

// Map DB row → app type
function fromRow(row: any): FamilyMember {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    role: row.role,
    age: row.age ?? undefined,
    phone: row.phone ?? undefined,
    emergencyContact: row.emergency_contact ?? undefined,
    language: row.language,
    voiceGender: row.voice_gender as 'male' | 'female',
    isCaregiver: row.is_caregiver,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function getFamilyMembers(): Promise<FamilyMember[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('family_members')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true });
  if (error) { console.error('getFamilyMembers:', error); return []; }
  return (data || []).map(fromRow);
}

export async function addFamilyMember(
  data: Omit<FamilyMember, 'id' | 'userId' | 'createdAt' | 'active'>
): Promise<FamilyMember> {
  const sb = getSupabaseClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: row, error } = await sb
    .from('family_members')
    .insert({
      user_id: user.id,
      name: data.name,
      role: data.role,
      age: data.age ?? null,
      phone: data.phone ?? null,
      emergency_contact: data.emergencyContact ?? null,
      language: data.language,
      voice_gender: data.voiceGender,
      is_caregiver: data.isCaregiver,
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(row);
}

export async function updateFamilyMember(id: string, data: Partial<FamilyMember>): Promise<boolean> {
  const sb = getSupabaseClient();
  const update: any = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) update.name = data.name;
  if (data.role !== undefined) update.role = data.role;
  if (data.age !== undefined) update.age = data.age;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.emergencyContact !== undefined) update.emergency_contact = data.emergencyContact;
  if (data.language !== undefined) update.language = data.language;
  if (data.voiceGender !== undefined) update.voice_gender = data.voiceGender;
  if (data.isCaregiver !== undefined) update.is_caregiver = data.isCaregiver;
  if (data.active !== undefined) update.active = data.active;

  const { error } = await sb.from('family_members').update(update).eq('id', id);
  if (error) { console.error('updateFamilyMember:', error); return false; }
  return true;
}

export async function deleteFamilyMember(id: string): Promise<boolean> {
  return updateFamilyMember(id, { active: false });
}

export async function initDefaultMember(userId: string): Promise<FamilyMember> {
  const existing = await getFamilyMembers();
  if (existing.length > 0) return existing[0];
  return addFamilyMember({
    name: 'You (Self)',
    role: 'self',
    language: 'en-IN',
    voiceGender: 'female',
    isCaregiver: false,
  });
}

export function getMemberRoleColor(role: string): string {
  const roleColors: Record<string, string> = {
    self: '#0D9B76',
    father: '#1A2F4E',
    mother: '#E91E8C',
    child: '#F97316',
    grandfather: '#8B5CF6',
    grandmother: '#EC4899',
    spouse: '#3B82F6',
    sibling: '#14B8A6',
    other: '#6B7280',
  };
  return roleColors[role] || '#6B7280';
}

export function getMemberInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
