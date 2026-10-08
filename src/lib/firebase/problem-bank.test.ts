import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  user: { currentUser: { uid: 'officer', isAnonymous: false } },
  db: {},
  getDocFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  arrayUnion: vi.fn((value: string) => ({ arrayUnion: value })),
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
  writeBatch: () => ({
    set: sdk.batchSet,
    update: sdk.batchUpdate,
    delete: sdk.batchDelete,
    commit: sdk.commit,
  }),
}));

import {
  addBankProblemToSession,
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

beforeEach(() => {
  vi.clearAllMocks();
  sdk.getDocsFromServer.mockResolvedValue({ docs: [] });
  sdk.getDocFromServer.mockImplementation(
    async ({ path }: { path: string }) => {
      const value =
        path === 'problemBank/source'
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
