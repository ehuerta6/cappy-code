'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/app-header';
import ProblemMarkdown from '@/components/member/problem-markdown';
import MemberSolutionViewer from '@/components/solutions/member-solution-viewer';
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
} from '@/lib/firebase/problem-bank';
import { listProblemUsageSummaries } from '@/lib/firebase/problem-usage';
import { isPermissionDenied } from '@/lib/firebase/errors';
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
  const [metadataRetry, setMetadataRetry] = useState(0);
  const [usage, setUsage] = useState<Record<string, ProblemUsageSummary>>({});
  const [tagsByProblem, setTagsByProblem] = useState<Record<string, string[]>>(
    {},
  );
  const [metadataError, setMetadataError] = useState(false);
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
    setMetadataError(false);
    setFilters(emptyProblemBankFilters);
    listMemberBankProblems().then(
      (records) => {
        if (!active) return;
        setState({ status: 'ready', records });
        if (records.length === 0) {
          setUsage({});
          setTagsByProblem({});
        }
      },
      () => {
        if (active) setState({ status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [retry]);
  useEffect(() => {
    if (state.status !== 'ready' || state.records.length === 0) return;
    let active = true;
    const problemIds = state.records.map(({ id }) => id);
    setMetadataError(false);
    Promise.allSettled([
      listBankProblemApproachTags(problemIds),
      listProblemUsageSummaries(problemIds),
    ]).then(([tagsResult, usageResult]) => {
      if (!active) return;
      if (tagsResult.status === 'fulfilled') setTagsByProblem(tagsResult.value);
      if (usageResult.status === 'fulfilled') setUsage(usageResult.value);
      setMetadataError(
        tagsResult.status === 'rejected' || usageResult.status === 'rejected',
      );
    });
    return () => {
      active = false;
    };
  }, [metadataRetry, state]);
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
          <div
            className="mt-5 min-h-56 border-t border-border-soft pt-5"
            aria-busy="true"
          >
            <p role="status">Loading Problem Bank…</p>
          </div>
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
              {metadataError && (
                <p className="-mt-3 mb-4 text-sm text-muted" role="status">
                  Some filter details could not be loaded. Results may be
                  incomplete.{' '}
                  <button
                    className="underline underline-offset-2"
                    onClick={() => setMetadataRetry((value) => value + 1)}
                  >
                    Retry filter details
                  </button>
                </p>
              )}
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
    | { status: 'error' }
    | {
        status: 'ready';
        problem: BankProblemRecord;
        approaches: SolutionApproach[];
      }
  >({ status: 'loading' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    getBankProblem(problemId).then(
      (result) => {
        if (active)
          setState(
            result ? { status: 'ready', ...result } : { status: 'unavailable' },
          );
      },
      (error: unknown) => {
        if (active)
          setState({
            status: isPermissionDenied(error) ? 'unavailable' : 'error',
          });
      },
    );
    return () => {
      active = false;
    };
  }, [problemId, retry]);
  const currentState =
    state.status === 'ready' && state.problem.id !== problemId
      ? { status: 'loading' as const }
      : state;
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
        {currentState.status === 'loading' ? (
          <div
            className="mt-4 min-h-[50vh] border-t border-border-soft pt-5"
            aria-busy="true"
          >
            <p id="bank-problem-heading" role="status">
              Loading Problem…
            </p>
          </div>
        ) : currentState.status === 'unavailable' ? (
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
        ) : currentState.status === 'error' ? (
          <div role="alert">
            <h1 className="text-[28px]" id="bank-problem-heading">
              Problem could not be loaded
            </h1>
            <p>Check your connection and retry loading this Problem.</p>
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
            <div className="mt-4 grid min-w-0 gap-6 min-[1100px]:h-[calc(100dvh-9rem)] min-[1100px]:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] min-[1100px]:gap-0 min-[1100px]:overflow-hidden min-[1100px]:divide-x min-[1100px]:divide-border-soft">
              <div
                className="min-w-0 min-[1100px]:h-full min-[1100px]:overflow-y-auto min-[1100px]:overscroll-contain min-[1100px]:pr-5"
                role="region"
                aria-label="Problem"
                tabIndex={0}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-sm font-semibold text-muted">
                      {labels[currentState.problem.category]}
                    </p>
                    <h1
                      className="mb-0 mt-1 text-[28px] font-semibold leading-9 tracking-tight"
                      id="bank-problem-heading"
                    >
                      {currentState.problem.title}
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <ProblemDifficultyBadge
                      difficulty={currentState.problem.difficulty}
                    />
                    {currentState.problem.leetcodeUrl && (
                      <a
                        className="text-accent underline-offset-4 hover:underline"
                        href={currentState.problem.leetcodeUrl}
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
                    tags={problemApproachTags(currentState.approaches)}
                  />
                </div>
                <ProblemMarkdown>
                  {currentState.problem.description}
                </ProblemMarkdown>
                {currentState.problem.constraints && (
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
                      {currentState.problem.constraints}
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
                        {currentState.problem.exampleInput || '—'}
                      </pre>
                    </div>
                    <div>
                      <h3 className="mb-1 mt-0 text-sm font-semibold text-muted">
                        Expected output
                      </h3>
                      <pre className="m-0 max-w-full overflow-x-auto rounded-md border border-border-soft bg-surface px-3 py-3 font-mono text-[15px] leading-6">
                        {currentState.problem.exampleOutput || '—'}
                      </pre>
                    </div>
                  </div>
                </section>
              </div>
              <section
                className="min-w-0 min-[1100px]:h-full min-[1100px]:overflow-y-auto min-[1100px]:overscroll-contain min-[1100px]:pl-5"
                role="region"
                aria-label="Solutions"
                tabIndex={0}
              >
                <section
                  className="mt-7"
                  aria-labelledby="bank-solutions-heading"
                >
                  <h2
                    className="mb-3 mt-0 text-lg font-semibold"
                    id="bank-solutions-heading"
                  >
                    Prepared Solutions
                  </h2>
                  {currentState.approaches.length === 0 ? (
                    <p
                      className="rounded-md border border-border-soft bg-surface p-4"
                      role="status"
                    >
                      No solution approaches are available yet.
                    </p>
                  ) : (
                    <MemberSolutionViewer
                      key={problemId}
                      approaches={currentState.approaches}
                      modelPath={`bank/${problemId}`}
                    />
                  )}
                </section>
              </section>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
