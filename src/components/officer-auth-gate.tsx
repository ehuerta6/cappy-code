'use client';

import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useOfficerAuth } from '@/hooks/use-officer-auth';
import { getOfficerAuth } from '@/lib/firebase/auth';
import OfficerLogin from './officer-login';

export default function OfficerAuthGate({ children }: { children: ReactNode }) {
  const auth = useOfficerAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    setError('');
    try {
      await signOut(getOfficerAuth());
    } catch {
      setError('Unable to sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="officer-shell">
      <header className="officer-header">
        <Link href="/">CappyCode</Link>
        <nav aria-label="Officer navigation">
          <Link href="/">Member Mode</Link>
          {auth.status === 'authenticated' && (
            <button
              className="clear-button"
              disabled={signingOut}
              onClick={handleLogout}
              type="button"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          )}
        </nav>
      </header>
      <main className="officer-content">
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {auth.status === 'checking' || signingOut ? (
          <p role="status">
            {signingOut ? 'Signing out…' : 'Checking officer access…'}
          </p>
        ) : auth.status === 'unavailable' ? (
          <p role="alert">
            Officer login is unavailable. Please reload to try again.
          </p>
        ) : auth.status === 'anonymous' ? (
          <OfficerLogin />
        ) : (
          children
        )}
      </main>
    </div>
  );
}
