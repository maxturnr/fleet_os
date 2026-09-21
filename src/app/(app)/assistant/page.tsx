import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Conversation } from '@/lib/types';
import { PageHeader } from '@/components/AppShell';
import { Chat } from '@/components/Chat';

export const metadata = { title: 'Ask AI' };

export default async function AssistantPage({ searchParams }: { searchParams: { c?: string; q?: string } }) {
  const auth = await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from('ai_conversations')
    .select('id, title, messages, created_at, updated_at, user_id, dealership_id')
    .eq('dealership_id', auth.dealership.id)
    .order('updated_at', { ascending: false })
    .limit(30);
  const conversations = (data || []) as Conversation[];
  const active = searchParams.c ? conversations.find((c) => c.id === searchParams.c) || null : null;

  return (
    <>
      <PageHeader title="Ask about the money" subtitle="Answers come from the live numbers in Pitch DMS — nothing is guessed." />
      <Chat conversations={conversations.map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at }))} active={active} prefill={searchParams.q || ''} hasKey={Boolean(process.env.ANTHROPIC_API_KEY)} />
    </>
  );
}
