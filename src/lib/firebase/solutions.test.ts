import { beforeEach, describe, expect, it, vi } from 'vitest';
import { languages } from '../domain';

const sdk = vi.hoisted(() => ({
  user: {
    currentUser: { isAnonymous: false } as { isAnonymous: boolean } | null,
  },
  db: {},
  getDocFromServer: vi.fn(),
  setDoc: vi.fn(),
  getDocsFromServer: vi.fn(),
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  batchDelete: vi.fn(),
  commit: vi.fn(),
  getFirestoreDb: vi.fn(),
}));
vi.mock('client-only', () => ({}));
vi.mock('./auth', () => ({ getOfficerAuth: () => sdk.user }));
vi.mock('./client', () => ({ getFirestoreDb: sdk.getFirestoreDb }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  doc: (_db: unknown, path?: string) =>
    path
      ? { path }
      : {
          path: 'sessions/s/problems/p/approaches/new-approach',
          id: 'new-approach',
        },
  collection: (_db: unknown, path: string) => ({ path }),
  getDocFromServer: sdk.getDocFromServer,
  setDoc: sdk.setDoc,
  getDocsFromServer: sdk.getDocsFromServer,
  writeBatch: () => ({
    set: sdk.batchSet,
    update: sdk.batchUpdate,
    delete: sdk.batchDelete,
    commit: sdk.commit,
  }),
}));
import {
  createApproach,
  deleteApproach,
  getApproaches,
  getSolutionsForProblem,
  updateSolution,
} from './solutions';

beforeEach(() => {
  vi.clearAllMocks();
  sdk.user.currentUser = { isAnonymous: false };
  sdk.getFirestoreDb.mockReturnValue(sdk.db);
  sdk.setDoc.mockResolvedValue(undefined);
  sdk.getDocsFromServer.mockResolvedValue({ docs: [] });
  sdk.commit.mockResolvedValue(undefined);
  sdk.getDocFromServer.mockImplementation(async ({ path }) => ({
    exists: () => true,
    metadata: { hasPendingWrites: false },
    data: () => ({ code: path, output: `legacy:${path}` }),
  }));
});

