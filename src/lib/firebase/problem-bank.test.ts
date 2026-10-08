import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  user: { currentUser: { uid: 'officer', isAnonymous: false } },
  db: {},
  getDocFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  arrayUnion: vi.fn((value: string) => ({ arrayUnion: value })),
  deleteField: vi.fn(() => ({ deleteField: true })),
  query: vi.fn((reference, ...constraints) => ({ reference, constraints })),
  where: vi.fn((...args) => args),
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  commit: vi.fn(),
}));

vi.mock('client-only', () => ({}));
vi.mock('./client', () => ({ getFirestoreDb: () => sdk.db }));
vi.mock('./auth', () => ({ getOfficerAuth: () => sdk.user }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (first: unknown, path?: string) => {
    if (path !== undefined) return { path };
    const collection = first as { path: string };
    return { path: `${collection.path}/session-copy`, id: 'session-copy' };
  },
  getDocFromServer: sdk.getDocFromServer,
  getDocsFromServer: sdk.getDocsFromServer,
  updateDoc: sdk.updateDoc,
  setDoc: sdk.setDoc,
  arrayUnion: sdk.arrayUnion,
  query: sdk.query,
  where: sdk.where,
  deleteField: sdk.deleteField,
  writeBatch: () => ({
    set: sdk.batchSet,
    update: sdk.batchUpdate,
    delete: sdk.batchDelete,
    commit: sdk.commit,
  }),
}));

import {
  addBankProblemToSession,
  createBankProblem,
  listMemberBankProblems,
  materializeSessionProblemInBank,
  updateBankPublication,
  updateBankProblem,
  updateBankSolution,
} from './problem-bank';

const metadata = {
  title: 'Two Sum',
  description: 'Find two values.',
  constraints: '2 ≤ n ≤ 100',
  exampleInput: '1 2',
  exampleOutput: '3',
  category: 'interview-style',
  difficulty: 'easy',
  leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
} as const;
const solutions = {
  python: { code: 'py', timeComplexity: 'O(n)' },
  java: { code: 'java', spaceComplexity: 'O(n)' },
  cpp: { code: 'cpp', timeComplexityReason: 'One pass.' },
};
const pendingSessionProblem = {
  ...metadata,
  order: 0,
  answersVisible: false,
  bankProblemId: 'reserved-bank',
  bankOrigin: 'session',
  bankCopyPending: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  pendingSessionProblem.bankCopyPending = true;
  sdk.getDocsFromServer.mockResolvedValue({ docs: [] });
  sdk.getDocFromServer.mockImplementation(
    async ({ path }: { path: string }) => {
      const value =
        path === 'sessions/session/problems/problem'
          ? pendingSessionProblem
          : path === 'problemBank/source'
            ? metadata
            : path.endsWith('/python')
              ? solutions.python
              : path.endsWith('/java')
                ? solutions.java
                : path.endsWith('/cpp')
                  ? solutions.cpp
                  : null;
      return {
        exists: () => value !== null,
        data: () => value,
        metadata: { hasPendingWrites: false },
      };
    },
  );
  sdk.commit.mockResolvedValue(undefined);
});

