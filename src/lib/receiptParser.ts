// ============================================================
// MoneyReg — Fiş okuma (parse-receipt Edge Function çağrısı)
// ============================================================

import Constants from 'expo-constants';
import type { Category } from '../types/models';

export type ParseReceiptResult = {
  amount: number | null;
  category_id: string | null;
  date: string | null;
  confidence: 'high' | 'low';
};

function getFunctionUrl(): string {
  const supabaseUrl =
    Constants.expoConfig?.extra?.supabaseUrl ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    '';
  if (!supabaseUrl) throw new Error('Supabase URL tanımlı değil.');
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/parse-receipt`;
}

function getAnonKey(): string {
  return (
    Constants.expoConfig?.extra?.supabaseAnonKey ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    ''
  );
}

/**
 * Yerel URI'deki fiş fotoğrafını Edge Function'a gönderip
 * tutar/kategori/tarih çıkarır.
 */
export async function parseReceipt(
  localUri: string,
  categories: Category[]
): Promise<ParseReceiptResult> {
  const empty: ParseReceiptResult = {
    amount: null,
    category_id: null,
    date: null,
    confidence: 'low',
  };

  try {
    // 1) Yerel dosyayı base64'e çevir
    const res = await fetch(localUri);
    const blob = await res.blob();

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const b64 = dataUrl.split(',')[1] ?? '';
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    if (!base64) return empty;

    // 2) Edge Function'a gönder
    const fnUrl = getFunctionUrl();
    const anonKey = getAnonKey();

    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({
        image_base64: base64,
        mime_type: blob.type || 'image/jpeg',
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
        })),
      }),
    });

    if (!response.ok) {
      // sessizce boş dön
      return empty;
    }

    const data = await response.json();

    return {
      amount: typeof data.amount === 'number' ? data.amount : null,
      category_id: typeof data.category_id === 'string' ? data.category_id : null,
      date: typeof data.date === 'string' ? data.date : null,
      confidence: data.confidence === 'high' ? 'high' : 'low',
    };
  } catch {
    return empty;
  }
}
