import { beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({
  user: {
    currentUser: { uid: 'officer', isAnonymous: false } as {
      uid: string;
      isAnonymous: boolean;
    } | null,
  },
  db: {},
  addDoc: vi.fn(),
  getDocsFromServer: vi.fn(),
  updateDoc: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  commit: vi.fn(),
}));
vi.mock('client-only', () => ({}));
vi.mock('./client', () => ({ getFirestoreDb: () => sdk.db }));
vi.mock('./auth', () => ({ getOfficerAuth: () => sdk.user }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, path: string) => ({ path }),
  addDoc: sdk.addDoc,
  getDocsFromServer: sdk.getDocsFromServer,
  updateDoc: sdk.updateDoc,
  writeBatch: () => ({
    update: sdk.batchUpdate,
    delete: sdk.batchDelete,
    commit: sdk.commit,
  }),
}));
import {
  createProblem,
  deleteProblem,
  listProblems,
  reorderProblems,
  updateProblem,
} from './problems';
const content = {
  title: 'Two Sum',
  description: 'Find a pair',
  exampleInput: '1 2',
  exampleOutput: '3',
};
const problem = { ...content, order: 0, answersVisible: false };
function document(
  id: string,
  order = 0,
  fields: unknown = { ...problem, order },
  pending = false,
) {
  return { id, data: () => fields, metadata: { hasPendingWrites: pending } };
}
beforeEach(() => {
  vi.clearAllMocks();
  sdk.user.currentUser = { uid: 'officer', isAnonymous: false };
  sdk.getDocsFromServer.mockResolvedValue({ docs: [] });
  sdk.addDoc.mockResolvedValue({ id: 'new' });
  sdk.updateDoc.mockResolvedValue(undefined);
  sdk.commit.mockResolvedValue(undefined);
});
describe('officer problem persistence', () => {
  it('creates only metadata, hidden answers, empty content and the next order', async () => {
    sdk.getDocsFromServer.mockResolvedValue({ docs: [document('old', 4)] });
    const result = await createProblem('session');
    const expected = {
      title: 'Untitled Problem',
      description: '',
      exampleInput: '',
      exampleOutput: '',
      order: 5,
      answersVisible: false,
    };
    expect(result).toEqual({ id: 'new', problem: expected });
    expect(sdk.addDoc).toHaveBeenCalledWith(
      { path: 'sessions/session/problems' },
      expected,
    );
    expect(Object.keys(sdk.addDoc.mock.calls[0][1]).sort()).toEqual([
      'answersVisible',
      'description',
      'exampleInput',
      'exampleOutput',
      'order',
      'title',
    ]);
  });
  it('starts an empty session at order zero', async () => {
    expect((await createProblem('session')).problem.order).toBe(0);
  });
  it('edits the four content fields without writing extra fields or reveal/presenter state', async () => {
    await updateProblem('session', 'problem', {
      ...content,
      title: ' Two Sum ',
      code: 'secret',
      output: 'secret',
    } as typeof content);
    expect(sdk.updateDoc).toHaveBeenCalledWith(
      { path: 'sessions/session/problems/problem' },
      content,
    );
  });
  it('sorts server metadata by order then ID with no solution fields', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        document('z', 2),
        document('b', 0),
        document('a', 0, { ...problem, code: 'secret' }),
      ],
    });
    const records = await listProblems('session');
    expect(records.map((record) => record.id)).toEqual(['a', 'b', 'z']);
    expect(records[0].problem).toEqual(problem);
  });
  it('writes dense order values atomically and preserves the order on reload', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [document('a'), document('b', 1)],
    });
    await reorderProblems('session', ['b', 'a']);
    expect(sdk.batchUpdate.mock.calls).toEqual([
      [{ path: 'sessions/session/problems/b' }, { order: 0 }],
      [{ path: 'sessions/session/problems/a' }, { order: 1 }],
    ]);
    expect(sdk.commit).toHaveBeenCalledTimes(1);
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [document('a', 1), document('b', 0)],
    });
    expect((await listProblems('session')).map((record) => record.id)).toEqual([
      'b',
      'a',
    ]);
  });
  it.each([['a'], ['a', 'a'], ['a', 'unknown']])(
    'rejects stale/incomplete/duplicate order %s before writing',
    async (...ids) => {
      sdk.getDocsFromServer.mockResolvedValue({
        docs: [document('a'), document('b', 1)],
      });
      await expect(reorderProblems('session', ids)).rejects.toThrow(
        'list changed',
      );
      expect(sdk.batchUpdate).not.toHaveBeenCalled();
    },
  );
  it('atomically removes all fixed solution paths including missing children then problem metadata', async () => {
    await deleteProblem('session', 'problem');
    expect(
      sdk.batchDelete.mock.calls.map(([reference]) => reference.path),
    ).toEqual([
      'sessions/session/problems/problem/solutions/python',
      'sessions/session/problems/problem/solutions/java',
      'sessions/session/problems/problem/solutions/cpp',
      'sessions/session/problems/problem',
    ]);
    expect(sdk.commit).toHaveBeenCalledTimes(1);
    expect(sdk.getDocsFromServer).not.toHaveBeenCalled();
  });
  it.each([null, { uid: 'anonymous', isAnonymous: true }])(
    'guards all operations against signed-out/anonymous auth %s',
    async (user) => {
      sdk.user.currentUser = user;
      for (const operation of [
        () => createProblem('s'),
        () => listProblems('s'),
        () => updateProblem('s', 'p', content),
        () => reorderProblems('s', []),
        () => deleteProblem('s', 'p'),
      ])
        await expect(operation()).rejects.toThrow('Sign in');
      expect(sdk.getDocsFromServer).not.toHaveBeenCalled();
      expect(sdk.addDoc).not.toHaveBeenCalled();
      expect(sdk.updateDoc).not.toHaveBeenCalled();
      expect(sdk.commit).not.toHaveBeenCalled();
    },
  );
  it('rejects pending writes, invalid metadata and blank titles', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [document('pending', 0, problem, true)],
    });
    await expect(listProblems('s')).rejects.toThrow('awaiting confirmation');
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [document('bad', 0, { ...problem, order: NaN })],
    });
    await expect(listProblems('s')).rejects.toThrow('invalid fields');
    await expect(
      updateProblem('s', 'p', { ...content, title: ' ' }),
    ).rejects.toThrow('Enter a problem title');
    expect(sdk.updateDoc).not.toHaveBeenCalled();
  });
  it('propagates read, write and batch failures', async () => {
    const error = new Error('offline');
    sdk.getDocsFromServer.mockRejectedValue(error);
    await expect(listProblems('s')).rejects.toBe(error);
    await expect(createProblem('s')).rejects.toBe(error);
    sdk.updateDoc.mockRejectedValue(error);
    await expect(updateProblem('s', 'p', content)).rejects.toBe(error);
    sdk.commit.mockRejectedValue(error);
    await expect(deleteProblem('s', 'p')).rejects.toBe(error);
    sdk.getDocsFromServer.mockResolvedValue({ docs: [] });
    await expect(reorderProblems('s', [])).rejects.toBe(error);
  });
});
