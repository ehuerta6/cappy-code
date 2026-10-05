'use client';

import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState, type FormEvent } from 'react';
import { getOfficerAuth } from '@/lib/firebase/auth';

export default function OfficerLogin() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const fields = new FormData(event.currentTarget);
    const email = String(fields.get('email') ?? '').trim();
    const password = String(fields.get('password') ?? '');
    setPending(true);
    setError('');

    try {
      await signInWithEmailAndPassword(getOfficerAuth(), email, password);
      // The auth observer, rather than this request, opens Officer Mode.
    } catch {
      setError('Unable to sign in. Check your credentials and try again.');
      setPending(false);
    }
  }

  return (
    <section
      className="w-full max-w-[400px]"
      aria-labelledby="officer-login-title"
    >
      <h1
        className="m-0 text-2xl font-semibold leading-8 tracking-tight"
        id="officer-login-title"
      >
        Officer login
      </h1>
      <form
        className="mt-6 grid gap-2"
        onSubmit={handleSubmit}
        aria-busy={pending}
      >
        <label className="font-medium" htmlFor="officer-email">
          Email
        </label>
        <input
          className="mb-2 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
          autoComplete="username"
          disabled={pending}
          id="officer-email"
          name="email"
          required
          type="email"
        />
        <label className="font-medium" htmlFor="officer-password">
          Password
        </label>
        <input
          className="mb-2 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
          autoComplete="current-password"
          disabled={pending}
          id="officer-password"
          name="password"
          required
          type="password"
        />
        {error && (
          <p className="text-danger" role="alert">
            {error}
          </p>
        )}
        <button
          className="mt-2 min-h-11 w-full rounded border border-accent bg-accent px-3 py-2 font-semibold text-accent-contrast hover:bg-accent-hover disabled:cursor-default disabled:border-border-strong disabled:bg-raised disabled:text-muted"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        {pending && (
          <p className="text-sm text-muted" role="status">
            Confirming officer access…
          </p>
        )}
      </form>
    </section>
  );
}
