import { supabase } from './supabase';
import {
  transactionAmountInTRY,
  type Category,
  type Space,
  type Transaction,
} from '../types/models';

// ---------- Tipler ----------

export type CategorySummary = {
  category_id: string | null;
  name: string;
  icon: string;
  total: number;
};

export type PersonReport = {
  user_id: string;
  display_name: string;
  initial: string;
  totalTRY: number;
  topCategories: CategorySummary[];
  othersCount: number;
};

export type ClosingReportData = {
  space: Space;
  totalTRY: number;
  people: PersonReport[];
};

export type PersonDetailData = {
  space: Space;
  person: {
    user_id: string;
    display_name: string;
    initial: string;
  };
  totalTRY: number;
  categoryBreakdown: CategorySummary[];
  transactions: (Transaction & {
    category_name?: string | null;
    category_icon?: string | null;
  })[];
};

// ---------- Yardımcılar ----------

function pickCategoryName(c: Category | undefined): { name: string; icon: string } {
  if (!c) return { name: 'Kategorisiz', icon: '📦' };
  return { name: c.name, icon: c.icon ?? '📦' };
}

function buildCategoryMap(categories: Category[]): Map<string, Category> {
  const m = new Map<string, Category>();
  for (const c of categories) m.set(c.id, c);
  return m;
}

function aggregateByCategory(
  transactions: Transaction[],
  categoryMap: Map<string, Category>
): CategorySummary[] {
  const totals = new Map<string, number>();

  for (const t of transactions) {
    const key = t.category_id ?? '__none__';
    const tryValue = transactionAmountInTRY(t);
    totals.set(key, (totals.get(key) ?? 0) + tryValue);
  }

  const result: CategorySummary[] = [];
  for (const [key, total] of totals.entries()) {
    if (key === '__none__') {
      result.push({ category_id: null, name: 'Kategorisiz', icon: '📦', total });
    } else {
      const cat = categoryMap.get(key);
      const { name, icon } = pickCategoryName(cat);
      result.push({ category_id: key, name, icon, total });
    }
  }
  result.sort((a, b) => b.total - a.total);
  return result;
}

async function fetchSpaceAndData(spaceId: string) {
  const { data: space, error: spaceErr } = await supabase
    .from('spaces')
    .select('*')
    .eq('id', spaceId)
    .single();

  if (spaceErr || !space) return null;

  const { data: memberRows } = await supabase
    .from('space_members')
    .select(`
      user_id,
      profile:profiles ( display_name )
    `)
    .eq('space_id', spaceId);

  const members: { user_id: string; display_name: string; initial: string }[] = [];
  for (const row of (memberRows ?? []) as any[]) {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const name: string = profile?.display_name ?? 'Bilinmeyen';
    members.push({
      user_id: row.user_id,
      display_name: name,
      initial: name.trim().charAt(0).toLocaleUpperCase('tr-TR'),
    });
  }

  const { data: txRows } = await supabase
    .from('transactions')
    .select('*')
    .eq('space_id', spaceId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  const transactions = (txRows ?? []) as Transaction[];

  const { data: catRows } = await supabase
    .from('categories')
    .select('*');

  const categories = (catRows ?? []) as Category[];
  const categoryMap = buildCategoryMap(categories);

  return { space: space as Space, members, transactions, categoryMap };
}

// ---------- Kapanış Raporu ----------

export async function getClosingReportData(
  spaceId: string
): Promise<ClosingReportData | null> {
  const data = await fetchSpaceAndData(spaceId);
  if (!data) return null;

  const { space, members, transactions, categoryMap } = data;

  let totalTRY = 0;
  const byPerson = new Map<string, Transaction[]>();
  for (const m of members) byPerson.set(m.user_id, []);
  for (const t of transactions) {
    const tryValue = transactionAmountInTRY(t);
    totalTRY += tryValue;
    const arr = byPerson.get(t.created_by);
    if (arr) arr.push(t);
  }

  const people: PersonReport[] = members.map((m) => {
    const txs = byPerson.get(m.user_id) ?? [];
    const personTotal = txs.reduce((s, t) => s + transactionAmountInTRY(t), 0);
    const allCats = aggregateByCategory(txs, categoryMap);
    const top = allCats.slice(0, 2);
    const othersCount = Math.max(0, allCats.length - 2);
    return {
      user_id: m.user_id,
      display_name: m.display_name,
      initial: m.initial,
      totalTRY: personTotal,
      topCategories: top,
      othersCount,
    };
  });

  people.sort((a, b) => b.totalTRY - a.totalTRY);

  return { space, totalTRY, people };
}

// ---------- Kişi Detayı ----------

export async function getPersonDetailData(
  spaceId: string,
  userId: string
): Promise<PersonDetailData | null> {
  const data = await fetchSpaceAndData(spaceId);
  if (!data) return null;

  const { space, members, transactions, categoryMap } = data;

  const person = members.find((m) => m.user_id === userId);
  if (!person) return null;

  const personTxs = transactions.filter((t) => t.created_by === userId);

  const totalTRY = personTxs.reduce((s, t) => s + transactionAmountInTRY(t), 0);

  const categoryBreakdown = aggregateByCategory(personTxs, categoryMap);

  const enriched = personTxs.map((t) => {
    const cat = t.category_id ? categoryMap.get(t.category_id) : undefined;
    return {
      ...t,
      category_name: cat?.name ?? (t.category_id ? null : 'Kategorisiz'),
      category_icon: cat?.icon ?? (t.category_id ? null : '📦'),
    };
  });

  return {
    space,
    person,
    totalTRY,
    categoryBreakdown,
    transactions: enriched,
  };
}
