// ============================================================
// MoneyReg — Transaction işlemleri + Space/Kategori sorguları
// ============================================================

import { supabase } from './supabase';
import type {
  Category,
  Currency,
  NewTransactionInput,
  Space,
  Transaction,
} from '../types/models';

// ---------- Spaces ----------

/**
 * Kullanıcının üye olduğu TÜM space'leri getirir (personal + shared).
 * space_members tablosu üzerinden join.
 */
export async function getUserSpaces(userId: string): Promise<Space[]> {
  const { data, error } = await supabase
    .from('space_members')
    .select(`
      space:spaces (
        id, type, name, status, created_by, created_at
      )
    `)
    .eq('user_id', userId);

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('getUserSpaces error:', error.message);
    return [];
  }

  // Supabase nested select bazen array döner, bazen obje — normalize edelim
  const spaces: Space[] = [];
  for (const row of (data ?? []) as any[]) {
    const s = row.space;
    if (!s) continue;
    if (Array.isArray(s)) {
      for (const item of s) spaces.push(item as Space);
    } else {
      spaces.push(s as Space);
    }
  }

  // Aktif olanları filtrele, personal'ı başa al
  return spaces
    .filter((s) => s.status === 'active')
    .sort((a, b) => {
      if (a.type === 'personal' && b.type !== 'personal') return -1;
      if (a.type !== 'personal' && b.type === 'personal') return 1;
      return a.name.localeCompare(b.name);
    });
}

// ---------- Categories ----------

/**
 * Varsayılan (is_default=true) + kullanıcının kendi kategorileri.
 */
export async function getAvailableCategories(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .or(`is_default.eq.true,created_by.eq.${userId}`)
    .order('is_default', { ascending: false })
    .order('name');

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('getAvailableCategories error:', error.message);
    return [];
  }
  return (data ?? []) as Category[];
}

// ---------- Transactions ----------

export type CreateTransactionResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; error: string };

/**
 * Yeni harcama kaydı.
 * exchange_rate_snapshot zaten çağıran tarafından hesaplanıp verilir.
 */
export async function createTransaction(
  userId: string,
  input: NewTransactionInput
): Promise<CreateTransactionResult> {
  // Basit doğrulama
  if (!input.amount || input.amount <= 0) {
    return { ok: false, error: 'Tutar 0’dan büyük olmalı.' };
  }
  if (!input.space_id) {
    return { ok: false, error: 'Alan seçilmedi.' };
  }
  if (!input.category_id) {
    return { ok: false, error: 'Kategori seçilmedi.' };
  }
  if (input.currency !== 'TRY') {
    if (
      input.exchange_rate_snapshot == null ||
      !Number.isFinite(input.exchange_rate_snapshot) ||
      input.exchange_rate_snapshot <= 0
    ) {
      return { ok: false, error: 'Kur bilgisi geçersiz.' };
    }
  }

  const payload = {
    space_id: input.space_id,
    created_by: userId,
    amount: input.amount,
    currency: input.currency as Currency,
    exchange_rate_snapshot:
      input.currency === 'TRY' ? null : input.exchange_rate_snapshot,
    category_id: input.category_id,
    note: input.note ?? null,
    expense_date: input.expense_date ?? new Date().toISOString().slice(0, 10),
    receipt_photo_url: input.receipt_photo_url ?? null,
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, transaction: data as Transaction };
}

// ============================================================
// TRANSACTION DÜZENLEME + SİLME
// ============================================================

import { deleteReceipt } from './receiptsStorage';

/**
 * Bir transaction'ı ID ile getir (düzenleme için).
 */
export async function getTransactionById(
  userId: string,
  transactionId: string
): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('created_by', userId)
    .single();

  if (error || !data) {
    console.warn('getTransactionById error:', error?.message);
    return null;
  }
  return data as Transaction;
}

export type UpdateTransactionResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; error: string };

/**
 * Transaction'ı güncelle.
 * - Sadece kendi transaction'ını güncelleyebilir.
 * - receipt_photo_url değişebilir (yeni fiş yüklendiyse).
 */
export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: NewTransactionInput
): Promise<UpdateTransactionResult> {
  if (!input.amount || input.amount <= 0) {
    return { ok: false, error: 'Tutar 0’dan büyük olmalı.' };
  }
  if (!input.category_id) {
    return { ok: false, error: 'Kategori seçilmedi.' };
  }
  if (!input.space_id) {
    return { ok: false, error: 'Alan seçilmedi.' };
  }

  const payload = {
    space_id: input.space_id,
    amount: input.amount,
    currency: input.currency as Currency,
    exchange_rate_snapshot:
      input.currency === 'TRY' ? null : input.exchange_rate_snapshot,
    category_id: input.category_id,
    note: input.note ?? null,
    expense_date: input.expense_date ?? new Date().toISOString().slice(0, 10),
    receipt_photo_url: input.receipt_photo_url ?? null,
  };

  const { data, error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', transactionId)
    .eq('created_by', userId)
    .select('*')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Güncellenemedi.' };
  }

  return { ok: true, transaction: data as Transaction };
}

export type DeleteTransactionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Transaction'ı sil.
 * - Sadece kendi transaction'ını silebilir.
 * - Fiş fotoğrafı varsa Storage'dan da siler.
 */
export async function deleteTransaction(
  userId: string,
  transactionId: string
): Promise<DeleteTransactionResult> {
  // 1) Önce transaction'ı çek (fiş path'i için)
  const { data: existing } = await supabase
    .from('transactions')
    .select('id, created_by, receipt_photo_url')
    .eq('id', transactionId)
    .eq('created_by', userId)
    .single();

  if (!existing) {
    return { ok: false, error: 'Kayıt bulunamadı veya yetkiniz yok.' };
  }

  // 2) Fiş varsa Storage'dan sil
  if (existing.receipt_photo_url) {
    try {
      await deleteReceipt(existing.receipt_photo_url);
    } catch {
      // Storage silme başarısız olsa bile transaction silinsin
    }
  }

  // 3) Transaction'ı sil
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('created_by', userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
