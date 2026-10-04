'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listMemberSessions,
  type MemberSessionRecord,
} from '@/lib/firebase/member';
import {
  PublicSessionDiscovery,
  type DiscoveryState,
} from './public-session-ui';

export default function MemberHome() {
  const [sessions, setSessions] = useState<MemberSessionRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setFailed(false);
    void listMemberSessions().then(
      (records) => {
        if (active) setSessions(records);
      },
      () => {
        if (active) {
          setSessions([]);
          setFailed(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [revision]);

  const retry = useCallback(() => {
    setSessions(null);
    setRevision((value) => value + 1);
  }, []);

  const state: DiscoveryState = failed
    ? { status: 'error', onRetry: retry }
    : sessions === null
      ? { status: 'loading' }
      : sessions.length
        ? {
            status: 'ready',
            sessions: sessions.map(({ id, session }) => ({ id, ...session })),
          }
        : { status: 'empty' };

  return <PublicSessionDiscovery state={state} />;
}
