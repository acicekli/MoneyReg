// ============================================================
// MoneyReg — Home ekranı için Supabase sorguları
// ============================================================

import { supabase } from './supabase';
import type { Category, Transaction } from '../types/models';

// ---------- Profil ----------

export async function getProfileDisplayName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('getProfileDisplayName error:', error.message);
    return null;
  }
  return data?.display_name ?? null;
}

// ---------- Personal Space ----------

export async function getPersonalSpaceId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('spaces')
    .select('id')
    .eq('created_by', userId)
    .eq('type', 'personal')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('getPersonalSpaceId error:', error.message);
    return null;
  }
  return data?.id ?? null;
}

// ---------- Transactions ----------

/**
 * Belirli bir space için bu ayki tüm transaction'ları getirir.
 * @param monthStart ISO date (YYYY-MM-01) — ayın ilk günü
 */
export async function getMonthlyTransactions(
  spaceId: string,
  monthStart: string
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('space_id', spaceId)
    .gte('expense_date', monthStart)
    .order('expense_date', { ascending: false });

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('getMonthlyTransactions error:', error.message);
    return [];
  }
  return (data ?? []) as Transaction[];
}

/**
 * Son N transaction (expense_date azalan).
 */
export async function getRecentTransactions(
  spaceId: string,
  limit = 7
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('space_id', spaceId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('getRecentTransactions error:', error.message);
    return [];
  }
  return (data ?? []) as Transaction[];
}

// ---------- Categories ----------

/**
 * Varsayılan + kullanıcının kendi kategorilerini getirir.
 * Transaction'ların `category_id`'sini `name`/`icon` ile göstermek için.
 */
export async function getCategories(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .or(`is_default.eq.true,created_by.eq.${userId}`);

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('getCategories error:', error.message);
    return [];
  }
  return (data ?? []) as Category[];
}

// ---------- Yardımcı ----------

/**
 * Bu ayın ilk gününü YYYY-MM-01 formatında döner.
 */
export function getCurrentMonthStart(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/**
 * Transaction listesini, kategori listesini kullanarak map'ler.
 * category_id → Category
 */
export function mapCategoriesById(categories: Category[]): Map<string, Category> {
  const map = new Map<string, Category>();
  for (const c of categories) map.set(c.id, c);
  return map;
}

// ============================================================
// "Tüm Harcamalar" modalı için filtreli sorgular
// ============================================================

import { getUserSpaces } from './transactionQueries';

export type TransactionScope = 'personal' | 'groups' | 'all';
export type TransactionPeriod = '1m' | '3m' | '1y' | 'all';

/**
 * Belirli bir scope + period için harcamaları getirir.
 * @param userId
 * @param scope 'personal' | 'groups' | 'all'
 * @param period '1m' | '3m' | '1y' | 'all'
 * @param spaceIdBelirli bir space'e kısıtlamak için (GroupDetail modalından)
 */
export async function getFilteredTransactions(
  userId: string,
  scope: TransactionScope,
  period: TransactionPeriod,
  spaceId?: string,
  createdByUserIds?: string[]
): Promise<Transaction[]> {
  // 1) Hangi space'ler?
  let spaceIds: string[] = [];

  if (spaceId) {
    // Belirli bir space (grup detay modalı)
    spaceIds = [spaceId];
  } else {
    // Kapsam filtresi
    const allSpaces = await getUserSpaces(userId);

    if (scope === 'personal') {
      spaceIds = allSpaces.filter((s) => s.type === 'personal').map((s) => s.id);
    } else if (scope === 'groups') {
      spaceIds = allSpaces.filter((s) => s.type === 'shared').map((s) => s.id);
    } else {
      spaceIds = allSpaces.map((s) => s.id);
    }
  }

  if (spaceIds.length === 0) return [];

  // 2) Tarih filtresi
  let cutoffDate: string | null = null;
  const now = new Date();
  if (period === '1m') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    cutoffDate = d.toISOString().slice(0, 10);
  } else if (period === '3m') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    cutoffDate = d.toISOString().slice(0, 10);
  } else if (period === '1y') {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 1);
    cutoffDate = d.toISOString().slice(0, 10);
  }
  // 'all' → cutoffDate = null

  // 3) Sorgu
  let query = supabase
    .from('transactions')
    .select('*')
    .in('space_id', spaceIds)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (cutoffDate) {
    query = query.gte('expense_date', cutoffDate);
  }

  // Kişi filtresi (çoklu)
  if (createdByUserIds && createdByUserIds.length > 0) {
    query = query.in('created_by', createdByUserIds);
  }

  // Scope 'groups' veya belirli bir shared space'te → sadece kendi ödediklerim
  // Ama personal space'te de hepsi benim
  // Şimdilik hepsini göster (kullanıcı kendi space'lerindeki her şeyi görebilir)
  // Not: shared space'lerde başkalarının harcamaları da görünür — bu istenirse
  // ek filtre eklenebilir.

  const { data, error } = await query;

  if (error) {
    console.warn('getFilteredTransactions error:', error.message);
    return [];
  }

  return (data ?? []) as Transaction[];
}
