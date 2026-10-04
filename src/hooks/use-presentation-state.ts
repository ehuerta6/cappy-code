'use client';

import { useEffect, useState } from 'react';
import {
  subscribeToActiveProblem,
  subscribeToAnswersVisible,
} from '@/lib/firebase/presentation';

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

export function useActiveProblemId(
  sessionId: string | null,
): RealtimeValue<string | null> {
  const key = sessionId === null ? '' : `session:${sessionId}`;
  const [stored, setStored] = useState<KeyedRealtimeValue<string | null>>({
    key: '',
    state: { status: 'loading' },
  });

  useEffect(() => {
    if (sessionId === null) {
      setStored({ key, state: { status: 'loading' } });
      return;
    }
    setStored({ key, state: { status: 'loading' } });
    try {
      const unsubscribe = subscribeToActiveProblem(
        sessionId,
        (value) => setStored({ key, state: { status: 'ready', value } }),
        (error) => setStored({ key, state: { status: 'error', error } }),
      );
      return unsubscribe;
    } catch (error) {
      setStored({ key, state: { status: 'error', error: asError(error) } });
    }
  }, [key, sessionId]);

  return stored.key === key ? stored.state : { status: 'loading' };
}

export function useAnswersVisible(
  sessionId: string | null,
  problemId: string | null,
): RealtimeValue<boolean> {
  const key =
    sessionId === null || problemId === null
      ? ''
      : `problem:${JSON.stringify([sessionId, problemId])}`;
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
  }, [key, problemId, sessionId]);

  return stored.key === key ? stored.state : { status: 'loading' };
}

export interface FollowPresenterState {
  activeProblemId: string | null;
  selectedProblemId: string | null;
  isFollowing: boolean;
}

export type FollowPresenterAction =
  | { type: 'presenter_changed'; problemId: string | null }
  | { type: 'select_problem'; problemId: string }
  | { type: 'follow_presenter' };

export function createFollowPresenterState(
  activeProblemId: string | null,
): FollowPresenterState {
  return {
    activeProblemId,
    selectedProblemId: activeProblemId,
    isFollowing: true,
  };
}

export function reduceFollowPresenterState(
  state: FollowPresenterState,
  action: FollowPresenterAction,
): FollowPresenterState {
  if (action.type === 'presenter_changed')
    return {
      ...state,
      activeProblemId: action.problemId,
      selectedProblemId: state.isFollowing
        ? action.problemId
        : state.selectedProblemId,
    };
  if (action.type === 'select_problem')
    return {
      ...state,
      selectedProblemId: action.problemId,
      isFollowing: false,
    };
  return {
    ...state,
    selectedProblemId: state.activeProblemId,
    isFollowing: true,
  };
}
