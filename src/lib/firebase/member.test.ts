import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  db: {},
  getDocFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
  getFirestoreDb: vi.fn(),
}));

vi.mock('client-only', () => ({}));
vi.mock('./client', () => ({ getFirestoreDb: sdk.getFirestoreDb }));
vi.mock('firebase/firestore', () => ({
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
}));

import {
  getMemberSession,
  getRevealedMemberSolutions,
  listMemberProblems,
  listMemberSessions,
} from './member';

const live = {
  title: 'Intro practice',
  date: '2026-10-04',
  status: 'live',
};
const problem = {
  title: 'Arrays',
  description: 'Find the pair.',
  exampleInput: '2 4',
  exampleOutput: '6',
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
      title: 'Intro practice',
      status: 'live',
    });
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

  it('loads only the three fixed solution documents when requested by the revealed UI', async () => {
    sdk.getDocFromServer.mockImplementation(
      async ({ path }: { path: string }) =>
        snapshot(path.split('/').at(-1) ?? '', {
          code: path,
          output: 'prepared',
        }),
    );
    const solutions = await getRevealedMemberSolutions('s', 'p');
    expect(solutions.python.code).toBe(
      'sessions/s/problems/p/solutions/python',
    );
    expect(solutions.java.output).toBe('prepared');
    expect(solutions.cpp.code).toBe('sessions/s/problems/p/solutions/cpp');
    expect(sdk.getDocFromServer).toHaveBeenCalledTimes(3);
  });
});
