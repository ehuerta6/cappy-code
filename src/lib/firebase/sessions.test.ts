import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

const sdk = vi.hoisted(() => ({
  user: {
    currentUser: { uid: 'officer', isAnonymous: false } as {
      uid: string;
      isAnonymous: boolean;
    } | null,
  },
  db: {},
  addDoc: vi.fn(),
  getCountFromServer: vi.fn(),
  getDocFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
  runTransaction: vi.fn(),
  transactionGet: vi.fn(),
  transactionUpdate: vi.fn(),
  transactionSet: vi.fn(),
  transactionStatus: 'draft' as string,
  transactionLiveSessionId: null as string | null,
  transactionLiveSessionExists: false,
  updateDoc: vi.fn(),
  batchDelete: vi.fn(),
  batchUpdate: vi.fn(),
  batchCommit: vi.fn(),
}));
vi.mock('client-only', () => ({}));
vi.mock('./client', () => ({
  getFirestoreDb: () => sdk.db,
}));
vi.mock('./auth', () => ({ getOfficerAuth: vi.fn(() => sdk.user) }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  collection: vi.fn((_db, path) => ({ path })),
  query: vi.fn((reference, ...constraints) => ({
    ...reference,
    isQuery: true,
    constraints,
  })),
  where: vi.fn((...args) => args),
  doc: vi.fn((_db, path) => ({ path })),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
  addDoc: sdk.addDoc,
  getDocsFromServer: sdk.getDocsFromServer,
  getDocFromServer: sdk.getDocFromServer,
  getCountFromServer: sdk.getCountFromServer,
  runTransaction: sdk.runTransaction,
  updateDoc: sdk.updateDoc,
  writeBatch: () => ({
    delete: sdk.batchDelete,
    update: sdk.batchUpdate,
    commit: sdk.batchCommit,
  }),
}));
import { getOfficerAuth } from './auth';
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  transitionSession,
  updateSession,
} from './sessions';

const metadata = {
  branch: 'intro' as const,
  title: 'Arrays',
  date: '2026-10-08',
};
const timestamp = Timestamp.fromMillis(1000);
const session = {
  ...metadata,
  status: 'draft',
  createdAt: timestamp,
  updatedAt: timestamp,
};
function document(id = 'session-id', data: unknown = session, pending = false) {
  return { id, data: () => data, metadata: { hasPendingWrites: pending } };
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.user.currentUser = { uid: 'officer', isAnonymous: false };
  sdk.addDoc.mockResolvedValue({ id: 'new-session' });
  sdk.updateDoc.mockResolvedValue(undefined);
  sdk.batchCommit.mockResolvedValue(undefined);
  sdk.transactionStatus = 'draft';
  sdk.transactionLiveSessionId = null;
  sdk.transactionLiveSessionExists = false;
  sdk.getDocFromServer.mockImplementation(async (reference) => ({
    exists: () =>
      reference.path === 'sessionControl/liveSession'
        ? sdk.transactionLiveSessionExists
        : true,
    data: () =>
      reference.path === 'sessionControl/liveSession'
        ? { sessionId: sdk.transactionLiveSessionId }
        : { status: sdk.transactionStatus },
  }));
  sdk.transactionGet.mockImplementation(async (reference) => {
    if (reference.path === 'sessionControl/liveSession')
      return {
        exists: () => sdk.transactionLiveSessionExists,
        data: () => ({ sessionId: sdk.transactionLiveSessionId }),
      };
    if (reference.path === 'problemBank/deleted-source')
      return { exists: () => false, data: () => undefined };
    return {
      exists: () => true,
      data: () => ({ ...session, status: sdk.transactionStatus }),
    };
  });
  sdk.runTransaction.mockImplementation(async (_db, callback) =>
    callback({
      get: sdk.transactionGet,
      update: sdk.transactionUpdate,
      set: sdk.transactionSet,
    }),
  );
  sdk.getCountFromServer.mockResolvedValue({ data: () => ({ count: 1 }) });
  sdk.getDocsFromServer.mockImplementation(async (reference) =>
    reference.path === 'sessions' && reference.constraints
      ? { docs: [] }
      : reference.path === 'sessions'
        ? { docs: [document()] }
        : { docs: [], empty: false },
  );
});

