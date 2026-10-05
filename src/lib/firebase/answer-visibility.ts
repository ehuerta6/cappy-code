import 'client-only';

import { doc, onSnapshot } from 'firebase/firestore';
import { getFirestoreDb } from './client';
import { problemPath } from './paths';

export type Unsubscribe = () => void;

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

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
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
