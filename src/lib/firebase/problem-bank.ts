import 'client-only';

import {
  collection,
  deleteField,
  arrayUnion,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  languages,
  problemCategorySchema,
  problemDifficultySchema,
  solutionSchema,
  type ProblemCategory,
  type ProblemDifficulty,
  type Solution,
} from '../domain';
import { validateLeetcodeProblemUrl } from '../problem-metadata';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import {
  bankProblemPath,
  bankSolutionPath,
  problemPath,
  sessionPath,
  solutionPath,
} from './paths';
import { listProblems } from './problems';

export interface BankProblemContent {
  title: string;
  description: string;
  constraints: string;
  exampleInput: string;
  exampleOutput: string;
  category: ProblemCategory;
  difficulty?: ProblemDifficulty;
  leetcodeUrl?: string;
}

export interface BankProblemRecord extends BankProblemContent {
  id: string;
}

export type BankSolutions = Record<(typeof languages)[number], Solution>;

function officerDb() {
  const user = getOfficerAuth().currentUser;
  if (!user || user.isAnonymous)
    throw new Error('Sign in to Officer Mode to manage the Problem Bank.');
  return getFirestoreDb();
}

function validateContent(value: unknown): BankProblemContent {
  if (!value || typeof value !== 'object')
    throw new Error('A stored bank Problem has invalid fields.');
  const data = value as Record<string, unknown>;
  if (typeof data.title !== 'string' || !data.title.trim())
    throw new Error('Enter a problem title.');
  for (const field of [
    'description',
    'constraints',
    'exampleInput',
    'exampleOutput',
  ]) {
    if (typeof data[field] !== 'string')
      throw new Error('Problem content must be text.');
  }
  if (!problemCategorySchema.safeParse(data.category).success)
    throw new Error('Select a supported Problem category.');
  const result: BankProblemContent = {
    title: data.title.trim(),
    description: data.description as string,
    constraints: data.constraints as string,
    exampleInput: data.exampleInput as string,
    exampleOutput: data.exampleOutput as string,
    category: data.category as ProblemCategory,
  };
  if (data.difficulty !== undefined) {
    if (!problemDifficultySchema.safeParse(data.difficulty).success)
      throw new Error('Select a supported Problem difficulty.');
    result.difficulty = data.difficulty as ProblemDifficulty;
  }
  const url = validateLeetcodeProblemUrl(data.leetcodeUrl);
  if (url) result.leetcodeUrl = url;
  return result;
}

function validateSolution(value: unknown): Solution {
  const parsed = solutionSchema.safeParse(value);
  if (!parsed.success) throw new Error('A stored solution has invalid fields.');
  return parsed.data;
}

function sorted(records: BankProblemRecord[]) {
  return records.sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id),
  );
}

function mapBankSnapshot(snapshot: {
  docs: Array<{
    id: string;
    data: () => Record<string, unknown>;
    metadata: { hasPendingWrites: boolean };
  }>;
}) {
  return snapshot.docs.map((document) => {
    if (document.metadata.hasPendingWrites)
      throw new Error('Problem Bank changes are awaiting confirmation.');
    return { id: document.id, ...validateContent(document.data()) };
  });
}

export async function listOfficerBankProblems(): Promise<BankProblemRecord[]> {
  const snapshot = await getDocsFromServer(
    collection(officerDb(), 'problemBank'),
  );
  return sorted(mapBankSnapshot(snapshot));
}

export async function listMemberBankProblems(): Promise<BankProblemRecord[]> {
  const db = getFirestoreDb();
  const snapshot = await getDocsFromServer(
    query(collection(db, 'problemBank'), where('isPublic', '==', true)),
  );
  return sorted(mapBankSnapshot(snapshot));
}

export async function getBankProblem(
  problemId: string,
  officer = false,
): Promise<{ problem: BankProblemRecord; solutions: BankSolutions } | null> {
  const db = officer ? officerDb() : getFirestoreDb();
  const parent = await getDocFromServer(doc(db, bankProblemPath(problemId)));
  if (!parent.exists()) return null;
  const problem = { id: parent.id, ...validateContent(parent.data()) };
  const entries = await Promise.all(
    languages.map(async (language) => {
      const snapshot = await getDocFromServer(
        doc(db, bankSolutionPath(problemId, language)),
      );
      if (snapshot.metadata.hasPendingWrites)
        throw new Error('Solution changes are awaiting confirmation.');
      return [
        language,
        snapshot.exists() ? validateSolution(snapshot.data()) : { code: '' },
      ] as const;
    }),
  );
  return { problem, solutions: Object.fromEntries(entries) as BankSolutions };
}

export async function createBankProblem(): Promise<BankProblemRecord> {
  const db = officerDb();
  const reference = doc(collection(db, 'problemBank'));
  const problem: BankProblemContent = {
    title: 'Untitled Problem',
    description: '',
    constraints: '',
    exampleInput: '',
    exampleOutput: '',
    category: 'custom',
  };
  const batch = writeBatch(db);
  batch.set(reference, { ...problem, isPublic: true });
  for (const language of languages)
    batch.set(doc(db, bankSolutionPath(reference.id, language)), { code: '' });
  await batch.commit();
  return { id: reference.id, ...problem };
}

export async function updateBankProblem(
  problemId: string,
  content: BankProblemContent,
): Promise<void> {
  const validated = validateContent(content);
  const updates: Record<string, unknown> = { ...validated };
  updates.difficulty = validated.difficulty ?? deleteField();
  updates.leetcodeUrl = validated.leetcodeUrl ?? deleteField();
  await updateDoc(doc(officerDb(), bankProblemPath(problemId)), updates);
}

export async function updateBankSolution(
  problemId: string,
  language: (typeof languages)[number],
  solution: Solution,
): Promise<void> {
  if (!languages.includes(language))
    throw new Error('Choose Python, Java, or C++.');
  const parsed = validateSolution(solution);
  await setDoc(doc(officerDb(), bankSolutionPath(problemId, language)), parsed);
}

export async function addBankProblemToSession(
  sessionId: string,
  problemId: string,
): Promise<{ id: string; problem: import('../domain').Problem }> {
  const db = officerDb();
  const record = await getBankProblem(problemId, true);
  if (!record) throw new Error('This bank Problem no longer exists.');
  const existing = await listProblems(sessionId);
  const sessionProblem = {
    title: record.problem.title,
    description: record.problem.description,
    constraints: record.problem.constraints,
    exampleInput: record.problem.exampleInput,
    exampleOutput: record.problem.exampleOutput,
    category: record.problem.category,
    ...(record.problem.difficulty
      ? { difficulty: record.problem.difficulty }
      : {}),
    ...(record.problem.leetcodeUrl
      ? { leetcodeUrl: record.problem.leetcodeUrl }
      : {}),
    order: existing.length
      ? Math.max(...existing.map(({ problem }) => problem.order)) + 1
      : 0,
    answersVisible: false,
    bankProblemId: problemId,
    bankOrigin: 'bank' as const,
  };
  const reference = doc(collection(db, `${sessionPath(sessionId)}/problems`));
  const batch = writeBatch(db);
  batch.set(doc(db, problemPath(sessionId, reference.id)), sessionProblem);
  for (const language of languages)
    batch.set(
      doc(db, solutionPath(sessionId, reference.id, language)),
      record.solutions[language],
    );
  batch.update(doc(db, sessionPath(sessionId)), {
    bankProblemIds: arrayUnion(problemId),
  });
  await batch.commit();
  return { id: reference.id, problem: sessionProblem };
}
