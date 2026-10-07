import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

const sdk = vi.hoisted(() => ({
  db: {},
  getDocFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
  onSnapshot: vi.fn(),
  getFirestoreDb: vi.fn(),
}));

vi.mock('client-only', () => ({}));
vi.mock('./client', () => ({ getFirestoreDb: sdk.getFirestoreDb }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, path: string) => ({ path }),
  query: (reference: unknown, ...constraints: unknown[]) => ({
    reference,
    constraints,
  }),
  where: (field: string, operator: string, value: string) => ({
    field,
    operator,
    value,
  }),
  getDocFromServer: sdk.getDocFromServer,
  getDocsFromServer: sdk.getDocsFromServer,
  onSnapshot: sdk.onSnapshot,
}));

import {
  getMemberSession,
  getMemberSolutions,
  listMemberProblems,
  listMemberSessions,
  subscribeToMemberSessions,
} from './member';

const live = {
  branch: 'intro',
  title: 'Intro practice',
  date: '2026-10-04',
  status: 'live',
  createdAt: Timestamp.fromMillis(1_000),
  updatedAt: Timestamp.fromMillis(1_000),
};
const problem = {
  title: 'Arrays',
  description: 'Find the pair.',
  exampleInput: '2 4',
  exampleOutput: '6',
  constraints: 'Values are distinct.',
  order: 0,
  answersVisible: false,
};

function snapshot(id: string, data: unknown, pending = false) {
  return {
    id,
    data: () => data,
    exists: () => true,
    metadata: { hasPendingWrites: pending },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.getFirestoreDb.mockReturnValue(sdk.db);
  sdk.getDocFromServer.mockResolvedValue(snapshot('s', live));
  sdk.getDocsFromServer.mockResolvedValue({ docs: [] });
});

