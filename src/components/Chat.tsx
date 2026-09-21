'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { History, Loader2, Plus, Send, Sparkles } from 'lucide-react';
import type { ChatMessage, Conversation } from '@/lib/types';
import { ago } from '@/lib/format';
import { Warn } from '@/components/ui';

const EXAMPLES = [
  'How much have we made in the last 90 days?',
  "We've made £20k but I only see £10k realised — where has the money gone?",
  'What is our current estimated VAT and corporation tax position?',
  'Which cars are tying up the most capital?',
  'Which cars have been in stock over 60 days and what are they costing us?',
  'What did we spend on mechanics and parts this month?',
];

export function Chat({ conversations, active, prefill, hasKey }: {
  conversations: { id: string; title: string | null; updated_at: string }[];
  active: Conversation | null;
  prefill: string;
  hasKey: boolean;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(active?.id || null);
  const [messages, setMessages] = useState<ChatMessage[]>(active?.messages || []);
  const [input, setInput] = useState(prefill);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  useEffect(() => { setConversationId(active?.id || null); setMessages(active?.messages || []); }, [active]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);
  useEffect(() => { if (prefill && !autoSent.current && hasKey) { autoSent.current = true; send(prefill); } }, [prefill]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setError(null);
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: q, conversationId }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
      setMessages((m) => [...m, { role: 'assistant', content: j.answer }]);
      if (!conversationId && j.conversationId) { setConversationId(j.conversationId); router.replace(`/assistant?c=${j.conversationId}`); router.refresh(); }
    } catch (err: any) {
      setError(err.message);
      setMessages((m) => m.slice(0, -1));
      setInput(q);
    } finally {
      setBusy(false);
    }
  }

  const newChat = () => { setConversationId(null); setMessages([]); setError(null); router.replace('/assistant'); };

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <aside className={`lg:col-span-1 ${showHistory ? '' : 'hidden lg:block'}`}>
        <div className="mb-2 flex items-center justify-between">
          <p className="label">History</p>
          <button className="btn btn-sm" onClick={newChat}><Plus className="h-3.5 w-3.5" /> New</button>
        </div>
        <ul className="card max-h-[60vh] divide-y divide-fleet-border overflow-y-auto">
          {conversations.length === 0 && <li className="px-3 py-4 text-xs text-fleet-faint">No conversations yet.</li>}
          {conversations.map((c) => (
            <li key={c.id}>
              <button onClick={() => { router.push(`/assistant?c=${c.id}`); setShowHistory(false); }} className={`block w-full px-3 py-2 text-left text-sm hover:bg-fleet-input ${c.id === conversationId ? 'bg-fleet-input' : ''}`}>
                <p className="truncate">{c.title || 'Untitled'}</p>
                <p className="text-[11px] text-fleet-faint">{ago(c.updated_at)}</p>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-h-[70vh] flex-col lg:col-span-3">
        {!hasKey && <div className="mb-3"><Warn>ANTHROPIC_API_KEY isn&apos;t set on the server yet, so the assistant can&apos;t answer. Add it in Vercel → Environment Variables.</Warn></div>}
        <div className="card flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-10 text-center">
              <Sparkles className="h-6 w-6 text-fleet-faint" />
              <p className="text-sm text-fleet-muted">Try one of these:</p>
              <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {EXAMPLES.map((e) => (
                  <button key={e} onClick={() => send(e)} disabled={!hasKey} className="rounded-fleet-lg border border-fleet-border bg-fleet-input px-3 py-2.5 text-left text-sm hover:bg-fleet-surface disabled:opacity-50">{e}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[92%] rounded-fleet-xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-fleet-inverse text-white dark:text-fleet-text' : 'bg-fleet-input'}`}>
                {m.role === 'user' ? <p className="whitespace-pre-wrap">{m.content}</p> : <div className="prose-chat"><ReactMarkdown>{m.content}</ReactMarkdown></div>}
              </div>
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-xs text-fleet-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the numbers…</div>}
          {error && <p className="rounded-fleet bg-fleet-red-dim px-3 py-2 text-sm text-fleet-red">{error}</p>}
          <div ref={bottomRef} />
        </div>
        <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <button type="button" className="btn lg:hidden" onClick={() => setShowHistory((s) => !s)} aria-label="History"><History className="h-4 w-4" /></button>
          <textarea
            className="input min-h-[44px] flex-1 resize-none"
            rows={1}
            placeholder="Ask about profit, cash, VAT, a car…"
            value={input}
            disabled={!hasKey}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button className="btn-primary" disabled={busy || !input.trim() || !hasKey} aria-label="Send"><Send className="h-4 w-4" /></button>
        </form>
      </section>
    </div>
  );
}
