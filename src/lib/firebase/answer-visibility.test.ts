import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ db: {}, onSnapshot: vi.fn() }));

vi.mock('client-only', () => ({}));
vi.mock('./client', () => ({ getFirestoreDb: () => sdk.db }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  onSnapshot: sdk.onSnapshot,
}));

import { subscribeToAnswersVisible } from './answer-visibility';

interface Listener {
  reference: { path: string };
  onValue: (snapshot: unknown) => void;
  onError: (error: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

let listeners: Listener[];

function snapshot(value: unknown, exists = true, fromCache = false) {
  return {
    exists: () => exists,
    data: () => value,
    metadata: { fromCache },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listeners = [];
  sdk.onSnapshot.mockImplementation(
    (
      reference: Listener['reference'],
      _options: unknown,
      onValue: Listener['onValue'],
      onError: Listener['onError'],
    ) => {
      const unsubscribe = vi.fn();
      listeners.push({ reference, onValue, onError, unsubscribe });
      return unsubscribe;
    },
  );
});

describe('answer visibility listener', () => {
  it('subscribes to Problem.answersVisible and forwards live changes', () => {
    const onValue = vi.fn();
    const onError = vi.fn();
    const stop = subscribeToAnswersVisible(
      'session',
      'problem',
      onValue,
      onError,
    );

    expect(listeners[0].reference.path).toBe(
      'sessions/session/problems/problem',
    );
    listeners[0].onValue(snapshot({ answersVisible: true }));
    listeners[0].onValue(snapshot({ answersVisible: false }));
    expect(onValue.mock.calls).toEqual([[true], [false]]);
    stop();
    expect(listeners[0].unsubscribe).toHaveBeenCalledOnce();
  });

  it('reports missing documents and invalid answer visibility values', () => {
    const onValue = vi.fn();
    const onError = vi.fn();
    subscribeToAnswersVisible('session', 'problem', onValue, onError);
    listeners[0].onValue(snapshot({}, false));
    listeners[0].onValue(snapshot({ answersVisible: 'yes' }));
    expect(onValue).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0][0].message).toContain('no longer exists');
    expect(onError.mock.calls[1][0].message).toContain('invalid fields');
  });

  it('does not accept a cached reveal value as canonical', () => {
    const onValue = vi.fn();
    const onError = vi.fn();
    subscribeToAnswersVisible('session', 'problem', onValue, onError);
    listeners[0].onValue(snapshot({ answersVisible: true }, true, true));
    expect(onValue).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('server-confirmed'),
      }),
    );
    expect(sdk.onSnapshot.mock.calls[0][1]).toEqual({
      includeMetadataChanges: true,
    });
  });

  it('ignores queued callbacks after unsubscribe and allows repeated cleanup', () => {
    const onValue = vi.fn();
    const onError = vi.fn();
    const stop = subscribeToAnswersVisible(
      'session',
      'problem',
      onValue,
      onError,
    );
    stop();
    stop();
    listeners[0].onValue(snapshot({ answersVisible: true }));
    listeners[0].onError(new Error('late error'));
    expect(listeners[0].unsubscribe).toHaveBeenCalledOnce();
    expect(onValue).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
