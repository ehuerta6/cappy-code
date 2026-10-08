import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  user: { currentUser: { uid: 'officer', isAnonymous: false } },
  db: {},
  getDocsFromServer: vi.fn(),
}));

vi.mock('client-only', () => ({}));
vi.mock('./client', () => ({ getFirestoreDb: () => sdk.db }));
vi.mock('./auth', () => ({ getOfficerAuth: () => sdk.user }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  collection: (_db: unknown, path: string) => ({ path }),
  query: (reference: unknown, ...constraints: unknown[]) => ({
    reference,
    constraints,
  }),
  where: (...args: unknown[]) => args,
  getDocsFromServer: sdk.getDocsFromServer,
}));

import { Timestamp } from 'firebase/firestore';
import { listProblemUsageSummaries } from './problem-usage';

const document = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => data,
  metadata: { hasPendingWrites: false },
});

const session = (status: string, bankProblemIds: string[] = []) => ({
  title: `${status} title`,
  date: '2026-10-08',
  branch: 'intro',
  status,
  createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
  updatedAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
  bankProblemIds,
});

beforeEach(() => {
  vi.clearAllMocks();
  sdk.getDocsFromServer.mockImplementation(
    async (reference: { path?: string }) => {
      if (!reference.path) {
        return {
          docs: [
            document('live', session('live')),
            document('ended', session('ended')),
          ],
        };
      }
      if (reference.path === 'sessions/live/problems')
        return {
          docs: [
            document('p1', {
              bankProblemId: 'problem',
              answersVisible: false,
              order: 0,
              title: 'Snapshot title',
              description: '',
              exampleInput: '',
              exampleOutput: '',
            }),
            document('p2', {
              bankProblemId: 'problem',
              answersVisible: false,
              order: 1,
              title: 'Duplicate snapshot',
              description: '',
              exampleInput: '',
              exampleOutput: '',
            }),
          ],
        };
      if (reference.path === 'sessions/ended/problems')
        return {
          docs: [
            document('p1', {
              bankProblemId: 'problem',
              answersVisible: false,
              order: 0,
              title: 'Old title',
              description: '',
              exampleInput: '',
              exampleOutput: '',
            }),
          ],
        };
      return { docs: [] };
    },
  );
});

describe('Firestore problem usage reads', () => {
  it('derives public history from snapshot provenance, counting a Session once', async () => {
    const summaries = await listProblemUsageSummaries(['problem']);
    expect(summaries.problem.count).toBe(2);
    expect(summaries.problem.history.map(({ sessionId }) => sessionId)).toEqual(
      ['ended', 'live'],
    );
    expect(summaries.problem.history[0].href).toBe('/sessions/ended');
    expect(sdk.getDocsFromServer).toHaveBeenCalledTimes(3);
    const sessionsQuery = sdk.getDocsFromServer.mock.calls[0][0] as {
      constraints: unknown[][];
    };
    expect(sessionsQuery.constraints[0]).toEqual([
      'status',
      'in',
      ['live', 'ended'],
    ]);
  });

  it('includes officer draft snapshots while members never query private Sessions', async () => {
    sdk.getDocsFromServer.mockImplementation(
      async (reference: { path?: string }) => {
        if (reference.path === 'sessions')
          return {
            docs: [
              document('draft', session('draft')),
              document('live', session('live')),
            ],
          };
        return {
          docs: [
            document('problem', {
              bankProblemId: 'problem',
              answersVisible: false,
              order: 0,
              title: 'Snapshot',
              description: '',
              exampleInput: '',
              exampleOutput: '',
            }),
          ],
        };
      },
    );
    const officer = await listProblemUsageSummaries(['problem'], true);
    expect(officer.problem.count).toBe(2);
    expect(officer.problem.history.map(({ sessionId }) => sessionId)).toEqual([
      'draft',
      'live',
    ]);
    expect(officer.problem.history[0]).not.toHaveProperty('href');
    const collectionRead = sdk.getDocsFromServer.mock.calls[0][0];
    expect(collectionRead).toEqual({ path: 'sessions' });
  });
});
