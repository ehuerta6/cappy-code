'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getMemberSolutions,
  listMemberProblems,
  subscribeToMemberSessions,
  type MemberSessionRecord,
} from '@/lib/firebase/member';
import {
  PublicSessionView,
  type PublicProblem,
  type PublicSessionSummary,
  type SessionState,
} from './public-session-ui';

export default function MemberSessionPage({
  sessionId,
}: {
  sessionId: string;
}) {
  const router = useRouter();
  const [session, setSession] = useState<MemberSessionRecord | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'loading' | 'error'>(
    'loading',
  );
  const [retryVersion, setRetryVersion] = useState(0);
  const [problems, setProblems] = useState<
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; records: PublicProblem[] }
  >({ status: 'loading' });
  const problemsRequest = useRef(0);
  const loadedProblemsFor = useRef<string | null>(null);

  const reloadProblems = useCallback(async () => {
    const request = ++problemsRequest.current;
    setProblems({ status: 'loading' });
    try {
      const records = await listMemberProblems(sessionId);
      if (request === problemsRequest.current) {
        setProblems({
          status: 'ready',
          records: records.map(({ id, problem }) => ({ id, ...problem })),
        });
      }
    } catch {
      if (request === problemsRequest.current) setProblems({ status: 'error' });
    }
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    setSession(null);
    setProblems({ status: 'loading' });
    setSessionStatus('loading');
    loadedProblemsFor.current = null;
    const unsubscribe = subscribeToMemberSessions(
      (records) => {
        if (!active) return;
        const live = records.find(({ session }) => session.status === 'live');
        if (live && live.id !== sessionId) {
          setSession(null);
          router.replace(`/sessions/${encodeURIComponent(live.id)}`);
          return;
        }
        const record = records.find(({ id }) => id === sessionId);
        if (!record) {
          setSession(null);
          if (!live) router.replace('/');
          return;
        }
        setSession(record);
        setSessionStatus('loading');
        if (loadedProblemsFor.current !== sessionId) {
          loadedProblemsFor.current = sessionId;
          void reloadProblems();
        }
      },
      () => {
        if (active) {
          setSession(null);
          setSessionStatus('error');
        }
      },
    );
    return () => {
      active = false;
      unsubscribe();
      problemsRequest.current += 1;
    };
  }, [reloadProblems, router, retryVersion, sessionId]);

  const loadRevealedSolutions = useCallback(
    (problemId: string) => getMemberSolutions(sessionId, problemId),
    [sessionId],
  );

  let state: SessionState;
  if (!session && sessionStatus === 'error') {
    state = {
      status: 'error',
      onRetry: () => setRetryVersion((value) => value + 1),
    };
  } else if (!session) {
    state = { status: 'loading' };
  } else {
    state = {
      status: 'ready',
      session: {
        id: session.id,
        ...session.session,
      } satisfies PublicSessionSummary,
      problems:
        problems.status === 'error'
          ? { status: 'error', onRetry: () => void reloadProblems() }
          : problems,
      loadRevealedSolutions,
    };
  }

  return <PublicSessionView state={state} />;
}
