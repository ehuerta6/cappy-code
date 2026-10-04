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
    <section className="officer-login" aria-labelledby="officer-login-title">
      <h1 id="officer-login-title">Officer Login</h1>
      <form onSubmit={handleSubmit} aria-busy={pending}>
        <label htmlFor="officer-email">Email</label>
        <input
          autoComplete="username"
          disabled={pending}
          id="officer-email"
          name="email"
          required
          type="email"
        />
        <label htmlFor="officer-password">Password</label>
        <input
          autoComplete="current-password"
          disabled={pending}
          id="officer-password"
          name="password"
          required
          type="password"
        />
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button className="login-button" disabled={pending} type="submit">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        {pending && <p role="status">Confirming officer access…</p>}
      </form>
    </section>
  );
}
