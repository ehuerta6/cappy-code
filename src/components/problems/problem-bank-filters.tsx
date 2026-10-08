'use client';

import {
  emptyProblemBankFilters,
  problemBankFilterOptions,
  type ProblemBankFilters as Filters,
} from '@/lib/problem-bank-filters';
import type {
  ProblemCategory,
  ProblemDifficulty,
  SessionBranch,
} from '@/lib/domain';
import { approachTags } from '@/lib/domain';

const labels = {
  branch: { intro: 'Intro', general: 'General', icpc: 'ICPC' },
  difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
  category: {
    custom: 'Custom',
    'interview-style': 'Interview-style',
    'competitive-programming': 'Competitive Programming',
  },
} as const;
const selectClass =
  'min-h-11 rounded border border-border-strong bg-surface px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export default function ProblemBankFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (value: Filters) => void;
}) {
  const active = Object.values(value).filter(Boolean).length;
  return (
    <fieldset className="mb-5 rounded border border-border-soft p-3">
      <legend className="px-1 text-sm font-semibold">Filter Problems</legend>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          CIC branch
          <select
            className={selectClass}
            value={value.branch}
            onChange={(event) =>
              onChange({
                ...value,
                branch: event.target.value as SessionBranch | '',
              })
            }
          >
            <option value="">Any branch</option>
            {problemBankFilterOptions.branches.map((branch) => (
              <option key={branch} value={branch}>
                {labels.branch[branch]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Difficulty
          <select
            className={selectClass}
            value={value.difficulty}
            onChange={(event) =>
              onChange({
                ...value,
                difficulty: event.target.value as ProblemDifficulty | '',
              })
            }
          >
            <option value="">Any difficulty</option>
            {problemBankFilterOptions.difficulties.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {labels.difficulty[difficulty]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Category
          <select
            className={selectClass}
            value={value.category}
            onChange={(event) =>
              onChange({
                ...value,
                category: event.target.value as ProblemCategory | '',
              })
            }
          >
            <option value="">Any category</option>
            {problemBankFilterOptions.categories.map((category) => (
              <option key={category} value={category}>
                {labels.category[category]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          DSA / algorithm
          <select
            className={selectClass}
            value={value.tag}
            onChange={(event) =>
              onChange({ ...value, tag: event.target.value as Filters['tag'] })
            }
          >
            <option value="">Any tag</option>
            {approachTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`${selectClass} ${active ? 'border-accent bg-raised font-semibold' : ''}`}
          disabled={!active}
          onClick={() => onChange(emptyProblemBankFilters)}
          type="button"
        >
          Clear all{active ? ` (${active})` : ''}
        </button>
      </div>
      <p className="mb-0 mt-2 text-sm text-muted" aria-live="polite">
        {active
          ? `${active} active ${active === 1 ? 'filter' : 'filters'}; selected groups are combined with AND.`
          : 'No filters active.'}
      </p>
    </fieldset>
  );
}
