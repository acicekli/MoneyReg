// ============================================================
// MoneyReg — Transaction servis katmanı
// Taksit grubu insert/delete işlemleri.
// ============================================================

import { supabase } from '../lib/supabase';
import type { Transaction } from '../types/models';
import type { InstallmentRow } from '../utils/installmentHelper';

// ============================================================
// Taksit grubu oluşturma (atomik)
// ============================================================

/**
 * Taksit satırlarını toplu olarak transactions tablosuna insert eder.
 * Postgres transaction → ya hepsi başarılı ya hiçbiri.
 */
export async function createInstallmentTransactions(
  rows: InstallmentRow[]
): Promise<{ ok: true; transactions: Transaction[] } | { ok: false; error: string }> {
  if (rows.length === 0) {
    return { ok: false, error: 'En az bir taksit satırı gerekli' };
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert(rows)
    .select('*');

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, transactions: (data ?? []) as Transaction[] };
}

// ============================================================
// Taksit grubunu silme (atomik)
// ============================================================

/**
 * Bir taksit grubunun TÜM satırlarını siler.
 * RLS zaten sadece kullanıcının kendi kayıtlarını silmesine izin verir.
 */
export async function deleteInstallmentGroup(
  groupId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!groupId) {
    return { ok: false, error: 'groupId gerekli' };
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('installment_group_id', groupId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ============================================================
// Taksit grubunu getirme (düzenleme için)
// ============================================================

/**
 * Aynı installment_group_id'ye sahip tüm satırları getirir.
 * Düzenleme modunda mevcut taksitleri yüklemek için kullanılır.
 */
export async function getInstallmentGroup(
  groupId: string
): Promise<{ ok: true; transactions: Transaction[] } | { ok: false; error: string }> {
  if (!groupId) {
    return { ok: false, error: 'groupId gerekli' };
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('installment_group_id', groupId)
    .order('installment_number', { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, transactions: (data ?? []) as Transaction[] };
}
