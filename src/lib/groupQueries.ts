// ============================================================
// MoneyReg — Gruplar (shared spaces) için Supabase sorguları
// ============================================================

import { supabase } from './supabase';
import { transactionAmountInTRY, type Space, type Transaction } from '../types/models';

export type SpaceWithMeta = Space & {
  totalTRY: number;
  memberInitials: string[];
  memberCount: number;
};

export async function getSharedSpacesWithMeta(
  userId: string
): Promise<SpaceWithMeta[]> {
  const { data: memberRows, error: memberErr } = await supabase
    .from('space_members')
    .select(`
      space:spaces (
        id, type, name, status, created_by, created_at
      )
    `)
    .eq('user_id', userId);

  if (memberErr) {
    console.warn('getSharedSpacesWithMeta memberErr:', memberErr.message);
    return [];
  }

  const spaces: Space[] = [];
  for (const row of (memberRows ?? []) as any[]) {
    const s = row.space;
    if (!s) continue;
    if (Array.isArray(s)) {
      for (const item of s) spaces.push(item as Space);
    } else {
      spaces.push(s as Space);
    }
  }

  const shared = spaces.filter((s) => s.type === 'shared');
  if (shared.length === 0) return [];

  const spaceIds = shared.map((s) => s.id);

  const { data: txRows, error: txErr } = await supabase
    .from('transactions')
    .select('id, space_id, amount, currency, exchange_rate_snapshot')
    .in('space_id', spaceIds);

  if (txErr) {
    console.warn('getSharedSpacesWithMeta txErr:', txErr.message);
  }

  const totals = new Map<string, number>();
  for (const t of (txRows ?? []) as Pick<
    Transaction,
    'space_id' | 'amount' | 'currency' | 'exchange_rate_snapshot'
  >[]) {
    const tryValue = transactionAmountInTRY(t);
    totals.set(t.space_id, (totals.get(t.space_id) ?? 0) + tryValue);
  }

  const { data: memRows, error: memErr } = await supabase
    .from('space_members')
    .select(`
      space_id,
      user_id,
      profile:profiles ( display_name )
    `)
    .in('space_id', spaceIds);

  if (memErr) {
    console.warn('getSharedSpacesWithMeta memErr:', memErr.message);
  }

  const membersBySpace = new Map<string, string[]>();
  for (const row of (memRows ?? []) as any[]) {
    const sid: string = row.space_id;
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const name: string | null = profile?.display_name ?? null;
    const initial = name && name.trim().length > 0
      ? name.trim().charAt(0).toLocaleUpperCase('tr-TR')
      : '?';
    const arr = membersBySpace.get(sid) ?? [];
    arr.push(initial);
    membersBySpace.set(sid, arr);
  }

  const result: SpaceWithMeta[] = shared.map((s) => {
    const initials = membersBySpace.get(s.id) ?? [];
    return {
      ...s,
      totalTRY: totals.get(s.id) ?? 0,
      memberInitials: initials,
      memberCount: initials.length,
    };
  });

  result.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });

  return result;
}

export type CreateSpaceResult =
  | { ok: true; space: Space }
  | { ok: false; error: string };

export async function createSharedSpace(
  userId: string,
  name: string
): Promise<CreateSpaceResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: 'Alan adı boş olamaz.' };
  }
  if (trimmed.length > 60) {
    return { ok: false, error: 'Alan adı en fazla 60 karakter olabilir.' };
  }

  // 1) Space oluştur
  const { data: spaceData, error: spaceErr } = await supabase
    .from('spaces')
    .insert({
      type: 'shared',
      name: trimmed,
      status: 'active',
      created_by: userId,
    })
    .select('*')
    .single();

  if (spaceErr || !spaceData) {
    return { ok: false, error: spaceErr?.message ?? 'Alan oluşturulamadı.' };
  }

  // 2) Oluşturanı üye olarak ekle
  const { error: memberErr } = await supabase
    .from('space_members')
    .insert({
      space_id: spaceData.id,
      user_id: userId,
    });

  if (memberErr) {
    // Rollback: space oluştu ama üyelik eklenemedi → space'i sil
    await supabase.from('spaces').delete().eq('id', spaceData.id);
    return { ok: false, error: memberErr.message };
  }

  return { ok: true, space: spaceData as Space };
}

// ============================================================
// DAVET KODU + ÜYE YÖNETİMİ
// ============================================================

export type JoinSpaceResult =
  | { ok: true; space: { id: string; name: string } }
  | { ok: false; error: string };

/**
 * Davet kodu ile space'e katıl (RPC üzerinden).
 */
export async function joinSpaceByCode(code: string): Promise<JoinSpaceResult> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: 'Kod boş olamaz.' };

  const { data, error } = await supabase.rpc('join_space_by_code', {
    code: trimmed,
  });

  if (error) {
    // Postgres exception mesajını döner
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: 'Beklenmeyen bir hata oluştu.' };
  }

  return { ok: true, space: { id: data.id, name: data.name } };
}

// ---------- Üyeler ----------

export type SpaceMemberInfo = {
  user_id: string;
  display_name: string;
  initial: string;
  joined_at: string;
};

/**
 * Bir space'in üyelerini (display_name + joined_at) getirir.
 */
export async function getSpaceMembers(
  spaceId: string
): Promise<SpaceMemberInfo[]> {
  const { data, error } = await supabase
    .from('space_members')
    .select(`
      user_id,
      joined_at,
      profile:profiles ( display_name )
    `)
    .eq('space_id', spaceId)
    .order('joined_at', { ascending: true });

  if (error) {
    console.warn('getSpaceMembers error:', error.message);
    return [];
  }

  const result: SpaceMemberInfo[] = [];
  for (const row of (data ?? []) as any[]) {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const name: string = profile?.display_name ?? 'Bilinmeyen';
    result.push({
      user_id: row.user_id,
      display_name: name,
      initial: name.trim().charAt(0).toLocaleUpperCase('tr-TR'),
      joined_at: row.joined_at,
    });
  }
  return result;
}

// ---------- Üye çıkarma ----------

export type RemoveMemberResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Bir üyeyi space'ten çıkar (sadece owner).
 * Ya da kullanıcı kendi üyeliğini siler (ayrılma).
 */
export async function removeMember(
  spaceId: string,
  userId: string
): Promise<RemoveMemberResult> {
  const { error } = await supabase
    .from('space_members')
    .delete()
    .eq('space_id', spaceId)
    .eq('user_id', userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
