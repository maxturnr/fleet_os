'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentLink, setSentLink] = useState(false);

  const next = params.get('next') || '/dashboard';

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace(next);
    router.refresh();
  }

  async function magicLink() {
    if (!email) return setError('Enter your email first.');
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    setBusy(false);
    if (error) return setError(error.message);
    setSentLink(true);
  }

  return (
    <form onSubmit={signIn} className="card card-pad w-full max-w-sm space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-sm text-fleet-muted">Use the same login as Pitch DMS.</p>
      </div>
      <label className="block space-y-1">
        <span className="label">Email</span>
        <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="label">Password</span>
        <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="rounded-fleet bg-fleet-red-dim px-3 py-2 text-sm text-fleet-red">{error}</p>}
      {sentLink && <p className="rounded-fleet bg-fleet-green-dim px-3 py-2 text-sm text-fleet-green">Magic link sent — check your inbox.</p>}
      <button className="btn-primary w-full" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <button type="button" className="btn w-full" disabled={busy || !email} onClick={magicLink}>Email me a magic link</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo size="lg" />
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="text-xs text-fleet-faint">Pitch Money reads live from your Pitch DMS. Nothing is copied or synced.</p>
    </main>
  );
}
