// ============================================================
// MoneyReg — parse-receipt Edge Function
// Gemini ile fiş görselinden tutar/kategori/tarih çıkarır.
// Model adı GEMINI_MODEL env değişkeniyle değiştirilebilir.
//
// Güvenlik:
//  - Sadece giriş yapmış kullanıcı çağırabilir (anon key tek başına yetmez)
//  - Görsel boyutu / mime / kategori sayısı sınırlı
//  - Kullanıcı başına dakikada en fazla RATE_MAX istek (isolate başına, best-effort)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite';

const MAX_BASE64_CHARS = 7_000_000; // ≈ 5 MB görsel
const MAX_CATEGORIES = 50;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const rateHits = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (rateHits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    rateHits.set(userId, recent);
    return true;
  }
  recent.push(now);
  rateHits.set(userId, recent);
  return false;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Prompt'a giren kategori adlarından satır sonu / tırnak vb. temizle (prompt injection azaltma)
function sanitizeCategories(input: unknown): CategoryInput[] {
  if (!Array.isArray(input)) return [];
  const out: CategoryInput[] = [];
  for (const c of input.slice(0, MAX_CATEGORIES)) {
    if (!c || typeof c.id !== 'string' || !UUID_RE.test(c.id)) continue;
    if (typeof c.name !== 'string') continue;
    const name = c.name.replace(/[\r\n"\\]/g, ' ').trim().slice(0, 40);
    if (!name) continue;
    out.push({ id: c.id, name });
  }
  return out;
}

type CategoryInput = {
  id: string;
  name: string;
  icon?: string | null;
};

type ParseRequest = {
  image_base64: string;       // data URL değil, sadece base64
  mime_type?: string;         // default: image/jpeg
  categories: CategoryInput[];
};

type ParseResponse = {
  amount: number | null;
  category_id: string | null;
  date: string | null;        // YYYY-MM-DD
  confidence: 'high' | 'low';
};

// ---------- Prompt ----------

function buildPrompt(categories: CategoryInput[]): string {
  const catList = categories
    .map((c) => `- id: "${c.id}", name: "${c.name}"`)
    .join('\n');

  return `Sen bir fiş/makbuz okuma asistanısın. Sana verilen fiş görselini analiz et ve SADECE aşağıdaki JSON formatında yanıt ver. Başka hiçbir şey yazma, açıklama yapma, markdown kod bloğu kullanma.

JSON formatı:
{
  "amount": <number veya null>,
  "category_id": <string veya null>,
  "date": "<YYYY-MM-DD>" veya null,
  "confidence": "high" veya "low"
}

Kurallar:
1. **amount**: Fişteki GENEL TOPLAM (toplam tutar, KDV dahil). Sadece sayı olsun, para birimi sembolü olmasın. Ondalık ayırıcı nokta (.) olsun. Örn: 245.50
2. **category_id**: Aşağıdaki listeden fişe EN UYGUN kategoriyi seç ve SADECE id'sini yaz. Emin değilsen null yaz.
   Kategoriler:
${catList || '(kategori listesi boş)'}
3. **date**: Fişte yazan tarih, YYYY-MM-DD formatında. Fişte tarih yoksa veya okuyamıyorsan null yaz.
4. **confidence**: 
   - "high": Tutar ve tarih net okunuyor, kategoriden eminsin
   - "low": Tutar bulanık, tarih yok, veya kategoriden emin değilsin

ÇOK ÖNEMLİ:
- Toplam tutar dışında (ara toplam, KDV, kalem tutarları) hiçbir sayıyı "amount" olarak döndürme.
- Eğer görsel bir fiş değilse veya okunamıyorsa tüm alanları null yap ve confidence: "low" döndür.
- Yanıtın geçerli JSON olmalı. Markdown kod bloğu KULLANMA.`;
}

// ---------- Gemini API çağrısı ----------

async function callGemini(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  categories: CategoryInput[]
): Promise<ParseResponse> {
  const prompt = buildPrompt(categories);

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,          // düşük → tutarlı çıktı
      response_mime_type: 'application/json',
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json();

  // Gemini yanıtı: candidates[0].content.parts[0].text
  const text =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ??
    json?.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data;

  if (!text) {
    throw new Error('Gemini yanıtı boş.');
  }

  // Text JSON olarak parse et
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Markdown kod bloğu varsa temizle
    const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  // Doğrula + normalize
  const amount =
    typeof parsed.amount === 'number' && Number.isFinite(parsed.amount)
      ? parsed.amount
      : null;

  const category_id =
    typeof parsed.category_id === 'string' &&
    categories.some((c) => c.id === parsed.category_id)
      ? parsed.category_id
      : null;

  const date =
    typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
      ? parsed.date
      : null;

  const confidence =
    parsed.confidence === 'high' && amount !== null ? 'high' : 'low';

  return { amount, category_id, date, confidence };
}

// ---------- HTTP handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1) Kimlik doğrulama: anon key değil, kullanıcının access token'ı gerekli
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: 'server_misconfigured' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

    // 2) Oran sınırı
    if (isRateLimited(userData.user.id)) {
      return json({ error: 'rate_limited' }, 429);
    }

    // 3) Gövde boyutu (okumadan önce)
    const contentLength = Number(req.headers.get('content-length') ?? '0');
    if (contentLength > MAX_BASE64_CHARS + 100_000) {
      return json({ error: 'payload_too_large' }, 413);
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return json({ error: 'server_misconfigured' }, 500);
    }

    const body: ParseRequest = await req.json();

    if (!body?.image_base64 || typeof body.image_base64 !== 'string') {
      return json({ error: 'image_base64 gerekli.' }, 400);
    }
    if (body.image_base64.length > MAX_BASE64_CHARS) {
      return json({ error: 'payload_too_large' }, 413);
    }

    const mimeType = body.mime_type || 'image/jpeg';
    if (!ALLOWED_MIME.has(mimeType)) {
      return json({ error: 'unsupported_mime_type' }, 415);
    }

    const categories = sanitizeCategories(body.categories);

    // Boş yanıt şablonu
    const empty: ParseResponse = {
      amount: null,
      category_id: null,
      date: null,
      confidence: 'low',
    };

    try {
      const result = await callGemini(apiKey, body.image_base64, mimeType, categories);
      return json(result);
    } catch (err) {
      // Gemini hatası → boş dön, 200 ile (kullanıcı manuel doldursun)
      console.error('[parse-receipt] Gemini error:', String(err));
      return json(empty);
    }
  } catch (err) {
    console.error('[parse-receipt] internal error:', String(err));
    return json({ error: 'internal_error' }, 500);
  }
});
