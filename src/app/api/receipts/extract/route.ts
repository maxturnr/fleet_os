import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { anthropic, MODEL } from '@/lib/anthropic';
import { COST_TYPES } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROMPT = `You are reading a supplier receipt or invoice for a UK used-car dealer. Extract the fields below as JSON only — no prose.
{
  "amount": number | null,          // grand total actually paid, in GBP, including VAT
  "date": "YYYY-MM-DD" | null,      // invoice/receipt date
  "supplier": string | null,        // trading name of the supplier
  "description": string | null,     // one short line of what was bought (e.g. "Front brake pads + discs")
  "cost_type": one of ${JSON.stringify(COST_TYPES)} | null,   // parts = components; mechanic = labour/garage work; fuel; collections = transport/delivery/recovery; advertising; MOT; warranty; auction fee; other
  "vat_type": "included" | "none" | null,   // "included" if VAT is shown/charged on the receipt, "none" if no VAT (e.g. non-registered trader, MOT, road tax)
  "registration": string | null,    // UK vehicle registration if printed anywhere (e.g. "AB12 CDE"), else null
  "confidence": "high" | "medium" | "low"
}`;

export async function POST(req: Request) {
  const auth = await requireAuth().catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { url } = await req.json().catch(() => ({}));
  if (!url || typeof url !== 'string') return NextResponse.json({ error: 'url required' }, { status: 400 });
  const allowedHost = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^https?:\/\//, '');
  if (!url.includes(allowedHost)) return NextResponse.json({ error: 'URL must be a Supabase storage URL' }, { status: 400 });

  try {
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: `Could not fetch receipt (${res.status})` }, { status: 400 });
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    const buf = Buffer.from(await res.arrayBuffer());
    const b64 = buf.toString('base64');

    const isPdf = type === 'application/pdf' || url.toLowerCase().endsWith('.pdf');
    const mediaType = isPdf ? 'application/pdf' : (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type) ? type : 'image/jpeg');

    const content: any[] = [
      isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
        : { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
      { type: 'text', text: PROMPT },
    ];

    const msg = await anthropic().messages.create({ model: MODEL, max_tokens: 400, messages: [{ role: 'user', content }] });
    const text = msg.content.filter((c) => c.type === 'text').map((c: any) => c.text).join('\n');
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return NextResponse.json({ error: 'No JSON in model response' }, { status: 502 });
    const extracted = JSON.parse(json);
    if (extracted.amount != null) extracted.amount = Math.round(Number(extracted.amount) * 100) / 100;
    return NextResponse.json({ extracted });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Extraction failed' }, { status: 500 });
  }
}
