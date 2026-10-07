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
  isProblemDifficulty,
  languages,
  type Problem,
  type SessionStatus,
  type SessionBranch,
  type Solution,
} from '../domain';
import { validateLeetcodeProblemUrl } from '../problem-metadata';
import { validateSessionMetadata } from '../session-metadata';
import { getFirestoreDb } from './client';
import { sessionPath, solutionPath } from './paths';

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
  const metadata = validateSessionMetadata({
    branch: data.branch,
    title: data.title,
    date: data.date,
  });
  return {
    id,
    session: {
      ...metadata,
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
    (data.constraints !== undefined && typeof data.constraints !== 'string') ||
    (data.difficulty !== undefined && !isProblemDifficulty(data.difficulty)) ||
    typeof data.order !== 'number' ||
    !Number.isFinite(data.order) ||
    typeof data.answersVisible !== 'boolean'
  )
    throw new Error('A stored problem has invalid fields.');
  const leetcodeUrl =
    data.leetcodeUrl === undefined
      ? undefined
      : validateLeetcodeProblemUrl(data.leetcodeUrl);
  return {
    id,
    problem: {
      title: data.title.trim(),
      description: data.description,
      exampleInput: data.exampleInput,
      exampleOutput: data.exampleOutput,
      constraints: data.constraints === undefined ? '' : data.constraints,
      order: data.order,
      answersVisible: data.answersVisible,
      ...(leetcodeUrl ? { leetcodeUrl } : {}),
      ...(isProblemDifficulty(data.difficulty)
        ? { difficulty: data.difficulty }
        : {}),
    },
  };
}

function validateSolution(value: unknown): Solution {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as Record<string, unknown>).code !== 'string'
  )
    throw new Error('A stored solution has invalid fields.');
  const data = value as Record<string, unknown>;
  const fields = [
    'timeComplexity',
    'timeComplexityReason',
    'spaceComplexity',
    'spaceComplexityReason',
  ] as const;
  const solution: Solution = { code: data.code as string };
  for (const field of fields) {
    const text = data[field];
    if (text !== undefined && typeof text !== 'string')
      throw new Error('A stored solution has invalid fields.');
    if (typeof text === 'string' && text.trim().length > 0)
      solution[field] = text;
  }
  return solution;
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
      (snapshot) => {
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
  const results = await Promise.all(
    languages.map(async (language) => {
      const snapshot = await getDocFromServer(
        doc(getFirestoreDb(), solutionPath(sessionId, problemId, language)),
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