describe('officer solution persistence', () => {
  it.each(languages)(
    'writes independent %s source to its fixed child document',
    async (language) => {
      await updateSolution('session', 'problem', language, {
        code: `${language} code`,
      });
      expect(sdk.setDoc).toHaveBeenCalledExactlyOnceWith(
        { path: `sessions/session/problems/problem/solutions/${language}` },
        { code: `${language} code` },
      );
    },
  );
  it('does not synchronize Solution edits from legacy origin-linked Problems', async () => {
    sdk.getDocFromServer.mockResolvedValue({
      exists: () => true,
      data: () => ({
        bankOrigin: 'session',
        bankProblemId: 'legacy-bank',
      }),
    });
    await updateSolution('session', 'problem', 'python', {
      code: 'Session copy',
      timeComplexity: 'O(n)',
    });
    expect(sdk.setDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/session/problems/problem/solutions/python' },
      { code: 'Session copy', timeComplexity: 'O(n)' },
    );
  });
  it('strips extra fields and never writes Problem metadata', async () => {
    await updateSolution('s', 'p', 'python', {
      code: 'code',
      title: 'metadata',
      language: 'python',
    } as { code: string });
    expect(sdk.setDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/s/problems/p/solutions/python' },
      { code: 'code' },
    );
  });
  it('loads all three fixed documents separately for the requested Problem', async () => {
    const result = await getSolutionsForProblem('s', 'p');
    for (const language of languages) {
      const path = `sessions/s/problems/p/solutions/${language}`;
      expect(result[language]).toEqual({ code: path });
    }
    expect(sdk.getDocFromServer).toHaveBeenCalledTimes(3);
  });
  it('round trips optional complexity independently for each language', async () => {
    const time = {
      timeComplexity: 'O(n)',
      timeComplexityReason: 'One pass through the input.',
      spaceComplexity: 'O(n)',
      spaceComplexityReason: 'The map can hold each input value.',
    };
    await updateSolution('s', 'p', 'python', { code: 'py', ...time });
    await updateSolution('s', 'p', 'java', {
      code: 'java',
      timeComplexity: 'O(n log n)',
    });
    expect(sdk.setDoc).toHaveBeenNthCalledWith(
      1,
      { path: 'sessions/s/problems/p/solutions/python' },
      { code: 'py', ...time },
    );
    expect(sdk.setDoc).toHaveBeenNthCalledWith(
      2,
      { path: 'sessions/s/problems/p/solutions/java' },
      { code: 'java', timeComplexity: 'O(n log n)' },
    );
    sdk.getDocFromServer.mockImplementation(async ({ path }) => ({
      exists: () => true,
      metadata: { hasPendingWrites: false },
      data: () =>
        path.endsWith('/python')
          ? { code: 'py', ...time }
          : path.endsWith('/java')
            ? { code: 'java', timeComplexity: 'O(n log n)' }
            : { code: 'legacy' },
    }));
    await expect(getSolutionsForProblem('s', 'p')).resolves.toEqual({
      python: { code: 'py', ...time },
      java: { code: 'java', timeComplexity: 'O(n log n)' },
      cpp: { code: 'legacy' },
    });
  });
  it('maps missing solutions to empty content without creating documents', async () => {
    sdk.getDocFromServer.mockResolvedValue({
      exists: () => false,
      metadata: { hasPendingWrites: false },
    });
    expect(await getSolutionsForProblem('s', 'p')).toEqual({
      python: { code: '' },
      java: { code: '' },
      cpp: { code: '' },
    });
    expect(sdk.setDoc).not.toHaveBeenCalled();
  });
  it.each([null, { isAnonymous: true }])(
    'denies reads and writes without officer authentication (%s)',
    async (user) => {
      sdk.user.currentUser = user;
      await expect(getSolutionsForProblem('s', 'p')).rejects.toThrow('Sign in');
      await expect(
        updateSolution('s', 'p', 'cpp', { code: '' }),
      ).rejects.toThrow('Sign in');
      expect(sdk.getFirestoreDb).not.toHaveBeenCalled();
    },
  );
  it('rejects malformed or pending stored content', async () => {
    sdk.getDocFromServer.mockResolvedValue({
      exists: () => true,
      metadata: { hasPendingWrites: false },
      data: () => ({ code: 1, output: 'legacy ignored' }),
    });
    await expect(getSolutionsForProblem('s', 'p')).rejects.toThrow('text');
    sdk.getDocFromServer.mockResolvedValue({
      exists: () => true,
      metadata: { hasPendingWrites: true },
    });
    await expect(getSolutionsForProblem('s', 'p')).rejects.toThrow('awaiting');
  });
  it('propagates network failures without fake saved content', async () => {
    sdk.setDoc.mockRejectedValue(new Error('offline'));
    sdk.getDocFromServer.mockRejectedValue(new Error('offline'));
    await expect(
      updateSolution('s', 'p', 'java', { code: '' }),
    ).rejects.toThrow('offline');
    await expect(getSolutionsForProblem('s', 'p')).rejects.toThrow('offline');
  });

  it('loads explicit approaches in deterministic order with fixed language solutions', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        {
          id: 'z',
          data: () => ({
            name: 'Two Pointers',
            tags: ['Arrays', 'Two Pointers'],
            order: 1,
          }),
        },
        {
          id: 'a',
          data: () => ({ name: 'Hash Map', tags: ['Hash Map'], order: 0 }),
        },
      ],
    });
    const approaches = await getApproaches('sessions/s/problems/p');
    expect(approaches.map(({ id }) => id)).toEqual(['a', 'z']);
    expect(approaches[0].solutions.python).toEqual({
      code: 'sessions/s/problems/p/approaches/a/solutions/python',
    });
  });

  it('refuses to copy pending Approach or Solution data', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        {
          id: 'draft-write',
          data: () => ({ name: 'Hash Map', tags: ['Hash Map'], order: 0 }),
          metadata: { hasPendingWrites: true },
        },
      ],
    });
    await expect(getApproaches('sessions/s/problems/p')).rejects.toThrow(
      'Approach changes are awaiting confirmation.',
    );

    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        {
          id: 'saved',
          data: () => ({ name: 'Hash Map', tags: ['Hash Map'], order: 0 }),
          metadata: { hasPendingWrites: false },
        },
      ],
    });
    sdk.getDocFromServer.mockResolvedValue({
      exists: () => true,
      metadata: { hasPendingWrites: true },
      data: () => ({ code: 'unsaved source' }),
    });
    await expect(getApproaches('sessions/s/problems/p')).rejects.toThrow(
      'Solution changes are awaiting confirmation.',
    );
  });

  it('forward materializes all legacy language documents as the stable primary Approach before adding one', async () => {
    sdk.getDocFromServer.mockImplementation(
      async ({ path }: { path: string }) => ({
        exists: () => !path.endsWith('/approaches/primary'),
        metadata: { hasPendingWrites: false },
        data: () => ({ code: path }),
      }),
    );
    await createApproach('sessions/s/problems/p');
    expect(sdk.batchSet).toHaveBeenCalledWith(
      { path: 'sessions/s/problems/p/approaches/primary' },
      { name: 'Primary Approach', tags: [], order: 0 },
    );
    for (const language of languages)
      expect(sdk.batchSet).toHaveBeenCalledWith(
        {
          path: `sessions/s/problems/p/approaches/primary/solutions/${language}`,
        },
        { code: `sessions/s/problems/p/solutions/${language}` },
      );
    expect(sdk.batchUpdate).toHaveBeenCalledWith(
      { path: 'sessions/s/problems/p' },
      { approachesEnabled: true },
    );
  });

  it('keeps the intentional empty Session Approach state after deleting the final primary', async () => {
    sdk.getDocsFromServer.mockResolvedValue({ docs: [] });
    sdk.getDocFromServer.mockImplementation(async ({ path }) => ({
      exists: () => path === 'sessions/s/problems/p',
      metadata: { hasPendingWrites: false },
      data: () => ({ approachesEnabled: true }),
    }));
    await deleteApproach('sessions/s/problems/p', 'primary');
    expect(sdk.batchDelete).toHaveBeenCalledWith({
      path: 'sessions/s/problems/p/approaches/primary',
    });
    for (const language of languages)
      expect(sdk.batchDelete).toHaveBeenCalledWith({
        path: `sessions/s/problems/p/solutions/${language}`,
      });
    expect(await getApproaches('sessions/s/problems/p')).toEqual([]);
    const added = await createApproach('sessions/s/problems/p');
    expect(added.id).toBe('new-approach');
    expect(sdk.batchSet).toHaveBeenCalledWith(
      {
        id: 'new-approach',
        path: 'sessions/s/problems/p/approaches/new-approach',
      },
      { name: 'New Approach', tags: [], order: 0 },
    );
  });
});
