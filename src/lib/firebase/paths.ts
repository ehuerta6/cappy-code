import type { Language } from '../domain';

function documentId(id: string): string {
  if (!id.trim() || id.includes('/')) {
    throw new Error('A document ID must be nonempty and contain no slashes.');
  }
  return id;
}

export function sessionPath(sessionId: string): string {
  return `sessions/${documentId(sessionId)}`;
}

export function bankProblemPath(problemId: string): string {
  return `problemBank/${documentId(problemId)}`;
}

export function bankSolutionPath(
  problemId: string,
  language: Language,
): string {
  return `${bankProblemPath(problemId)}/solutions/${language}`;
}

export function problemPath(sessionId: string, problemId: string): string {
  return `${sessionPath(sessionId)}/problems/${documentId(problemId)}`;
}

export function solutionPath(
  sessionId: string,
  problemId: string,
  language: Language,
): string {
  return `${problemPath(sessionId, problemId)}/solutions/${language}`;
}
