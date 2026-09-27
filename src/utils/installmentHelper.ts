// ============================================================
// MoneyReg — Taksitli harcama helper'ı
// Bir harcamayı N taksite böler, küsüratı son taksite ekler.
// ============================================================

import type { Currency } from '../types/models';

// RN Hermes'te crypto.randomUUID bazen yok → fallback
function uuidv4(): string {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 2 ondalıklı yuvarlama (kuruş hatası olmasın)
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ISO tarihe ay ekleme (ayın sonu taşması kırpılır)
function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const targetMonth = base.getUTCMonth() + months;
  const targetYear = base.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const yy = targetYear;
  const mm = String(normalizedMonth + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// ============================================================
// Girdi / Çıktı tipleri
// ============================================================

export type InstallmentInput = {
  title: string;
  totalAmount: number;
  installmentCount: number;
  startDate: string;          // ISO: "2026-09-27"
  categoryId: string | null;
  userId: string;             // created_by
  spaceId: string;
  currency?: Currency;        // default 'TRY'
  exchangeRateSnapshot?: number | null;
  receiptPhotoUrl?: string | null;
};

// transactions tablosuna doğrudan insert edilebilir satır
export type InstallmentRow = {
  space_id: string;
  created_by: string;
  amount: number;
  currency: Currency;
  exchange_rate_snapshot: number | null;
  category_id: string | null;
  note: string;
  expense_date: string;
  receipt_photo_url: string | null;
  installment_group_id: string;
  installment_number: number;
  total_installments: number;
};

// ============================================================
// Ana fonksiyon
// ============================================================

/**
 * Bir harcamayı N taksite böler.
 * Küsürat kuralı: fark SON taksite eklenir.
 *   Örn: 1000 / 3 → [333.33, 333.33, 333.34]
 */
export function splitInstallments(input: InstallmentInput): InstallmentRow[] {
  const {
    title,
    totalAmount,
    installmentCount,
    startDate,
    categoryId,
    userId,
    spaceId,
    currency = 'TRY',
    exchangeRateSnapshot = null,
    receiptPhotoUrl = null,
  } = input;

  if (installmentCount < 1) {
    throw new Error('installmentCount en az 1 olmalı');
  }
  if (totalAmount <= 0) {
    throw new Error('totalAmount pozitif olmalı');
  }

  const groupId = uuidv4();
  const baseAmount = round2(totalAmount / installmentCount);
  const distributed = round2(baseAmount * installmentCount);
  const diff = round2(totalAmount - distributed);

  const rows: InstallmentRow[] = [];

  for (let i = 1; i <= installmentCount; i++) {
    const isLast = i === installmentCount;
    const amount = isLast ? round2(baseAmount + diff) : baseAmount;
    const date = addMonths(startDate, i - 1);

    rows.push({
      space_id: spaceId,
      created_by: userId,
      amount,
      currency,
      exchange_rate_snapshot: exchangeRateSnapshot,
      category_id: categoryId,
      note: `${title} (${i}/${installmentCount})`,
      expense_date: date,
      receipt_photo_url: receiptPhotoUrl,
      installment_group_id: groupId,
      installment_number: i,
      total_installments: installmentCount,
    });
  }

  return rows;
}
