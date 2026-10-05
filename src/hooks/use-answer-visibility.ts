'use client';

import { useEffect, useState } from 'react';
import { subscribeToAnswersVisible } from '@/lib/firebase/answer-visibility';

export type RealtimeValue<T> =
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'error'; error: Error };

interface KeyedRealtimeValue<T> {
  key: string;
  state: RealtimeValue<T>;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Realtime updates failed.');
}

export function useAnswersVisible(
  sessionId: string | null,
  problemId: string | null,
  retryVersion = 0,
): RealtimeValue<boolean> {
  const key =
    sessionId === null || problemId === null
      ? ''
      : `problem:${JSON.stringify([sessionId, problemId, retryVersion])}`;
  const [stored, setStored] = useState<KeyedRealtimeValue<boolean>>({
    key: '',
    state: { status: 'loading' },
  });

  useEffect(() => {
    if (sessionId === null || problemId === null) {
      setStored({ key, state: { status: 'loading' } });
      return;
    }
    setStored({ key, state: { status: 'loading' } });
    try {
      const unsubscribe = subscribeToAnswersVisible(
        sessionId,
        problemId,
        (value) => setStored({ key, state: { status: 'ready', value } }),
        (error) => setStored({ key, state: { status: 'error', error } }),
      );
      return unsubscribe;
    } catch (error) {
      setStored({ key, state: { status: 'error', error: asError(error) } });
    }
  }, [key, problemId, retryVersion, sessionId]);

  return stored.key === key ? stored.state : { status: 'loading' };
}
