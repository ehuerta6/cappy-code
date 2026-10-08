import {
  approachTags,
  problemCategories,
  problemDifficulties,
  sessionBranches,
  type ProblemCategory,
  type ProblemDifficulty,
  type SessionBranch,
} from './domain';
import type { ProblemUsageSummary } from './problem-usage';

export interface FilterableBankProblem {
  id: string;
  title: string;
  category: ProblemCategory;
  difficulty?: ProblemDifficulty;
}

export interface ProblemBankFilters {
  branch: SessionBranch | '';
  difficulty: ProblemDifficulty | '';
  category: ProblemCategory | '';
  tag: (typeof approachTags)[number] | '';
}

export const emptyProblemBankFilters: ProblemBankFilters = {
  branch: '',
  difficulty: '',
  category: '',
  tag: '',
};

export const problemBankFilterOptions = {
  branches: sessionBranches,
  difficulties: problemDifficulties,
  categories: problemCategories,
  tags: approachTags,
};

export function filterProblemBank<T extends FilterableBankProblem>(
  problems: T[],
  filters: ProblemBankFilters,
  tagsByProblem: Record<string, string[]>,
  usage: Record<string, ProblemUsageSummary>,
): T[] {
  return problems.filter((problem) => {
    if (filters.difficulty && problem.difficulty !== filters.difficulty)
      return false;
    if (filters.category && problem.category !== filters.category) return false;
    if (filters.branch && !usage[problem.id]?.branches.includes(filters.branch))
      return false;
    if (filters.tag && !tagsByProblem[problem.id]?.includes(filters.tag))
      return false;
    return true;
  });
}

export function problemApproachTags(
  approaches: Array<{ tags: string[] }>,
): string[] {
  return [...new Set(approaches.flatMap(({ tags }) => tags))].sort((a, b) =>
    a.localeCompare(b),
  );
}
