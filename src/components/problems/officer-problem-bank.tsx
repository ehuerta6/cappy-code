'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ProblemBankBrowser from './problem-bank-browser';
import {
  useDsaTagCatalog,
  useDsaTagCatalogState,
} from './dsa-tag-catalog-provider';
import { Button, StateMessage } from '@/components/ui/primitives';
import {
  createBankProblem,
  listOfficerBankProblems,
  type BankProblemRecord,
} from '@/lib/firebase/problem-bank';
import { listProblemUsageSummaries } from '@/lib/firebase/problem-usage';
import type { ProblemUsageSummary } from '@/lib/problem-usage';
import {
  emptyProblemBankFilters,
  filterProblemBank,
  type ProblemBankFilters,
} from '@/lib/problem-bank-filters';

type LoadState = 'loading' | 'ready' | 'error';

export default function OfficerProblemBank() {
  const catalog = useDsaTagCatalog();
  const catalogState = useDsaTagCatalogState();
  const router = useRouter();
  const [records, setRecords] = useState<BankProblemRecord[]>([]);
  const [usage, setUsage] = useState<Record<string, ProblemUsageSummary>>({});
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [usageState, setUsageState] = useState<LoadState>('loading');
  const [filters, setFilters] = useState<ProblemBankFilters>(
    emptyProblemBankFilters,
  );
  const [retry, setRetry] = useState(0);
  const [usageRetry, setUsageRetry] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    setUsageState('loading');
    setRecords([]);
    setUsage({});
    setFilters(emptyProblemBankFilters);
    listOfficerBankProblems().then(
      (items) => {
        if (!active) return;
        setRecords(items);
        setLoadState('ready');
      },
      () => {
        if (active) setLoadState('error');
      },
    );
    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    if (!records.length) {
      setUsage({});
      setUsageState('ready');
      return;
    }
    let active = true;
    setUsageState('loading');
    listProblemUsageSummaries(
      records.map(({ id }) => id),
      true,
    ).then(
      (summaries) => {
        if (active) {
          setUsage(summaries);
          setUsageState('ready');
        }
      },
      () => {
        if (active) setUsageState('error');
      },
    );
    return () => {
      active = false;
    };
  }, [loadState, records, usageRetry]);

  const branchesByProblem = Object.fromEntries(
    Object.entries(usage).map(([id, summary]) => [id, summary.branches]),
  );
  const filteredRecords = filterProblemBank(
    records,
    {
      ...filters,
      branch: usageState === 'ready' ? filters.branch : [],
    },
    Object.fromEntries(
      records.map(({ id, approachTagSummary }) => [
        id,
        approachTagSummary ?? [],
      ]),
    ),
    branchesByProblem,
  );
  const branchesPending = filters.branch.length > 0 && usageState === 'loading';

  async function createProblem() {
    if (creating) return;
    setCreating(true);
    setCreateError(false);
    try {
      const created = await createBankProblem();
      router.push(`/officer/problem-bank/${encodeURIComponent(created.id)}`);
    } catch {
      setCreateError(true);
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="ui-page-shell" aria-labelledby="officer-bank-heading">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="m-0 text-[28px] font-semibold leading-9 tracking-tight"
              id="officer-bank-heading"
            >
              Problem Bank
            </h1>
            <p className="mb-0 mt-1 text-muted">
              Browse reusable Problems and open one to edit its content and
              Solutions.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => void createProblem()}
            disabled={creating}
          >
            {creating ? 'Creating Problem…' : '+ New Problem'}
          </Button>
        </header>
        {createError && (
          <StateMessage role="alert">
            Problem could not be created. Retry when the connection is
            available.{' '}
            <Button onClick={() => void createProblem()}>Retry</Button>
          </StateMessage>
        )}
        {loadState === 'loading' ? (
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
        ) : loadState === 'error' ? (
          <StateMessage role="alert">
            Problem Bank could not be loaded.{' '}
            <Button onClick={() => setRetry((value) => value + 1)}>
              Retry
            </Button>
          </StateMessage>
        ) : records.length === 0 ? (
          <p>No reusable Problems yet. Create one here or from a Session.</p>
        ) : (
          <>
            {(usageState === 'error' || branchesPending) && (
              <StateMessage>
                {usageState === 'error'
                  ? 'CIC branch filters could not be loaded.'
                  : 'CIC branch filters are loading; this branch filter is not applied yet.'}{' '}
                {usageState === 'error' && (
                  <button
                    className="underline underline-offset-2"
                    onClick={() => setUsageRetry((value) => value + 1)}
                  >
                    Retry filters
                  </button>
                )}
              </StateMessage>
            )}
            <ProblemBankBrowser
              records={filteredRecords}
              catalog={catalog}
              catalogStatus={catalogState.status}
              catalogError={catalogState.error}
              onRetryCatalog={() => void catalogState.refresh().catch(() => {})}
              filters={filters}
              onFiltersChange={setFilters}
              tagsByProblem={Object.fromEntries(
                records.map(({ id, approachTagSummary }) => [
                  id,
                  approachTagSummary ?? [],
                ]),
              )}
              hrefForProblem={(id) =>
                `/officer/problem-bank/${encodeURIComponent(id)}`
              }
              idPrefix="officer-bank"
              noResultsMessage={
                branchesPending
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
