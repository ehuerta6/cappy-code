import 'client-only';

import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocFromServer,
  getDocsFromServer,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Session } from '../domain';
import {
  validateSessionMetadata,
  type SessionMetadata,
} from '../session-metadata';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import { sessionPath } from './paths';
import { appendProblemDeletion } from './problems';

export interface SessionRecord {
  id: string;
  session: Session;
  problemCount: number | null;
}

export type ProblemCountState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; count: number };

function officerDb() {
  const user = getOfficerAuth().currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('Sign in to Officer Mode to manage sessions.');
  }
  return getFirestoreDb();
}

export async function createSession(
  metadata: SessionMetadata,
): Promise<string> {
  const db = officerDb();
  const fields = validateSessionMetadata(metadata);
  const reference = await addDoc(collection(db, 'sessions'), {
    ...fields,
    status: 'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function listSessions(): Promise<SessionRecord[]> {
  const db = officerDb();
  const snapshot = await getDocsFromServer(collection(db, 'sessions'));
  const records = await Promise.all(
    snapshot.docs.map(async (document): Promise<SessionRecord> => {
      // A server read can still include local pending writes. Never invent timestamps.
      if (document.metadata.hasPendingWrites) {
        throw new Error(
          'Session changes are still awaiting confirmation. Retry when connected.',
        );
      }
      const data = document.data();
      if (
        typeof data.title !== 'string' ||
        typeof data.date !== 'string' ||
        !['draft', 'live', 'ended'].includes(data.status) ||
        !(data.createdAt instanceof Timestamp) ||
        !(data.updatedAt instanceof Timestamp)
      ) {
        throw new Error(
          'A stored session has invalid fields. Check its Firestore document.',
        );
      }
      const metadata = validateSessionMetadata({
        branch: data.branch,
        title: data.title,
        date: data.date,
      });
      let problemCount: number | null = null;
      try {
        const problems = await getCountFromServer(
          collection(db, `${sessionPath(document.id)}/problems`),
        );
        problemCount = problems.data().count;
      } catch {
        // Keep the Session available so the Officer can still open it and retry.
      }
      return {
        id: document.id,
        problemCount,
        session: {
          ...metadata,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        },
      };
    }),
  );
  return records.sort(
    (a, b) =>
      a.session.date.localeCompare(b.session.date) || a.id.localeCompare(b.id),
  );
}

export async function transitionSession(
  id: string,
  nextStatus: 'live' | 'draft' | 'ended',
): Promise<void> {
  if (
    nextStatus !== 'live' &&
    nextStatus !== 'draft' &&
    nextStatus !== 'ended'
  ) {
    throw new Error('Unsupported session status transition.');
  }
  const db = officerDb();
  const reference = doc(db, sessionPath(id));

  if (nextStatus === 'live') {
    const problems = await getDocsFromServer(
      collection(db, `${sessionPath(id)}/problems`),
    );
    if (problems.empty) {
      throw new Error('Add at least one problem before going live.');
    }
  }

  const liveSessionReference = doc(db, 'sessionControl/liveSession');
  const legacyLiveSessions =
    nextStatus === 'live' &&
    !(await getDocFromServer(liveSessionReference)).exists()
      ? (
          await getDocsFromServer(
            query(collection(db, 'sessions'), where('status', '==', 'live')),
          )
        ).docs
      : [];

  await runTransaction(db, async (transaction) => {
    const liveSessionSnapshot = await transaction.get(liveSessionReference);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) {
      throw new Error('This session no longer exists.');
    }
    const currentStatus = snapshot.data().status;
    const expectedStatus = nextStatus === 'live' ? 'draft' : 'live';
    if (currentStatus !== expectedStatus) {
      throw new Error(
        nextStatus === 'live'
          ? 'Only draft sessions can go live.'
          : `Only live sessions can be marked ${nextStatus === 'draft' ? 'not live' : 'ended'}.`,
      );
    }

    let liveSessionId: string | null = liveSessionSnapshot.exists()
      ? (liveSessionSnapshot.data().sessionId as string | null)
      : null;

    if (!liveSessionSnapshot.exists()) {
      const otherLiveSession = legacyLiveSessions.find(
        (liveSession) => liveSession.id !== id,
      );

      if (nextStatus === 'live' && otherLiveSession) {
        throw new Error(
          'Another Session is already live. Set it to Not Live or end it before starting this one.',
        );
      }

      liveSessionId = legacyLiveSessions[0]?.id ?? null;
      if (nextStatus !== 'live') liveSessionId = null;
    }

    if (nextStatus === 'live' && liveSessionId && liveSessionId !== id) {
      throw new Error(
        'Another Session is already live. Set it to Not Live or end it before starting this one.',
      );
    }
    const releasesLiveClaim = nextStatus !== 'live' && liveSessionId === id;
    if (nextStatus === 'live' || releasesLiveClaim) {
      transaction.set(liveSessionReference, {
        sessionId: nextStatus === 'live' ? id : null,
      });
    }
    transaction.update(reference, {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function updateSession(
  id: string,
  metadata: SessionMetadata,
): Promise<void> {
  const db = officerDb();
  await updateDoc(doc(db, sessionPath(id)), {
    ...validateSessionMetadata(metadata),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSession(id: string): Promise<void> {
  const db = officerDb();
  const problems = await getDocsFromServer(
    collection(db, `${sessionPath(id)}/problems`),
  );
  const sessionReference = doc(db, sessionPath(id));
  const liveSessionReference = doc(db, 'sessionControl/liveSession');
  const [session, liveSession] = await Promise.all([
    getDocFromServer(sessionReference),
    getDocFromServer(liveSessionReference),
  ]);
  const releasesLiveClaim =
    session.exists() &&
    session.data().status === 'live' &&
    liveSession.exists() &&
    liveSession.data().sessionId === id;
  // Keep the entire cascade atomic within Firestore's 500-write batch limit.
  if (problems.docs.length * 4 + 1 + Number(releasesLiveClaim) > 500)
    throw new Error('Too many problems to delete this session in one batch.');
  const batch = writeBatch(db);
  for (const problem of problems.docs)
    appendProblemDeletion(batch, db, id, problem.id);
  if (releasesLiveClaim) {
    batch.update(liveSessionReference, { sessionId: null });
  }
  batch.delete(sessionReference);
  await batch.commit();
}
