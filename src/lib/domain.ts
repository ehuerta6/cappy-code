import type { Timestamp } from 'firebase/firestore';

export const languages = ['python', 'java', 'cpp'] as const;
export const problemDifficulties = ['easy', 'medium', 'hard'] as const;
export const sessionBranches = ['intro', 'general', 'icpc'] as const;

export type Language = (typeof languages)[number];
export type ProblemDifficulty = (typeof problemDifficulties)[number];
export type SessionBranch = (typeof sessionBranches)[number];
export type SessionStatus = 'draft' | 'live' | 'ended';

export function isProblemDifficulty(
  value: unknown,
): value is ProblemDifficulty {
  return problemDifficulties.some((difficulty) => difficulty === value);
}

export const sessionBranchLabels: Record<SessionBranch, string> = {
  intro: 'Intro',
  general: 'General',
  icpc: 'ICPC',
};

// Document IDs live in Firestore paths, not in these persisted fields.
export interface Session {
  branch: SessionBranch;
  title: string;
  // Calendar date in YYYY-MM-DD format, independent of a time zone.
  date: string;
  status: SessionStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Problem {
  title: string;
  description: string;
  exampleInput: string;
  exampleOutput: string;
  constraints: string;
  order: number;
  answersVisible: boolean;
  leetcodeUrl?: string;
  difficulty?: ProblemDifficulty;
}

export interface Solution {
  code: string;
  timeComplexity?: string;
  timeComplexityReason?: string;
  spaceComplexity?: string;
  spaceComplexityReason?: string;
}