describe('Problem Bank snapshots', () => {
  it('copies metadata and all prepared language Solutions in one batch', async () => {
    const result = await addBankProblemToSession('session', 'source');
    expect(result).toEqual({
      id: 'session-copy',
      problem: {
        ...metadata,
        order: 0,
        answersVisible: false,
        bankProblemId: 'source',
        bankOrigin: 'bank',
      },
    });
    expect(sdk.batchSet).toHaveBeenCalledWith(
      { path: 'sessions/session/problems/session-copy' },
      result.problem,
    );
    for (const language of ['python', 'java', 'cpp'] as const) {
      expect(sdk.batchSet).toHaveBeenCalledWith(
        {
          path: `sessions/session/problems/session-copy/solutions/${language}`,
        },
        solutions[language],
      );
    }
    expect(sdk.batchUpdate).toHaveBeenCalledWith(
      { path: 'sessions/session' },
      { bankProblemIds: { arrayUnion: 'source' } },
    );
    expect(sdk.commit).toHaveBeenCalledOnce();
  });

  it('creates a new Bank Problem unpublished with no live hiding marker', async () => {
    const result = await createBankProblem();
    expect(result.isPublished).toBe(false);
    expect(sdk.batchSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'problemBank/session-copy' }),
      expect.objectContaining({
        isPublished: false,
        hiddenByLiveSessionId: null,
      }),
    );
  });

  it('atomically materializes a prepared Session Problem and all three Solutions', async () => {
    await expect(
      materializeSessionProblemInBank('session', 'problem'),
    ).resolves.toEqual({ bankProblemId: 'reserved-bank' });
    expect(sdk.batchSet).toHaveBeenCalledWith(
      { path: 'problemBank/reserved-bank' },
      {
        ...metadata,
        isPublished: false,
        hiddenByLiveSessionId: null,
      },
    );
    for (const language of ['python', 'java', 'cpp'] as const) {
      expect(sdk.batchSet).toHaveBeenCalledWith(
        { path: `problemBank/reserved-bank/solutions/${language}` },
        solutions[language],
      );
    }
    expect(sdk.batchUpdate).toHaveBeenCalledWith(
      { path: 'sessions/session/problems/problem' },
      {
        bankProblemId: 'reserved-bank',
        bankOrigin: 'session',
        bankCopyPending: { deleteField: true },
      },
    );
    expect(sdk.batchUpdate).toHaveBeenCalledWith(
      { path: 'sessions/session' },
      { bankProblemIds: { arrayUnion: 'reserved-bank' } },
    );
    expect(sdk.commit).toHaveBeenCalledOnce();
  });

  it('changes publication intent explicitly without clearing temporary live hiding', async () => {
    await updateBankPublication('source', true);
    expect(sdk.updateDoc).toHaveBeenCalledWith(
      { path: 'problemBank/source' },
      {
        isPublished: true,
        isPublic: { deleteField: true },
      },
    );
  });

  it('keeps legacy publication deterministic: only legacy true is public intent', async () => {
    const legacyPublic = {
      id: 'legacy-public',
      data: () => ({ ...metadata, isPublic: true }),
      metadata: { hasPendingWrites: false },
    };
    const canonicalPublic = {
      id: 'canonical-public',
      data: () => ({ ...metadata, isPublished: true }),
      metadata: { hasPendingWrites: false },
    };
    sdk.getDocsFromServer
      .mockResolvedValueOnce({ docs: [canonicalPublic] })
      .mockResolvedValueOnce({ docs: [legacyPublic] });
    await expect(listMemberBankProblems()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'legacy-public', isPublished: true }),
        expect.objectContaining({ id: 'canonical-public', isPublished: true }),
      ]),
    );
  });

  it('does not publish a new direct Session Problem while it is still Untitled', async () => {
    sdk.getDocFromServer.mockImplementation(
      async ({ path }: { path: string }) => ({
        exists: () => true,
        data: () =>
          path === 'sessions/session/problems/problem'
            ? { ...pendingSessionProblem, title: 'Untitled Problem' }
            : null,
        metadata: { hasPendingWrites: false },
      }),
    );
    await expect(
      materializeSessionProblemInBank('session', 'problem'),
    ).resolves.toBeNull();
    expect(sdk.getDocFromServer).toHaveBeenCalledOnce();
    expect(sdk.commit).not.toHaveBeenCalled();
  });

  it('does not report success or partially publish when a Solution read fails', async () => {
    const error = new Error('offline');
    sdk.getDocFromServer.mockImplementation(
      async ({ path }: { path: string }) => {
        if (path.endsWith('/cpp')) throw error;
        const value =
          path === 'sessions/session/problems/problem'
            ? pendingSessionProblem
            : path.endsWith('/python')
              ? solutions.python
              : solutions.java;
        return {
          exists: () => true,
          data: () => value,
          metadata: { hasPendingWrites: false },
        };
      },
    );
    await expect(
      materializeSessionProblemInBank('session', 'problem'),
    ).rejects.toBe(error);
    expect(sdk.batchSet).not.toHaveBeenCalled();
    expect(sdk.commit).not.toHaveBeenCalled();
  });

  it('retries failed materialization against the same Bank ID without creating duplicates', async () => {
    sdk.commit.mockRejectedValueOnce(new Error('offline'));
    await expect(
      materializeSessionProblemInBank('session', 'problem'),
    ).rejects.toThrow('offline');
    await expect(
      materializeSessionProblemInBank('session', 'problem'),
    ).resolves.toEqual({ bankProblemId: 'reserved-bank' });
    const bankWrites = sdk.batchSet.mock.calls.map(
      ([reference]) => reference.path,
    );
    expect(bankWrites).toEqual([
      'problemBank/reserved-bank',
      'problemBank/reserved-bank/solutions/python',
      'problemBank/reserved-bank/solutions/java',
      'problemBank/reserved-bank/solutions/cpp',
      'problemBank/reserved-bank',
      'problemBank/reserved-bank/solutions/python',
      'problemBank/reserved-bank/solutions/java',
      'problemBank/reserved-bank/solutions/cpp',
    ]);
    expect(sdk.commit).toHaveBeenCalledTimes(2);
  });

  it('does not create another Bank entry after the copy has materialized', async () => {
    await materializeSessionProblemInBank('session', 'problem');
    const writeCount = sdk.batchSet.mock.calls.length;
    pendingSessionProblem.bankCopyPending = false;
    await expect(
      materializeSessionProblemInBank('session', 'problem'),
    ).resolves.toBeNull();
    expect(sdk.batchSet).toHaveBeenCalledTimes(writeCount);
    expect(sdk.commit).toHaveBeenCalledOnce();
  });

  it('does not materialize legacy Session-origin links or synchronize later edits', async () => {
    sdk.getDocFromServer.mockImplementation(
      async ({ path }: { path: string }) => ({
        exists: () => true,
        data: () =>
          path === 'sessions/session/problems/problem'
            ? {
                ...pendingSessionProblem,
                bankCopyPending: undefined,
                bankProblemId: 'legacy-bank',
              }
            : null,
        metadata: { hasPendingWrites: false },
      }),
    );
    await expect(
      materializeSessionProblemInBank('session', 'problem'),
    ).resolves.toBeNull();
    expect(sdk.commit).not.toHaveBeenCalled();
  });

  it('does not report success when a copied Solution cannot be read', async () => {
    const error = new Error('offline');
    sdk.getDocFromServer.mockImplementation(
      async ({ path }: { path: string }) => {
        if (path.endsWith('/cpp')) throw error;
        const value =
          path === 'problemBank/source'
            ? metadata
            : path.endsWith('/python')
              ? solutions.python
              : solutions.java;
        return {
          exists: () => true,
          data: () => value,
          metadata: { hasPendingWrites: false },
        };
      },
    );
    await expect(addBankProblemToSession('session', 'source')).rejects.toBe(
      error,
    );
    expect(sdk.commit).not.toHaveBeenCalled();
  });

  it('does not report success when the atomic snapshot write fails', async () => {
    const error = new Error('offline');
    sdk.commit.mockRejectedValueOnce(error);
    await expect(addBankProblemToSession('session', 'source')).rejects.toBe(
      error,
    );
    expect(sdk.batchSet).toHaveBeenCalledTimes(4);
    expect(sdk.commit).toHaveBeenCalledOnce();
  });

  it('saves Bank metadata only to the reusable Bank document', async () => {
    await updateBankProblem('source', metadata);
    expect(sdk.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'problemBank/source' },
      expect.objectContaining({
        title: 'Two Sum',
        category: 'interview-style',
      }),
    );
  });

  it('saves Bank Solutions only to the reusable Bank document', async () => {
    await updateBankSolution('source', 'java', solutions.java);
    expect(sdk.setDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'problemBank/source/solutions/java' },
      solutions.java,
    );
  });
});
