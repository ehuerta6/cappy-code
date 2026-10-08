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
  problemSchema,
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
  isPublished: boolean;
  isTemporarilyHidden: boolean;
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

function publicationIntent(data: Record<string, unknown>): boolean {
  // isPublic is the legacy field. A false legacy value is ambiguous because
  // the old live lifecycle also wrote false, so preserve it conservatively.
  return typeof data.isPublished === 'boolean'
    ? data.isPublished
    : data.isPublic === true;
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
    const data = document.data();
    return {
      id: document.id,
      ...validateContent(data),
      isPublished: publicationIntent(data),
      isTemporarilyHidden:
        typeof data.hiddenByLiveSessionId === 'string' &&
        data.hiddenByLiveSessionId.length > 0,
    };
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
  const bank = collection(db, 'problemBank');
  const [published, legacyPublic] = await Promise.all([
    getDocsFromServer(
      query(
        bank,
        where('isPublished', '==', true),
        where('hiddenByLiveSessionId', '==', null),
      ),
    ),
    getDocsFromServer(query(bank, where('isPublic', '==', true))),
  ]);
  const documents = new Map(
    [...published.docs, ...legacyPublic.docs].map((document) => [
      document.id,
      document,
    ]),
  );
  return sorted(
    mapBankSnapshot({ docs: [...documents.values()] }).filter(
      (problem) => problem.isPublished,
    ),
  );
}

export async function getBankProblem(
  problemId: string,
  officer = false,
): Promise<{ problem: BankProblemRecord; solutions: BankSolutions } | null> {
  const db = officer ? officerDb() : getFirestoreDb();
  const parent = await getDocFromServer(doc(db, bankProblemPath(problemId)));
  if (!parent.exists()) return null;
  const parentData = parent.data();
  const problem = {
    id: parent.id,
    ...validateContent(parentData),
    isPublished: publicationIntent(parentData),
    isTemporarilyHidden:
      typeof parentData.hiddenByLiveSessionId === 'string' &&
      parentData.hiddenByLiveSessionId.length > 0,
  };
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
  batch.set(reference, {
    ...problem,
    isPublished: false,
    hiddenByLiveSessionId: null,
  });
  for (const language of languages)
    batch.set(doc(db, bankSolutionPath(reference.id, language)), { code: '' });
  await batch.commit();
  return {
    id: reference.id,
    ...problem,
    isPublished: false,
    isTemporarilyHidden: false,
  };
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

export async function updateBankPublication(
  problemId: string,
  isPublished: boolean,
): Promise<void> {
  const db = officerDb();
  const reference = doc(db, bankProblemPath(problemId));
  const snapshot = await getDocFromServer(reference);
  if (!snapshot.exists())
    throw new Error('This bank Problem no longer exists.');
  await updateDoc(reference, {
    isPublished,
    isPublic: deleteField(),
  });
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

export async function materializeSessionProblemInBank(
  sessionId: string,
  problemId: string,
): Promise<{ bankProblemId: string } | null> {
  const db = officerDb();
  const problemReference = doc(db, problemPath(sessionId, problemId));
  const snapshot = await getDocFromServer(problemReference);
  if (!snapshot.exists()) throw new Error('This Problem no longer exists.');
  const stored = snapshot.data();
  if (
    stored.bankOrigin !== 'session' ||
    stored.bankCopyPending !== true ||
    typeof stored.bankProblemId !== 'string'
  )
    return null;

  const parsedProblem = problemSchema.safeParse(stored);
  if (!parsedProblem.success)
    throw new Error('The saved Problem has invalid fields.');
  if (parsedProblem.data.title === 'Untitled Problem') return null;

  const solutionEntries = await Promise.all(
    languages.map(async (language) => {
      const solutionSnapshot = await getDocFromServer(
        doc(db, solutionPath(sessionId, problemId, language)),
      );
      if (solutionSnapshot.metadata.hasPendingWrites)
        throw new Error('Solution changes are awaiting confirmation.');
      return [
        language,
        solutionSnapshot.exists()
          ? validateSolution(solutionSnapshot.data())
          : { code: '' },
      ] as const;
    }),
  );

  const bankProblemId = stored.bankProblemId;
  const bankReference = doc(db, bankProblemPath(bankProblemId));
  const problem = parsedProblem.data;
  const bankContent: BankProblemContent = {
    title: problem.title,
    description: problem.description,
    constraints: problem.constraints,
    exampleInput: problem.exampleInput,
    exampleOutput: problem.exampleOutput,
    category: problem.category,
    ...(problem.difficulty ? { difficulty: problem.difficulty } : {}),
    ...(problem.leetcodeUrl ? { leetcodeUrl: problem.leetcodeUrl } : {}),
  };
  const batch = writeBatch(db);
  batch.set(bankReference, {
    ...bankContent,
    isPublished: false,
    hiddenByLiveSessionId: null,
  });
  for (const [language, solution] of solutionEntries)
    batch.set(doc(db, bankSolutionPath(bankProblemId, language)), solution);
  batch.update(problemReference, {
    bankProblemId,
    bankOrigin: 'session',
    bankCopyPending: deleteField(),
  });
  batch.update(doc(db, sessionPath(sessionId)), {
    bankProblemIds: arrayUnion(bankProblemId),
  });
  await batch.commit();
  return { bankProblemId };
}
