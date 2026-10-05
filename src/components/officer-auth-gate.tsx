'use client';

import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useOfficerAuth } from '@/hooks/use-officer-auth';
import { getOfficerAuth } from '@/lib/firebase/auth';
import AppHeader from './app-header';
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
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader
        context={auth.status === 'authenticated' ? 'Officer Mode' : undefined}
      >
        <nav aria-label="Officer navigation">
          <Link href="/" aria-label="View member site">
            View member site
          </Link>
          {auth.status === 'authenticated' && (
            <button
              className="min-h-11 rounded px-2 text-sm text-muted hover:bg-hover hover:text-ink"
              disabled={signingOut}
              onClick={handleLogout}
              type="button"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          )}
        </nav>
      </AppHeader>
      <main
        className={
          auth.status === 'anonymous'
            ? 'mx-auto flex min-h-[calc(100vh-56px)] w-[calc(100%-32px)] max-w-[1440px] items-center justify-center pb-[6vh] sm:w-[calc(100%-48px)]'
            : 'mx-auto w-[calc(100%-32px)] max-w-[1440px] py-5 pb-12 sm:w-[calc(100%-48px)] sm:pt-6'
        }
      >
        {error && (
          <p className="text-danger" role="alert">
            {error}
          </p>
        )}
        {auth.status === 'checking' || signingOut ? (
          <p className="text-muted" role="status">
            {signingOut ? 'Signing out…' : 'Checking officer access…'}
          </p>
        ) : auth.status === 'unavailable' ? (
          <p className="text-danger" role="alert">
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
