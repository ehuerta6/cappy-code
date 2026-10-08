'use client';

import { useEffect, useState } from 'react';
import {
  subscribeToMemberSessions,
  memberReadFailureKind,
  type MemberSessionRecord,
} from '@/lib/firebase/member';
import {
  PublicSessionDiscovery,
  type DiscoveryState,
} from './public-session-ui';

export default function MemberHome() {
  const [sessions, setSessions] = useState<
    | { status: 'loading' }
    | { status: 'error'; errorKind: 'permission' | 'connection' }
    | { status: 'ready'; records: MemberSessionRecord[] }
  >({ status: 'loading' });
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    setSessions({ status: 'loading' });
    return subscribeToMemberSessions(
      (records) => setSessions({ status: 'ready', records }),
      (error) =>
        setSessions({
          status: 'error',
          errorKind: memberReadFailureKind(error),
        }),
    );
  }, [retryVersion]);

  let state: DiscoveryState;
  if (sessions.status === 'error') {
    state = {
      status: 'error',
      errorKind: sessions.errorKind,
      onRetry: () => setRetryVersion((v) => v + 1),
    };
  } else if (sessions.status === 'loading') {
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
