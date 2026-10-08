'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getMemberSolutions,
  listMemberProblems,
  memberReadFailureKind,
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
  problemId = null,
}: {
  sessionId: string;
  problemId?: string | null;
}) {
  const [session, setSession] = useState<MemberSessionRecord | null>(null);
  const [sessionStatus, setSessionStatus] = useState<
    'loading' | 'error' | 'unavailable'
  >('loading');
  const [sessionErrorKind, setSessionErrorKind] = useState<
    'permission' | 'connection'
  >('connection');
  const [retryVersion, setRetryVersion] = useState(0);
  const [problems, setProblems] = useState<
    | { status: 'loading' }
    | { status: 'error'; errorKind: 'permission' | 'connection' }
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
    } catch (error) {
      if (request === problemsRequest.current)
        setProblems({
          status: 'error',
          errorKind: memberReadFailureKind(error),
        });
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
        const record = records.find(({ id }) => id === sessionId);
        if (!record) {
          setSession(null);
          setSessionStatus('unavailable');
          return;
        }
        setSession(record);
        setSessionStatus('loading');
        if (loadedProblemsFor.current !== sessionId) {
          loadedProblemsFor.current = sessionId;
          void reloadProblems();
        }
      },
      (error) => {
        if (active) {
          setSession(null);
          setSessionErrorKind(memberReadFailureKind(error));
          setSessionStatus('error');
        }
      },
    );
    return () => {
      active = false;
      unsubscribe();
      problemsRequest.current += 1;
    };
  }, [reloadProblems, retryVersion, sessionId]);

  const loadRevealedSolutions = useCallback(
    (problemId: string) => getMemberSolutions(sessionId, problemId),
    [sessionId],
  );

  let state: SessionState;
  if (!session && sessionStatus === 'error') {
    state = {
      status: 'error',
      errorKind: sessionErrorKind,
      onRetry: () => setRetryVersion((value) => value + 1),
    };
  } else if (!session) {
    state =
      sessionStatus === 'unavailable'
        ? { status: 'unavailable', kind: 'session' }
        : { status: 'loading' };
  } else {
    state = {
      status: 'ready',
      session: {
        id: session.id,
        ...session.session,
      } satisfies PublicSessionSummary,
      selectedProblemId: problemId,
      problems:
        problems.status === 'error'
          ? {
              status: 'error',
              errorKind: problems.errorKind,
              onRetry: () => void reloadProblems(),
            }
          : problems,
      loadRevealedSolutions,
    };
  }

  return <PublicSessionView state={state} />;
}
