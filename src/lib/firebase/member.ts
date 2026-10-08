import 'client-only';

import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  languages,
  problemSchema,
  sessionSchema,
  solutionSchema,
  type Problem,
  type SessionStatus,
  type SessionBranch,
  type Solution,
  type SolutionApproach,
} from '../domain';
import { getFirestoreDb } from './client';
import { isPermissionDenied } from './errors';
import { sessionPath, solutionPath } from './paths';
import { getApproaches } from './solutions';

export interface MemberSessionRecord {
  id: string;
  session: {
    branch: SessionBranch;
    title: string;
    date: string;
    status: 'live' | 'ended';
  };
}

export interface MemberProblemRecord {
  id: string;
  problem: Problem;
}

export type MemberSolutions = Record<(typeof languages)[number], Solution>;

export async function getMemberApproaches(
  sessionId: string,
  problemId: string,
): Promise<SolutionApproach[]> {
  return getApproaches(`${sessionPath(sessionId)}/problems/${problemId}`);
}

export function memberReadFailureKind(
  error: unknown,
): 'permission' | 'connection' {
  return isPermissionDenied(error) ? 'permission' : 'connection';
}

const publicStatuses: SessionStatus[] = ['live', 'ended'];

function validateSessionRecord(
  id: string,
  value: unknown,
): MemberSessionRecord {
  const parsed = sessionSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.message;
    if (
      issue?.path[0] === 'date' ||
      message === 'Choose Intro, General, or ICPC for this session.'
    )
      throw new Error(message);
    throw new Error('A stored session has invalid fields.');
  }
  if (!publicStatuses.includes(parsed.data.status as SessionStatus))
    throw new Error('A stored session has invalid fields.');
  return {
    id,
    session: {
      branch: parsed.data.branch,
      title: parsed.data.title,
      date: parsed.data.date,
      status: parsed.data.status as 'live' | 'ended',
    },
  };
}

function validateProblemRecord(
  id: string,
  value: unknown,
): MemberProblemRecord {
  const parsed = problemSchema.safeParse(value);
  if (!parsed.success) {
    const leetcodeIssue = parsed.error.issues.find(
      (issue) => issue.path[0] === 'leetcodeUrl',
    );
    if (leetcodeIssue) throw new Error(leetcodeIssue.message);
    throw new Error('A stored problem has invalid fields.');
  }
  return { id, problem: parsed.data };
}

function validateSolution(value: unknown): Solution {
  const parsed = solutionSchema.safeParse(value);
  if (!parsed.success) throw new Error('A stored solution has invalid fields.');
  return parsed.data;
}

async function listSessionsWithStatus(status: 'live' | 'ended') {
  const snapshot = await getDocsFromServer(
    query(
      collection(getFirestoreDb(), 'sessions'),
      where('status', '==', status),
    ),
  );
  return snapshot.docs.map((document) => {
    if (document.metadata.hasPendingWrites)
      throw new Error('Session changes are awaiting confirmation.');
    return validateSessionRecord(document.id, document.data());
  });
}

export async function listMemberSessions(): Promise<MemberSessionRecord[]> {
  const [live, ended] = await Promise.all([
    listSessionsWithStatus('live'),
    listSessionsWithStatus('ended'),
  ]);
  return [...live, ...ended].sort(
    (a, b) =>
      b.session.date.localeCompare(a.session.date) || a.id.localeCompare(b.id),
  );
}

export function subscribeToMemberSessions(
  onValue: (sessions: MemberSessionRecord[]) => void,
  onError: (error: Error) => void,
): () => void {
  try {
    return onSnapshot(
      query(
        collection(getFirestoreDb(), 'sessions'),
        where('status', 'in', publicStatuses),
      ),
      { includeMetadataChanges: true },
      (snapshot) => {
        // Cache results can describe a Session that has since gone draft or
        // an obsolete reveal value. Wait for a server-confirmed snapshot.
        if (snapshot.metadata.fromCache) {
          onError(
            new Error('Waiting for a server-confirmed Session snapshot.'),
          );
          return;
        }
        try {
          const records = snapshot.docs.map((document) => {
            if (document.metadata.hasPendingWrites)
              throw new Error('Session changes are awaiting confirmation.');
            return validateSessionRecord(document.id, document.data());
          });
          onValue(
            records.sort(
              (a, b) =>
                b.session.date.localeCompare(a.session.date) ||
                a.id.localeCompare(b.id),
            ),
          );
        } catch (error) {
          onError(
            error instanceof Error
              ? error
              : new Error('Session data is invalid.'),
          );
        }
      },
      onError,
    );
  } catch (error) {
    onError(
      error instanceof Error ? error : new Error('Session updates failed.'),
    );
    return () => {};
  }
}

export async function getMemberSession(
  sessionId: string,
): Promise<MemberSessionRecord | null> {
  const snapshot = await getDocFromServer(
    doc(getFirestoreDb(), sessionPath(sessionId)),
  );
  if (!snapshot.exists()) return null;
  if (snapshot.metadata.hasPendingWrites)
    throw new Error('Session changes are awaiting confirmation.');
  const record = validateSessionRecord(snapshot.id, snapshot.data());
  return record;
}

export async function listMemberProblems(
  sessionId: string,
): Promise<MemberProblemRecord[]> {
  const snapshot = await getDocsFromServer(
    collection(getFirestoreDb(), `${sessionPath(sessionId)}/problems`),
  );
  return snapshot.docs
    .map((document) => {
      if (document.metadata.hasPendingWrites)
        throw new Error('Problem changes are awaiting confirmation.');
      return validateProblemRecord(document.id, document.data());
    })
    .sort(
      (a, b) => a.problem.order - b.problem.order || a.id.localeCompare(b.id),
    );
}

export async function getMemberSolutions(
  sessionId: string,
  problemId: string,
): Promise<MemberSolutions> {
  const db = getFirestoreDb();
  const results = await Promise.all(
    languages.map(async (language) => {
      const snapshot = await getDocFromServer(
        doc(db, solutionPath(sessionId, problemId, language)),
      );
      if (snapshot.metadata.hasPendingWrites)
        throw new Error('Solution changes are awaiting confirmation.');
      return [
        language,
        snapshot.exists() ? validateSolution(snapshot.data()) : { code: '' },
      ] as const;
    }),
  );
  return Object.fromEntries(results) as MemberSolutions;
}
