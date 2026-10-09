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
  runTransaction: vi.fn(),
  transactionGet: vi.fn(),
  transactionSet: vi.fn(),
  transactionUpdate: vi.fn(),
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
  runTransaction: sdk.runTransaction,
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
  getBankProblem,
  deleteBankProblem,
  listMemberBankProblems,
  listBankProblemApproachTags,
  materializeSessionProblemInBank,
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
  sdk.transactionGet.mockResolvedValue({
    exists: () => true,
    data: () => ({ status: 'draft' }),
  });
  sdk.runTransaction.mockImplementation(async (_db, callback) =>
    callback({
      get: sdk.transactionGet,
      set: sdk.transactionSet,
      update: sdk.transactionUpdate,
    }),
  );
});

describe('Problem Bank snapshots', () => {
  it('loads Bank detail Solutions from Approaches without duplicate legacy reads', async () => {
    const result = await getBankProblem('source');

    expect(result?.problem.title).toBe('Two Sum');
    expect(result?.solutions).toEqual(solutions);
    for (const language of ['python', 'java', 'cpp']) {
      expect(
        sdk.getDocFromServer.mock.calls.filter(
          ([reference]) =>
            (reference as { path: string }).path ===
            `problemBank/source/solutions/${language}`,
        ),
      ).toHaveLength(1);
    }
  });

  it('deletes the Bank hierarchy in one batch and leaves Session references alone', async () => {
    const snapshot = (paths: string[]) => ({
      docs: paths.map((path) => ({
        id: path.split('/').at(-1),
        ref: { path },
      })),
    });
    sdk.getDocFromServer.mockResolvedValueOnce({
      exists: () => true,
      ref: { path: 'problemBank/source' },
    });
    sdk.getDocsFromServer.mockImplementation(
      async ({ path }: { path: string }) =>
        path === 'problemBank/source/solutions'
          ? snapshot([
              'problemBank/source/solutions/python',
              'problemBank/source/solutions/java',
            ])
          : path === 'problemBank/source/approaches'
            ? snapshot(['problemBank/source/approaches/primary'])
            : path === 'problemBank/source/approaches/primary/solutions'
              ? snapshot([
                  'problemBank/source/approaches/primary/solutions/python',
                  'problemBank/source/approaches/primary/solutions/java',
                  'problemBank/source/approaches/primary/solutions/cpp',
                ])
              : snapshot([]),
    );

    await deleteBankProblem('source');

    expect(
      sdk.batchDelete.mock.calls.map(([reference]) => reference.path),
    ).toEqual([
      'problemBank/source/solutions/python',
      'problemBank/source/solutions/java',
      'problemBank/source/approaches/primary/solutions/python',
      'problemBank/source/approaches/primary/solutions/java',
      'problemBank/source/approaches/primary/solutions/cpp',
      'problemBank/source/approaches/primary',
      'problemBank/source',
    ]);
    expect(sdk.commit).toHaveBeenCalledOnce();
    expect(sdk.batchUpdate).not.toHaveBeenCalled();
  });

  it('rejects a hierarchy over the Firestore batch limit before queuing writes', async () => {
    sdk.getDocFromServer.mockResolvedValueOnce({ exists: () => true });
    sdk.getDocsFromServer.mockImplementation(
      async ({ path }: { path: string }) =>
        path === 'problemBank/source/approaches'
          ? {
              docs: Array.from({ length: 167 }, (_, index) => ({
                id: `approach-${index}`,
                ref: {
                  path: `problemBank/source/approaches/approach-${index}`,
                },
              })),
            }
          : path.endsWith('/solutions') && path.includes('/approaches/')
            ? {
                docs: Array.from({ length: 3 }, (_, index) => ({
                  ref: { path: `${path}/solution-${index}` },
                })),
              }
            : { docs: [] },
    );

    await expect(deleteBankProblem('source')).rejects.toThrow(
      'too much stored content',
    );
    expect(sdk.batchDelete).not.toHaveBeenCalled();
    expect(sdk.commit).not.toHaveBeenCalled();
  });

  it('derives tag options from every Bank Approach using the supported taxonomy', async () => {
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [
        {
          id: 'first',
          data: () => ({ tags: ['Arrays', 'Hash Map'] }),
          metadata: { hasPendingWrites: false },
        },
        {
          id: 'second',
          data: () => ({ tags: ['Arrays', 'Two Pointers', 'Custom tag'] }),
          metadata: { hasPendingWrites: false },
        },
      ],
    });
    await expect(
      listBankProblemApproachTags(['source'], true),
    ).resolves.toEqual({
      source: ['Arrays', 'Hash Map', 'Two Pointers'],
    });
    expect(sdk.getDocsFromServer).toHaveBeenCalledWith({
      path: 'problemBank/source/approaches',
    });
  });

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
      { ...result.problem, approachesEnabled: true },
    );
    for (const language of ['python', 'java', 'cpp'] as const) {
      expect(sdk.batchSet).toHaveBeenCalledWith(
        {
          path: `sessions/session/problems/session-copy/solutions/${language}`,
        },
        solutions[language],
      );
    }
    expect(sdk.batchSet).toHaveBeenCalledWith(
      { path: 'sessions/session/problems/session-copy/approaches/primary' },
      { name: 'Primary Approach', tags: [], order: 0 },
    );
    for (const language of ['python', 'java', 'cpp'] as const)
      expect(sdk.batchSet).toHaveBeenCalledWith(
        {
          path: `sessions/session/problems/session-copy/approaches/primary/solutions/${language}`,
        },
        solutions[language],
      );
    expect(sdk.batchUpdate).toHaveBeenCalledWith(
      { path: 'sessions/session' },
      { bankProblemIds: { arrayUnion: 'source' } },
    );
    expect(sdk.commit).toHaveBeenCalledOnce();
  });

  it('creates a new public Bank Problem with no publication fields', async () => {
    const result = await createBankProblem();
    expect(result).not.toHaveProperty('isPublished');
    expect(sdk.batchSet).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'problemBank/session-copy' }),
      expect.objectContaining({
        hiddenByLiveSessionId: null,
      }),
    );
    expect(sdk.batchSet.mock.calls[0][1]).not.toHaveProperty('isPublic');
    expect(sdk.batchSet.mock.calls[0][1]).not.toHaveProperty('isPublished');
  });

  it('atomically materializes a prepared Session Problem and all three Solutions', async () => {
    await expect(
      materializeSessionProblemInBank('session', 'problem'),
    ).resolves.toEqual({ bankProblemId: 'reserved-bank' });
    expect(sdk.transactionSet).toHaveBeenCalledWith(
      { path: 'problemBank/reserved-bank' },
      {
        ...metadata,
        hiddenByLiveSessionId: null,
        approachesEnabled: true,
      },
    );
    const bankParent = sdk.transactionSet.mock.calls.find(
      ([reference]) => reference.path === 'problemBank/reserved-bank',
    )?.[1];
    expect(bankParent).not.toHaveProperty('isPublished');
    expect(bankParent).not.toHaveProperty('isPublic');
    for (const language of ['python', 'java', 'cpp'] as const) {
      expect(sdk.transactionSet).toHaveBeenCalledWith(
        { path: `problemBank/reserved-bank/solutions/${language}` },
        solutions[language],
      );
    }
    expect(sdk.transactionUpdate).toHaveBeenCalledWith(
      { path: 'sessions/session/problems/problem' },
      {
        bankProblemId: 'reserved-bank',
        bankOrigin: 'session',
        bankCopyPending: { deleteField: true },
      },
    );
    expect(sdk.transactionUpdate).toHaveBeenCalledWith(
      { path: 'sessions/session' },
      { bankProblemIds: { arrayUnion: 'reserved-bank' } },
    );
    expect(sdk.runTransaction).toHaveBeenCalledOnce();
  });

  it('lists all unhidden Bank Problems regardless of legacy publication fields', async () => {
    const records = [undefined, false, true].flatMap((isPublished, index) =>
      [undefined, false, true].map((isPublic, legacyIndex) => ({
        id: `bank-${index}-${legacyIndex}`,
        data: () => ({
          ...metadata,
          hiddenByLiveSessionId: null,
          ...(isPublished === undefined ? {} : { isPublished }),
          ...(isPublic === undefined ? {} : { isPublic }),
        }),
        metadata: { hasPendingWrites: false },
      })),
    );
    sdk.getDocsFromServer.mockResolvedValueOnce({ docs: records });
    await expect(listMemberBankProblems()).resolves.toHaveLength(9);
    expect(sdk.query).toHaveBeenCalledWith({ path: 'problemBank' }, [
      'hiddenByLiveSessionId',
      '==',
      null,
    ]);
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
    expect(sdk.runTransaction).not.toHaveBeenCalled();
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
    expect(sdk.transactionSet).not.toHaveBeenCalled();
    expect(sdk.runTransaction).not.toHaveBeenCalled();
  });

  it.each(['live', 'ended'] as const)(
    'rejects Session-to-Bank materialization while the Session is %s',
    async (status) => {
      sdk.transactionGet.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status }),
      });

      await expect(
        materializeSessionProblemInBank('session', 'problem'),
      ).rejects.toThrow(
        'Only draft Sessions can be materialized into the Problem Bank.',
      );
      expect(sdk.transactionSet).not.toHaveBeenCalled();
      expect(sdk.transactionUpdate).not.toHaveBeenCalled();
    },
  );

  it('retries failed materialization against the same Bank ID without creating duplicates', async () => {
    sdk.runTransaction.mockRejectedValueOnce(new Error('offline'));
    await expect(
      materializeSessionProblemInBank('session', 'problem'),
    ).rejects.toThrow('offline');
    await expect(
      materializeSessionProblemInBank('session', 'problem'),
    ).resolves.toEqual({ bankProblemId: 'reserved-bank' });
    const bankWrites = sdk.transactionSet.mock.calls.map(
      ([reference]) => reference.path,
    );
    expect(bankWrites).toEqual([
      'problemBank/reserved-bank',
      'problemBank/reserved-bank/solutions/python',
      'problemBank/reserved-bank/solutions/java',
      'problemBank/reserved-bank/solutions/cpp',
      'problemBank/reserved-bank/approaches/primary',
      'problemBank/reserved-bank/approaches/primary/solutions/python',
      'problemBank/reserved-bank/approaches/primary/solutions/java',
      'problemBank/reserved-bank/approaches/primary/solutions/cpp',
    ]);
    expect(sdk.runTransaction).toHaveBeenCalledTimes(2);
  });

  it('does not create another Bank entry after the copy has materialized', async () => {
    await materializeSessionProblemInBank('session', 'problem');
    const writeCount = sdk.transactionSet.mock.calls.length;
    pendingSessionProblem.bankCopyPending = false;
    await expect(
      materializeSessionProblemInBank('session', 'problem'),
    ).resolves.toBeNull();
    expect(sdk.transactionSet).toHaveBeenCalledTimes(writeCount);
    expect(sdk.runTransaction).toHaveBeenCalledOnce();
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
    expect(sdk.batchSet).toHaveBeenCalledTimes(8);
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
