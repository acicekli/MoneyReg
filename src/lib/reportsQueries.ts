// ============================================================
// MoneyReg — Raporlar sorguları
// Haftalık / Aylık / Yıllık
// Aylık periyot kullanıcının month_start_day ayarına göre.
// ============================================================

import { supabase } from './supabase';
import {
  transactionAmountInTRY,
  type Category,
  type Space,
  type Transaction,
} from '../types/models';

export type ReportScope = 'personal' | 'groups' | 'all';
export type ReportPeriod = 'weekly' | 'monthly' | 'yearly';

export type CategoryReportRow = {
  category_id: string | null;
  name: string;
  icon: string;
  total: number;
  percentage: number;
};

export type ReportData = {
  totalTRY: number;
  rows: CategoryReportRow[];
  startDate: string;
  endDate: string;
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getStartOfThisWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getStartOfThisYear(): Date {
  const now = new Date();
  const first = new Date(now.getFullYear(), 0, 1);
  first.setHours(0, 0, 0, 0);
  return first;
}

// Bir ayın efektif başlangıç gününü ver.
// Seçilen gün > ayın son günü ise ay sonuna kırpılır.
// Örnek: day=31, Şubat → 28 (veya 29)
function getEffectiveDay(year: number, month: number, day: number): number {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDayOfMonth);
}

function getStartOfThisMonth(monthStartDay: number): Date {
  const now = new Date();
  const day = now.getDate();

  const thisMonthEffective = getEffectiveDay(
    now.getFullYear(),
    now.getMonth(),
    monthStartDay
  );

  if (day >= thisMonthEffective) {
    const d = new Date(now.getFullYear(), now.getMonth(), thisMonthEffective);
    d.setHours(0, 0, 0, 0);
    return d;
  } else {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEffective = getEffectiveDay(
      prevMonth.getFullYear(),
      prevMonth.getMonth(),
      monthStartDay
    );
    const d = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevEffective);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

export function getPeriodRange(
  period: ReportPeriod,
  monthStartDay: number = 1
): { start: string; end: string } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  let start: Date;
  if (period === 'weekly') start = getStartOfThisWeek();
  else if (period === 'monthly') start = getStartOfThisMonth(monthStartDay);
  else start = getStartOfThisYear();

  return { start: toISODate(start), end: toISODate(end) };
}

async function getSpaceIdsForScope(
  userId: string,
  scope: ReportScope
): Promise<string[]> {
  const { data: memberRows, error } = await supabase
    .from('space_members')
    .select(`space:spaces ( id, type, status, created_by )`)
    .eq('user_id', userId);

  if (error) {
    console.warn('getSpaceIdsForScope error:', error.message);
    return [];
  }

  const spaces: Space[] = [];
  for (const row of (memberRows ?? []) as any[]) {
    const s = row.space;
    if (!s) continue;
    if (Array.isArray(s)) for (const x of s) spaces.push(x as Space);
    else spaces.push(s as Space);
  }

  const ids: string[] = [];
  for (const s of spaces) {
    if (scope === 'personal' && s.type !== 'personal') continue;
    if (scope === 'groups' && s.type !== 'shared') continue;
    ids.push(s.id);
  }
  return ids;
}

async function getMonthStartDay(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('profiles')
    .select('month_start_day')
    .eq('id', userId)
    .single();

  if (error || !data) return 1;
  const v = (data as any).month_start_day;
  if (typeof v === 'number' && v >= 1 && v <= 28) return v;
  return 1;
}

export async function getReportData(
  userId: string,
  scope: ReportScope,
  period: ReportPeriod
): Promise<ReportData> {
  const monthStartDay = period === 'monthly' ? await getMonthStartDay(userId) : 1;
  const { start, end } = getPeriodRange(period, monthStartDay);

  const spaceIds = await getSpaceIdsForScope(userId, scope);
  if (spaceIds.length === 0) {
    return { totalTRY: 0, rows: [], startDate: start, endDate: end };
  }

  let query = supabase
    .from('transactions')
    .select('*')
    .in('space_id', spaceIds)
    .gte('expense_date', start)
    .lte('expense_date', end);

  if (scope !== 'personal') {
    query = query.eq('created_by', userId);
  }

  const { data: txRows, error: txErr } = await query;
  if (txErr) {
    console.warn('getReportData txErr:', txErr.message);
    return { totalTRY: 0, rows: [], startDate: start, endDate: end };
  }

  const transactions = (txRows ?? []) as Transaction[];

  const { data: catRows } = await supabase.from('categories').select('*');
  const categoryMap = new Map<string, Category>();
  for (const c of (catRows ?? []) as Category[]) categoryMap.set(c.id, c);

  const totals = new Map<string, number>();
  let totalTRY = 0;

  for (const t of transactions) {
    const tryValue = transactionAmountInTRY(t);
    totalTRY += tryValue;
    const key = t.category_id ?? '__none__';
    totals.set(key, (totals.get(key) ?? 0) + tryValue);
  }

  const rows: CategoryReportRow[] = [];
  for (const [key, total] of totals.entries()) {
    if (key === '__none__') {
      rows.push({ category_id: null, name: 'Kategorisiz', icon: '📦', total, percentage: 0 });
    } else {
      const cat = categoryMap.get(key);
      rows.push({
        category_id: key,
        name: cat?.name ?? 'Bilinmeyen',
        icon: cat?.icon ?? '📦',
        total,
        percentage: 0,
      });
    }
  }

  rows.sort((a, b) => b.total - a.total);
  for (const r of rows) {
    r.percentage = totalTRY > 0 ? (r.total / totalTRY) * 100 : 0;
  }

  return { totalTRY, rows, startDate: start, endDate: end };
}

export type UpdateMonthStartDayResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateMonthStartDay(
  userId: string,
  day: number
): Promise<UpdateMonthStartDayResult> {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return { ok: false, error: 'Gün 1 ile 31 arasında olmalı.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ month_start_day: day })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getMonthStartDaySetting(userId: string): Promise<number> {
  return getMonthStartDay(userId);
}
