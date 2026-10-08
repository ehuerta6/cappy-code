import 'client-only';

import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  languages,
  solutionSchema,
  solutionApproachSchema,
  type Language,
  type Solution,
  type SolutionApproach,
} from '../domain';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import {
  approachCollectionPath,
  approachPath,
  approachSolutionPath,
  problemPath,
  solutionPath,
} from './paths';

export type ProblemSolutions = Record<Language, Solution>;

const emptySolutions = (): ProblemSolutions => ({
  python: { code: '' },
  java: { code: '' },
  cpp: { code: '' },
});

export async function getApproaches(
  parentPath: string,
): Promise<SolutionApproach[]> {
  const db = getFirestoreDb();
  const snapshot = await getDocsFromServer(
    collection(db, approachCollectionPath(parentPath)),
  );
  const approaches = await Promise.all(
    snapshot.docs.map(async (entry) => {
      const data = entry.data();
      const solutions = await Promise.all(
        languages.map(async (language) => {
          const solution = await getDocFromServer(
            doc(db, approachSolutionPath(parentPath, entry.id, language)),
          );
          return [
            language,
            solution.exists()
              ? validateSolution(solution.data())
              : { code: '' },
          ] as const;
        }),
      );
      return {
        id: entry.id,
        name: typeof data.name === 'string' ? data.name : 'Approach',
        tags: Array.isArray(data.tags)
          ? data.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        order: typeof data.order === 'number' ? data.order : 0,
        solutions: Object.fromEntries(solutions) as ProblemSolutions,
      };
    }),
  );
  if (approaches.length)
    return approaches.sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    );
  const parent = await getDocFromServer(doc(db, parentPath));
  if (parent.data()?.approachesEnabled === true) return [];
  const legacy = await Promise.all(
    languages.map(async (language) => {
      const solution = await getDocFromServer(
        doc(db, `${parentPath}/solutions/${language}`),
      );
      return [
        language,
        solution.exists() ? validateSolution(solution.data()) : { code: '' },
      ] as const;
    }),
  );
  return [
    {
      id: 'primary',
      name: 'Primary Approach',
      tags: [],
      order: 0,
      solutions: Object.fromEntries(legacy) as ProblemSolutions,
    },
  ];
}

export async function saveApproach(
  parentPath: string,
  approach: SolutionApproach,
): Promise<void> {
  const db = getFirestoreDb();
  const parsed = solutionApproachSchema.safeParse(approach);
  if (!parsed.success)
    throw new Error('Approach name, tags, or order is invalid.');
  const existing = await getDocFromServer(
    doc(db, approachPath(parentPath, approach.id)),
  );
  const batch = writeBatch(db);
  if (!existing.exists()) {
    const legacy = await Promise.all(
      languages.map(async (language) => {
        const value = await getDocFromServer(
          doc(db, `${parentPath}/solutions/${language}`),
        );
        return [
          language,
          value.exists()
            ? validateSolution(value.data())
            : approach.solutions[language],
        ] as const;
      }),
    );
    if (approach.id === 'primary')
      for (const [language, solution] of legacy)
        batch.set(
          doc(db, approachSolutionPath(parentPath, approach.id, language)),
          solution,
        );
  }
  batch.set(doc(db, approachPath(parentPath, approach.id)), {
    name: parsed.data.name,
    tags: parsed.data.tags,
    order: parsed.data.order,
  });
  batch.update(doc(db, parentPath), { approachesEnabled: true });
  await batch.commit();
}

export async function deleteApproach(
  parentPath: string,
  approachId: string,
): Promise<void> {
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  for (const language of languages)
    batch.delete(
      doc(db, approachSolutionPath(parentPath, approachId, language)),
    );
  if (approachId === 'primary')
    for (const language of languages)
      batch.delete(doc(db, `${parentPath}/solutions/${language}`));
  batch.delete(doc(db, approachPath(parentPath, approachId)));
  batch.update(doc(db, parentPath), { approachesEnabled: true });
  await batch.commit();
}

