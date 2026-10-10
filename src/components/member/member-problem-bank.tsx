'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/app-header';
import ProblemMarkdown from '@/components/member/problem-markdown';
import MemberSolutionViewer from '@/components/solutions/member-solution-viewer';
import {
  ProblemApproachTags,
  ProblemDifficultyBadge,
  ProblemLink,
} from '@/components/problems/problem-bank-metadata';
import type { SolutionApproach } from '@/lib/domain';
import {
  getBankProblem,
  listMemberBankProblems,
  type BankProblemRecord,
} from '@/lib/firebase/problem-bank';
import { listProblemUsageSummaries } from '@/lib/firebase/problem-usage';
import { isPermissionDenied } from '@/lib/firebase/errors';
import { problemApproachTags } from '@/lib/problem-bank-filters';
import { Button, StateMessage } from '@/components/ui/primitives';
import ProblemBankBrowser from '@/components/problems/problem-bank-browser';
import {
  emptyProblemBankFilters,
  filterProblemBank,
  type ProblemBankFilters as Filters,
} from '@/lib/problem-bank-filters';
import type { SessionBranch } from '@/lib/domain';
import {
  useDsaTagCatalog,
  useDsaTagCatalogReady,
} from '@/components/problems/dsa-tag-catalog-provider';

type MetadataLoad<T> =
  { status: 'loading' } | { status: 'failed' } | { status: 'ready'; value: T };

const labels = {
  custom: 'Custom',
  'interview-style': 'Interview-style',
  'competitive-programming': 'Competitive Programming',
} as const;

export function MemberProblemBank() {
  const catalog = useDsaTagCatalog();
  const catalogReady = useDsaTagCatalogReady();
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; records: BankProblemRecord[] }
  >({ status: 'loading' });
  const [retry, setRetry] = useState(0);
  const [metadataRetry, setMetadataRetry] = useState(0);
  const [branchMetadata, setBranchMetadata] = useState<
    MetadataLoad<Record<string, SessionBranch[]>>
  >({ status: 'loading' });
  const [filters, setFilters] = useState<Filters>(emptyProblemBankFilters);
  const branchFiltersReady = branchMetadata.status === 'ready';
  const branchFilterPending = filters.branch.length > 0 && !branchFiltersReady;
  const hasDeferredMetadataFilters = branchFilterPending;
  const availableFilters = {
    ...filters,
    branch: branchFiltersReady ? filters.branch : [],
    tag: filters.tag,
  };
  const filteredRecords =
    state.status === 'ready'
      ? filterProblemBank(
          state.records,
          availableFilters,
          Object.fromEntries(
            state.records.map(({ id, approachTagSummary }) => [
              id,
              approachTagSummary ?? [],
            ]),
          ),
          branchMetadata.status === 'ready' ? branchMetadata.value : {},
        )
      : [];
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    setBranchMetadata({ status: 'loading' });
    setFilters(emptyProblemBankFilters);
    listMemberBankProblems().then(
      (records) => {
        if (!active) return;
        setState({ status: 'ready', records });
        if (records.length === 0) {
          setBranchMetadata({ status: 'ready', value: {} });
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
    setBranchMetadata({ status: 'loading' });
    listProblemUsageSummaries(problemIds).then(
      (summaries) => {
        if (!active) return;
        setBranchMetadata({
          status: 'ready',
          // Members need branch filter data only. Do not retain counts,
          // last-used details, or Officer planning history in this view.
          value: Object.fromEntries(
            Object.entries(summaries).map(([id, summary]) => [
              id,
              summary.branches,
            ]),
          ),
        });
      },
      () => {
        if (active) setBranchMetadata({ status: 'failed' });
      },
    );
    return () => {
      active = false;
    };
  }, [metadataRetry, state]);
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <AppHeader current="problem-bank" />
      <section className="ui-page-shell" aria-labelledby="member-bank-heading">
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
          <div className="ui-loading-block mt-5 min-h-56" aria-busy="true">
            <StateMessage className="sr-only">
              Loading Problem Bank…
            </StateMessage>
            <div className="ui-skeleton mb-5 h-5 w-36" aria-hidden="true" />
            <div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              aria-hidden="true"
            >
              <div className="ui-skeleton h-12" />
              <div className="ui-skeleton h-12" />
              <div className="ui-skeleton h-12" />
            </div>
          </div>
        ) : state.status === 'error' ? (
          <div role="alert">
            <p>Problem Bank could not be loaded.</p>
            <Button onClick={() => setRetry((value) => value + 1)}>
              Retry
            </Button>
          </div>
        ) : state.records.length === 0 ? (
          <p>No public Problems are available right now.</p>
        ) : (
          <>
            {(branchMetadata.status === 'failed' ||
              hasDeferredMetadataFilters) && (
              <p className="mb-4 mt-3 text-sm text-muted" role="status">
                {branchMetadata.status === 'failed'
                  ? 'CIC branch filters could not be loaded.'
                  : 'CIC branch filters are still loading; the selected branch filter is not applied yet.'}{' '}
                {branchMetadata.status === 'failed' && (
                  <button
                    className="underline underline-offset-2"
                    onClick={() => setMetadataRetry((value) => value + 1)}
                  >
                    Retry branch filters
                  </button>
                )}
              </p>
            )}
            <ProblemBankBrowser
              records={filteredRecords}
              catalog={catalog}
              catalogReady={catalogReady}
              filters={filters}
              onFiltersChange={setFilters}
              tagsByProblem={Object.fromEntries(
                state.records.map(({ id, approachTagSummary }) => [
                  id,
                  approachTagSummary ?? [],
                ]),
              )}
              hrefForProblem={(id) => `/problem-bank/${encodeURIComponent(id)}`}
              idPrefix="member-bank"
              noResultsMessage={
                hasDeferredMetadataFilters
                  ? 'No Problems match the available filters; the selected branch filter is not applied yet.'
                  : 'No Problems match these filters.'
              }
              onClearFilters={() => setFilters(emptyProblemBankFilters)}
            />
          </>
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
      <AppHeader current="problem-bank" />
      <section className="ui-page-shell" aria-labelledby="bank-problem-heading">
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
            <Button
              className="ml-3"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry
            </Button>
          </div>
        ) : currentState.status === 'error' ? (
          <div role="alert">
            <h1 className="text-[28px]" id="bank-problem-heading">
              Problem could not be loaded
            </h1>
            <p>Check your connection and retry loading this Problem.</p>
            <Link href="/problem-bank">← Problem Bank</Link>
            <Button
              className="ml-3"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry
            </Button>
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
                      className="mb-0 mt-1 text-2xl font-semibold leading-8 tracking-tight"
                      id="bank-problem-heading"
                    >
                      {currentState.problem.title}
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <ProblemDifficultyBadge
                      difficulty={currentState.problem.difficulty}
                    />
                    <ProblemLink href={currentState.problem.leetcodeUrl} />
                  </div>
                </div>
                <div className="mt-3">
                  <ProblemApproachTags
                    tags={
                      currentState.problem.approachTagSummary?.length
                        ? currentState.problem.approachTagSummary
                        : problemApproachTags(currentState.approaches)
                    }
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
