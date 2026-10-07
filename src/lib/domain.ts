import type { Timestamp } from 'firebase/firestore';

export const languages = ['python', 'java', 'cpp'] as const;

export type Language = (typeof languages)[number];
export type SessionStatus = 'draft' | 'live' | 'ended';

// Document IDs live in Firestore paths, not in these persisted fields.
export interface Session {
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
  order: number;
  answersVisible: boolean;
  leetcodeUrl?: string;
}

export interface Solution {
  code: string;
  timeComplexity?: string;
  timeComplexityReason?: string;
  spaceComplexity?: string;
  spaceComplexityReason?: string;
}
