import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  languageSchema,
  languages,
  problemSchema,
  sessionSchema,
  solutionSchema,
} from './domain';

const timestamp = Timestamp.fromMillis(1_000);

describe('persisted domain schemas', () => {
  it('keeps the supported Language values fixed', () => {
    expect(languages.map((language) => languageSchema.parse(language))).toEqual(
      ['python', 'java', 'cpp'],
    );
    expect(languageSchema.safeParse('javascript').success).toBe(false);
  });

  it('parses Session data and treats a missing legacy branch as Intro', () => {
    const legacySession = {
      title: ' Arrays ',
      date: '2028-02-29',
      status: 'draft',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    expect(sessionSchema.parse(legacySession)).toEqual({
      branch: 'intro',
      title: 'Arrays',
      date: '2028-02-29',
      status: 'draft',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    expect(
      sessionSchema.safeParse({
        ...legacySession,
        branch: 'advanced',
      }).success,
    ).toBe(false);
    expect(
      sessionSchema.safeParse({ ...legacySession, date: '2026-02-29' }).success,
    ).toBe(false);
  });

  it('accepts older Problem documents and validates current optional metadata', () => {
    const legacyProblem = {
      title: ' Two Sum ',
      description: 'Find a pair.',
      exampleInput: '2 7',
      exampleOutput: '9',
      order: 0,
      answersVisible: false,
    };

    expect(problemSchema.parse(legacyProblem)).toEqual({
      ...legacyProblem,
      title: 'Two Sum',
      constraints: '',
    });
    expect(
      problemSchema.parse({
        ...legacyProblem,
        constraints: '1 ≤ nums.length ≤ 10⁴',
        difficulty: 'medium',
        leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
      }),
    ).toMatchObject({
      constraints: '1 ≤ nums.length ≤ 10⁴',
      difficulty: 'medium',
      leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
    });
    expect(
      problemSchema.safeParse({ ...legacyProblem, difficulty: 'extreme' })
        .success,
    ).toBe(false);
    expect(
      problemSchema.safeParse({ ...legacyProblem, leetcodeUrl: 'not a URL' })
        .success,
    ).toBe(false);
  });

  it('accepts code-only legacy Solutions and validates optional complexity', () => {
    expect(solutionSchema.parse({ code: 'return 1;' })).toEqual({
      code: 'return 1;',
    });
    expect(
      solutionSchema.parse({
        code: 'return 1;',
        timeComplexity: 'O(1)',
        timeComplexityReason: 'One operation.',
        spaceComplexity: 'O(1)',
        spaceComplexityReason: 'Constant storage.',
        legacyOutput: 'ignored',
      }),
    ).toEqual({
      code: 'return 1;',
      timeComplexity: 'O(1)',
      timeComplexityReason: 'One operation.',
      spaceComplexity: 'O(1)',
      spaceComplexityReason: 'Constant storage.',
    });
    expect(
      solutionSchema.safeParse({ code: 'return 1;', timeComplexity: 1 })
        .success,
    ).toBe(false);
    expect(solutionSchema.safeParse({ code: 1 }).success).toBe(false);
  });
});
