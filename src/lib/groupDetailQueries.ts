// ============================================================
// MoneyReg — Grup Detayı sorguları + bakiye hesaplama
// ============================================================

import { supabase } from './supabase';
import {
  transactionAmountInTRY,
  type Space,
  type Transaction,
} from '../types/models';

// ---------- Tipler ----------

export type MemberInfo = {
  user_id: string;
  display_name: string;
  initial: string;
};

export type TransactionWithPayer = Transaction & {
  payer_display_name: string;
};

export type BalanceEntry = {
  user_id: string;
  display_name: string;
  initial: string;
  paid: number;      // toplam ödediği (TL)
  share: number;     // eşit payına düşen (TL)
  net: number;       // paid - share  → + ise alacaklı, - ise borçlu
};

export type SpaceDetail = {
  space: Space;
  members: MemberInfo[];
  transactions: TransactionWithPayer[];
  totalTRY: number;
  balances: BalanceEntry[];
};

// ---------- Space detayı ----------

export async function getSpaceDetail(spaceId: string): Promise<SpaceDetail | null> {
  const { data: space, error: spaceErr } = await supabase
    .from('spaces')
    .select('*')
    .eq('id', spaceId)
    .single();

  if (spaceErr || !space) {
    // eslint-disable-next-line no-console
    console.warn('getSpaceDetail spaceErr:', spaceErr?.message);
    return null;
  }

  // Üyeler (profiles join)
  const { data: memberRows, error: memErr } = await supabase
    .from('space_members')
    .select(`
      user_id,
      profile:profiles ( display_name )
    `)
    .eq('space_id', spaceId);

  if (memErr) {
    // eslint-disable-next-line no-console
    console.warn('getSpaceDetail memErr:', memErr.message);
  }

  const members: MemberInfo[] = ((memberRows ?? []) as any[]).map((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const name: string = profile?.display_name ?? 'Bilinmeyen';
    return {
      user_id: row.user_id,
      display_name: name,
      initial: name.trim().charAt(0).toLocaleUpperCase('tr-TR'),
    };
  });

  const memberMap = new Map<string, MemberInfo>();
  for (const m of members) memberMap.set(m.user_id, m);

  // Transaction'lar (yeni → eski)
  const { data: txRows, error: txErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('space_id', spaceId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (txErr) {
    // eslint-disable-next-line no-console
    console.warn('getSpaceDetail txErr:', txErr.message);
  }

  const transactions: TransactionWithPayer[] = ((txRows ?? []) as Transaction[]).map((t) => {
    const payer = memberMap.get(t.created_by);
    return {
      ...t,
      payer_display_name: payer?.display_name ?? 'Bilinmeyen',
    };
  });

  // Toplam + bakiye
  let totalTRY = 0;
  const paidMap = new Map<string, number>();
  for (const t of transactions) {
    const tryValue = transactionAmountInTRY(t);
    totalTRY += tryValue;
    paidMap.set(t.created_by, (paidMap.get(t.created_by) ?? 0) + tryValue);
  }

  const memberCount = members.length || 1;
  const share = totalTRY / memberCount;

  const balances: BalanceEntry[] = members.map((m) => {
    const paid = paidMap.get(m.user_id) ?? 0;
    return {
      ...m,
      paid,
      share,
      net: paid - share,
    };
  });

  // Sırala: en çok alacaklıdan en çok borçluya
  balances.sort((a, b) => b.net - a.net);

  return {
    space: space as Space,
    members,
    transactions,
    totalTRY,
    balances,
  };
}

// ---------- Space kapatma ----------

export type CloseSpaceResult =
  | { ok: true }
  | { ok: false; error: string };

export async function closeSpace(spaceId: string): Promise<CloseSpaceResult> {
  const { error } = await supabase
    .from('spaces')
    .update({ status: 'closed' })
    .eq('id', spaceId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
