'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/app-header';
import ProblemMarkdown from '@/components/member/problem-markdown';
import SolutionWorkspace from '@/components/solutions/solution-workspace';
import {
  ProblemApproachTags,
  ProblemDifficultyBadge,
} from '@/components/problems/problem-bank-metadata';
import { problemCategories } from '@/lib/domain';
import type { SolutionApproach } from '@/lib/domain';
import {
  getBankProblem,
  listBankProblemApproachTags,
  listMemberBankProblems,
  type BankProblemRecord,
  type BankSolutions,
} from '@/lib/firebase/problem-bank';
import { listProblemUsageSummaries } from '@/lib/firebase/problem-usage';
import type { ProblemUsageSummary } from '@/lib/problem-usage';
import { problemApproachTags } from '@/lib/problem-bank-filters';
import ProblemBankFilters from '@/components/problems/problem-bank-filters';
import {
  emptyProblemBankFilters,
  filterProblemBank,
  type ProblemBankFilters as Filters,
} from '@/lib/problem-bank-filters';

const labels = {
  custom: 'Custom',
  'interview-style': 'Interview-style',
  'competitive-programming': 'Competitive Programming',
} as const;

export function MemberProblemBank() {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; records: BankProblemRecord[] }
  >({ status: 'loading' });
  const [retry, setRetry] = useState(0);
  const [usage, setUsage] = useState<Record<string, ProblemUsageSummary>>({});
  const [tagsByProblem, setTagsByProblem] = useState<Record<string, string[]>>(
    {},
  );
  const [filters, setFilters] = useState<Filters>(emptyProblemBankFilters);
  const filteredRecords =
    state.status === 'ready'
      ? filterProblemBank(state.records, filters, tagsByProblem, usage)
      : [];
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    setUsage({});
    setTagsByProblem({});
    setFilters(emptyProblemBankFilters);
    listMemberBankProblems().then(
      (records) => {
        if (!active) return;
        setState({ status: 'ready', records });
        if (records.length === 0) {
          setUsage({});
          setTagsByProblem({});
          return;
        }
        listBankProblemApproachTags(records.map(({ id }) => id)).then(
          (tags) => {
            if (active) setTagsByProblem(tags);
          },
          () => {
            if (active) setState({ status: 'error' });
          },
        );
        listProblemUsageSummaries(records.map(({ id }) => id)).then(
          (summaries) => {
            if (active) setUsage(summaries);
          },
          () => {
            if (active) setUsage({});
          },
        );
      },
      () => {
        if (active) setState({ status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <AppHeader>
        <nav aria-label="Member navigation">
          <Link href="/">Sessions</Link>
        </nav>
      </AppHeader>
      <section
        className="mx-auto w-[calc(100%-32px)] max-w-[1440px] py-5 sm:w-[calc(100%-48px)]"
        aria-labelledby="member-bank-heading"
      >
        <h1
          className="m-0 text-[28px] font-semibold leading-9 tracking-tight"
          id="member-bank-heading"
        >
          Problem Bank
        </h1>
        <p className="mb-5 mt-1 text-muted">
          Browse prepared CIC Problems and compare all three Solutions.
        </p>
        {state.status === 'loading' ? (
          <p role="status">Loading Problem Bank…</p>
        ) : state.status === 'error' ? (
          <div role="alert">
            <p>Problem Bank could not be loaded.</p>
            <button
              className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        ) : state.records.length === 0 ? (
          <p>No public Problems are available right now.</p>
        ) : (
          <div className="grid gap-7 md:grid-cols-3">
            <div className="md:col-span-3">
              <ProblemBankFilters value={filters} onChange={setFilters} />
              {filteredRecords.length === 0 && (
                <p role="status">
                  No Problems match these filters.{' '}
                  <button
                    className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2"
                    onClick={() => setFilters(emptyProblemBankFilters)}
                  >
                    Clear filters
                  </button>
                </p>
              )}
            </div>
            {problemCategories.map((category) => {
              const records = filteredRecords.filter(
                (record) => record.category === category,
              );
              return (
                <section
                  key={category}
                  aria-labelledby={`member-bank-${category}`}
                >
                  <h2
                    className="mb-2 mt-0 text-lg font-semibold"
                    id={`member-bank-${category}`}
                  >
                    {labels[category]}
                  </h2>
                  {records.length ? (
                    <ul className="m-0 list-none p-0">
                      {records.map((record) => (
                        <li
                          className="border-b border-border-soft"
                          key={record.id}
                        >
                          <Link
                            className="flex min-h-12 items-center rounded px-3 py-2 font-semibold text-ink no-underline hover:bg-hover hover:text-accent-hover hover:underline focus-visible:relative focus-visible:z-10"
                            href={`/problem-bank/${encodeURIComponent(record.id)}`}
                          >
                            {record.title}
                          </Link>
                          <div
                            className="flex flex-wrap items-center gap-1.5 px-3 pb-3"
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
      </section>
    </main>
  );
}

export function MemberBankProblemPage({ problemId }: { problemId: string }) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'unavailable' }
    | {
        status: 'ready';
        problem: BankProblemRecord;
        solutions: BankSolutions;
        approaches: SolutionApproach[];
      }
  >({ status: 'loading' });
  const [retry, setRetry] = useState(0);
  const [approachId, setApproachId] = useState('primary');
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    setApproachId('primary');
    getBankProblem(problemId).then(
      (result) => {
        if (active)
          setState(
            result ? { status: 'ready', ...result } : { status: 'unavailable' },
          );
      },
      () => {
        if (active) setState({ status: 'unavailable' });
      },
    );
    return () => {
      active = false;
    };
  }, [problemId, retry]);
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <AppHeader>
        <nav aria-label="Member navigation">
          <Link href="/problem-bank">Problem Bank</Link>
          <Link href="/">Sessions</Link>
        </nav>
      </AppHeader>
      <section
        className="mx-auto w-[calc(100%-32px)] max-w-[1440px] py-5 sm:w-[calc(100%-48px)]"
        aria-labelledby="bank-problem-heading"
      >
        {state.status === 'loading' ? (
          <p id="bank-problem-heading" role="status">
            Loading Problem…
          </p>
        ) : state.status === 'unavailable' ? (
          <div role="alert">
            <h1 className="text-[28px]" id="bank-problem-heading">
              Problem unavailable
            </h1>
            <p>
              This Problem is unavailable or is being used by the live Session.
            </p>
            <Link href="/problem-bank">← Problem Bank</Link>
            <button
              className="ml-3 min-h-11 rounded border border-border-strong bg-surface px-3 py-2"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <Link
              className="text-accent underline-offset-4 hover:underline"
              href="/problem-bank"
            >
              ← Problem Bank
            </Link>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="m-0 text-sm font-semibold text-muted">
                  {labels[state.problem.category]}
                </p>
                <h1
                  className="mb-0 mt-1 text-[28px] font-semibold leading-9 tracking-tight"
                  id="bank-problem-heading"
                >
                  {state.problem.title}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ProblemDifficultyBadge difficulty={state.problem.difficulty} />
                {state.problem.leetcodeUrl && (
                  <a
                    className="text-accent underline-offset-4 hover:underline"
                    href={state.problem.leetcodeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LeetCode source
                  </a>
                )}
              </div>
            </div>
            <div className="mt-3">
              <ProblemApproachTags
                tags={problemApproachTags(state.approaches)}
              />
            </div>
            <ProblemMarkdown>{state.problem.description}</ProblemMarkdown>
            {state.problem.constraints && (
              <section
                className="mt-5 max-w-[80ch]"
                aria-labelledby="bank-constraints"
              >
                <h2
                  className="mb-2 mt-0 text-base font-semibold"
                  id="bank-constraints"
                >
                  Constraints
                </h2>
                <p className="m-0 max-w-[80ch] whitespace-pre-wrap break-words text-base leading-[26px]">
                  {state.problem.constraints}
                </p>
              </section>
            )}
            <section className="mt-6" aria-label="Shared example">
              <h2 className="mb-3 mt-0 text-lg font-semibold">Example</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-1 mt-0 text-sm font-semibold text-muted">
                    Input
                  </h3>
                  <pre className="m-0 max-w-full overflow-x-auto rounded-md border border-border-soft bg-surface px-3 py-3 font-mono text-[15px] leading-6">
                    {state.problem.exampleInput || '—'}
                  </pre>
                </div>
                <div>
                  <h3 className="mb-1 mt-0 text-sm font-semibold text-muted">
                    Expected output
                  </h3>
                  <pre className="m-0 max-w-full overflow-x-auto rounded-md border border-border-soft bg-surface px-3 py-3 font-mono text-[15px] leading-6">
                    {state.problem.exampleOutput || '—'}
                  </pre>
                </div>
              </div>
            </section>
            <section className="mt-7" aria-labelledby="bank-solutions-heading">
              <h2
                className="mb-3 mt-0 text-lg font-semibold"
                id="bank-solutions-heading"
              >
                Prepared Solutions
              </h2>
              {state.approaches.length === 0 ? (
                <p>No solution approaches are available.</p>
              ) : (
                <>
                  {state.approaches.length > 1 && (
                    <div
                      className="mb-4 flex flex-wrap gap-2"
                      aria-label="Solution approaches"
                    >
                      {state.approaches.map((approach) => (
                        <button
                          key={approach.id}
                          type="button"
                          aria-pressed={approach.id === approachId}
                          className="rounded border border-border-strong bg-surface px-3 py-2"
                          onClick={() => setApproachId(approach.id)}
                        >
                          {approach.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <SolutionWorkspace
                    solutions={
                      state.approaches.find(({ id }) => id === approachId)
                        ?.solutions ?? state.solutions
                    }
                    modelPath={`bank/${problemId}/${approachId}`}
                  />
                </>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
