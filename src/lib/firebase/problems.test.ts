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
  getDocFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
  updateDoc: vi.fn(),
  deleteField: vi.fn(() => 'DELETE_FIELD'),
  batchUpdate: vi.fn(),
  batchSet: vi.fn(),
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
    const collection = path === undefined ? (first as { path: string }) : null;
    return collection
      ? {
          path: `${collection.path}/${collection.path === 'problemBank' ? 'bank-new' : 'new'}`,
          id: collection.path === 'problemBank' ? 'bank-new' : 'new',
        }
      : { path };
  },
  addDoc: sdk.addDoc,
  getDocsFromServer: sdk.getDocsFromServer,
  getDocFromServer: sdk.getDocFromServer,
  updateDoc: sdk.updateDoc,
  deleteField: sdk.deleteField,
  writeBatch: () => ({
    set: sdk.batchSet,
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
  setAnswersVisible,
  updateProblem,
} from './problems';
const content = {
  title: 'Two Sum',
  description: 'Find a pair',
  exampleInput: '1 2',
  exampleOutput: '3',
  constraints: '1 ≤ n ≤ 100',
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
  sdk.getDocFromServer.mockResolvedValue({
    exists: () => true,
    data: () => ({ ...problem }),
  });
  sdk.addDoc.mockResolvedValue({ id: 'new' });
  sdk.updateDoc.mockResolvedValue(undefined);
  sdk.commit.mockResolvedValue(undefined);
  sdk.batchSet.mockReset();
});
describe('officer problem persistence', () => {
  it('creates a Session Problem and a reusable bank copy with empty Solutions', async () => {
    sdk.getDocsFromServer.mockResolvedValue({ docs: [document('old', 4)] });
    const result = await createProblem('session');
    const expected = {
      title: 'Untitled Problem',
      description: '',
      exampleInput: '',
      exampleOutput: '',
      constraints: '',
      order: 5,
      answersVisible: false,
      category: 'custom',
      bankProblemId: 'bank-new',
      bankOrigin: 'session',
    };
    expect(result).toEqual({ id: 'new', problem: expected });
    expect(sdk.batchSet).toHaveBeenCalledWith(
      { path: 'sessions/session/problems/new', id: 'new' },
      expected,
    );
    expect(sdk.batchSet).toHaveBeenCalledWith(
      { path: 'problemBank/bank-new' },
      {
        title: 'Untitled Problem',
        description: '',
        exampleInput: '',
        exampleOutput: '',
        constraints: '',
        category: 'custom',
        isPublic: true,
      },
    );
    expect(sdk.batchSet).toHaveBeenCalledTimes(5);
  });
  it('starts an empty session at order zero', async () => {
    expect((await createProblem('session')).problem.order).toBe(0);
  });
  it('does not report direct creation success when its atomic snapshot batch fails', async () => {
    const error = new Error('offline');
    sdk.commit.mockRejectedValueOnce(error);
    await expect(createProblem('session')).rejects.toBe(error);
    expect(sdk.batchSet).toHaveBeenCalledTimes(5);
  });
  it('edits Problem content without writing Solution fields or reveal state', async () => {
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
  it('writes only Problem content fields included in the save', async () => {
    await updateProblem('session', 'problem', { description: 'New statement' });
    expect(sdk.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/session/problems/problem' },
      { description: 'New statement' },
    );
  });
  it('does not synchronize edits from legacy origin-linked Session Problems', async () => {
    sdk.getDocFromServer.mockResolvedValue({
      exists: () => true,
      data: () => ({
        ...problem,
        bankProblemId: 'legacy-bank',
        bankOrigin: 'session',
      }),
    });
    await updateProblem('session', 'problem', { description: 'Session edit' });
    expect(sdk.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/session/problems/problem' },
      { description: 'Session edit' },
    );
    expect(sdk.batchUpdate).not.toHaveBeenCalled();
    expect(sdk.batchSet).not.toHaveBeenCalled();
  });
  it('writes constraints as plain Problem metadata', async () => {
    await updateProblem('session', 'problem', {
      constraints: '1 ≤ n ≤ 100\nValues are distinct.',
    });
    expect(sdk.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/session/problems/problem' },
      { constraints: '1 ≤ n ≤ 100\nValues are distinct.' },
    );
  });
  it.each(['easy', 'medium', 'hard'] as const)(
    'writes supported %s difficulty as Problem metadata',
    async (difficulty) => {
      await updateProblem('session', 'problem', { difficulty });
      expect(sdk.updateDoc).toHaveBeenCalledExactlyOnceWith(
        { path: 'sessions/session/problems/problem' },
        { difficulty },
      );
    },
  );
  it('unsets difficulty when the Officer selects Not set', async () => {
    await updateProblem('session', 'problem', { difficulty: '' });
    expect(sdk.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/session/problems/problem' },
      { difficulty: 'DELETE_FIELD' },
    );
  });
  it('accepts a blank LeetCode field and removes any saved URL', async () => {
    await updateProblem('session', 'problem', { leetcodeUrl: '   ' });
    expect(sdk.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/session/problems/problem' },
      { leetcodeUrl: 'DELETE_FIELD' },
    );
  });
  it('saves only a valid HTTPS LeetCode Problem URL', async () => {
    await updateProblem('session', 'problem', {
      leetcodeUrl: ' https://leetcode.com/problems/two-sum/ ',
    });
    expect(sdk.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/session/problems/problem' },
      { leetcodeUrl: 'https://leetcode.com/problems/two-sum/' },
    );
  });
  it.each([
    'https://leetcode.com/problems/two-sum/',
    'https://leetcode.com/problems/two-sum/description/',
    'https://leetcode.com/problems/two-sum/description/?lang=en',
    'https://www.leetcode.com/problems/two-sum/',
    'https://www.leetcode.com/problems/two-sum/description/?lang=en',
  ])('accepts a LeetCode Problem reference URL: %s', async (url) => {
    await updateProblem('session', 'problem', { leetcodeUrl: url });
    expect(sdk.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/session/problems/problem' },
      { leetcodeUrl: url },
    );
  });
  it.each([
    'http://leetcode.com/problems/two-sum/',
    'https://example.com/problems/two-sum/',
    'https://leetcode.com/problemset/all/',
    'https://leetcode.com/problems/two-sum/solutions/',
    'https://leetcode.com/problems/two-sum/submissions/',
    'https://leetcode.com/problems/two-sum/description/editorial/',
    'https://user:pass@leetcode.com/problems/two-sum/',
    'https://leetcode.com:8443/problems/two-sum/',
    'not a URL',
  ])(
    'rejects invalid LeetCode URLs before a Firestore write: %s',
    async (url) => {
      await expect(
        updateProblem('session', 'problem', { leetcodeUrl: url }),
      ).rejects.toThrow('valid HTTPS LeetCode Problem URL');
      expect(sdk.updateDoc).not.toHaveBeenCalled();
    },
  );
  it('updates only the selected problem reveal field', async () => {
    await setAnswersVisible('session', 'problem', true);
    expect(sdk.updateDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/session/problems/problem' },
      { answersVisible: true },
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
    expect(records[0].problem).toEqual({ ...problem, category: 'custom' });
  });
  it('loads old Problem records without inventing a LeetCode field and reads a link', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        document('legacy', 0, {
          title: problem.title,
          description: problem.description,
          exampleInput: problem.exampleInput,
          exampleOutput: problem.exampleOutput,
          order: 0,
          answersVisible: false,
        }),
        document('linked', 1, {
          ...problem,
          order: 1,
          leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
        }),
      ],
    });
    const records = await listProblems('session');
    expect(records[0].problem).not.toHaveProperty('leetcodeUrl');
    expect(records[0].problem.constraints).toBe('');
    expect(records[0].problem).not.toHaveProperty('difficulty');
    expect(records[1].problem.leetcodeUrl).toBe(
      'https://leetcode.com/problems/two-sum/',
    );
  });
  it('loads valid difficulty values and rejects an invalid persisted value', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        document('easy', 0, { ...problem, difficulty: 'easy' }),
        document('hard', 1, { ...problem, order: 1, difficulty: 'hard' }),
      ],
    });
    expect(
      (await listProblems('session')).map(
        ({ problem: item }) => item.difficulty,
      ),
    ).toEqual(['easy', 'hard']);
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [document('bad', 0, { ...problem, difficulty: 'extreme' })],
    });
    await expect(listProblems('session')).rejects.toThrow('invalid fields');
  });
  it('loads multiline constraints when present and defaults only missing values to empty text', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        document('legacy', 0, { ...problem, order: 0, constraints: undefined }),
        document('new', 1, {
          ...problem,
          order: 1,
          constraints: '1 ≤ n ≤ 100\nValues are distinct.',
        }),
      ],
    });
    const records = await listProblems('session');
    expect(records.map(({ problem: item }) => item.constraints)).toEqual([
      '',
      '1 ≤ n ≤ 100\nValues are distinct.',
    ]);
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
    const deletedPaths = sdk.batchDelete.mock.calls.map(
      ([reference]) => reference.path,
    );
    expect(deletedPaths).toEqual([
      'sessions/session/problems/problem/solutions/python',
      'sessions/session/problems/problem/solutions/java',
      'sessions/session/problems/problem/solutions/cpp',
      'sessions/session/problems/problem',
    ]);
    expect(
      deletedPaths.every((path: string) => !path.startsWith('problemBank/')),
    ).toBe(true);
    expect(sdk.commit).toHaveBeenCalledTimes(1);
    expect(sdk.getDocsFromServer).toHaveBeenCalledOnce();
    expect(sdk.batchUpdate).toHaveBeenCalledWith(
      { path: 'sessions/session' },
      { bankProblemIds: [] },
    );
  });
  it.each([null, { uid: 'anonymous', isAnonymous: true }])(
    'guards all operations against signed-out/anonymous auth %s',
    async (user) => {
      sdk.user.currentUser = user;
      for (const operation of [
        () => createProblem('s'),
        () => listProblems('s'),
        () => updateProblem('s', 'p', content),
        () => setAnswersVisible('s', 'p', true),
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
    await expect(
      updateProblem('s', 'p', { difficulty: 'extreme' as never }),
    ).rejects.toThrow('supported Problem difficulty');
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