describe('anonymous member persistence', () => {
  it('discovers live and ended sessions with separate rule-compatible queries', async () => {
    sdk.getDocsFromServer
      .mockResolvedValueOnce({ docs: [snapshot('live', live)] })
      .mockResolvedValueOnce({
        docs: [
          snapshot('past', { ...live, status: 'ended', date: '2026-09-01' }),
        ],
      });

    const records = await listMemberSessions();

    expect(records.map(({ id }) => id)).toEqual(['live', 'past']);
    expect(sdk.getDocsFromServer).toHaveBeenCalledTimes(2);
    expect(
      sdk.getDocsFromServer.mock.calls.map(([reference]) => reference),
    ).toEqual([
      {
        reference: { path: 'sessions' },
        constraints: [{ field: 'status', operator: '==', value: 'live' }],
      },
      {
        reference: { path: 'sessions' },
        constraints: [{ field: 'status', operator: '==', value: 'ended' }],
      },
    ]);
  });

  it('subscribes to the public live and ended lifecycle and reports changes', () => {
    const onValue = vi.fn();
    const onError = vi.fn();
    const unsubscribe = vi.fn();
    sdk.onSnapshot.mockImplementationOnce(
      (_query: unknown, next: (value: unknown) => void) => {
        next({
          docs: [
            snapshot('live', live),
            snapshot('past', { ...live, status: 'ended' }),
          ],
        });
        return unsubscribe;
      },
    );

    expect(subscribeToMemberSessions(onValue, onError)).toBe(unsubscribe);
    expect(onValue).toHaveBeenCalledWith([
      {
        id: 'live',
        session: {
          branch: 'intro',
          title: 'Intro practice',
          date: '2026-10-04',
          status: 'live',
        },
      },
      {
        id: 'past',
        session: {
          branch: 'intro',
          title: 'Intro practice',
          date: '2026-10-04',
          status: 'ended',
        },
      },
    ]);
    expect(onError).not.toHaveBeenCalled();
    expect(sdk.onSnapshot.mock.calls[0][0]).toEqual({
      reference: { path: 'sessions' },
      constraints: [
        { field: 'status', operator: 'in', value: ['live', 'ended'] },
      ],
    });
  });

  it('does not expose draft Sessions through a direct public read', async () => {
    sdk.getDocFromServer.mockResolvedValueOnce(
      snapshot('draft', { ...live, status: 'draft' }),
    );
    await expect(getMemberSession('draft')).rejects.toThrow('invalid fields');
  });

  it('returns no record for a missing Session and validates public metadata', async () => {
    sdk.getDocFromServer.mockResolvedValueOnce({ exists: () => false });
    await expect(getMemberSession('missing')).resolves.toBeNull();
    sdk.getDocFromServer.mockResolvedValueOnce(snapshot('s', live, true));
    await expect(getMemberSession('s')).rejects.toThrow(
      'awaiting confirmation',
    );
  });

  it('ignores a legacy activeProblemId field in public Session data', async () => {
    sdk.getDocFromServer.mockResolvedValueOnce(
      snapshot('legacy', { ...live, activeProblemId: 'old-problem' }),
    );
    const record = await getMemberSession('legacy');
    expect(record?.session).not.toHaveProperty('activeProblemId');
    expect(record?.session).toMatchObject({
      branch: 'intro',
      title: 'Intro practice',
      status: 'live',
    });
  });

  it('parses every public branch and rejects unsupported values', async () => {
    sdk.getDocFromServer.mockResolvedValueOnce(
      snapshot('general', { ...live, branch: 'general' }),
    );
    await expect(getMemberSession('general')).resolves.toMatchObject({
      session: { branch: 'general' },
    });
    sdk.getDocFromServer.mockResolvedValueOnce(
      snapshot('invalid', { ...live, branch: 'advanced' }),
    );
    await expect(getMemberSession('invalid')).rejects.toThrow(
      'Choose Intro, General, or ICPC',
    );
  });

  it('reads public Problem metadata and sorts by order then document ID', async () => {
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [
        snapshot('later', { ...problem, order: 2 }),
        snapshot('second-b', { ...problem, order: 1 }),
        snapshot('second-a', { ...problem, order: 1 }),
      ],
    });
    const records = await listMemberProblems('session');
    expect(records.map(({ id }) => id)).toEqual([
      'second-a',
      'second-b',
      'later',
    ]);
    expect(sdk.getDocsFromServer).toHaveBeenCalledWith({
      path: 'sessions/session/problems',
    });
  });

  it('accepts a missing optional LeetCode URL and validates linked Problems', async () => {
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [
        snapshot('custom', { ...problem, order: 0 }),
        snapshot('linked', {
          ...problem,
          order: 1,
          leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
        }),
      ],
    });
    const records = await listMemberProblems('session');
    expect(records[0].problem).not.toHaveProperty('leetcodeUrl');
    expect(records[1].problem.leetcodeUrl).toBe(
      'https://leetcode.com/problems/two-sum/',
    );
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [
        snapshot('bad', {
          ...problem,
          leetcodeUrl: 'http://example.com/problem',
        }),
      ],
    });
    await expect(listMemberProblems('session')).rejects.toThrow(
      'valid HTTPS LeetCode Problem URL',
    );
  });

  it('reads supported Problem difficulty values and rejects invalid stored values', async () => {
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [
        snapshot('easy', { ...problem, difficulty: 'easy' }),
        snapshot('medium', { ...problem, order: 1, difficulty: 'medium' }),
        snapshot('hard', { ...problem, order: 2, difficulty: 'hard' }),
      ],
    });
    expect(
      (await listMemberProblems('session')).map(
        ({ problem: item }) => item.difficulty,
      ),
    ).toEqual(['easy', 'medium', 'hard']);
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [snapshot('invalid', { ...problem, difficulty: 'extreme' })],
    });
    await expect(listMemberProblems('session')).rejects.toThrow(
      'invalid fields',
    );
  });

  it('maps legacy Problems without constraints to empty text and preserves new multiline constraints', async () => {
    sdk.getDocsFromServer.mockResolvedValueOnce({
      docs: [
        snapshot('legacy', { ...problem, constraints: undefined }),
        snapshot('new', {
          ...problem,
          order: 1,
          constraints: '1 ≤ n ≤ 100\nValues are distinct.',
        }),
      ],
    });
    const records = await listMemberProblems('session');
    expect(records.map(({ problem: item }) => item.constraints)).toEqual([
      '',
      '1 ≤ n ≤ 100\nValues are distinct.',
    ]);
  });

  it('loads only the three fixed solution documents', async () => {
    sdk.getDocFromServer.mockImplementation(
      async ({ path }: { path: string }) =>
        snapshot(path.split('/').at(-1) ?? '', {
          code: path,
          output: 'legacy output ignored',
        }),
    );
    const solutions = await getMemberSolutions('s', 'p');
    expect(solutions.python.code).toBe(
      'sessions/s/problems/p/solutions/python',
    );
    expect(solutions.java).toEqual({
      code: 'sessions/s/problems/p/solutions/java',
    });
    expect(solutions.cpp.code).toBe('sessions/s/problems/p/solutions/cpp');
    expect(sdk.getDocFromServer).toHaveBeenCalledTimes(3);
  });
  it('reads complexity only from each authorized language Solution document', async () => {
    sdk.getDocFromServer.mockImplementation(
      async ({ path }: { path: string }) =>
        snapshot(path.split('/').at(-1) ?? '', {
          code: path,
          ...(path.endsWith('/python')
            ? { timeComplexity: 'O(n)', timeComplexityReason: 'One pass.' }
            : path.endsWith('/java')
              ? { spaceComplexity: 'O(1)' }
              : {}),
        }),
    );
    await expect(getMemberSolutions('s', 'p')).resolves.toMatchObject({
      python: { timeComplexity: 'O(n)', timeComplexityReason: 'One pass.' },
      java: { spaceComplexity: 'O(1)' },
      cpp: { code: 'sessions/s/problems/p/solutions/cpp' },
    });
  });

  it('maps missing solution documents to empty source', async () => {
    sdk.getDocFromServer.mockImplementation(async () => ({
      exists: () => false,
      metadata: { hasPendingWrites: false },
    }));
    await expect(getMemberSolutions('past', 'problem')).resolves.toEqual({
      python: { code: '' },
      java: { code: '' },
      cpp: { code: '' },
    });
  });
});
