import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

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
  deleteDoc: vi.fn(),
}));
vi.mock('client-only', () => ({}));
vi.mock('./client', () => ({
  getFirestoreDb: () => sdk.db,
}));
vi.mock('./auth', () => ({ getOfficerAuth: vi.fn(() => sdk.user) }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/firestore')>()),
  collection: vi.fn((_db, path) => ({ path })),
  doc: vi.fn((_db, path) => ({ path })),
  serverTimestamp: () => 'SERVER_TIMESTAMP',
  addDoc: sdk.addDoc,
  getDocsFromServer: sdk.getDocsFromServer,
  updateDoc: sdk.updateDoc,
  deleteDoc: sdk.deleteDoc,
}));
import { getOfficerAuth } from './auth';
import {
  createSession,
  deleteSession,
  listSessions,
  updateSession,
} from './sessions';

const metadata = { title: 'Arrays', date: '2026-10-08' };
const timestamp = Timestamp.fromMillis(1000);
const session = {
  ...metadata,
  status: 'draft',
  activeProblemId: null,
  createdAt: timestamp,
  updatedAt: timestamp,
};
function document(id = 'session-id', data: unknown = session, pending = false) {
  return { id, data: () => data, metadata: { hasPendingWrites: pending } };
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.user.currentUser = { uid: 'officer', isAnonymous: false };
  sdk.addDoc.mockResolvedValue({ id: 'new-session' });
  sdk.updateDoc.mockResolvedValue(undefined);
  sdk.deleteDoc.mockResolvedValue(undefined);
  sdk.getDocsFromServer.mockResolvedValue({ docs: [document()] });
});

describe('officer session persistence', () => {
  it('creates only the required fields with draft, null pointer and server timestamps', async () => {
    expect(await createSession({ ...metadata, title: ' Arrays ' })).toBe(
      'new-session',
    );
    expect(getOfficerAuth).toHaveBeenCalledWith();
    expect(sdk.addDoc).toHaveBeenCalledWith(
      { path: 'sessions' },
      {
        ...session,
        createdAt: 'SERVER_TIMESTAMP',
        updatedAt: 'SERVER_TIMESTAMP',
      },
    );
  });

  it('edits only metadata and updatedAt, leaving createdAt and lifecycle fields stable', async () => {
    await updateSession('session-id', { title: 'Hashing', date: '2026-10-09' });
    expect(sdk.updateDoc).toHaveBeenCalledWith(
      { path: 'sessions/session-id' },
      {
        title: 'Hashing',
        date: '2026-10-09',
        updatedAt: 'SERVER_TIMESTAMP',
      },
    );
  });

  it('reads server records, keeping IDs separate and sorting calendar dates', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [
        document('later'),
        document('earlier', { ...session, date: '2026-10-07' }),
      ],
    });
    const records = await listSessions();
    expect(records.map((record) => record.id)).toEqual(['earlier', 'later']);
    expect(records[1].session).toEqual(session);
    expect(records[1].session).not.toHaveProperty('id');
    expect(sdk.getDocsFromServer).toHaveBeenCalledWith({ path: 'sessions' });
  });

  it('rejects pending timestamps instead of representing them as persisted success', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [document('pending', session, true)],
    });
    await expect(listSessions()).rejects.toThrow('awaiting confirmation');
  });

  it('rejects malformed persisted timestamps', async () => {
    sdk.getDocsFromServer.mockResolvedValue({
      docs: [document('invalid', { ...session, createdAt: null })],
    });
    await expect(listSessions()).rejects.toThrow('invalid fields');
  });

  it('returns an empty list from an empty Firestore collection', async () => {
    sdk.getDocsFromServer.mockResolvedValue({ docs: [] });
    expect(await listSessions()).toEqual([]);
  });

  it('hard deletes only the session document without changing its status', async () => {
    await deleteSession('session-id');
    expect(sdk.deleteDoc).toHaveBeenCalledWith({ path: 'sessions/session-id' });
    expect(sdk.updateDoc).not.toHaveBeenCalled();
  });

  it.each([null, { uid: 'anonymous-auth', isAnonymous: true }])(
    'blocks all operations without an officer Firebase session (%s)',
    async (user) => {
      sdk.user.currentUser = user;
      await expect(createSession(metadata)).rejects.toThrow('Sign in');
      await expect(listSessions()).rejects.toThrow('Sign in');
      await expect(updateSession('id', metadata)).rejects.toThrow('Sign in');
      await expect(deleteSession('id')).rejects.toThrow('Sign in');
      expect(sdk.addDoc).not.toHaveBeenCalled();
      expect(sdk.getDocsFromServer).not.toHaveBeenCalled();
      expect(sdk.updateDoc).not.toHaveBeenCalled();
      expect(sdk.deleteDoc).not.toHaveBeenCalled();
    },
  );

  it('checks the current Firebase session again after sign-out', async () => {
    await listSessions();
    sdk.user.currentUser = null;
    await expect(updateSession('id', metadata)).rejects.toThrow('Sign in');
  });

  it('does not hide Firestore failures', async () => {
    const error = new Error('permission denied');
    sdk.addDoc.mockRejectedValue(error);
    sdk.getDocsFromServer.mockRejectedValue(error);
    sdk.updateDoc.mockRejectedValue(error);
    sdk.deleteDoc.mockRejectedValue(error);
    await expect(createSession(metadata)).rejects.toBe(error);
    await expect(listSessions()).rejects.toBe(error);
    await expect(updateSession('id', metadata)).rejects.toBe(error);
    await expect(deleteSession('id')).rejects.toBe(error);
  });
});
