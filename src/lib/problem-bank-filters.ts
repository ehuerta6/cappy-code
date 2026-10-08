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
  branch: SessionBranch[];
  difficulty: ProblemDifficulty[];
  category: ProblemCategory[];
  tag: Array<(typeof approachTags)[number]>;
}

export const emptyProblemBankFilters: ProblemBankFilters = {
  branch: [],
  difficulty: [],
  category: [],
  tag: [],
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
    if (
      filters.difficulty.length > 0 &&
      (!problem.difficulty || !filters.difficulty.includes(problem.difficulty))
    )
      return false;
    if (
      filters.category.length > 0 &&
      !filters.category.includes(problem.category)
    )
      return false;
    if (
      filters.branch.length > 0 &&
      !usage[problem.id]?.branches.some((branch) =>
        filters.branch.includes(branch),
      )
    )
      return false;
    if (
      filters.tag.length > 0 &&
      !tagsByProblem[problem.id]?.some((tag) =>
        filters.tag.includes(tag as (typeof approachTags)[number]),
      )
    )
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
