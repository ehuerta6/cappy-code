import 'client-only';

import {
  doc,
  getDocFromServer,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import { problemPath, sessionPath } from './paths';

export type Unsubscribe = () => void;

function officerDb() {
  const user = getOfficerAuth().currentUser;
  if (!user || user.isAnonymous)
    throw new Error('Sign in to Officer Mode to manage presentation state.');
  return getFirestoreDb();
}

export async function setActiveProblem(
  sessionId: string,
  problemId: string | null,
): Promise<void> {
  const db = officerDb();
  if (problemId !== null) {
    const problem = await getDocFromServer(
      doc(db, problemPath(sessionId, problemId)),
    );
    if (!problem.exists())
      throw new Error('Choose a problem that belongs to this session.');
  }
  await updateDoc(doc(db, sessionPath(sessionId)), {
    activeProblemId: problemId,
    updatedAt: serverTimestamp(),
  });
}

function listenForValue<T>(
  path: string,
  field: string,
  isValue: (value: unknown) => value is T,
  onValue: (value: T) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  let active = true;
  const unsubscribe = onSnapshot(
    doc(getFirestoreDb(), path),
    (snapshot) => {
      if (!active) return;
      if (!snapshot.exists()) {
        onError(new Error('The presentation document no longer exists.'));
        return;
      }
      const value = snapshot.data()[field];
      if (!isValue(value)) {
        onError(new Error('The presentation document has invalid fields.'));
        return;
      }
      onValue(value);
    },
    (error) => {
      if (active) onError(error);
    },
  );
  return () => {
    if (!active) return;
    active = false;
    unsubscribe();
  };
}

function isProblemId(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value.trim().length > 0 &&
      !value.includes('/'))
  );
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function subscribeToActiveProblem(
  sessionId: string,
  onValue: (problemId: string | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return listenForValue(
    sessionPath(sessionId),
    'activeProblemId',
    isProblemId,
    onValue,
    onError,
  );
}

export function subscribeToAnswersVisible(
  sessionId: string,
  problemId: string,
  onValue: (visible: boolean) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return listenForValue(
    problemPath(sessionId, problemId),
    'answersVisible',
    isBoolean,
    onValue,
    onError,
  );
}