describe('officer session persistence', () => {
  it('loads a direct Session and its problem count concurrently without listing every Session', async () => {
    sdk.getDocFromServer.mockResolvedValueOnce({
      exists: () => true,
      data: () => session,
      metadata: { hasPendingWrites: false },
    });
    let resolveCount:
      ((value: { data: () => { count: number } }) => void) | undefined;
    sdk.getCountFromServer.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCount = resolve;
      }),
    );

    const pending = getSession('session-id');
    expect(sdk.getDocFromServer).toHaveBeenCalledWith({
      path: 'sessions/session-id',
    });
    expect(sdk.getCountFromServer).toHaveBeenCalledWith({
      path: 'sessions/session-id/problems',
    });
    resolveCount?.({ data: () => ({ count: 1 }) });
    await expect(pending).resolves.toEqual({
      id: 'session-id',
      session,
      problemCount: 1,
    });
    expect(sdk.getDocsFromServer).not.toHaveBeenCalled();
  });

  it('creates only required fields with draft status and server timestamps', async () => {
    expect(await createSession({ ...metadata, title: ' Arrays ' })).toBe(
      'new-session',
    );
    expect(getOfficerAuth).toHaveBeenCalledWith();
    expect(sdk.addDoc).toHaveBeenCalledWith(
      { path: 'sessions' },
      {
        ...session,
        bankProblemIds: [],
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      },
    );
  });

  it.each(['intro', 'general', 'icpc'] as const)(
    'creates a draft Session in the %s branch',
    async (branch) => {
      await createSession({ ...metadata, branch });
      expect(sdk.addDoc).toHaveBeenCalledWith(
        { path: 'sessions' },
        expect.objectContaining({ branch, status: 'draft' }),
      );
    },
  );

  it('edits only metadata and updatedAt, leaving createdAt and lifecycle fields stable', async () => {
    await updateSession('session-id', {
      ...metadata,
      title: 'Hashing',
      date: '2026-10-09',
    });
    expect(sdk.updateDoc).toHaveBeenCalledWith(
      { path: 'sessions/session-id' },
      {
        title: 'Hashing',
        date: '2026-10-09',
        branch: 'intro',
        updatedAt: 'SERVER_TIMESTAMP',
      },
    );
  });

  it('reads server records, keeping IDs separate and sorting calendar dates', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        document('later'),
        document('earlier', { ...session, date: '2026-10-07' }),
      ],
    });
    const records = await listSessions();
    expect(records.map((record) => record.id)).toEqual(['earlier', 'later']);
    expect(records[0].problemCount).toBe(1);
    expect(records[1].session).toEqual(session);
    expect(records[1].session).not.toHaveProperty('id');
    expect(sdk.getDocsFromServer).toHaveBeenCalledWith({ path: 'sessions' });
  });

  it('ignores a legacy activeProblemId field when reading a Session', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        document('legacy', { ...session, activeProblemId: 'old-problem' }),
      ],
    });
    const [record] = await listSessions();
    expect(record.session).not.toHaveProperty('activeProblemId');
    expect(record.session).toMatchObject({ title: 'Arrays', status: 'draft' });
  });

  it('treats stored Sessions without a branch as Intro and rejects unsupported branches', async () => {
    const legacySession = { ...session };
    Reflect.deleteProperty(legacySession, 'branch');
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [document('legacy', legacySession)],
    });
    await expect(listSessions()).resolves.toMatchObject([
      { session: { branch: 'intro' } },
    ]);
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [document('invalid', { ...session, branch: 'advanced' })],
    });
    await expect(listSessions()).rejects.toThrow(
      'Choose Intro, General, or ICPC',
    );
  });

  it('keeps Sessions available when a Problem count cannot be read', async () => {
    sdk.getCountFromServer.mockRejectedValueOnce(new Error('offline'));
    const records = await listSessions();
    expect(records).toHaveLength(1);
    expect(records[0].problemCount).toBeNull();
    expect(records[0].session).toEqual(session);
  });

  it('rejects pending timestamps instead of representing them as persisted success', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [document('pending', session, true)],
    });
    await expect(listSessions()).rejects.toThrow('awaiting confirmation');
  });

  it('rejects malformed persisted timestamps', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [document('invalid', { ...session, createdAt: null })],
    });
    await expect(listSessions()).rejects.toThrow('invalid fields');
  });

  it('returns an empty list from an empty Firestore collection', async () => {
    sdk.getDocsFromServer.mockResolvedValue({ docs: [] });
    expect(await listSessions()).toEqual([]);
  });

  it('goes live in a transaction only for a draft with at least one Problem', async () => {
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [document('problem')],
    });
    await transitionSession('session-id', 'live');
    expect(sdk.runTransaction).toHaveBeenCalledOnce();
    expect(sdk.transactionGet).toHaveBeenCalledWith({
      path: 'sessions/session-id',
    });
    expect(sdk.transactionUpdate).toHaveBeenCalledWith(
      { path: 'sessions/session-id' },
      { status: 'live', updatedAt: 'SERVER_TIMESTAMP' },
    );
    expect(sdk.transactionSet).toHaveBeenCalledWith(
      { path: 'sessionControl/liveSession' },
      { sessionId: 'session-id' },
    );
    expect(sdk.updateDoc).not.toHaveBeenCalled();
  });

  it('only writes the live-hiding marker when a Session goes Live', async () => {
    sdk.transactionLiveSessionExists = true;
    sdk.transactionGet.mockImplementation(async (reference) => {
      if (reference.path === 'sessionControl/liveSession')
        return { exists: () => true, data: () => ({ sessionId: null }) };
      if (reference.path === 'sessions/session-id')
        return {
          exists: () => true,
          data: () => ({ ...session, bankProblemIds: ['bank-one'] }),
        };
      return {
        exists: () => true,
        ref: { path: reference.path },
        data: () => ({
          isPublished: false,
          isPublic: true,
          hiddenByLiveSessionId: null,
        }),
      };
    });
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [document('problem')],
    });

    await transitionSession('session-id', 'live');

    expect(sdk.transactionUpdate).toHaveBeenCalledWith(
      { path: 'problemBank/bank-one' },
      { hiddenByLiveSessionId: 'session-id' },
    );
    expect(sdk.transactionUpdate.mock.calls[0][1]).not.toHaveProperty(
      'isPublished',
    );
    expect(sdk.transactionUpdate.mock.calls[0][1]).not.toHaveProperty(
      'isPublic',
    );
  });

  it.each(['draft', 'ended'] as const)(
    'clears an already-linked Bank Problem when a live Session becomes %s',
    async (nextStatus) => {
      sdk.transactionStatus = 'live';
      sdk.transactionLiveSessionExists = true;
      sdk.transactionLiveSessionId = 'session-id';
      sdk.transactionGet.mockImplementation(async (reference) => {
        if (reference.path === 'sessionControl/liveSession')
          return {
            exists: () => true,
            data: () => ({ sessionId: 'session-id' }),
          };
        if (reference.path === 'sessions/session-id')
          return {
            exists: () => true,
            data: () => ({
              ...session,
              status: 'live',
              bankProblemIds: ['bank-one'],
            }),
          };
        return {
          exists: () => true,
          ref: { path: reference.path },
          data: () => ({ hiddenByLiveSessionId: 'session-id' }),
        };
      });

      await transitionSession('session-id', nextStatus);

      expect(sdk.transactionUpdate).toHaveBeenCalledWith(
        { path: 'problemBank/bank-one' },
        { hiddenByLiveSessionId: null },
      );
    },
  );

  it('blocks Go Live when legacy-lock initialization finds another live Session', async () => {
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [document('problem')],
    });
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [document('already-live', { ...session, status: 'live' })],
    });
    await expect(transitionSession('session-id', 'live')).rejects.toThrow(
      'Another Session is already live',
    );
    expect(sdk.transactionSet).not.toHaveBeenCalled();
    expect(sdk.transactionUpdate).not.toHaveBeenCalled();
  });

  it('blocks Go Live when the live-session pointer is already claimed', async () => {
    sdk.transactionLiveSessionExists = true;
    sdk.transactionLiveSessionId = 'already-live';
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [document('problem')],
    });
    await expect(transitionSession('session-id', 'live')).rejects.toThrow(
      'Another Session is already live',
    );
    expect(sdk.transactionSet).not.toHaveBeenCalled();
    expect(sdk.transactionUpdate).not.toHaveBeenCalled();
  });

  it('ends only a live Session and changes no Problem answer visibility', async () => {
    sdk.transactionStatus = 'live';
    sdk.transactionLiveSessionExists = true;
    sdk.transactionLiveSessionId = 'session-id';
    await transitionSession('session-id', 'ended');
    expect(sdk.getDocsFromServer).not.toHaveBeenCalled();
    expect(sdk.transactionUpdate).toHaveBeenCalledWith(
      { path: 'sessions/session-id' },
      { status: 'ended', updatedAt: 'SERVER_TIMESTAMP' },
    );
    expect(sdk.transactionUpdate.mock.calls[0][1]).not.toHaveProperty(
      'answersVisible',
    );
    expect(sdk.transactionSet).toHaveBeenCalledWith(
      { path: 'sessionControl/liveSession' },
      { sessionId: null },
    );
  });

  it('returns a live Session to draft without touching prepared content or reveal state', async () => {
    sdk.transactionStatus = 'live';
    sdk.transactionLiveSessionExists = true;
    sdk.transactionLiveSessionId = 'session-id';
    await transitionSession('session-id', 'draft');
    expect(sdk.transactionUpdate).toHaveBeenCalledWith(
      { path: 'sessions/session-id' },
      { status: 'draft', updatedAt: 'SERVER_TIMESTAMP' },
    );
    expect(sdk.transactionSet).toHaveBeenCalledWith(
      { path: 'sessionControl/liveSession' },
      { sessionId: null },
    );
    expect(sdk.transactionUpdate.mock.calls[0][1]).not.toHaveProperty(
      'answersVisible',
    );
  });

  it.each(['draft', 'ended'] as const)(
    'transitions a live Session to %s when a referenced Bank source was deleted',
    async (nextStatus) => {
      sdk.transactionStatus = 'live';
      sdk.transactionLiveSessionExists = true;
      sdk.transactionLiveSessionId = 'session-id';
      sdk.transactionGet.mockImplementation(async (reference) => {
        if (reference.path === 'sessionControl/liveSession')
          return {
            exists: () => true,
            data: () => ({ sessionId: 'session-id' }),
          };
        if (reference.path === 'sessions/session-id')
          return {
            exists: () => true,
            data: () => ({
              ...session,
              status: 'live',
              bankProblemIds: ['deleted-source'],
            }),
          };
        return { exists: () => false, data: () => undefined };
      });

      await expect(
        transitionSession('session-id', nextStatus),
      ).resolves.toBeUndefined();

      expect(sdk.transactionGet).toHaveBeenCalledWith({
        path: 'problemBank/deleted-source',
      });
      expect(sdk.transactionUpdate).toHaveBeenCalledWith(
        { path: 'sessions/session-id' },
        { status: nextStatus, updatedAt: 'SERVER_TIMESTAMP' },
      );
      expect(
        sdk.transactionUpdate.mock.calls.some(
          ([reference]) => reference.path === 'problemBank/deleted-source',
        ),
      ).toBe(false);
    },
  );

  it('cleans up a legacy live Session without clearing another Session’s live claim', async () => {
    sdk.transactionStatus = 'live';
    sdk.transactionLiveSessionExists = true;
    sdk.transactionLiveSessionId = 'current-live';
    await transitionSession('legacy-live', 'draft');
    expect(sdk.transactionUpdate).toHaveBeenCalledWith(
      { path: 'sessions/legacy-live' },
      { status: 'draft', updatedAt: 'SERVER_TIMESTAMP' },
    );
    expect(sdk.transactionSet).not.toHaveBeenCalled();
  });

  it('rejects empty Go Live attempts and invalid state transitions before commit', async () => {
    sdk.getDocsFromServer.mockResolvedValueOnce({ docs: [], empty: true });
    await expect(transitionSession('session-id', 'live')).rejects.toThrow(
      'Add at least one problem',
    );
    expect(sdk.runTransaction).not.toHaveBeenCalled();
    sdk.transactionStatus = 'ended';
    await expect(transitionSession('session-id', 'live')).rejects.toThrow(
      'Only draft sessions can go live',
    );
    expect(sdk.transactionUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['draft', 'draft'],
    ['draft', 'ended'],
    ['live', 'live'],
    ['ended', 'draft'],
    ['ended', 'live'],
    ['ended', 'ended'],
  ])('rejects unsupported transition %s → %s', async (current, next) => {
    sdk.transactionStatus = current;
    await expect(
      transitionSession('session-id', next as 'live' | 'draft' | 'ended'),
    ).rejects.toThrow();
    expect(sdk.transactionUpdate).not.toHaveBeenCalled();
  });

  it('atomically deletes known solutions, child problems and the session without changing status', async () => {
    sdk.getDocsFromServer.mockImplementation(async (reference) =>
      reference.path === 'sessions/session-id/problems'
        ? { docs: [document('first'), document('second')] }
        : reference.path === 'sessions/session-id/problems/first/approaches'
          ? { docs: [document('primary')] }
          : reference.path === 'sessions/session-id/problems/second/approaches'
            ? { docs: [document('alternate')] }
            : { docs: [] },
    );
    await deleteSession('session-id');
    expect(
      sdk.batchDelete.mock.calls.map(([reference]) => reference.path),
    ).toEqual([
      'sessions/session-id/problems/first/approaches/primary/solutions/python',
      'sessions/session-id/problems/first/approaches/primary/solutions/java',
      'sessions/session-id/problems/first/approaches/primary/solutions/cpp',
      'sessions/session-id/problems/first/approaches/primary',
      'sessions/session-id/problems/first/solutions/python',
      'sessions/session-id/problems/first/solutions/java',
      'sessions/session-id/problems/first/solutions/cpp',
      'sessions/session-id/problems/first',
      'sessions/session-id/problems/second/approaches/alternate/solutions/python',
      'sessions/session-id/problems/second/approaches/alternate/solutions/java',
      'sessions/session-id/problems/second/approaches/alternate/solutions/cpp',
      'sessions/session-id/problems/second/approaches/alternate',
      'sessions/session-id/problems/second/solutions/python',
      'sessions/session-id/problems/second/solutions/java',
      'sessions/session-id/problems/second/solutions/cpp',
      'sessions/session-id/problems/second',
      'sessions/session-id',
    ]);
    expect(sdk.batchCommit).toHaveBeenCalledTimes(1);
    expect(sdk.updateDoc).not.toHaveBeenCalled();
  });

  it('atomically releases the live claim when deleting a live Session', async () => {
    sdk.transactionStatus = 'live';
    sdk.transactionLiveSessionExists = true;
    sdk.transactionLiveSessionId = 'session-id';
    sdk.getDocsFromServer.mockResolvedValue({ docs: [] });
    await deleteSession('session-id');
    expect(sdk.batchUpdate).toHaveBeenCalledWith(
      { path: 'sessionControl/liveSession' },
      { sessionId: null },
    );
    expect(sdk.batchDelete).toHaveBeenCalledWith({
      path: 'sessions/session-id',
    });
    expect(sdk.batchCommit).toHaveBeenCalledOnce();
  });

  it('deletes a Session while releasing a live claim with a missing Bank source', async () => {
    sdk.getDocsFromServer.mockResolvedValue({ docs: [] });
    sdk.getDocFromServer.mockImplementation(async (reference) => {
      if (reference.path === 'sessions/session-id')
        return {
          exists: () => true,
          data: () => ({
            ...session,
            status: 'live',
            bankProblemIds: ['deleted-source'],
          }),
        };
      if (reference.path === 'sessionControl/liveSession')
        return {
          exists: () => true,
          data: () => ({ sessionId: 'session-id' }),
        };
      return { exists: () => false, data: () => undefined };
    });

    await expect(deleteSession('session-id')).resolves.toBeUndefined();

    expect(sdk.batchUpdate).toHaveBeenCalledWith(
      { path: 'sessionControl/liveSession' },
      { sessionId: null },
    );
    expect(sdk.batchDelete).toHaveBeenCalledWith({
      path: 'sessions/session-id',
    });
    expect(
      sdk.batchUpdate.mock.calls.some(
        ([reference]) => reference.path === 'problemBank/deleted-source',
      ),
    ).toBe(false);
    expect(sdk.batchCommit).toHaveBeenCalledOnce();
  });

  it('deletes an empty session in one batch and rejects oversized cascades before writing', async () => {
    sdk.getDocsFromServer.mockImplementation(async (reference) =>
      reference.path === 'sessions/empty/problems'
        ? { docs: [] }
        : { docs: [] },
    );
    await deleteSession('empty');
    expect(sdk.batchDelete).toHaveBeenCalledWith({ path: 'sessions/empty' });
    sdk.batchDelete.mockClear();
    sdk.getDocsFromServer.mockImplementation(async (reference) =>
      reference.path === 'sessions/large/problems'
        ? {
            docs: Array.from({ length: 125 }, (_, index) =>
              document(String(index)),
            ),
          }
        : { docs: [] },
    );
    await expect(deleteSession('large')).rejects.toThrow('Too many problems');
    expect(sdk.batchDelete).not.toHaveBeenCalled();
  });

  it('counts each Approach and its three Solutions toward the Session batch limit', async () => {
    sdk.getDocsFromServer.mockImplementation(async (reference) =>
      reference.path === 'sessions/large/problems'
        ? {
            docs: Array.from({ length: 63 }, (_, index) =>
              document(String(index)),
            ),
          }
        : reference.path.startsWith('sessions/large/problems/')
          ? { docs: [document('primary')] }
          : { docs: [] },
    );
    await expect(deleteSession('large')).rejects.toThrow('Too many problems');
    expect(sdk.batchDelete).not.toHaveBeenCalled();
  });

  it('propagates failed cascade commits without presenting deletion success', async () => {
    const error = new Error('offline');
    sdk.batchCommit.mockRejectedValue(error);
    await expect(deleteSession('session-id')).rejects.toBe(error);
  });

  it.each([null, { uid: 'anonymous-auth', isAnonymous: true }])(
    'blocks all operations without an officer Firebase session (%s)',
    async (user) => {
      sdk.user.currentUser = user;
      await expect(createSession(metadata)).rejects.toThrow('Sign in');
      await expect(listSessions()).rejects.toThrow('Sign in');
      await expect(updateSession('id', metadata)).rejects.toThrow('Sign in');
      await expect(deleteSession('id')).rejects.toThrow('Sign in');
      expect(sdk.addDoc).not.toHaveBeenCalled();
      expect(sdk.getDocsFromServer).not.toHaveBeenCalled();
      expect(sdk.updateDoc).not.toHaveBeenCalled();
    },
  );

  it('checks the current Firebase session again after sign-out', async () => {
    await listSessions();
    sdk.user.currentUser = null;
    await expect(updateSession('id', metadata)).rejects.toThrow('Sign in');
  });

  it('does not hide Firestore failures', async () => {
    const error = new Error('permission denied');
    sdk.addDoc.mockRejectedValue(error);
    sdk.getDocsFromServer.mockRejectedValue(error);
    sdk.updateDoc.mockRejectedValue(error);
    sdk.batchCommit.mockRejectedValue(error);
    await expect(createSession(metadata)).rejects.toBe(error);
    await expect(listSessions()).rejects.toBe(error);
    await expect(updateSession('id', metadata)).rejects.toBe(error);
    await expect(deleteSession('id')).rejects.toBe(error);
  });
});
