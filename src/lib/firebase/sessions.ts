import 'client-only';

import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocsFromServer,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
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
  problemCount: number;
}

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
    activeProblemId: null,
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
        !(
          data.activeProblemId === null ||
          typeof data.activeProblemId === 'string'
        ) ||
        !(data.createdAt instanceof Timestamp) ||
        !(data.updatedAt instanceof Timestamp)
      ) {
        throw new Error(
          'A stored session has invalid fields. Check its Firestore document.',
        );
      }
      const metadata = validateSessionMetadata({
        title: data.title,
        date: data.date,
      });
      const problems = await getCountFromServer(
        collection(db, `${sessionPath(document.id)}/problems`),
      );
      return {
        id: document.id,
        problemCount: problems.data().count,
        session: {
          ...metadata,
          status: data.status,
          activeProblemId: data.activeProblemId,
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
  nextStatus: 'live' | 'ended',
): Promise<void> {
  if (nextStatus !== 'live' && nextStatus !== 'ended') {
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

  await runTransaction(db, async (transaction) => {
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
          : 'Only live sessions can be ended.',
      );
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
  // Keep the entire cascade atomic within Firestore's 500-write batch limit.
  if (problems.docs.length * 4 + 1 > 500)
    throw new Error('Too many problems to delete this session in one batch.');
  const batch = writeBatch(db);
  for (const problem of problems.docs)
    appendProblemDeletion(batch, db, id, problem.id);
  batch.delete(doc(db, sessionPath(id)));
  await batch.commit();
}
