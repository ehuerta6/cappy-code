import 'client-only';

import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  where,
} from 'firebase/firestore';
import {
  languages,
  type Problem,
  type SessionStatus,
  type Solution,
} from '../domain';
import { validateSessionMetadata } from '../session-metadata';
import { getFirestoreDb } from './client';
import { sessionPath, solutionPath } from './paths';

export interface MemberSessionRecord {
  id: string;
  session: { title: string; date: string; status: 'live' | 'ended' };
}

export interface MemberProblemRecord {
  id: string;
  problem: Problem;
}

export type MemberSolutions = Record<(typeof languages)[number], Solution>;

const publicStatuses: SessionStatus[] = ['live', 'ended'];

function validateSessionRecord(
  id: string,
  value: unknown,
): MemberSessionRecord {
  if (!value || typeof value !== 'object')
    throw new Error('A stored session has invalid fields.');
  const data = value as Record<string, unknown>;
  if (
    typeof data.title !== 'string' ||
    typeof data.date !== 'string' ||
    !publicStatuses.includes(data.status as SessionStatus)
  )
    throw new Error('A stored session has invalid fields.');
  return {
    id,
    session: {
      ...validateSessionMetadata({ title: data.title, date: data.date }),
      status: data.status as 'live' | 'ended',
    },
  };
}

function validateProblemRecord(
  id: string,
  value: unknown,
): MemberProblemRecord {
  if (!value || typeof value !== 'object')
    throw new Error('A stored problem has invalid fields.');
  const data = value as Record<string, unknown>;
  if (
    typeof data.title !== 'string' ||
    !data.title.trim() ||
    typeof data.description !== 'string' ||
    typeof data.exampleInput !== 'string' ||
    typeof data.exampleOutput !== 'string' ||
    typeof data.order !== 'number' ||
    !Number.isFinite(data.order) ||
    typeof data.answersVisible !== 'boolean'
  )
    throw new Error('A stored problem has invalid fields.');
  return {
    id,
    problem: {
      title: data.title.trim(),
      description: data.description,
      exampleInput: data.exampleInput,
      exampleOutput: data.exampleOutput,
      order: data.order,
      answersVisible: data.answersVisible,
    },
  };
}

function validateSolution(value: unknown): Solution {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as Record<string, unknown>).code !== 'string' ||
    typeof (value as Record<string, unknown>).output !== 'string'
  )
    throw new Error('A stored solution has invalid fields.');
  const data = value as Record<string, string>;
  return { code: data.code, output: data.output };
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
  const results = await Promise.all(
    languages.map(async (language) => {
      const snapshot = await getDocFromServer(
        doc(getFirestoreDb(), solutionPath(sessionId, problemId, language)),
      );
      if (snapshot.metadata.hasPendingWrites)
        throw new Error('Solution changes are awaiting confirmation.');
      return [
        language,
        snapshot.exists()
          ? validateSolution(snapshot.data())
          : { code: '', output: '' },
      ] as const;
    }),
  );
  return Object.fromEntries(results) as MemberSolutions;
}
