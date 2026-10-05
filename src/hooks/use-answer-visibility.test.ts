// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const subscriptions = vi.hoisted(() => ({ answers: vi.fn() }));

vi.mock('@/lib/firebase/answer-visibility', () => ({
  subscribeToAnswersVisible: subscriptions.answers,
}));

import { useAnswersVisible } from './use-answer-visibility';

type ValueCallback<T> = (value: T) => void;
type ErrorCallback = (error: Error) => void;

interface TestListener<T> {
  onValue: ValueCallback<T>;
  onError: ErrorCallback;
  unsubscribe: ReturnType<typeof vi.fn>;
}

let answerListeners: TestListener<boolean>[];

beforeEach(() => {
  vi.clearAllMocks();
  answerListeners = [];
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

describe('answer visibility hook', () => {
  it('tracks reveal updates and cleans up when the Problem changes', () => {
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
});
