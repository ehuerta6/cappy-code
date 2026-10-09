import 'client-only';

import {
  collection,
  deleteField,
  arrayUnion,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  runTransaction,
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
  type SolutionApproach,
} from '../domain';
import { validateLeetcodeProblemUrl } from '../problem-metadata';
import { problemApproachTags } from '../problem-bank-filters';
import { normalizeBankApproachTagSummary } from '../problem-bank-tag-summary';
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
import {
  getApproaches,
  saveApproach,
  updateApproachSolution,
} from './solutions';

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
  isTemporarilyHidden: boolean;
  approachTagSummary?: string[];
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
    const data = document.data();
    return {
      id: document.id,
      ...validateContent(data),
      isTemporarilyHidden:
        typeof data.hiddenByLiveSessionId === 'string' &&
        data.hiddenByLiveSessionId.length > 0,
      approachTagSummary: Array.isArray(data.approachTagSummary)
        ? normalizeBankApproachTagSummary([{ tags: data.approachTagSummary }])
        : undefined,
    };
  });
}

export async function listOfficerBankProblems(): Promise<BankProblemRecord[]> {
  const snapshot = await getDocsFromServer(
    collection(officerDb(), 'problemBank'),
  );
  return sorted(mapBankSnapshot(snapshot));
}

export async function listBankProblemApproachTags(
  problemIds: string[],
  officer = false,
): Promise<Record<string, string[]>> {
  const db = officer ? officerDb() : getFirestoreDb();
  const entries = await Promise.all(
    problemIds.map(async (problemId) => {
      const snapshot = await getDocsFromServer(
        collection(db, `${bankProblemPath(problemId)}/approaches`),
      );
      const approaches = snapshot.docs.map((approach) => {
        if (approach.metadata.hasPendingWrites)
          throw new Error('Approach changes are awaiting confirmation.');
        return approach.data();
      });
      return [problemId, normalizeBankApproachTagSummary(approaches)];
    }),
  );
  return Object.fromEntries(entries);
}

export async function listMemberBankProblems(): Promise<BankProblemRecord[]> {
  const db = getFirestoreDb();
  const snapshot = await getDocsFromServer(
    query(
      collection(db, 'problemBank'),
      where('hiddenByLiveSessionId', '==', null),
    ),
  );
  const records = mapBankSnapshot(snapshot);
  const legacyRecords = records.filter(
    ({ approachTagSummary }) => approachTagSummary === undefined,
  );
  if (legacyRecords.length === 0) return sorted(records);

  // Older Bank parents do not have the denormalized summary. Resolve their
  // Approach tags before returning the list, so the first render is complete.
  // The one-time backfill removes this compatibility read from normal lists.
  const legacyTags = await listBankProblemApproachTags(
    legacyRecords.map(({ id }) => id),
  );
  return sorted(
    records.map((record) =>
      record.approachTagSummary === undefined
        ? { ...record, approachTagSummary: legacyTags[record.id] ?? [] }
        : record,
    ),
  );
}

