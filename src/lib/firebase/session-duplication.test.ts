import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { todayCalendarDate } from '../calendar-date';

const sdk = vi.hoisted(() => ({
  user: { currentUser: { uid: 'officer', isAnonymous: false } },
  db: {},
  sequence: 0,
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
  doc: (first: unknown, path?: string) => {
    if (path) return { path };
    const reference = first as { path: string };
    const id = `copy-${++sdk.sequence}`;
    return { id, path: `${reference.path}/${id}` };
  },
  serverTimestamp: () => 'SERVER_TIMESTAMP',
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
import { duplicateSession } from './sessions';

const timestamp = Timestamp.fromMillis(1);
const savedSession = {
  branch: 'general',
  title: 'Arrays Workshop',
  date: '2026-10-01',
  status: 'ended',
  createdAt: timestamp,
  updatedAt: timestamp,
};
const savedProblem = {
  title: 'Two Sum',
  description: 'Find a pair',
  exampleInput: '2 7',
  exampleOutput: '9',
  constraints: '1 ≤ n ≤ 100',
  order: 4,
  answersVisible: true,
  leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
  difficulty: 'medium',
  category: 'interview-style',
  bankProblemId: 'bank-two-sum',
  bankOrigin: 'bank',
};
const approach = {
  id: 'original-approach-id',
  name: 'Hash Map',
  tags: ['Arrays', 'Hash Map'],
  order: 7,
  solutions: {
    python: {
      code: 'python',
      timeComplexity: 'O(n)',
      timeComplexityReason: 'One pass',
      spaceComplexity: 'O(n)',
      spaceComplexityReason: 'Map storage',
    },
    java: { code: 'java', timeComplexity: 'O(n)' },
    cpp: { code: 'cpp', spaceComplexity: 'O(n)' },
  },
};
const laterApproach = {
  ...approach,
  id: 'source-second-approach',
  name: 'Two Pointers',
  tags: ['Arrays', 'Two Pointers'],
  order: 9,
};

function firestoreDocument(id: string, data: unknown, pending = false) {
  return { id, data: () => data, metadata: { hasPendingWrites: pending } };
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.sequence = 0;
  sdk.user.currentUser = { uid: 'officer', isAnonymous: false };
  sdk.commit.mockResolvedValue(undefined);
  sdk.getDocFromServer.mockResolvedValue({
    exists: () => true,
    data: () => savedSession,
    metadata: { hasPendingWrites: false },
  });
  sdk.getDocsFromServer.mockResolvedValue({
    docs: [firestoreDocument('problem-a', savedProblem)],
  });
  vi.mocked(getApproaches).mockResolvedValue([approach]);
});

describe('duplicateSession', () => {
  it.each(['draft', 'live', 'ended'] as const)(
    'copies a %s Session as an independent draft with hidden answers',
    async (status) => {
      sdk.getDocFromServer.mockResolvedValue({
        exists: () => true,
        data: () => ({ ...savedSession, status }),
        metadata: { hasPendingWrites: false },
      });

      await expect(duplicateSession('source')).resolves.toBe('copy-1');

      expect(sdk.set).toHaveBeenCalledWith(
        { id: 'copy-1', path: 'sessions/copy-1' },
        expect.objectContaining({
          branch: 'general',
          title: 'Arrays Workshop Copy',
          date: todayCalendarDate(),
          status: 'draft',
          bankProblemIds: ['bank-two-sum'],
        }),
      );
      expect(sdk.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'sessions/copy-1/problems/copy-2' }),
        expect.objectContaining({
          ...savedProblem,
          order: 0,
          answersVisible: false,
          approachesEnabled: true,
        }),
      );
      expect(sdk.set).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'sessions/copy-1/problems/copy-2/approaches/copy-3',
        }),
        { name: 'Hash Map', tags: ['Arrays', 'Hash Map'], order: 0 },
      );
      expect(sdk.set).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'sessions/copy-1/problems/copy-2/approaches/copy-3/solutions/python',
        }),
        approach.solutions.python,
      );
      for (const language of ['python', 'java', 'cpp'] as const) {
        expect(sdk.set).toHaveBeenCalledWith(
          expect.objectContaining({
            path: `sessions/copy-1/problems/copy-2/approaches/copy-3/solutions/${language}`,
          }),
          approach.solutions[language],
        );
      }
      expect(sdk.commit).toHaveBeenCalledOnce();
    },
  );

  it('copies multiple Problems in order and preserves canonical Bank provenance without touching Bank documents', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        firestoreDocument('first', { ...savedProblem, order: 3 }),
        firestoreDocument('second', {
          ...savedProblem,
          order: 8,
          bankProblemId: 'bank-two-sum',
        }),
      ],
    });
    vi.mocked(getApproaches).mockResolvedValue([]);

    await duplicateSession('source');

    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/copy-1/problems/copy-2' }),
      expect.objectContaining({ order: 0, answersVisible: false }),
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/copy-1/problems/copy-3' }),
      expect.objectContaining({ order: 1, answersVisible: false }),
    );
    expect(
      sdk.set.mock.calls.some(([reference]) =>
        String(reference.path).startsWith('problemBank/'),
      ),
    ).toBe(false);
  });

  it('sorts source Problems by persisted order instead of Firestore iteration order', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        firestoreDocument('problem-c', {
          ...savedProblem,
          title: 'C',
          order: 2,
        }),
        firestoreDocument('problem-a', {
          ...savedProblem,
          title: 'A',
          order: 0,
        }),
        firestoreDocument('problem-b', {
          ...savedProblem,
          title: 'B',
          order: 1,
        }),
      ],
    });
    vi.mocked(getApproaches).mockResolvedValue([]);

    await duplicateSession('source');

    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/copy-1/problems/copy-2' }),
      expect.objectContaining({ title: 'A', order: 0 }),
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/copy-1/problems/copy-3' }),
      expect.objectContaining({ title: 'B', order: 1 }),
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/copy-1/problems/copy-4' }),
      expect.objectContaining({ title: 'C', order: 2 }),
    );
  });

  it('uses document IDs to order equal or invalid persisted Problem orders', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        firestoreDocument('problem-z', {
          ...savedProblem,
          title: 'Invalid Z',
          order: Number.NaN,
        }),
        firestoreDocument('problem-b', {
          ...savedProblem,
          title: 'Equal B',
          order: 1,
        }),
        firestoreDocument('problem-a', {
          ...savedProblem,
          title: 'Equal A',
          order: 1,
        }),
        firestoreDocument('problem-x', {
          ...savedProblem,
          title: 'Invalid X',
          order: 'broken',
        }),
      ],
    });
    vi.mocked(getApproaches).mockResolvedValue([]);

    await duplicateSession('source');

    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/copy-1/problems/copy-2' }),
      expect.objectContaining({ title: 'Equal A', order: 0 }),
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/copy-1/problems/copy-3' }),
      expect.objectContaining({ title: 'Equal B', order: 1 }),
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/copy-1/problems/copy-4' }),
      expect.objectContaining({ title: 'Invalid X', order: 2 }),
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'sessions/copy-1/problems/copy-5' }),
      expect.objectContaining({ title: 'Invalid Z', order: 3 }),
    );
  });

  it('copies legacy primary Solutions into a new explicit Approach', async () => {
    vi.mocked(getApproaches).mockResolvedValue([
      { ...approach, id: 'primary', name: 'Primary Approach' },
    ]);

    await duplicateSession('source');

    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sessions/copy-1/problems/copy-2/approaches/copy-3/solutions/java',
      }),
      approach.solutions.java,
    );
  });

  it('copies every Approach with fresh identity and deterministic order', async () => {
    vi.mocked(getApproaches).mockResolvedValue([approach, laterApproach]);

    await duplicateSession('source');

    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sessions/copy-1/problems/copy-2/approaches/copy-3',
      }),
      { name: 'Hash Map', tags: ['Arrays', 'Hash Map'], order: 0 },
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sessions/copy-1/problems/copy-2/approaches/copy-4',
      }),
      { name: 'Two Pointers', tags: ['Arrays', 'Two Pointers'], order: 1 },
    );
    expect(sdk.set).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'sessions/copy-1/problems/copy-2/approaches/copy-4/solutions/cpp',
      }),
      laterApproach.solutions.cpp,
    );
  });

  it('fails before writes when the atomic copy would exceed Firestore’s batch limit', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: Array.from({ length: 126 }, (_, index) =>
        firestoreDocument(`problem-${index}`, {
          ...savedProblem,
          order: index,
        }),
      ),
    });
    vi.mocked(getApproaches).mockResolvedValue([approach]);

    await expect(duplicateSession('source')).rejects.toThrow(/too large/i);
    expect(sdk.set).not.toHaveBeenCalled();
    expect(sdk.commit).not.toHaveBeenCalled();
  });

  it('surfaces a failed batch commit without returning a duplicate', async () => {
    sdk.commit.mockRejectedValue(new Error('offline'));

    await expect(duplicateSession('source')).rejects.toThrow('offline');
  });
});
