import 'client-only';

import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import {
  languages,
  solutionSchema,
  type Language,
  type Solution,
} from '../domain';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import { problemPath, solutionPath } from './paths';

export type ProblemSolutions = Record<Language, Solution>;

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
  const saved = validateSolution(solution);
  const problem = await getDocFromServer(
    doc(db, problemPath(sessionId, problemId)),
  );
  if (!problem.exists()) throw new Error('This Problem no longer exists.');
  await setDoc(doc(db, solutionPath(sessionId, problemId, language)), saved);
}
