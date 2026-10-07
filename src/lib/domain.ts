import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import { calendarDateSchema } from './calendar-date';
import { validateLeetcodeProblemUrl } from './problem-metadata';

export const languages = ['python', 'java', 'cpp'] as const;
export const problemDifficulties = ['easy', 'medium', 'hard'] as const;
export const problemCategories = [
  'custom',
  'interview-style',
  'competitive-programming',
] as const;
export const sessionBranches = ['intro', 'general', 'icpc'] as const;

export const languageSchema = z.enum(languages);
export const problemDifficultySchema = z.enum(problemDifficulties);
export const problemCategorySchema = z.enum(problemCategories);
export const sessionBranchSchema = z.enum(sessionBranches, {
  error: 'Choose Intro, General, or ICPC for this session.',
});
export const sessionStatusSchema = z.enum(['draft', 'live', 'ended']);

const leetcodeUrlSchema = z
  .string()
  .optional()
  .refine((value) => {
    try {
      validateLeetcodeProblemUrl(value);
      return true;
    } catch {
      return false;
    }
  }, 'Enter a valid HTTPS LeetCode Problem URL.')
  .transform((value) =>
    value === undefined ? undefined : validateLeetcodeProblemUrl(value),
  );

const solutionTextSchema = z.string().optional();

export const sessionSchema = z.object({
  branch: sessionBranchSchema
    .optional()
    .transform((branch) => branch ?? 'intro'),
  title: z.string().trim().min(1),
  date: calendarDateSchema,
  status: sessionStatusSchema,
  createdAt: z.instanceof(Timestamp),
  updatedAt: z.instanceof(Timestamp),
});

export const problemSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string(),
  exampleInput: z.string(),
  exampleOutput: z.string(),
  constraints: z.string().optional().default(''),
  order: z.number().finite(),
  answersVisible: z.boolean(),
  leetcodeUrl: leetcodeUrlSchema,
  difficulty: problemDifficultySchema.optional(),
  category: problemCategorySchema.optional().default('custom'),
  bankProblemId: z.string().optional(),
  bankOrigin: z.enum(['session', 'bank']).optional(),
});

export const solutionSchema = z
  .object({
    code: z.string(),
    timeComplexity: solutionTextSchema,
    timeComplexityReason: solutionTextSchema,
    spaceComplexity: solutionTextSchema,
    spaceComplexityReason: solutionTextSchema,
  })
  .transform((data) => {
    const solution: Solution = { code: data.code };
    for (const field of [
      'timeComplexity',
      'timeComplexityReason',
      'spaceComplexity',
      'spaceComplexityReason',
    ] as const) {
      const value = data[field];
      if (value !== undefined && value.trim().length > 0)
        solution[field] = value;
    }
    return solution;
  });

export type Language = (typeof languages)[number];
export type ProblemDifficulty = (typeof problemDifficulties)[number];
export type ProblemCategory = (typeof problemCategories)[number];
export type SessionBranch = (typeof sessionBranches)[number];
export type SessionStatus = 'draft' | 'live' | 'ended';

export function isProblemDifficulty(
  value: unknown,
): value is ProblemDifficulty {
  return problemDifficultySchema.safeParse(value).success;
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
  category?: ProblemCategory;
  bankProblemId?: string;
  bankOrigin?: 'session' | 'bank';
}

export interface Solution {
  code: string;
  timeComplexity?: string;
  timeComplexityReason?: string;
  spaceComplexity?: string;
  spaceComplexityReason?: string;
}
