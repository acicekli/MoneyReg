// ============================================================
// MoneyReg — Home ekranı + AllTransactions için Supabase sorguları
// ============================================================

import { supabase } from './supabase';
import { getUserSpaces } from './transactionQueries';
import type { Category, Transaction } from '../types/models';

// ---------- Profil ----------

export async function getProfileDisplayName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single();

  if (error) {
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
    console.warn('getPersonalSpaceId error:', error.message);
    return null;
  }
  return data?.id ?? null;
}

// ---------- Transactions (Home için) ----------

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
    console.warn('getMonthlyTransactions error:', error.message);
    return [];
  }
  return (data ?? []) as Transaction[];
}

export async function getRecentTransactions(
  spaceId: string,
  limit = 15
): Promise<Transaction[]> {
  // Taksitleri tekleştirmek için son 100 kaydı çekip JS'te filtreleyeceğiz.
  // (Veritabanında RPC yazana kadar en pratik yöntem)
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('space_id', spaceId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('getRecentTransactions error:', error.message);
    return [];
  }

  const raw = (data ?? []) as Transaction[];
  const seenGroups = new Set<string>();
  const filtered: Transaction[] = [];

  for (const tx of raw) {
    // Eğer bir taksit grubuna aitse, sadece grubun İLK karşılaşılan (en yeni) 
    // taksitini listeye ekle, diğerlerini atla.
    if (tx.installment_group_id) {
      if (seenGroups.has(tx.installment_group_id)) continue;
      seenGroups.add(tx.installment_group_id);
    }
    filtered.push(tx);
    if (filtered.length >= limit) break;
  }

  return filtered;
}

// ---------- AllTransactions için: filtresiz TÜM harcamalar ----------

export async function getAllTransactions(
  userId: string
): Promise<Transaction[]> {
  const allSpaces = await getUserSpaces(userId);
  const spaceIds = allSpaces.map((s) => s.id);

  if (spaceIds.length === 0) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .in('space_id', spaceIds)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('getAllTransactions error:', error.message);
    return [];
  }

  return (data ?? []) as Transaction[];
}

// ---------- Categories ----------

export async function getCategories(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .or(`is_default.eq.true,created_by.eq.${userId}`);

  if (error) {
    console.warn('getCategories error:', error.message);
    return [];
  }
  return (data ?? []) as Category[];
}

// ---------- Yardımcılar ----------

export function getCurrentMonthStart(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function mapCategoriesById(categories: Category[]): Map<string, Category> {
  const map = new Map<string, Category>();
  for (const c of categories) map.set(c.id, c);
  return map;
}

// ============================================================
// AllTransactions ekranı için tip tanımları (client-side filtre)
// ============================================================

export type TransactionScope = 'personal' | 'groups' | 'all';
export type TransactionPeriod = '1m' | '3m' | '1y' | 'all';
