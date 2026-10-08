import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  user: { currentUser: { uid: 'officer', isAnonymous: false } },
  db: {},
  sequence: 0,
  sessionStatus: 'draft',
  bankProblemIds: ['bank-two-sum'],
  getDocFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn(),
}));

vi.mock('client-only', () => ({}));
vi.mock('./client', () => ({ getFirestoreDb: () => sdk.db }));
vi.mock('./auth', () => ({ getOfficerAuth: () => sdk.user }));
vi.mock('./solutions', () => ({ getApproaches: vi.fn() }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (first: { path: string } | unknown, path?: string) => {
    if (path) return { path };
    const reference = first as { path: string };
    const id = `copy-${++sdk.sequence}`;
    return { id, path: `${reference.path}/${id}` };
  },
  writeBatch: () => ({
    set: sdk.set,
    update: sdk.update,
    delete: sdk.delete,
    commit: sdk.commit,
  }),
  getDocFromServer: sdk.getDocFromServer,
  getDocsFromServer: sdk.getDocsFromServer,
}));

import { getApproaches } from './solutions';
import { duplicateProblem } from './problems';

const problem = {
  title: 'Two Sum',
  description: 'Find a pair',
  exampleInput: '2 7',
  exampleOutput: '9',
  constraints: '1 ≤ n ≤ 100',
  order: 1,
  answersVisible: true,
  leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
  difficulty: 'medium',
  category: 'interview-style',
  bankProblemId: 'bank-two-sum',
  bankOrigin: 'bank',
};
const approach = {
  id: 'same-id-in-source',
  name: 'Hash Map',
  tags: ['Arrays', 'Hash Map'],
  order: 2,
  solutions: {
    python: {
      code: 'python',
      timeComplexity: 'O(n)',
      timeComplexityReason: 'scan',
    },
    java: {
      code: 'java',
      spaceComplexity: 'O(n)',
      spaceComplexityReason: 'map',
    },
    cpp: { code: 'cpp' },
  },
};
const laterApproach = {
  ...approach,
  id: 'another-source-id',
  name: 'Two Pointers',
  tags: ['Arrays', 'Two Pointers'],
  order: 5,
};
function firestoreDocument(id: string, data: unknown, pending = false) {
  return { id, data: () => data, metadata: { hasPendingWrites: pending } };
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.sequence = 0;
  sdk.user.currentUser = { uid: 'officer', isAnonymous: false };
  sdk.sessionStatus = 'draft';
  sdk.bankProblemIds = ['bank-two-sum'];
  sdk.commit.mockResolvedValue(undefined);
  sdk.getDocFromServer.mockResolvedValue({
    exists: () => true,
    data: () => ({
      status: sdk.sessionStatus,
      bankProblemIds: sdk.bankProblemIds,
    }),
    metadata: { hasPendingWrites: false },
  });
  sdk.getDocsFromServer.mockResolvedValue({
    docs: [
      firestoreDocument('first', { ...problem, order: 0 }),
      firestoreDocument('source', problem),
      firestoreDocument('third', { ...problem, order: 2 }),
    ],
  });
  vi.mocked(getApproaches).mockResolvedValue([approach]);
});

describe('duplicateProblem', () => {
  it('creates an adjacent independent copy, shifts later order, hides answers, and preserves Bank provenance', async () => {
    const result = await duplicateProblem('session', 'source');

    expect(result).toEqual({
      id: 'copy-1',
      problem: expect.objectContaining({
        ...problem,
        title: 'Two Sum Copy',
        order: 2,
        answersVisible: false,
      }),
    });
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/session/problems/copy-1' }),
      expect.objectContaining({
        ...problem,
        title: 'Two Sum Copy',
        order: 2,
        answersVisible: false,
        approachesEnabled: true,
      }),
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sessions/session/problems/copy-1/approaches/copy-2',
      }),
      { name: 'Hash Map', tags: ['Arrays', 'Hash Map'], order: 0 },
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sessions/session/problems/copy-1/approaches/copy-2/solutions/python',
      }),
      approach.solutions.python,
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sessions/session/problems/copy-1/approaches/copy-2/solutions/java',
      }),
      approach.solutions.java,
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sessions/session/problems/copy-1/approaches/copy-2/solutions/cpp',
      }),
      approach.solutions.cpp,
    );
    expect(sdk.update).toHaveBeenCalledWith(
      { path: 'sessions/session/problems/third' },
      { order: 3 },
    );
    expect(
      sdk.set.mock.calls.some(([reference]) =>
        reference.path.endsWith('/same-id-in-source'),
      ),
    ).toBe(false);
    expect(sdk.commit).toHaveBeenCalledOnce();
  });

  it.each(['live', 'ended'])(
    'denies structural duplication in a %s Session before writes',
    async (status) => {
      sdk.sessionStatus = status;
      await expect(duplicateProblem('session', 'source')).rejects.toThrow(
        /draft/i,
      );
      expect(sdk.commit).not.toHaveBeenCalled();
    },
  );

  it('allows duplication only when the loaded Session is draft', async () => {
    await expect(duplicateProblem('session', 'source')).resolves.toBeTruthy();
  });

  it('copies every Approach with new nested IDs and order', async () => {
    vi.mocked(getApproaches).mockResolvedValue([approach, laterApproach]);

    await duplicateProblem('session', 'source');

    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sessions/session/problems/copy-1/approaches/copy-2',
      }),
      { name: 'Hash Map', tags: ['Arrays', 'Hash Map'], order: 0 },
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sessions/session/problems/copy-1/approaches/copy-3',
      }),
      { name: 'Two Pointers', tags: ['Arrays', 'Two Pointers'], order: 1 },
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sessions/session/problems/copy-1/approaches/copy-3/solutions/python',
      }),
      laterApproach.solutions.python,
    );
  });

  it('does not carry an unmaterialized Bank reservation into the copy', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        firestoreDocument('source', { ...problem, bankCopyPending: true }),
      ],
    });
    sdk.bankProblemIds = [];

    const result = await duplicateProblem('session', 'source');

    expect(result.problem).not.toHaveProperty('bankProblemId');
    expect(result.problem).not.toHaveProperty('bankCopyPending');
    expect(sdk.update).not.toHaveBeenCalledWith(
      { path: 'sessions/session' },
      expect.anything(),
    );
  });

  it('rejects oversized batches before committing', async () => {
    vi.mocked(getApproaches).mockResolvedValue(
      Array.from({ length: 125 }, (_, index) => ({
        ...approach,
        id: `approach-${index}`,
      })),
    );

    await expect(duplicateProblem('session', 'source')).rejects.toThrow(
      /too large/i,
    );
    expect(sdk.set).not.toHaveBeenCalled();
    expect(sdk.commit).not.toHaveBeenCalled();
  });

  it('surfaces failed commits', async () => {
    sdk.commit.mockRejectedValue(new Error('offline'));

    await expect(duplicateProblem('session', 'source')).rejects.toThrow(
      'offline',
    );
  });
});
