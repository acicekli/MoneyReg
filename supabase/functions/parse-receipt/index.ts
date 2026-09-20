// ============================================================
// MoneyReg — parse-receipt Edge Function
// Gemini 2.5 Flash-Lite ile fiş görselinden tutar/kategori/tarih çıkarır.
// ============================================================

import { corsHeaders } from '../_shared/cors.ts';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY sunucuda tanımlı değil.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body: ParseRequest = await req.json();

    if (!body?.image_base64 || typeof body.image_base64 !== 'string') {
      return new Response(
        JSON.stringify({ error: 'image_base64 gerekli.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const mimeType = body.mime_type || 'image/jpeg';
    const categories = Array.isArray(body.categories) ? body.categories : [];

    // Boş yanıt şablonu
    const empty: ParseResponse = {
      amount: null,
      category_id: null,
      date: null,
      confidence: 'low',
    };

    try {
      const result = await callGemini(
        apiKey,
        body.image_base64,
        mimeType,
        categories
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      // Gemini hatası → boş dön, 200 ile (kullanıcı manuel doldursun)
      console.error('[parse-receipt] Gemini error:', String(err));
      return new Response(JSON.stringify(empty), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'internal_error', message: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
