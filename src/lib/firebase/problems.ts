import 'client-only';

import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocsFromServer,
  updateDoc,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import {
  isProblemDifficulty,
  languages,
  type Problem,
  type ProblemDifficulty,
} from '../domain';
import { validateLeetcodeProblemUrl } from '../problem-metadata';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import { problemPath, sessionPath, solutionPath } from './paths';

export interface ProblemRecord {
  id: string;
  problem: Problem;
}
export type ProblemContent = Pick<
  Problem,
  'title' | 'description' | 'exampleInput' | 'exampleOutput' | 'constraints'
> & { leetcodeUrl: string; difficulty: ProblemDifficulty | '' };

type ProblemContentInput = Omit<
  ProblemContent,
  'leetcodeUrl' | 'constraints' | 'difficulty'
> & {
  constraints?: string;
  leetcodeUrl?: string;
  difficulty?: ProblemDifficulty | '';
};

function officerDb() {
  const user = getOfficerAuth().currentUser;
  if (!user || user.isAnonymous)
    throw new Error('Sign in to Officer Mode to manage problems.');
  return getFirestoreDb();
}

export function validateProblemContent(
  content: ProblemContentInput,
): ProblemContent {
  if (typeof content.title !== 'string' || !content.title.trim())
    throw new Error('Enter a problem title.');
  const constraints = content.constraints ?? '';
  const difficulty = content.difficulty ?? '';
  if (
    [
      content.description,
      content.exampleInput,
      content.exampleOutput,
      constraints,
    ].some((field) => typeof field !== 'string')
  )
    throw new Error('Problem content must be text.');
  if (difficulty !== '' && !isProblemDifficulty(difficulty))
    throw new Error('Select a supported Problem difficulty.');
  return {
    title: content.title.trim(),
    description: content.description,
    exampleInput: content.exampleInput,
    exampleOutput: content.exampleOutput,
    constraints,
    leetcodeUrl: validateLeetcodeProblemUrl(content.leetcodeUrl) ?? '',
    difficulty,
  };
}

export async function listProblems(
  sessionId: string,
): Promise<ProblemRecord[]> {
  const snapshot = await getDocsFromServer(
    collection(officerDb(), `${sessionPath(sessionId)}/problems`),
  );
  const records = snapshot.docs.map((document): ProblemRecord => {
    if (document.metadata.hasPendingWrites)
      throw new Error('Problem changes are still awaiting confirmation.');
    const data = document.data();
    if (data.difficulty !== undefined && !isProblemDifficulty(data.difficulty))
      throw new Error('A stored problem has invalid fields.');
    const leetcodeUrl =
      data.leetcodeUrl === undefined
        ? undefined
        : validateLeetcodeProblemUrl(data.leetcodeUrl);
    if (
      typeof data.order !== 'number' ||
      !Number.isFinite(data.order) ||
      typeof data.answersVisible !== 'boolean'
    )
      throw new Error('A stored problem has invalid fields.');
    const content = validateProblemContent({
      title: data.title,
      description: data.description,
      exampleInput: data.exampleInput,
      exampleOutput: data.exampleOutput,
      constraints: data.constraints === undefined ? '' : data.constraints,
    });
    return {
      id: document.id,
      problem: {
        title: content.title,
        description: content.description,
        exampleInput: content.exampleInput,
        exampleOutput: content.exampleOutput,
        constraints: content.constraints,
        order: data.order,
        answersVisible: data.answersVisible,
        ...(leetcodeUrl ? { leetcodeUrl } : {}),
        ...(isProblemDifficulty(data.difficulty)
          ? { difficulty: data.difficulty }
          : {}),
      },
    };
  });
  return records.sort(
    (a, b) => a.problem.order - b.problem.order || a.id.localeCompare(b.id),
  );
}

export async function createProblem(sessionId: string): Promise<ProblemRecord> {
  const db = officerDb();
  const records = await listProblems(sessionId);
  const problem: Problem = {
    title: 'Untitled Problem',
    description: '',
    exampleInput: '',
    exampleOutput: '',
    constraints: '',
    order: records.length
      ? Math.max(...records.map((record) => record.problem.order)) + 1
      : 0,
    answersVisible: false,
  };
  const reference = await addDoc(
    collection(db, `${sessionPath(sessionId)}/problems`),
    problem,
  );
  return { id: reference.id, problem };
}

export async function updateProblem(
  sessionId: string,
  problemId: string,
  content: Partial<ProblemContent>,
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (content.title !== undefined) {
    if (typeof content.title !== 'string' || !content.title.trim())
      throw new Error('Enter a problem title.');
    updates.title = content.title.trim();
  }
  for (const field of [
    'description',
    'exampleInput',
    'exampleOutput',
    'constraints',
  ] as const) {
    if (content[field] !== undefined) {
      if (typeof content[field] !== 'string')
        throw new Error('Problem content must be text.');
      updates[field] = content[field];
    }
  }
  if (content.leetcodeUrl !== undefined) {
    const leetcodeUrl = validateLeetcodeProblemUrl(content.leetcodeUrl);
    updates.leetcodeUrl = leetcodeUrl ?? deleteField();
  }
  if (content.difficulty !== undefined) {
    if (content.difficulty === '') updates.difficulty = deleteField();
    else if (isProblemDifficulty(content.difficulty))
      updates.difficulty = content.difficulty;
    else throw new Error('Select a supported Problem difficulty.');
  }
  if (Object.keys(updates).length === 0)
    throw new Error('Select Problem content to save.');
  await updateDoc(doc(officerDb(), problemPath(sessionId, problemId)), updates);
}

export async function setAnswersVisible(
  sessionId: string,
  problemId: string,
  visible: boolean,
): Promise<void> {
  await updateDoc(doc(officerDb(), problemPath(sessionId, problemId)), {
    answersVisible: visible,
  });
}

export async function reorderProblems(
  sessionId: string,
  orderedIds: string[],
): Promise<void> {
  const db = officerDb();
  const records = await listProblems(sessionId);
  if (
    orderedIds.length !== records.length ||
    new Set(orderedIds).size !== orderedIds.length ||
    records.some((record) => !orderedIds.includes(record.id))
  )
    throw new Error('The problem list changed. Reload before reordering.');
  if (orderedIds.length > 500)
    throw new Error('Too many problems for one reorder.');
  const batch = writeBatch(db);
  orderedIds.forEach((id, order) =>
    batch.update(doc(db, problemPath(sessionId, id)), { order }),
  );
  await batch.commit();
}

// Fixed children can be deleted without reading protected Solution content.
export function appendProblemDeletion(
  batch: WriteBatch,
  db: Firestore,
  sessionId: string,
  problemId: string,
): void {
  for (const language of languages)
    batch.delete(doc(db, solutionPath(sessionId, problemId, language)));
  batch.delete(doc(db, problemPath(sessionId, problemId)));
}

export async function deleteProblem(
  sessionId: string,
  problemId: string,
): Promise<void> {
  const db = officerDb();
  const batch = writeBatch(db);
  appendProblemDeletion(batch, db, sessionId, problemId);
  await batch.commit();
}
