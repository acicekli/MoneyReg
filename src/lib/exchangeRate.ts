import Constants from 'expo-constants';

export type CurrencyCode = 'USD' | 'EUR';

export type RateResponse = {
  date: string;         // istenen tarih (YYYY-MM-DD)
  usd_try: number;
  eur_try: number;
  source_date: string;  // fiilen kullanılan iş günü
};

// --- Supabase Edge Function URL'i ---
// Supabase URL'i zaten .env'de (EXPO_PUBLIC_SUPABASE_URL) var.
// Edge Function yolu: /functions/v1/get-exchange-rate

function getFunctionUrl(): string {
  const supabaseUrl =
    Constants.expoConfig?.extra?.supabaseUrl ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    '';

  if (!supabaseUrl) {
    throw new Error('Supabase URL tanımlı değil (.env kontrol et).');
  }

  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/get-exchange-rate`;
}

function getAnonKey(): string {
  return (
    Constants.expoConfig?.extra?.supabaseAnonKey ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    ''
  );
}

// --- Ortak çağrı ---
// Tüm kur çağrıları burada toplanıyor — mantık tekrarı yok.

async function fetchRates(date: string): Promise<RateResponse> {
  const url = `${getFunctionUrl()}?date=${encodeURIComponent(date)}`;
  const anonKey = getAnonKey();

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      },
    });
  } catch (networkErr) {
    throw new Error('Kur bilgisi alınamadı: ağ hatası. Tekrar dene.');
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error ?? '';
    } catch {
      // ignore
    }
    throw new Error(
      `Kur bilgisi alınamadı (HTTP ${res.status})${detail ? `: ${detail}` : ''}`
    );
  }

  const json = (await res.json()) as RateResponse;
  if (!json || typeof json.usd_try !== 'number' || typeof json.eur_try !== 'number') {
    throw new Error('Kur bilgisi alınamadı: beklenmeyen yanıt formatı.');
  }

  return json;
}

// --- Public API ---

/**
 * Belirli bir geçmiş tarih için kuru döner (transaction kaydederken kullanılacak).
 * @param currency 'USD' | 'EUR'
 * @param date     'YYYY-MM-DD' formatında tarih
 */
export async function getExchangeRateForDate(
  currency: CurrencyCode,
  date: string
): Promise<number> {
  const rates = await fetchRates(date);
  return currency === 'USD' ? rates.usd_try : rates.eur_try;
}

/**
 * Bugünün kuru (Ana Sayfa'daki görüntüleme para birimi dönüşümü için).
 * Edge Function zaten hafta sonu/tatil durumunda önceki iş gününe döner.
 */
export async function getCurrentExchangeRate(
  currency: CurrencyCode
): Promise<number> {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return getExchangeRateForDate(currency, iso);
}
