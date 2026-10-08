import 'client-only';

import {
  collection,
  deleteField,
  doc,
  getDocFromServer,
  getDocsFromServer,
  updateDoc,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import {
  isProblemDifficulty,
  languages,
  problemCategorySchema,
  problemSchema,
  type Problem,
  type ProblemCategory,
  type ProblemDifficulty,
} from '../domain';
import { validateLeetcodeProblemUrl } from '../problem-metadata';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import {
  approachCollectionPath,
  approachPath,
  approachSolutionPath,
  problemPath,
  sessionPath,
  solutionPath,
} from './paths';
import { getApproaches } from './solutions';

export interface ProblemRecord {
  id: string;
  problem: Problem;
}
export type ProblemContent = Pick<
  Problem,
  'title' | 'description' | 'exampleInput' | 'exampleOutput' | 'constraints'
> & {
  leetcodeUrl: string;
  difficulty: ProblemDifficulty | '';
  category: ProblemCategory;
};

type ProblemContentInput = Omit<
  ProblemContent,
  'leetcodeUrl' | 'constraints' | 'difficulty' | 'category'
> & {
  constraints?: string;
  leetcodeUrl?: string;
  difficulty?: ProblemDifficulty | '';
  category?: ProblemCategory;
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
  const category = content.category ?? 'custom';
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
  if (!problemCategorySchema.safeParse(category).success)
    throw new Error('Select a supported Problem category.');
  return {
    title: content.title.trim(),
    description: content.description,
    exampleInput: content.exampleInput,
    exampleOutput: content.exampleOutput,
    constraints,
    leetcodeUrl: validateLeetcodeProblemUrl(content.leetcodeUrl) ?? '',
    difficulty,
    category,
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
    const parsed = problemSchema.safeParse(document.data());
    if (!parsed.success) {
      const leetcodeIssue = parsed.error.issues.find(
        (issue) => issue.path[0] === 'leetcodeUrl',
      );
      if (leetcodeIssue) throw new Error(leetcodeIssue.message);
      throw new Error('A stored problem has invalid fields.');
    }
    return { id: document.id, problem: parsed.data };
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
    category: 'custom',
  };
  const sessionReference = doc(
    collection(db, `${sessionPath(sessionId)}/problems`),
  );
  const bankReference = doc(collection(db, 'problemBank'));
  const problemWithBank: Problem = {
    ...problem,
    bankProblemId: bankReference.id,
    bankOrigin: 'session',
    bankCopyPending: true,
  };
  const batch = writeBatch(db);
  batch.set(sessionReference, problemWithBank);
  await batch.commit();
  return { id: sessionReference.id, problem: problemWithBank };
}

export async function duplicateProblem(
  sessionId: string,
  problemId: string,
): Promise<ProblemRecord> {
  const db = officerDb();
  const sessionReference = doc(db, sessionPath(sessionId));
  const sessionSnapshot = await getDocFromServer(sessionReference);
  if (!sessionSnapshot.exists())
    throw new Error('This Session no longer exists.');
  if (sessionSnapshot.metadata.hasPendingWrites)
    throw new Error('Session changes are awaiting confirmation.');
  if (sessionSnapshot.data().status !== 'draft')
    throw new Error('Problems can only be duplicated in a draft Session.');

  const records = await listProblems(sessionId);
  const sourceIndex = records.findIndex((record) => record.id === problemId);
  if (sourceIndex < 0) throw new Error('This Problem no longer exists.');
  const source = records[sourceIndex];
  const approaches = await getApproaches(problemPath(sessionId, problemId));
  const problemReference = doc(
    collection(db, `${sessionPath(sessionId)}/problems`),
  );
  const bankProblemIds: string[] = Array.isArray(
    sessionSnapshot.data().bankProblemIds,
  )
    ? sessionSnapshot
        .data()
        .bankProblemIds.filter(
          (id: unknown): id is string => typeof id === 'string',
        )
    : [];
  const copiedProblem: Problem = {
    ...source.problem,
    title: `${source.problem.title} Copy`,
    order: sourceIndex + 1,
    answersVisible: false,
  };
  for (const field of [
    'leetcodeUrl',
    'difficulty',
    'bankProblemId',
    'bankOrigin',
    'bankCopyPending',
  ] as const) {
    if (copiedProblem[field] === undefined) delete copiedProblem[field];
  }
  if (copiedProblem.bankCopyPending === true) {
    delete copiedProblem.bankCopyPending;
    delete copiedProblem.bankProblemId;
    delete copiedProblem.bankOrigin;
  }
  const writeCount = records.length + 2 + approaches.length * 4;
  if (writeCount > 500)
    throw new Error(
      'This Problem is too large to duplicate in one Firestore batch.',
    );

  const ordered = [...records];
  ordered.splice(sourceIndex + 1, 0, {
    id: problemReference.id,
    problem: copiedProblem,
  });
  const batch = writeBatch(db);
  for (const [order, record] of ordered.entries()) {
    if (record.id === problemReference.id) continue;
    batch.update(doc(db, problemPath(sessionId, record.id)), { order });
  }
  batch.set(doc(db, problemPath(sessionId, problemReference.id)), {
    ...copiedProblem,
    approachesEnabled: true,
  });
  for (const [order, approach] of approaches.entries()) {
    const approachReference = doc(
      collection(
        db,
        approachCollectionPath(problemPath(sessionId, problemReference.id)),
      ),
    );
    batch.set(approachReference, {
      name: approach.name,
      tags: approach.tags,
      order,
    });
    for (const language of languages) {
      batch.set(
        doc(
          db,
          approachSolutionPath(
            problemPath(sessionId, problemReference.id),
            approachReference.id,
            language,
          ),
        ),
        approach.solutions[language],
      );
    }
  }
  if (
    copiedProblem.bankProblemId &&
    !bankProblemIds.includes(copiedProblem.bankProblemId)
  ) {
    batch.update(sessionReference, {
      bankProblemIds: [...bankProblemIds, copiedProblem.bankProblemId],
    });
  }
  await batch.commit();
  return { id: problemReference.id, problem: copiedProblem };
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
  if (content.category !== undefined) {
    if (!problemCategorySchema.safeParse(content.category).success)
      throw new Error('Select a supported Problem category.');
    updates.category = content.category;
  }
  if (Object.keys(updates).length === 0)
    throw new Error('Select Problem content to save.');
  const db = officerDb();
  const reference = doc(db, problemPath(sessionId, problemId));
  const snapshot = await getDocFromServer(reference);
  if (!snapshot.exists()) throw new Error('This Problem no longer exists.');
  problemSchema.parse(snapshot.data());
  await updateDoc(reference, updates);
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
  approachIds: string[],
): void {
  for (const approachId of approachIds) {
    for (const language of languages)
      batch.delete(
        doc(
          db,
          approachSolutionPath(
            problemPath(sessionId, problemId),
            approachId,
            language,
          ),
        ),
      );
    batch.delete(
      doc(db, approachPath(problemPath(sessionId, problemId), approachId)),
    );
  }
  for (const language of languages)
    batch.delete(doc(db, solutionPath(sessionId, problemId, language)));
  batch.delete(doc(db, problemPath(sessionId, problemId)));
}

export async function deleteProblem(
  sessionId: string,
  problemId: string,
): Promise<void> {
  const db = officerDb();
  const sessionProblems = await listProblems(sessionId);
  const bankProblemIds = [
    ...new Set(
      sessionProblems
        .filter((record) => record.id !== problemId)
        .filter((record) => record.problem.bankCopyPending !== true)
        .map((record) => record.problem.bankProblemId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const approaches = await getDocsFromServer(
    collection(db, approachCollectionPath(problemPath(sessionId, problemId))),
  );
  const writes = 4 + approaches.docs.length * 4 + 1;
  if (writes > 500)
    throw new Error('Too many approaches to delete this Problem in one batch.');
  const batch = writeBatch(db);
  appendProblemDeletion(
    batch,
    db,
    sessionId,
    problemId,
    approaches.docs.map(({ id }) => id),
  );
  batch.update(doc(db, sessionPath(sessionId)), { bankProblemIds });
  await batch.commit();
}
