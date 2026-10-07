'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  subscribeToMemberSessions,
  type MemberSessionRecord,
} from '@/lib/firebase/member';
import {
  PublicSessionDiscovery,
  type DiscoveryState,
} from './public-session-ui';

export default function MemberHome() {
  const router = useRouter();
  const [sessions, setSessions] = useState<
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; records: MemberSessionRecord[] }
  >({ status: 'loading' });
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    setSessions({ status: 'loading' });
    return subscribeToMemberSessions(
      (records) => setSessions({ status: 'ready', records }),
      () => setSessions({ status: 'error' }),
    );
  }, [retryVersion]);

  const liveSession =
    sessions.status === 'ready'
      ? sessions.records.find(({ session }) => session.status === 'live')
      : undefined;

  useEffect(() => {
    if (liveSession) {
      router.replace(`/sessions/${encodeURIComponent(liveSession.id)}`);
    }
  }, [liveSession, router]);

  let state: DiscoveryState;
  if (sessions.status === 'error') {
    state = { status: 'error', onRetry: () => setRetryVersion((v) => v + 1) };
  } else if (sessions.status === 'loading' || liveSession) {
    state = { status: 'loading' };
  } else if (sessions.records.length) {
    state = {
      status: 'ready',
      sessions: sessions.records.map(({ id, session }) => ({ id, ...session })),
    };
  } else {
    state = { status: 'empty' };
  }

  return <PublicSessionDiscovery state={state} />;
}
