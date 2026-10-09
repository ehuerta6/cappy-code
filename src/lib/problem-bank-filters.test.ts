import { describe, expect, it } from 'vitest';
import { deriveProblemUsage } from './problem-usage';
import {
  emptyProblemBankFilters,
  filterProblemBank,
  problemApproachTags,
  type FilterableBankProblem,
} from './problem-bank-filters';

const problems: Array<
  FilterableBankProblem & {
    category: 'custom' | 'interview-style' | 'competitive-programming';
  }
> = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'easy',
    category: 'interview-style',
  },
  {
    id: 'shortest',
    title: 'Shortest Path',
    difficulty: 'medium',
    category: 'competitive-programming',
  },
  {
    id: 'draft-only',
    title: 'Draft Only',
    difficulty: 'hard',
    category: 'custom',
  },
  { id: 'legacy', title: 'Legacy primary', category: 'custom' },
];
const tags = {
  'two-sum': problemApproachTags([
    { tags: ['Arrays', 'Hash Map'] },
    { tags: ['Arrays', 'Two Pointers'] },
  ]),
  shortest: ['Graph', 'Shortest Path'],
  'draft-only': ['Dynamic Programming'],
  legacy: [],
};
const allBranches = Object.fromEntries(
  problems.map(({ id }) => [
    id,
    { count: 0, lastUsed: null, branches: [], history: [] },
  ]),
) as Record<string, ReturnType<typeof deriveProblemUsage>>;
allBranches['two-sum'] = {
  ...allBranches['two-sum'],
  branches: ['intro', 'general'],
};
allBranches.shortest = { ...allBranches.shortest, branches: ['icpc'] };

describe('Problem Bank filters', () => {
  it('trims and case-folds partial Problem name searches while composing with other filters', () => {
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, name: '  TWO su ' },
        tags,
        allBranches,
      ).map(({ id }) => id),
    ).toEqual(['two-sum']);
    expect(
      filterProblemBank(
        problems,
        {
          ...emptyProblemBankFilters,
          name: 'sum',
          difficulty: ['hard'],
          category: ['interview-style'],
          branch: ['general'],
          tag: ['Arrays'],
        },
        tags,
        allBranches,
      ),
    ).toEqual([]);
  });
  it('matches each difficulty and each category value', () => {
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, difficulty: ['easy'] },
        tags,
        allBranches,
      ).map(({ id }) => id),
    ).toEqual(['two-sum']);
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, difficulty: ['medium'] },
        tags,
        allBranches,
      ).map(({ id }) => id),
    ).toEqual(['shortest']);
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, difficulty: ['hard'] },
        tags,
        allBranches,
      ).map(({ id }) => id),
    ).toEqual(['draft-only']);
    for (const category of [
      'custom',
      'interview-style',
      'competitive-programming',
    ] as const)
      expect(
        filterProblemBank(
          problems,
          { ...emptyProblemBankFilters, category: [category] },
          tags,
          allBranches,
        ).every((p) => p.category === category),
      ).toBe(true);
  });

  it('uses OR for multiple values in difficulty and category groups', () => {
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, difficulty: ['easy', 'medium'] },
        tags,
        allBranches,
      ).map(({ id }) => id),
    ).toEqual(['two-sum', 'shortest']);
    expect(
      filterProblemBank(
        problems,
        {
          ...emptyProblemBankFilters,
          category: ['custom', 'interview-style'],
        },
        tags,
        allBranches,
      ).map(({ id }) => id),
    ).toEqual(['two-sum', 'draft-only', 'legacy']);
  });

  it('matches branch usage including multi-branch Problems', () => {
    for (const [branch, expected] of [
      ['intro', 'two-sum'],
      ['general', 'two-sum'],
      ['icpc', 'shortest'],
    ] as const)
      expect(
        filterProblemBank(
          problems,
          { ...emptyProblemBankFilters, branch: [branch] },
          tags,
          allBranches,
        ).map(({ id }) => id),
      ).toContain(expected);
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, branch: ['general'] },
        tags,
        allBranches,
      ),
    ).toHaveLength(1);
  });

  it('matches tags from any Approach, excludes unrelated tags, and leaves zero or legacy approaches usable', () => {
    for (const tag of ['Arrays', 'Hash Map', 'Two Pointers'] as const)
      expect(
        filterProblemBank(
          problems,
          { ...emptyProblemBankFilters, tag: [tag] },
          tags,
          allBranches,
        ).map(({ id }) => id),
      ).toContain('two-sum');
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, tag: ['Dynamic Programming'] },
        tags,
        allBranches,
      ).map(({ id }) => id),
    ).toEqual(['draft-only']);
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, tag: ['Queue'] },
        tags,
        allBranches,
      ),
    ).toEqual([]);
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, difficulty: ['medium'] },
        tags,
        allBranches,
      ).map(({ id }) => id),
    ).toEqual(['shortest']);
  });

  it('aggregates tags from first and later Approaches without duplicates', () => {
    expect(
      problemApproachTags([
        { tags: ['Arrays', 'Hash Map'] },
        { tags: ['Arrays', 'Two Pointers'] },
      ]),
    ).toEqual(['Arrays', 'Hash Map', 'Two Pointers']);
  });

  it('uses OR for multiple values in branch and tag groups', () => {
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, branch: ['general', 'icpc'] },
        tags,
        allBranches,
      ).map(({ id }) => id),
    ).toEqual(['two-sum', 'shortest']);
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, tag: ['Hash Map', 'Two Pointers'] },
        tags,
        allBranches,
      ).map(({ id }) => id),
    ).toEqual(['two-sum']);
  });

  it('ANDs filter groups and Clear All restores every Problem', () => {
    expect(
      filterProblemBank(
        problems,
        {
          ...emptyProblemBankFilters,
          branch: ['general'],
          difficulty: ['easy'],
          tag: ['Two Pointers'],
        },
        tags,
        allBranches,
      ).map(({ id }) => id),
    ).toEqual(['two-sum']);
    expect(
      filterProblemBank(
        problems,
        {
          ...emptyProblemBankFilters,
          category: ['interview-style'],
          tag: ['Shortest Path'],
        },
        tags,
        allBranches,
      ),
    ).toEqual([]);
    expect(
      filterProblemBank(problems, emptyProblemBankFilters, tags, allBranches),
    ).toHaveLength(4);
  });

  it('excludes draft-only branch history for members while authorized officer history can include it', () => {
    const sessions = [
      {
        sessionId: 'draft-general',
        title: 'Draft',
        branch: 'general' as const,
        date: '2026-10-01',
        status: 'draft' as const,
        bankProblemIds: ['draft-only'],
      },
    ];
    const memberUsage = deriveProblemUsage(
      'draft-only',
      sessions,
      '2026-10-08',
      'member',
    );
    const officerUsage = deriveProblemUsage(
      'draft-only',
      sessions,
      '2026-10-08',
      'officer',
    );
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, branch: ['general'] },
        tags,
        { ...allBranches, 'draft-only': memberUsage },
      ).map(({ id }) => id),
    ).not.toContain('draft-only');
    expect(
      filterProblemBank(
        problems,
        { ...emptyProblemBankFilters, branch: ['general'] },
        tags,
        { ...allBranches, 'draft-only': officerUsage },
      ).map(({ id }) => id),
    ).toContain('draft-only');
  });
});
