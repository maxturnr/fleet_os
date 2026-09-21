import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getAiContext, getTaxAssumptions } from '@/lib/data/finance';
import { anthropic, MODEL } from '@/lib/anthropic';
import type { ChatMessage } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SYSTEM = `You are the money assistant inside Pitch Money, the finance companion to Pitch DMS for a UK used-car dealer.
You answer questions about the dealership's money using ONLY the JSON context provided. Be direct, numerate and practical — you are talking to the owner.

House rules:
- Currency is GBP. Round to the nearest pound unless pennies matter. Always show your working briefly (e.g. "£144k sales − £77k purchases − £29k costs − £4k VAT = £2.6k").
- "Realised profit" = profit on cars actually sold (sale price − purchase − costs on that car − margin-scheme VAT). "Unrealised" = projected margin on stock at asking price. Never mix the two without saying so.
- The classic "we've made £X but the bank only shows £Y" question: reconcile it explicitly — money is usually sitting in stock (capital tied up / new purchases), owed to HMRC (VAT, corporation tax), in unpaid supplier bills, deposits, drawings or overheads. Use the dashboard numbers to show where it went, in a short table.
- VAT: the dealer is on the second-hand margin scheme where flagged (VAT = 1/6 of the margin per car). Input VAT is reclaimable on VAT-able costs only if the dealership is VAT registered. Corporation tax estimate uses the rate in the context (default 19%, UK small profits rate; 25% main rate above £250k) — say it's an estimate and their accountant has the final word.
- If a vehicle has missing_purchase_price=true its profit is unknown; say so rather than guessing, and suggest adding it in Pitch DMS.
- Prefer compact markdown tables for breakdowns. Keep answers under ~250 words unless asked for detail. No emojis.
- If asked something the data can't answer (bank feeds, payroll, personal tax), say what you'd need.`;

export async function POST(req: Request) {
  const auth = await requireAuth().catch(() => null);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const question: string = (body.message || '').toString().trim();
  const conversationId: string | null = body.conversationId || null;
  if (!question) return NextResponse.json({ error: 'message required' }, { status: 400 });

  const supabase = await createClient();
  let history: ChatMessage[] = [];
  if (conversationId) {
    const { data } = await supabase.from('ai_conversations').select('messages').eq('id', conversationId).maybeSingle();
    history = ((data?.messages as ChatMessage[]) || []).slice(-12);
  }

  const [ctx, tax] = await Promise.all([getAiContext(auth.dealership.id), getTaxAssumptions(auth.dealership.id)]);
  const context = {
    today: new Date().toISOString().slice(0, 10),
    dealership: { name: auth.dealership.trading_name || auth.dealership.company_name, vat_registered: auth.dealership.vat_registered, vat_effective_date: auth.dealership.vat_effective_date },
    tax_assumptions: tax,
    ...ctx,
  };

  try {
    const msg = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: [
        { type: 'text', text: SYSTEM },
        { type: 'text', text: `DEALERSHIP FINANCIAL CONTEXT (JSON):\n${JSON.stringify(context)}`, cache_control: { type: 'ephemeral' } } as any,
      ],
      messages: [...history.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: question }],
    });
    const answer = msg.content.filter((c) => c.type === 'text').map((c: any) => c.text).join('\n').trim();
    const now = new Date().toISOString();
    const messages: ChatMessage[] = [...history, { role: 'user', content: question, at: now }, { role: 'assistant', content: answer, at: now }];

    let id = conversationId;
    if (id) {
      await supabase.from('ai_conversations').update({ messages, updated_at: now }).eq('id', id);
    } else {
      const { data } = await supabase
        .from('ai_conversations')
        .insert({ user_id: auth.userId, dealership_id: auth.dealership.id, title: question.slice(0, 80), messages })
        .select('id')
        .single();
      id = data?.id || null;
    }
    return NextResponse.json({ answer, conversationId: id, usage: msg.usage });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'AI request failed' }, { status: 500 });
  }
}
