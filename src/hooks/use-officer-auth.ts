'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { getOfficerAuth } from '@/lib/firebase/auth';

type OfficerAuthState =
  | { status: 'checking' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: User }
  | { status: 'unavailable' };

export function useOfficerAuth(): OfficerAuthState {
  const [state, setState] = useState<OfficerAuthState>({ status: 'checking' });

  useEffect(() => {
    try {
      return onAuthStateChanged(
        getOfficerAuth(),
        (user) => {
          setState(
            user ? { status: 'authenticated', user } : { status: 'anonymous' },
          );
        },
        () => setState({ status: 'unavailable' }),
      );
    } catch {
      setState({ status: 'unavailable' });
    }
  }, []);

  return state;
}
