'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { approachTags } from '@/lib/domain';
import { Button } from '@/components/ui/primitives';
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
const optionClass =
  'flex min-h-11 cursor-pointer items-center gap-3 px-2 text-sm';

type FilterKey = 'branch' | 'difficulty' | 'category' | 'tag';

export default function ProblemBankFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (value: Filters) => void;
}) {
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState<
    { left: number; top: number } | undefined
  >();
  const panelId = useId();
  const activeGroups = (
    ['branch', 'difficulty', 'category', 'tag'] as const
  ).filter((group) => value[group].length > 0).length;
  const activeValues = activeGroups + (value.name.trim() ? 1 : 0);

  useLayoutEffect(() => {
    if (!openFilter) return;
    const positionPanel = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const triggerRect = trigger.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const margin = 8;
      const maxLeft = Math.max(
        margin,
        window.innerWidth - panelRect.width - margin,
      );
      const maxTop = Math.max(
        margin,
        window.innerHeight - panelRect.height - margin,
      );
      setPanelPosition({
        left: Math.min(Math.max(triggerRect.left, margin), maxLeft),
        top: Math.min(triggerRect.bottom + 4, maxTop),
      });
    };
    positionPanel();
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
    };
  }, [openFilter]);

  useEffect(() => {
    if (!openFilter) return;
    function dismissOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenFilter(null);
    }
    function dismissFocus(event: FocusEvent) {
      const target = event.target as Node;
      const panel = document.getElementById(`${panelId}-${openFilter}`);
      const trigger = rootRef.current?.querySelector('[aria-expanded="true"]');
      if (!panel?.contains(target) && !trigger?.contains(target))
        setOpenFilter(null);
    }
    function dismissEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpenFilter(null);
      triggerRef.current?.focus();
    }
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissFocus);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissFocus);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [openFilter, panelId]);

  function toggle<K extends FilterKey>(group: K, selected: Filters[K][number]) {
    const current = value[group] as string[];
    const next = current.includes(selected as string)
      ? current.filter((entry) => entry !== selected)
      : [...current, selected as string];
    onChange({ ...value, [group]: next });
  }

  function filterGroup<T extends string>(
    key: FilterKey,
    label: string,
    options: readonly T[],
    selected: T[],
    valueLabel: (option: T) => string,
  ) {
    const isOpen = openFilter === key;
    const id = `${panelId}-${key}`;
    return (
      <div className="relative">
        <Button
          variant="secondary"
          aria-controls={id}
          aria-expanded={isOpen}
          onFocus={() => {
            if (openFilter && openFilter !== key) setOpenFilter(null);
          }}
          className={`justify-between gap-2 text-sm ${selected.length ? 'border-accent bg-raised' : ''}`}
          onClick={(event) => {
            triggerRef.current = event.currentTarget;
            setOpenFilter(isOpen ? null : key);
          }}
          type="button"
        >
          {label}
          {selected.length ? ` (${selected.length})` : ''}
          <span aria-hidden="true">▾</span>
        </Button>
        {isOpen ? (
          <div
            className="fixed z-30 max-h-[min(24rem,70dvh)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded border border-border-strong bg-surface p-2 text-ink shadow-lg"
            id={id}
            role="group"
            aria-label={`${label} options`}
            ref={panelRef}
            style={{
              left: panelPosition?.left ?? 8,
              top: panelPosition?.top ?? 8,
              visibility: panelPosition ? 'visible' : 'hidden',
            }}
          >
            {options.map((option) => (
              <label className={optionClass} key={option}>
                <input
                  checked={selected.includes(option)}
                  className="size-4 accent-accent"
                  onChange={() =>
                    toggle(key, option as Filters[typeof key][number])
                  }
                  type="checkbox"
                  value={option}
                />
                {valueLabel(option)}
              </label>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-2"
      ref={rootRef}
      aria-label="Problem Bank search and filters"
      role="group"
    >
      <label className="relative min-w-44 flex-1 basis-52 sm:max-w-sm">
        <span className="sr-only">Search Problems</span>
        <input
          className="ui-field pr-9 text-sm placeholder:text-muted"
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          placeholder="Search Problems"
          type="search"
          value={value.name}
        />
      </label>
      {filterGroup(
        'branch',
        'CIC branch',
        problemBankFilterOptions.branches,
        value.branch,
        (branch) => labels.branch[branch],
      )}
      {filterGroup(
        'difficulty',
        'Difficulty',
        problemBankFilterOptions.difficulties,
        value.difficulty,
        (difficulty) => labels.difficulty[difficulty],
      )}
      {filterGroup(
        'category',
        'Category',
        problemBankFilterOptions.categories,
        value.category,
        (category) => labels.category[category],
      )}
      {filterGroup(
        'tag',
        'DSA / algorithm',
        approachTags,
        value.tag,
        (tag) => tag,
      )}
      <Button
        variant="secondary"
        className={`text-sm ${activeValues ? 'border-accent bg-raised font-semibold' : ''}`}
        disabled={!activeValues}
        onClick={() => {
          setOpenFilter(null);
          onChange(emptyProblemBankFilters);
        }}
        type="button"
      >
        Clear all{activeValues ? ` (${activeValues})` : ''}
      </Button>
      {activeValues > 0 ? (
        <span className="sr-only" aria-live="polite">
          Search and filters active.
        </span>
      ) : null}
    </div>
  );
}
