'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getMemberSession,
  getRevealedMemberSolutions,
  listMemberProblems,
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
  const [session, setSession] = useState<MemberSessionRecord | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'loading' | 'unavailable'>(
    'loading',
  );
  const [problems, setProblems] = useState<
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; records: PublicProblem[] }
  >({ status: 'loading' });
  const problemsRequest = useRef(0);

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
    void getMemberSession(sessionId).then(
      (record) => {
        if (!active) return;
        if (!record) {
          setSessionStatus('unavailable');
          return;
        }
        setSession(record);
        setSessionStatus('loading');
        void reloadProblems();
      },
      () => {
        if (active) setSessionStatus('unavailable');
      },
    );
    return () => {
      active = false;
      problemsRequest.current += 1;
    };
  }, [reloadProblems, sessionId]);

  const loadRevealedSolutions = useCallback(
    (problemId: string) => getRevealedMemberSolutions(sessionId, problemId),
    [sessionId],
  );

  let state: SessionState;
  if (!session && sessionStatus === 'unavailable') {
    state = { status: 'unavailable' };
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
