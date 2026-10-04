// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const subscriptions = vi.hoisted(() => ({
  active: vi.fn(),
  answers: vi.fn(),
}));

vi.mock('@/lib/firebase/presentation', () => ({
  subscribeToActiveProblem: subscriptions.active,
  subscribeToAnswersVisible: subscriptions.answers,
}));

import {
  createFollowPresenterState,
  reduceFollowPresenterState,
  useActiveProblemId,
  useAnswersVisible,
} from './use-presentation-state';

type ValueCallback<T> = (value: T) => void;
type ErrorCallback = (error: Error) => void;

interface TestListener<T> {
  onValue: ValueCallback<T>;
  onError: ErrorCallback;
  unsubscribe: ReturnType<typeof vi.fn>;
}

let activeListeners: TestListener<string | null>[];
let answerListeners: TestListener<boolean>[];

beforeEach(() => {
  vi.clearAllMocks();
  activeListeners = [];
  answerListeners = [];
  subscriptions.active.mockImplementation(
    (
      _sessionId: string,
      onValue: ValueCallback<string | null>,
      onError: ErrorCallback,
    ) => {
      const unsubscribe = vi.fn();
      activeListeners.push({ onValue, onError, unsubscribe });
      return unsubscribe;
    },
  );
  subscriptions.answers.mockImplementation(
    (
      _sessionId: string,
      _problemId: string,
      onValue: ValueCallback<boolean>,
      onError: ErrorCallback,
    ) => {
      const unsubscribe = vi.fn();
      answerListeners.push({ onValue, onError, unsubscribe });
      return unsubscribe;
    },
  );
});

describe('presentation state hooks', () => {
  it('tracks the current Session and ignores late callbacks from an old listener', () => {
    const { result, rerender } = renderHook(
      ({ sessionId }) => useActiveProblemId(sessionId),
      { initialProps: { sessionId: 'first' as string | null } },
    );
    expect(subscriptions.active).toHaveBeenCalledWith(
      'first',
      expect.any(Function),
      expect.any(Function),
    );

    rerender({ sessionId: 'second' });
    expect(activeListeners[0].unsubscribe).toHaveBeenCalledOnce();
    act(() => activeListeners[0].onValue('stale-problem'));
    expect(result.current).toEqual({ status: 'loading' });
    act(() => activeListeners[1].onValue('current-problem'));
    expect(result.current).toEqual({
      status: 'ready',
      value: 'current-problem',
    });
  });

  it('tracks answer reveal updates and cleans up when the Problem changes', () => {
    const { result, rerender } = renderHook(
      ({ problemId }) => useAnswersVisible('session', problemId),
      { initialProps: { problemId: 'first' as string | null } },
    );
    act(() => answerListeners[0].onValue(true));
    expect(result.current).toEqual({ status: 'ready', value: true });

    rerender({ problemId: 'second' });
    expect(answerListeners[0].unsubscribe).toHaveBeenCalledOnce();
    act(() => answerListeners[0].onValue(false));
    expect(result.current).toEqual({ status: 'loading' });
    act(() => answerListeners[1].onValue(false));
    expect(result.current).toEqual({ status: 'ready', value: false });
  });

  it('moves with the presenter until a member selects a different Problem', () => {
    let state = createFollowPresenterState('one');
    state = reduceFollowPresenterState(state, {
      type: 'presenter_changed',
      problemId: 'two',
    });
    expect(state).toMatchObject({
      activeProblemId: 'two',
      selectedProblemId: 'two',
      isFollowing: true,
    });

    state = reduceFollowPresenterState(state, {
      type: 'select_problem',
      problemId: 'one',
    });
    state = reduceFollowPresenterState(state, {
      type: 'presenter_changed',
      problemId: null,
    });
    expect(state).toMatchObject({
      activeProblemId: null,
      selectedProblemId: 'one',
      isFollowing: false,
    });

    state = reduceFollowPresenterState(state, { type: 'follow_presenter' });
    expect(state).toMatchObject({
      selectedProblemId: null,
      isFollowing: true,
    });
  });
});
