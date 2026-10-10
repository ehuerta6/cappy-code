'use client';

import Link from 'next/link';
import { problemCategories } from '@/lib/domain';
import type { BankProblemRecord } from '@/lib/firebase/problem-bank';
import type { ProblemBankFilters } from '@/lib/problem-bank-filters';
import type { DsaTag } from '@/lib/dsa-tags';
import { Button, StateMessage } from '@/components/ui/primitives';
import ProblemBankFiltersControl from './problem-bank-filters';
import {
  ProblemApproachTags,
  ProblemDifficultyBadge,
} from './problem-bank-metadata';

const categoryLabels = {
  custom: 'Custom',
  'interview-style': 'Interview-style',
  'competitive-programming': 'Competitive Programming',
} as const;

export default function ProblemBankBrowser({
  records,
  filters,
  onFiltersChange,
  tagsByProblem,
  catalog,
  catalogStatus,
  catalogError,
  onRetryCatalog,
  hrefForProblem,
  idPrefix,
  noResultsMessage = 'No Problems match these filters.',
  onClearFilters,
}: {
  records: BankProblemRecord[];
  filters: ProblemBankFilters;
  onFiltersChange: (filters: ProblemBankFilters) => void;
  tagsByProblem: Record<string, string[]>;
  catalog: DsaTag[];
  catalogStatus: 'loading' | 'ready' | 'error';
  catalogError: string | null;
  onRetryCatalog: () => void;
  hrefForProblem: (id: string) => string;
  idPrefix: string;
  noResultsMessage?: string;
  onClearFilters: () => void;
}) {
  return (
    <>
      {catalogStatus === 'loading' ? (
        <StateMessage className="mt-4">Loading DSA tag catalog…</StateMessage>
      ) : null}
      {catalogStatus === 'error' ? (
        <StateMessage className="mt-4" role="alert">
          DSA tag filters could not be loaded. Check your connection and retry.
          {catalogError ? ` ${catalogError}` : ''}{' '}
          <Button onClick={onRetryCatalog}>Retry loading tags</Button>
        </StateMessage>
      ) : null}
      <ProblemBankFiltersControl
        value={filters}
        onChange={onFiltersChange}
        tags={
          catalogStatus === 'ready' ? catalog.filter((tag) => tag.active) : []
        }
      />
      {records.length === 0 ? (
        <p className="mt-4" role="status">
          {noResultsMessage}{' '}
          <button
            className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 underline underline-offset-2"
            onClick={onClearFilters}
          >
            Clear filters
          </button>
        </p>
      ) : (
        <div className="mt-6 grid min-w-0 gap-7 md:grid-cols-3">
          {problemCategories.map((category) => {
            const categoryRecords = records.filter(
              (record) => record.category === category,
            );
            return (
              <section
                className="min-w-0"
                key={category}
                aria-labelledby={`${idPrefix}-${category}`}
              >
                <h2
                  className="mb-2 mt-0 text-lg font-semibold"
                  id={`${idPrefix}-${category}`}
                >
                  {categoryLabels[category]}
                </h2>
                {categoryRecords.length ? (
                  <ul className="m-0 list-none p-0">
                    {categoryRecords.map((record) => (
                      <li
                        className="min-w-0 border-b border-border-soft"
                        key={record.id}
                      >
                        <Link
                          className="flex min-h-12 min-w-0 items-center rounded px-3 py-2 font-semibold text-ink no-underline hover:bg-hover hover:text-accent-hover hover:underline focus-visible:relative focus-visible:z-10"
                          href={hrefForProblem(record.id)}
                        >
                          <span className="break-words">{record.title}</span>
                        </Link>
                        <div
                          className="flex min-w-0 flex-wrap items-center gap-1.5 px-3 pb-3"
                          role="group"
                          aria-label={`${record.title} classification`}
                        >
                          <ProblemDifficultyBadge
                            difficulty={record.difficulty}
                          />
                          <ProblemApproachTags
                            tags={tagsByProblem[record.id] ?? []}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 text-sm text-muted">
                    No Problems in this category.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
