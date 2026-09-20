// ============================================================
// MoneyReg — Domain Types
// Context 2 veri modeli
// ============================================================

// ---------- ENUM'lar ----------
export type SpaceType = 'personal' | 'shared';
export type SpaceStatus = 'active' | 'closed';
export type Currency = 'TRY' | 'USD' | 'EUR';

// ---------- Profiles ----------
export interface Profile {
  id: string;
  display_name: string | null;
  default_currency: string;
  month_start_day: number;   // 1-28 arası, aylık raporun başlangıç günü
  created_at: string;
}

// ---------- Spaces ----------
export interface Space {
  id: string;
  type: SpaceType;
  name: string;
  status: SpaceStatus;
  created_by: string;
  invite_code: string;
  created_at: string;
}

// ---------- Space Members ----------
export interface SpaceMember {
  space_id: string;
  user_id: string;
  joined_at: string;
}

// ---------- Categories ----------
export interface Category {
  id: string;
  name: string;
  icon: string | null;
  is_default: boolean;
  created_by: string | null;
}

// ---------- Transactions ----------
export interface Transaction {
  id: string;
  space_id: string;
  created_by: string;
  amount: number;
  currency: Currency;
  exchange_rate_snapshot: number | null;
  category_id: string | null;
  note: string | null;
  expense_date: string;   // ISO date: "2026-09-17"
  receipt_photo_url: string | null;
  created_at: string;
}

// ============================================================
// Yardımcı tipler
// ============================================================

// Transaction formu için (oluşturma)
export interface NewTransactionInput {
  space_id: string;
  amount: number;
  currency: Currency;
  exchange_rate_snapshot?: number | null;
  category_id?: string | null;
  note?: string | null;
  expense_date?: string;         // ISO date, verilmezse bugün
  receipt_photo_url?: string | null;
}

// TL karşılığı hesaplama kuralı:
//   currency === 'TRY' → amount
//   currency !== 'TRY' → amount * exchange_rate_snapshot
export function transactionAmountInTRY(t: Pick<Transaction, 'amount' | 'currency' | 'exchange_rate_snapshot'>): number {
  if (t.currency === 'TRY') return t.amount;
  if (t.exchange_rate_snapshot == null) return 0; // güvenlik
  return t.amount * t.exchange_rate_snapshot;
}
