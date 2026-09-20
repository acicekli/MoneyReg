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
