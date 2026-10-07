import 'client-only';

import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { languages, type Language, type Solution } from '../domain';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import { solutionPath } from './paths';

export type ProblemSolutions = Record<Language, Solution>;

function officerDb() {
  const user = getOfficerAuth().currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('Sign in to Officer Mode to manage solutions.');
  }
  return getFirestoreDb();
}

function validateSolution(value: unknown): Solution {
  if (
    !value ||
    typeof value !== 'object' ||
    !('code' in value) ||
    typeof value.code !== 'string'
  ) {
    throw new Error('A solution must contain source code text.');
  }
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
      throw new Error(`A solution ${field} must be text.`);
    if (typeof text === 'string' && text.trim().length > 0)
      solution[field] = text;
  }
  return solution;
}

export async function getSolutionsForProblem(
  sessionId: string,
  problemId: string,
): Promise<ProblemSolutions> {
  const db = officerDb();
  const records = await Promise.all(
    languages.map(async (language) => {
      const snapshot = await getDocFromServer(
        doc(db, solutionPath(sessionId, problemId, language)),
      );
      if (snapshot.metadata.hasPendingWrites)
        throw new Error('Solution changes are awaiting confirmation.');
      return {
        language,
        solution: snapshot.exists()
          ? validateSolution(snapshot.data())
          : { code: '' },
      };
    }),
  );
  return {
    python: records[0].solution,
    java: records[1].solution,
    cpp: records[2].solution,
  };
}

// Missing documents stay absent until their first edit is confirmed by Firestore.
export async function updateSolution(
  sessionId: string,
  problemId: string,
  language: Language,
  solution: Solution,
): Promise<void> {
  const db = officerDb();
  if (!languages.includes(language))
    throw new Error('Choose Python, Java, or C++.');
  await setDoc(
    doc(db, solutionPath(sessionId, problemId, language)),
    validateSolution(solution),
  );
}
