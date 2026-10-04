import { beforeEach, describe, expect, it, vi } from 'vitest';
import { languages } from '../domain';

const sdk = vi.hoisted(() => ({
  user: {
    currentUser: { isAnonymous: false } as { isAnonymous: boolean } | null,
  },
  db: {},
  getDocFromServer: vi.fn(),
  setDoc: vi.fn(),
  getFirestoreDb: vi.fn(),
}));
vi.mock('client-only', () => ({}));
vi.mock('./auth', () => ({ getOfficerAuth: () => sdk.user }));
vi.mock('./client', () => ({ getFirestoreDb: sdk.getFirestoreDb }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  getDocFromServer: sdk.getDocFromServer,
  setDoc: sdk.setDoc,
}));
import { getSolutionsForProblem, updateSolution } from './solutions';

beforeEach(() => {
  vi.clearAllMocks();
  sdk.user.currentUser = { isAnonymous: false };
  sdk.getFirestoreDb.mockReturnValue(sdk.db);
  sdk.setDoc.mockResolvedValue(undefined);
  sdk.getDocFromServer.mockImplementation(async ({ path }) => ({
    exists: () => true,
    metadata: { hasPendingWrites: false },
    data: () => ({ code: path, output: `output:${path}` }),
  }));
});

describe('officer solution persistence', () => {
  it.each(languages)(
    'writes independent %s source and output to its fixed child document',
    async (language) => {
      await updateSolution('session', 'problem', language, {
        code: `${language} code`,
        output: `${language} output`,
      });
      expect(sdk.setDoc).toHaveBeenCalledExactlyOnceWith(
        { path: `sessions/session/problems/problem/solutions/${language}` },
        { code: `${language} code`, output: `${language} output` },
      );
    },
  );
  it('strips extra fields and never writes Problem metadata', async () => {
    await updateSolution('s', 'p', 'python', {
      code: 'code',
      output: 'output',
      title: 'metadata',
      language: 'python',
    } as { code: string; output: string });
    expect(sdk.setDoc).toHaveBeenCalledExactlyOnceWith(
      { path: 'sessions/s/problems/p/solutions/python' },
      { code: 'code', output: 'output' },
    );
  });
  it('loads all three fixed documents separately for the requested Problem', async () => {
    const result = await getSolutionsForProblem('s', 'p');
    for (const language of languages) {
      const path = `sessions/s/problems/p/solutions/${language}`;
      expect(result[language]).toEqual({
        code: path,
        output: `output:${path}`,
      });
    }
    expect(sdk.getDocFromServer).toHaveBeenCalledTimes(3);
  });
  it('maps missing solutions to empty content without creating documents', async () => {
    sdk.getDocFromServer.mockResolvedValue({
      exists: () => false,
      metadata: { hasPendingWrites: false },
    });
    expect(await getSolutionsForProblem('s', 'p')).toEqual({
      python: { code: '', output: '' },
      java: { code: '', output: '' },
      cpp: { code: '', output: '' },
    });
    expect(sdk.setDoc).not.toHaveBeenCalled();
  });
  it.each([null, { isAnonymous: true }])(
    'denies reads and writes without officer authentication (%s)',
    async (user) => {
      sdk.user.currentUser = user;
      await expect(getSolutionsForProblem('s', 'p')).rejects.toThrow('Sign in');
      await expect(
        updateSolution('s', 'p', 'cpp', { code: '', output: '' }),
      ).rejects.toThrow('Sign in');
      expect(sdk.getFirestoreDb).not.toHaveBeenCalled();
    },
  );
  it('rejects malformed or pending stored content', async () => {
    sdk.getDocFromServer.mockResolvedValue({
      exists: () => true,
      metadata: { hasPendingWrites: false },
      data: () => ({ code: 1, output: '' }),
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
      updateSolution('s', 'p', 'java', { code: '', output: '' }),
    ).rejects.toThrow('offline');
    await expect(getSolutionsForProblem('s', 'p')).rejects.toThrow('offline');
  });
});
