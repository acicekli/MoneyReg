// ============================================================
// MoneyReg — Para birimi formatlama yardımcıları
// Türkçe format: binlik nokta, ondalık virgül
// ============================================================

export type SupportedCurrency = 'TRY' | 'USD' | 'EUR';

const SYMBOLS: Record<SupportedCurrency, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
};

/**
 * Sayıyı Türkçe formatta gösterir: 179810.09 → "179.810,09"
 */
export function formatNumber(value: number): string {
  const safe = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Para birimi ile birlikte formatlar: (179810.09, 'TRY') → "₺179.810,09"
 * Negatif değerlerde eksi işareti başa gelir: (-85, 'TRY') → "-₺85,00"
 */
export function formatCurrency(
  amount: number,
  currency: SupportedCurrency = 'TRY'
): string {
  const safe = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  const symbol = SYMBOLS[currency] ?? '';
  const isNegative = safe < 0;
  const formatted = formatNumber(Math.abs(safe));
  return `${isNegative ? '-' : ''}${symbol}${formatted}`;
}

/**
 * Sadece tutar (sembolsüz) — "179.810,09"
 */
export function formatAmount(amount: number): string {
  return formatNumber(amount);
}

/**
 * Harcama için eksi işaretli format: (85, 'USD') → "-$85,00"
 */
export function formatExpenseAmount(
  amount: number,
  currency: SupportedCurrency = 'TRY'
): string {
  const safe = typeof amount === 'number' && Number.isFinite(amount) ? Math.abs(amount) : 0;
  return `-${formatCurrency(safe, currency)}`;
}

/**
 * Yüzde formatla: 32.5 → "%32"
 */
export function formatPercent(value: number): string {
  const safe = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `%${safe.toFixed(0)}`;
}

/**
 * ISO tarih → "20.09.2026"
 */
export function formatDateTR(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

/**
 * ISO tarih → "20.09" (kısa)
 */
export function formatDateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

/**
 * Canlı input string'ini formatlar: "1234,50" → "1.234,50"
 * amountStr (kullanıcının tuş takımıyla girdiği) için kullanılır.
 */
export function formatAmountString(input: string): string {
  if (!input) return '0';

  // Virgülle ayır
  const [intPartRaw, decPart] = input.split(',');

  // Integer kısmı formatla (binlik nokta)
  const intPart = intPartRaw || '0';
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Ondalık varsa koru
  if (decPart !== undefined) {
    return `${formattedInt},${decPart}`;
  }
  return formattedInt;
}
