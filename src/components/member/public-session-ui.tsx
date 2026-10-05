'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ProblemSolutions } from '@/lib/firebase/solutions';
import AppHeader from '@/components/app-header';
import SolutionWorkspace from '@/components/solutions/solution-workspace';
import { useAnswersVisible } from '@/hooks/use-answer-visibility';

export interface PublicSessionSummary {
  id: string;
  title: string;
  date: string;
  status: 'live' | 'ended';
}

export interface PublicProblem {
  id: string;
  title: string;
  description: string;
  exampleInput: string;
  exampleOutput: string;
  order: number;
  answersVisible: boolean;
  leetcodeUrl?: string;
}

export type DiscoveryState =
  | { status: 'loading' }
  | { status: 'error'; onRetry: () => void }
  | { status: 'empty' }
  | { status: 'ready'; sessions: PublicSessionSummary[] };

export function PublicSessionDiscovery({ state }: { state: DiscoveryState }) {
  const sessions =
    state.status === 'ready'
      ? state.sessions.filter(
          (session) => session.status === 'live' || session.status === 'ended',
        )
      : [];
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <AppHeader>
        <Link href="/officer">Officer login</Link>
      </AppHeader>
      <section
        className="mx-auto w-[calc(100%-32px)] max-w-[1440px] py-5 pb-12 leading-relaxed sm:w-[calc(100%-48px)] sm:pt-6"
        aria-labelledby="sessions-heading"
      >
        <h1
          className="m-0 text-[28px] font-semibold leading-9 tracking-tight"
          id="sessions-heading"
        >
          Sessions
        </h1>
        {state.status === 'loading' ? (
          <p role="status">Loading sessions…</p>
        ) : state.status === 'error' ? (
          <div
            className="mt-4 rounded-md border border-border-strong bg-surface p-4"
            role="alert"
          >
            <p>Sessions could not be loaded.</p>
            <button
              className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 text-ink hover:bg-hover"
              type="button"
              onClick={state.onRetry}
            >
              Retry sessions
            </button>
          </div>
        ) : state.status === 'empty' ? (
          <>
            <SessionGroup
              title="Live"
              sessions={[]}
              emptyMessage="No live session right now."
            />
            <SessionGroup
              title="Past"
              sessions={[]}
              emptyMessage="No past sessions yet."
            />
          </>
        ) : (
          <>
            <SessionGroup
              title="Live"
              sessions={sessions.filter((session) => session.status === 'live')}
              emptyMessage="No live session right now."
            />
            <SessionGroup
              title="Past"
              sessions={sessions.filter(
                (session) => session.status === 'ended',
              )}
              emptyMessage="No past sessions yet."
            />
          </>
        )}
      </section>
    </main>
  );
}

