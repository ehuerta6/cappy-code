import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  user: {
    currentUser: { uid: 'officer', isAnonymous: false } as {
      uid: string;
      isAnonymous: boolean;
    } | null,
  },
  db: {},
  getDocFromServer: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-time'),
  onSnapshot: vi.fn(),
}));

vi.mock('client-only', () => ({}));
vi.mock('./client', () => ({ getFirestoreDb: () => sdk.db }));
vi.mock('./auth', () => ({ getOfficerAuth: () => sdk.user }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  getDocFromServer: sdk.getDocFromServer,
  updateDoc: sdk.updateDoc,
  serverTimestamp: sdk.serverTimestamp,
  onSnapshot: sdk.onSnapshot,
}));

import {
  setActiveProblem,
  subscribeToActiveProblem,
  subscribeToAnswersVisible,
} from './presentation';

interface Listener {
  reference: { path: string };
  onValue: (snapshot: unknown) => void;
  onError: (error: Error) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

let listeners: Listener[];

function snapshot(value: unknown, exists = true) {
  return { exists: () => exists, data: () => value };
}

beforeEach(() => {
  vi.clearAllMocks();
  listeners = [];
  sdk.user.currentUser = { uid: 'officer', isAnonymous: false };
  sdk.getDocFromServer.mockResolvedValue({ exists: () => true });
  sdk.updateDoc.mockResolvedValue(undefined);
  sdk.onSnapshot.mockImplementation(
    (
      reference: Listener['reference'],
      onValue: Listener['onValue'],
      onError: Listener['onError'],
    ) => {
      const unsubscribe = vi.fn();
      listeners.push({ reference, onValue, onError, unsubscribe });
      return unsubscribe;
    },
  );
});

describe('presentation persistence', () => {
  it('validates the selected Problem under the Session before saving the pointer', async () => {
    await setActiveProblem('session', 'problem');
    expect(sdk.getDocFromServer).toHaveBeenCalledExactlyOnceWith({
      path: 'sessions/session/problems/problem',
    });
    expect(sdk.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/session' },
      { activeProblemId: 'problem', updatedAt: 'server-time' },
    );
  });

  it('rejects a missing nested Problem without changing the Session', async () => {
    sdk.getDocFromServer.mockResolvedValue({ exists: () => false });
    await expect(setActiveProblem('session', 'outside')).rejects.toThrow(
      'belongs to this session',
    );
    expect(sdk.updateDoc).not.toHaveBeenCalled();
  });

  it('clears the pointer without a Problem read', async () => {
    await setActiveProblem('session', null);
    expect(sdk.getDocFromServer).not.toHaveBeenCalled();
    expect(sdk.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/session' },
      { activeProblemId: null, updatedAt: 'server-time' },
    );
  });

  it.each([null, { uid: 'anonymous', isAnonymous: true }])(
    'requires an authenticated officer for writes: %s',
    async (user) => {
      sdk.user.currentUser = user;
      await expect(setActiveProblem('session', null)).rejects.toThrow(
        'Sign in',
      );
      expect(sdk.getDocFromServer).not.toHaveBeenCalled();
      expect(sdk.updateDoc).not.toHaveBeenCalled();
    },
  );
});

describe('presentation listeners', () => {
  it('subscribes to Session.activeProblemId and returns the Firebase unsubscribe', () => {
    const onValue = vi.fn();
    const onError = vi.fn();
    const stop = subscribeToActiveProblem('session', onValue, onError);

    expect(listeners[0].reference.path).toBe('sessions/session');
    listeners[0].onValue(snapshot({ activeProblemId: 'problem' }));
    expect(onValue).toHaveBeenCalledExactlyOnceWith('problem');
    stop();
    expect(listeners[0].unsubscribe).toHaveBeenCalledOnce();
  });

  it('subscribes to Problem.answersVisible', () => {
    const onValue = vi.fn();
    const onError = vi.fn();
    subscribeToAnswersVisible('session', 'problem', onValue, onError);

    expect(listeners[0].reference.path).toBe(
      'sessions/session/problems/problem',
    );
    listeners[0].onValue(snapshot({ answersVisible: true }));
    expect(onValue).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('reports missing documents and invalid field values', () => {
    const onValue = vi.fn();
    const onError = vi.fn();
    subscribeToActiveProblem('session', onValue, onError);
    listeners[0].onValue(snapshot({}, false));
    listeners[0].onValue(snapshot({ activeProblemId: 42 }));
    listeners[0].onValue(snapshot({ activeProblemId: '' }));
    expect(onValue).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(3);
    expect(onError.mock.calls[0][0].message).toContain('no longer exists');
    expect(onError.mock.calls[1][0].message).toContain('invalid fields');
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
