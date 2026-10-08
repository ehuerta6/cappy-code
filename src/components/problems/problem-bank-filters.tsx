'use client';

import { approachTags } from '@/lib/domain';
import {
  emptyProblemBankFilters,
  problemBankFilterOptions,
  type ProblemBankFilters as Filters,
} from '@/lib/problem-bank-filters';

const labels = {
  branch: { intro: 'Intro', general: 'General', icpc: 'ICPC' },
  difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
  category: {
    custom: 'Custom',
    'interview-style': 'Interview-style',
    'competitive-programming': 'Competitive Programming',
  },
} as const;
const summaryClass =
  'min-h-11 cursor-pointer rounded border border-border-strong bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const optionClass = 'flex min-h-9 items-center gap-2 px-2 text-sm';

function FilterGroup<T extends string>({
  label,
  values,
  selected,
  valueLabel,
  onToggle,
}: {
  label: string;
  values: readonly T[];
  selected: T[];
  valueLabel: (value: T) => string;
  onToggle: (value: T) => void;
}) {
  return (
    <details className="relative">
      <summary
        className={`${summaryClass} list-none [&::-webkit-details-marker]:hidden`}
      >
        <span>
          {label}
          {selected.length ? ` (${selected.length})` : ''}
        </span>{' '}
        <span aria-hidden="true">▾</span>
      </summary>
      <div className="absolute z-20 mt-1 max-h-64 min-w-56 overflow-y-auto rounded border border-border-strong bg-surface p-2 shadow-lg">
        {values.map((value) => (
          <label className={optionClass} key={value}>
            <input
              checked={selected.includes(value)}
              onChange={() => onToggle(value)}
              type="checkbox"
              value={value}
            />
            {valueLabel(value)}
          </label>
        ))}
      </div>
    </details>
  );
}

export default function ProblemBankFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (value: Filters) => void;
}) {
  const activeGroups = Object.values(value).filter(
    (values) => values.length > 0,
  ).length;
  const activeValues = Object.values(value).reduce(
    (count, values) => count + values.length,
    0,
  );
  function toggle<K extends keyof Filters>(
    group: K,
    selected: Filters[K][number],
  ) {
    const current = value[group] as string[];
    const next = current.includes(selected as string)
      ? current.filter((entry) => entry !== selected)
      : [...current, selected as string];
    onChange({ ...value, [group]: next });
  }

  return (
    <fieldset className="mb-5 rounded border border-border-soft p-3">
      <legend className="px-1 text-sm font-semibold">Filter Problems</legend>
      <div className="flex flex-wrap items-start gap-2">
        <FilterGroup
          label="CIC branch"
          values={problemBankFilterOptions.branches}
          selected={value.branch}
          valueLabel={(branch) => labels.branch[branch]}
          onToggle={(branch) => toggle('branch', branch)}
        />
        <FilterGroup
          label="Difficulty"
          values={problemBankFilterOptions.difficulties}
          selected={value.difficulty}
          valueLabel={(difficulty) => labels.difficulty[difficulty]}
          onToggle={(difficulty) => toggle('difficulty', difficulty)}
        />
        <FilterGroup
          label="Category"
          values={problemBankFilterOptions.categories}
          selected={value.category}
          valueLabel={(category) => labels.category[category]}
          onToggle={(category) => toggle('category', category)}
        />
        <FilterGroup
          label="DSA / algorithm"
          values={approachTags}
          selected={value.tag}
          valueLabel={(tag) => tag}
          onToggle={(tag) => toggle('tag', tag)}
        />
        <button
          className={`${summaryClass} ${activeGroups ? 'border-accent bg-raised font-semibold' : ''}`}
          disabled={!activeGroups}
          onClick={() => onChange(emptyProblemBankFilters)}
          type="button"
        >
          Clear all{activeGroups ? ` (${activeGroups})` : ''}
        </button>
      </div>
      <p className="mb-0 mt-2 text-sm text-muted" aria-live="polite">
        {activeValues
          ? `${activeValues} selected ${activeValues === 1 ? 'value' : 'values'} across ${activeGroups} ${activeGroups === 1 ? 'group' : 'groups'}; values within each group use OR and groups combine with AND.`
          : 'No filters active.'}
      </p>
    </fieldset>
  );
}