function SessionGroup({
  title,
  sessions,
  emptyMessage,
}: {
  title: string;
  sessions: PublicSessionSummary[];
  emptyMessage: string;
}) {
  return (
    <section className="mt-8 first:mt-7" aria-label={title}>
      <h2 className="mb-2 mt-0 text-lg font-semibold leading-[26px]">
        {title}
      </h2>
      {sessions.length ? (
        <ul className="m-0 max-w-5xl list-none p-0">
          {sessions.map((session) => (
            <li className="border-b border-border-soft" key={session.id}>
              <Link
                className="flex min-h-[52px] max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 rounded px-2 py-3 text-ink no-underline hover:bg-hover focus-visible:relative focus-visible:z-10 [&:hover_.session-title]:text-accent-hover [&:hover_.session-title]:underline"
                href={`/sessions/${encodeURIComponent(session.id)}`}
              >
                <time
                  className="shrink-0 text-sm text-muted"
                  dateTime={session.date}
                >
                  {formatDate(session.date)}
                </time>
                <span className="session-title min-w-0 max-w-[40ch] break-words font-semibold">
                  {session.title}
                </span>
                <span
                  className={`text-sm font-semibold ${session.status === 'live' ? 'text-success' : 'text-muted'}`}
                >
                  {session.status === 'live' ? 'Live' : 'Past'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-muted">{emptyMessage}</p>
      )}
    </section>
  );
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | {
      status: 'ready';
      session: PublicSessionSummary;
      problems:
        | { status: 'loading' }
        | { status: 'error'; onRetry: () => void }
        | { status: 'ready'; records: PublicProblem[] };
      loadRevealedSolutions: (problemId: string) => Promise<ProblemSolutions>;
    };

export function PublicSessionView({ state }: { state: SessionState }) {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <AppHeader>
        <Link href="/officer">Officer login</Link>
      </AppHeader>
      {state.status === 'loading' ? (
        <p
          className="mx-auto w-[calc(100%-32px)] max-w-[1440px] py-6 text-muted sm:w-[calc(100%-48px)]"
          role="status"
        >
          Loading session…
        </p>
      ) : state.status === 'unavailable' ? (
        <section
          className="mx-auto w-[calc(100%-32px)] max-w-[1440px] py-6 sm:w-[calc(100%-48px)]"
          aria-labelledby="unavailable-title"
        >
          <h1
            className="m-0 text-[28px] font-semibold leading-9 tracking-tight"
            id="unavailable-title"
          >
            Session unavailable
          </h1>
          <p>This session is unavailable or cannot be viewed.</p>
          <Link
            className="text-accent underline-offset-4 hover:text-accent-hover hover:underline"
            href="/"
          >
            ← Sessions
          </Link>
        </section>
      ) : (
        <SessionContent key={state.session.id} state={state} />
      )}
    </main>
  );
}

function SessionContent({
  state,
}: {
  state: Extract<SessionState, { status: 'ready' }>;
}) {
  const problems = useMemo(
    () =>
      state.problems.status === 'ready'
        ? [...state.problems.records].sort(
            (a, b) => a.order - b.order || a.id.localeCompare(b.id),
          )
        : [],
    [state.problems],
  );
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(
    null,
  );
  const effectiveSelectedProblemId = problems.some(
    (problem) => problem.id === selectedProblemId,
  )
    ? selectedProblemId
    : (problems[0]?.id ?? null);
  const selectedProblem = problems.find(
    (problem) => problem.id === effectiveSelectedProblemId,
  );

  useEffect(() => {
    if (state.problems.status !== 'ready') return;
    if (!problems.some((problem) => problem.id === selectedProblemId)) {
      setSelectedProblemId(problems[0]?.id ?? null);
    }
  }, [problems, selectedProblemId, state.problems.status]);

  function selectProblem(problemId: string) {
    setSelectedProblemId(problemId);
  }

  return (
    <section className="mx-auto w-[calc(100%-32px)] max-w-[1440px] py-5 pb-12 leading-relaxed sm:w-[calc(100%-48px)] sm:pt-6">
      <Link
        className="mb-3 inline-flex min-h-10 items-center text-sm text-muted underline-offset-4 hover:text-accent-hover hover:underline"
        href="/"
      >
        ← Sessions
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="m-0 text-[25px] font-semibold leading-8 tracking-tight sm:text-[28px] sm:leading-9">
          {state.session.title}
        </h1>
        <span
          className={`inline-flex min-h-7 shrink-0 items-center rounded border px-2.5 py-0.5 text-sm font-semibold capitalize leading-5 ${state.session.status === 'live' ? 'border-success/50 bg-success-surface text-success' : 'border-border-soft text-muted'}`}
        >
          {state.session.status === 'live' ? 'Live' : 'Ended'}
        </span>
        <time
          className="text-sm leading-5 text-muted"
          dateTime={state.session.date}
        >
          {formatDate(state.session.date)}
        </time>
      </div>

      {state.problems.status === 'loading' ? (
        <p role="status">Loading problems…</p>
      ) : state.problems.status === 'error' ? (
        <div
          className="mt-4 rounded-md border border-border-strong bg-surface p-4"
          role="alert"
        >
          <p>Problems could not be loaded.</p>
          <button
            className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 hover:bg-hover"
            type="button"
            onClick={state.problems.onRetry}
          >
            Retry problems
          </button>
        </div>
      ) : problems.length === 0 ? (
        <p className="text-muted">No problems are available in this session.</p>
      ) : (
        <>
          <div className="mt-1 border-b border-border-soft pb-1">
            <ProblemTabs
              problems={problems}
              selectedId={effectiveSelectedProblemId ?? ''}
              onSelect={selectProblem}
            />
          </div>
          {selectedProblem ? (
            <ProblemContent
              key={selectedProblem.id}
              session={state.session}
              problem={selectedProblem}
              loadRevealedSolutions={state.loadRevealedSolutions}
            />
          ) : (
            <p className="text-muted" role="status">
              No problems are available in this session.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function ProblemTabs({
  problems,
  selectedId,
  onSelect,
}: {
  problems: PublicProblem[];
  selectedId: string;
  onSelect: (problemId: string) => void;
}) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const index = problems.findIndex((problem) => problem.id === selectedId);
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % problems.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + problems.length) % problems.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? problems.length - 1
              : -1;
    if (nextIndex >= 0) {
      event.preventDefault();
      const nextProblem = problems[nextIndex];
      onSelect(nextProblem.id);
      document.getElementById(`problem-tab-${nextProblem.id}`)?.focus();
    }
  }

  return (
    <div
      className="flex max-w-full min-w-0 gap-1 overflow-x-auto [scrollbar-width:thin]"
      role="tablist"
      aria-label="Problems"
    >
      {problems.map((problem) => (
        <button
          key={problem.id}
          id={`problem-tab-${problem.id}`}
          type="button"
          role="tab"
          aria-selected={problem.id === selectedId}
          aria-controls={`problem-panel-${problem.id}`}
          className="min-h-12 shrink-0 rounded-t px-3 py-2 text-[15px] font-medium text-muted hover:bg-hover hover:text-ink focus-visible:relative focus-visible:z-10 aria-selected:border-b-2 aria-selected:border-accent aria-selected:font-semibold aria-selected:text-ink"
          tabIndex={problem.id === selectedId ? 0 : -1}
          onClick={() => onSelect(problem.id)}
          onKeyDown={handleKeyDown}
        >
          {problem.title}
        </button>
      ))}
    </div>
  );
}

function ProblemContent({
  session,
  problem,
  loadRevealedSolutions,
}: {
  session: PublicSessionSummary;
  problem: PublicProblem;
  loadRevealedSolutions: (problemId: string) => Promise<ProblemSolutions>;
}) {
  const [visibilityRetry, setVisibilityRetry] = useState(0);
  const isEnded = session.status === 'ended';
  const visibility = useAnswersVisible(
    isEnded ? null : session.id,
    isEnded ? null : problem.id,
    visibilityRetry,
  );

  return (
    <article
      className="pt-5"
      id={`problem-panel-${problem.id}`}
      role="tabpanel"
      aria-labelledby={`problem-tab-${problem.id}`}
      tabIndex={0}
    >
      <h2 className="mb-2 mt-0 text-2xl font-semibold leading-8">
        {problem.title}
      </h2>
      {problem.leetcodeUrl ? (
        <a
          className="mb-3 inline-block text-sm text-muted underline decoration-border-strong underline-offset-4 hover:text-ink focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href={problem.leetcodeUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on LeetCode ↗
        </a>
      ) : null}
      {problem.description ? (
        <p className="mb-5 max-w-[80ch] whitespace-pre-wrap text-base leading-[26px]">
          {problem.description}
        </p>
      ) : null}
      <section className="my-5 mb-7" aria-labelledby="examples-heading">
        <h3
          className="mb-2 mt-0 text-base font-semibold leading-6"
          id="examples-heading"
        >
          Examples
        </h3>
        <div className="grid sm:grid-cols-2">
          <section className="min-w-0 p-3">
            <h4 className="mb-2 mt-0 text-sm font-semibold leading-5 text-muted">
              Input
            </h4>
            <pre className="m-0 min-h-6 overflow-auto whitespace-pre-wrap rounded-md bg-raised px-3 py-2 font-mono text-[15px] leading-[23px]">
              {problem.exampleInput || 'No example input'}
            </pre>
          </section>
          <section className="min-w-0 border-t border-border-soft p-3 sm:border-l sm:border-t-0">
            <h4 className="mb-2 mt-0 text-sm font-semibold leading-5 text-muted">
              Output
            </h4>
            <pre className="m-0 min-h-6 overflow-auto whitespace-pre-wrap rounded-md bg-raised px-3 py-2 font-mono text-[15px] leading-[23px]">
              {problem.exampleOutput || 'No example output'}
            </pre>
          </section>
        </div>
      </section>
      <section
        className="mt-7 border-t border-border-soft pt-6"
        aria-labelledby="solutions-heading"
      >
        <h2
          className="mb-2 mt-0 text-2xl font-semibold leading-8"
          id="solutions-heading"
        >
          Solutions
        </h2>
        {isEnded ? (
          <RevealedSolutions
            key={`${session.id}/${problem.id}`}
            sessionId={session.id}
            problemId={problem.id}
            loadRevealedSolutions={loadRevealedSolutions}
          />
        ) : visibility.status === 'loading' ? (
          <p role="status">Syncing answer visibility…</p>
        ) : visibility.status === 'error' ? (
          <div
            className="mt-3 rounded-md border border-border-strong bg-surface p-4"
            role="status"
          >
            <p>Answer visibility could not be synchronized.</p>
            <button
              type="button"
              onClick={() => setVisibilityRetry((value) => value + 1)}
            >
              Retry sync
            </button>
          </div>
        ) : !visibility.value ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-border-soft bg-surface p-6 text-center">
            <svg
              className="mb-2 text-muted"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="5"
                y="10"
                width="14"
                height="11"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M8 10V7a4 4 0 1 1 8 0v3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            <h3 className="mb-1 mt-0 text-[17px] font-semibold">
              Answers hidden
            </h3>
            <p className="m-0 text-[15px] leading-[23px] text-muted">
              Waiting for the officer to reveal the solution…
            </p>
          </div>
        ) : (
          <RevealedSolutions
            key={`${session.id}/${problem.id}`}
            sessionId={session.id}
            problemId={problem.id}
            loadRevealedSolutions={loadRevealedSolutions}
          />
        )}
      </section>
    </article>
  );
}

function RevealedSolutions({
  sessionId,
  problemId,
  loadRevealedSolutions,
}: {
  sessionId: string;
  problemId: string;
  loadRevealedSolutions: (problemId: string) => Promise<ProblemSolutions>;
}) {
  const [solutions, setSolutions] = useState<ProblemSolutions | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setSolutions(null);
    setFailed(false);
    void loadRevealedSolutions(problemId).then(
      (result) => {
        if (active) setSolutions(result);
      },
      () => {
        if (active) {
          setSolutions(null);
          setFailed(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [loadRevealedSolutions, problemId, retryCount]);

  if (failed) {
    return (
      <div
        className="mt-3 rounded-md border border-border-strong bg-surface p-4"
        role="alert"
      >
        <p>Solutions could not be loaded.</p>
        <button
          type="button"
          onClick={() => setRetryCount((count) => count + 1)}
        >
          Retry solutions
        </button>
      </div>
    );
  }
  if (!solutions) return <p role="status">Loading solutions…</p>;
  return (
    <SolutionWorkspace
      solutions={solutions}
      modelPath={`member/${sessionId}/${problemId}`}
    />
  );
}