export async function getBankProblem(
  problemId: string,
  officer = false,
): Promise<{
  problem: BankProblemRecord;
  solutions: BankSolutions;
  approaches: SolutionApproach[];
} | null> {
  const db = officer ? officerDb() : getFirestoreDb();
  const parent = await getDocFromServer(doc(db, bankProblemPath(problemId)));
  if (!parent.exists()) return null;
  const parentData = parent.data();
  const problem = {
    id: parent.id,
    ...validateContent(parentData),
    isTemporarilyHidden:
      typeof parentData.hiddenByLiveSessionId === 'string' &&
      parentData.hiddenByLiveSessionId.length > 0,
    approachTagSummary: Array.isArray(parentData.approachTagSummary)
      ? normalizeBankApproachTagSummary([
          { tags: parentData.approachTagSummary },
        ])
      : undefined,
  };
  const approaches = await getApproaches(bankProblemPath(problemId));
  return {
    problem,
    // getApproaches includes the legacy primary Solution documents when no
    // Approach records exist. Reading them again here duplicated three reads
    // on every Bank detail open.
    solutions: approaches[0]?.solutions ?? {
      python: { code: '' },
      java: { code: '' },
      cpp: { code: '' },
    },
    approaches,
  };
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
    hiddenByLiveSessionId: null,
    approachTagSummary: [],
  });
  for (const language of languages)
    batch.set(doc(db, bankSolutionPath(reference.id, language)), { code: '' });
  await batch.commit();
  return {
    id: reference.id,
    ...problem,
    isTemporarilyHidden: false,
    approachTagSummary: [],
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

/** Delete a reusable Bank Problem and every Bank-owned child document. */
export async function deleteBankProblem(problemId: string): Promise<void> {
  const db = officerDb();
  const parentPath = bankProblemPath(problemId);
  const parentReference = doc(db, parentPath);
  const [parent, legacySolutions, approaches] = await Promise.all([
    getDocFromServer(parentReference),
    getDocsFromServer(collection(db, `${parentPath}/solutions`)),
    getDocsFromServer(collection(db, `${parentPath}/approaches`)),
  ]);
  if (!parent.exists()) throw new Error('This bank Problem no longer exists.');

  const approachSolutions = await Promise.all(
    approaches.docs.map(({ id }) =>
      getDocsFromServer(
        collection(db, `${parentPath}/approaches/${id}/solutions`),
      ),
    ),
  );
  const writeCount =
    1 +
    legacySolutions.docs.length +
    approaches.docs.length +
    approachSolutions.reduce(
      (count, snapshot) => count + snapshot.docs.length,
      0,
    );
  if (writeCount > 500)
    throw new Error(
      'This Problem has too much stored content to delete in one operation.',
    );

  const batch = writeBatch(db);
  for (const solution of legacySolutions.docs) batch.delete(solution.ref);
  approaches.docs.forEach((approach, index) => {
    for (const solution of approachSolutions[index].docs)
      batch.delete(solution.ref);
    batch.delete(approach.ref);
  });
  batch.delete(parentReference);
  await batch.commit();
}

export async function updateBankSolution(
  problemId: string,
  language: (typeof languages)[number],
  solution: Solution,
  approachId?: string,
): Promise<void> {
  if (!languages.includes(language))
    throw new Error('Choose Python, Java, or C++.');
  const parsed = validateSolution(solution);
  if (approachId)
    await updateApproachSolution(
      bankProblemPath(problemId),
      approachId,
      language,
      parsed,
    );
  else
    await setDoc(
      doc(officerDb(), bankSolutionPath(problemId, language)),
      parsed,
    );
}

export async function updateBankApproach(
  problemId: string,
  approach: SolutionApproach,
): Promise<void> {
  await saveApproach(bankProblemPath(problemId), approach);
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
  batch.set(doc(db, problemPath(sessionId, reference.id)), {
    ...sessionProblem,
    approachesEnabled: true,
  });
  for (const language of languages)
    batch.set(
      doc(db, solutionPath(sessionId, reference.id, language)),
      record.solutions[language],
    );
  for (const approach of record.approaches) {
    batch.set(
      doc(
        db,
        `${problemPath(sessionId, reference.id)}/approaches/${approach.id}`,
      ),
      { name: approach.name, tags: approach.tags, order: approach.order },
    );
    for (const language of languages)
      batch.set(
        doc(
          db,
          `${problemPath(sessionId, reference.id)}/approaches/${approach.id}/solutions/${language}`,
        ),
        approach.solutions[language],
      );
  }
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
  const approaches = await getApproaches(problemPath(sessionId, problemId));
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
  await runTransaction(db, async (transaction) => {
    const sessionReference = doc(db, sessionPath(sessionId));
    const sessionSnapshot = await transaction.get(sessionReference);
    if (!sessionSnapshot.exists())
      throw new Error('This Session no longer exists.');
    if (sessionSnapshot.data().status !== 'draft')
      throw new Error(
        'Only draft Sessions can be materialized into the Problem Bank.',
      );

    transaction.set(bankReference, {
      ...bankContent,
      hiddenByLiveSessionId: null,
      approachesEnabled: true,
      approachTagSummary: problemApproachTags(approaches),
    });
    for (const [language, solution] of solutionEntries)
      transaction.set(
        doc(db, bankSolutionPath(bankProblemId, language)),
        solution,
      );
    for (const approach of approaches) {
      transaction.set(
        doc(db, `${bankProblemPath(bankProblemId)}/approaches/${approach.id}`),
        { name: approach.name, tags: approach.tags, order: approach.order },
      );
      for (const language of languages)
        transaction.set(
          doc(
            db,
            `${bankProblemPath(bankProblemId)}/approaches/${approach.id}/solutions/${language}`,
          ),
          approach.solutions[language],
        );
    }
    transaction.update(problemReference, {
      bankProblemId,
      bankOrigin: 'session',
      bankCopyPending: deleteField(),
    });
    transaction.update(sessionReference, {
      bankProblemIds: arrayUnion(bankProblemId),
    });
  });
  return { bankProblemId };
}
