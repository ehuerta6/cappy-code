'use client';

import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useOfficerAuth } from '@/hooks/use-officer-auth';
import { getOfficerAuth } from '@/lib/firebase/auth';
import AppHeader from './app-header';
import OfficerLogin from './officer-login';
import { Button } from './ui/primitives';

export default function OfficerAuthGate({ children }: { children: ReactNode }) {
  const auth = useOfficerAuth();
  const pathname = usePathname();
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
        mode={auth.status === 'authenticated' ? 'officer' : 'login'}
        current={
          pathname.startsWith('/officer/problem-bank')
            ? 'problem-bank'
            : 'sessions'
        }
        context={auth.status === 'authenticated' ? 'Officer Mode' : undefined}
      >
        <Link href="/" className="ui-header-link" aria-label="View member site">
          View member site
        </Link>
        {auth.status === 'authenticated' && (
          <Button
            variant="quiet"
            className="min-h-11 px-1.5 text-sm"
            disabled={signingOut}
            onClick={handleLogout}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        )}
      </AppHeader>
      <main
        className={
          auth.status === 'anonymous'
            ? 'mx-auto flex min-h-[calc(100vh-56px)] w-[calc(100%-32px)] max-w-[1440px] items-center justify-center pb-[6vh] sm:w-[calc(100%-48px)]'
            : 'ui-page-shell'
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
