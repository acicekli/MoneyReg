import { corsHeaders } from '../_shared/cors.ts';

type RateResponse = {
  date: string;
  usd_try: number;
  eur_try: number;
  source_date: string;
};

// --- Yardımcılar ---

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDDMMYYYY(d: Date): string {
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}`;
}

function formatYYYYMM(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}`;
}

function formatYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(iso: string): Date {
  // "YYYY-MM-DD" → Date (UTC değil, yerel gibi davransın diye manuel)
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// --- XML Parser (regex tabanlı, Deno'da hızlı) ---

function extractForexSelling(xml: string, kod: string): number | null {
  // <Currency ... Kod="USD" ...> ... <ForexSelling>2.9161</ForexSelling>
  // Kod attribute sırası değişebilir, o yüzden esnek regex
  const currencyRegex = new RegExp(
    `<Currency[^>]*Kod="${kod}"[^>]*>([\\s\\S]*?)<\\/Currency>`,
    'i'
  );
  const match = xml.match(currencyRegex);
  if (!match) return null;

  const block = match[1];
  const sellingMatch = block.match(/<ForexSelling>([\d.,]+)<\/ForexSelling>/i);
  if (!sellingMatch) return null;

  const value = parseFloat(sellingMatch[1].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

// --- TCMB fetch + fallback ---

async function fetchRatesForDate(isoDate: string): Promise<RateResponse | null> {
  const d = parseDate(isoDate);
  const url = `https://www.tcmb.gov.tr/kurlar/${formatYYYYMM(d)}/${formatDDMMYYYY(d)}.xml`;

  const res = await fetch(url, {
    headers: {
      // TCMB bazı istekleri User-Agent'sız reddediyor
      'User-Agent': 'MoneyReg/1.0 (+https://github.com/acicekli)',
      'Accept': 'application/xml,text/xml,*/*',
    },
  });

  if (!res.ok) return null;

  const xml = await res.text();
  const usd = extractForexSelling(xml, 'USD');
  const eur = extractForexSelling(xml, 'EUR');

  if (usd == null || eur == null) return null;

  return {
    date: isoDate,
    usd_try: usd,
    eur_try: eur,
    source_date: isoDate,
  };
}

async function fetchWithFallback(
  startIso: string,
  maxLookback = 5
): Promise<RateResponse | null> {
  const start = parseDate(startIso);
  for (let i = 0; i <= maxLookback; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    const iso = formatYYYYMMDD(d);

    try {
      const result = await fetchRatesForDate(iso);
      if (result) {
        // source_date = fiilen bulunan iş günü
        return { ...result, source_date: iso, date: startIso };
      }
    } catch (_e) {
      // devam et
    }
  }
  return null;
}

// --- HTTP handler ---

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // date parametresi: query string veya POST body'den
    let dateParam: string | null = null;

    const url = new URL(req.url);
    dateParam = url.searchParams.get('date');

    if (!dateParam && req.method === 'POST') {
      try {
        const body = await req.json();
        dateParam = body?.date ?? null;
      } catch {
        // body yok/geçersiz, sorun değil
      }
    }

    // Varsayılan: bugün
    if (!dateParam) {
      dateParam = formatYYYYMMDD(new Date());
    }

    // Basit doğrulama
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return new Response(
        JSON.stringify({ error: 'date must be YYYY-MM-DD' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await fetchWithFallback(dateParam);

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'rate_unavailable', date: dateParam }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
