import 'client-only';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocsFromServer,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import type { Session } from '../domain';
import {
  validateSessionMetadata,
  type SessionMetadata,
} from '../session-metadata';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import { sessionPath } from './paths';

export interface SessionRecord {
  id: string;
  session: Session;
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
  const snapshot = await getDocsFromServer(collection(officerDb(), 'sessions'));
  const records = snapshot.docs.map((document): SessionRecord => {
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
    return {
      id: document.id,
      session: {
        ...metadata,
        status: data.status,
        activeProblemId: data.activeProblemId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    };
  });
  return records.sort(
    (a, b) =>
      a.session.date.localeCompare(b.session.date) || a.id.localeCompare(b.id),
  );
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

// Firestore does not recursively delete subcollections; #39 must revisit this policy.
export async function deleteSession(id: string): Promise<void> {
  await deleteDoc(doc(officerDb(), sessionPath(id)));
}