export async function createApproach(
  parentPath: string,
): Promise<SolutionApproach> {
  const db = getFirestoreDb();
  const current = await getApproaches(parentPath);
  if (
    current.some(({ id }) => id === 'primary') &&
    !(
      await getDocFromServer(doc(db, approachPath(parentPath, 'primary')))
    ).exists()
  )
    await saveApproach(parentPath, current[0]);
  const reference = doc(collection(db, approachCollectionPath(parentPath)));
  const approach: SolutionApproach = {
    id: reference.id,
    name: 'New Approach',
    tags: [],
    order: current.length,
    solutions: emptySolutions(),
  };
  const batch = writeBatch(db);
  batch.set(reference, {
    name: approach.name,
    tags: approach.tags,
    order: approach.order,
  });
  batch.update(doc(db, parentPath), { approachesEnabled: true });
  await batch.commit();
  return approach;
}

export async function updateApproachSolution(
  parentPath: string,
  approachId: string,
  language: Language,
  solution: Solution,
): Promise<void> {
  const db = getFirestoreDb();
  const approachSnapshot = await getDocFromServer(
    doc(db, approachPath(parentPath, approachId)),
  );
  if (approachId === 'primary' && !approachSnapshot.exists()) {
    const parsed = validateSolution(solution);
    await setDoc(doc(db, `${parentPath}/solutions/${language}`), parsed);
    return;
  }
  if (!approachSnapshot.exists())
    throw new Error('This Approach no longer exists.');
  await setDoc(
    doc(db, approachSolutionPath(parentPath, approachId, language)),
    validateSolution(solution),
  );
}

export async function reorderApproaches(
  parentPath: string,
  ordered: SolutionApproach[],
): Promise<void> {
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  ordered.forEach((approach, order) =>
    batch.update(doc(db, approachPath(parentPath, approach.id)), {
      name: approach.name,
      tags: approach.tags,
      order,
    }),
  );
  await batch.commit();
}

function officerDb() {
  const user = getOfficerAuth().currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('Sign in to Officer Mode to manage solutions.');
  }
  return getFirestoreDb();
}

function validateSolution(value: unknown): Solution {
  const parsed = solutionSchema.safeParse(value);
  if (!parsed.success && parsed.error.issues[0]?.path[0] === 'code') {
    throw new Error('A solution must contain source code text.');
  }
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (
      field === 'timeComplexity' ||
      field === 'timeComplexityReason' ||
      field === 'spaceComplexity' ||
      field === 'spaceComplexityReason'
    ) {
      throw new Error(`A solution ${field} must be text.`);
    }
    throw new Error('A solution must contain source code text.');
  }
  return parsed.data;
}

export async function getSolutionsForProblem(
  sessionId: string,
  problemId: string,
): Promise<ProblemSolutions> {
  officerDb();
  const db = getFirestoreDb();
  const records = await Promise.all(
    languages.map(async (language) => {
      const snapshot = await getDocFromServer(
        doc(db, `${problemPath(sessionId, problemId)}/solutions/${language}`),
      );
      if (snapshot.metadata.hasPendingWrites)
        throw new Error('Solution changes are awaiting confirmation.');
      return [
        language,
        snapshot.exists() ? validateSolution(snapshot.data()) : { code: '' },
      ] as const;
    }),
  );
  return Object.fromEntries(records) as ProblemSolutions;
}

// Missing documents stay absent until their first edit is confirmed by Firestore.
export async function updateSolution(
  sessionId: string,
  problemId: string,
  language: Language,
  solution: Solution,
  approachId?: string,
): Promise<void> {
  const db = officerDb();
  if (!languages.includes(language))
    throw new Error('Choose Python, Java, or C++.');
  const saved = validateSolution(solution);
  const problem = await getDocFromServer(
    doc(db, problemPath(sessionId, problemId)),
  );
  if (!problem.exists()) throw new Error('This Problem no longer exists.');
  if (approachId)
    await updateApproachSolution(
      problemPath(sessionId, problemId),
      approachId,
      language,
      saved,
    );
  else
    await setDoc(doc(db, solutionPath(sessionId, problemId, language)), saved);
}
