'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { SolutionApproach } from '@/lib/domain';
import type { ProblemSolutions } from '@/lib/firebase/solutions';
import type { ProblemDifficulty } from '@/lib/domain';
import AppHeader from '@/components/app-header';
import ProblemMarkdown from '@/components/member/problem-markdown';
import {
  ProblemDifficultyBadge,
  ProblemLink,
} from '@/components/problems/problem-bank-metadata';
import { sessionProblemWorkspaceClass } from '@/components/problems/session-problem-workspace';
import { formatCalendarDate } from '@/lib/calendar-date';
import MemberSolutionViewer from '@/components/solutions/member-solution-viewer';
import { useAnswersVisible } from '@/hooks/use-answer-visibility';
import { Button, StateMessage } from '@/components/ui/primitives';
import {
  sessionBranches,
  sessionBranchLabels,
  type SessionBranch,
} from '@/lib/domain';

export interface PublicSessionSummary {
  id: string;
  branch: SessionBranch;
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
  constraints: string;
  order: number;
  answersVisible: boolean;
  leetcodeUrl?: string;
  difficulty?: ProblemDifficulty;
}

export type DiscoveryState =
  | { status: 'loading' }
  | {
      status: 'error';
      errorKind?: 'permission' | 'connection';
      onRetry: () => void;
    }
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
      <AppHeader current="sessions" />
      <section
        className="ui-page-shell leading-relaxed"
        aria-labelledby="sessions-heading"
      >
        <h1
          className="m-0 text-[28px] font-semibold leading-9 tracking-tight"
          id="sessions-heading"
        >
          Sessions
        </h1>
        {state.status === 'loading' ? (
          <LoadingBranchDiscovery />
        ) : state.status === 'error' ? (
          <div
            className="mt-4 rounded-md border border-border-strong bg-surface p-4"
            role="alert"
          >
            <p>
              {state.errorKind === 'permission'
                ? 'You do not have permission to view these Sessions.'
                : 'Sessions could not be loaded. Check your connection and retry.'}
            </p>
            <Button onClick={state.onRetry}>Retry sessions</Button>
          </div>
        ) : state.status === 'empty' ? (
          <BranchDiscovery sessions={[]} />
        ) : (
          <BranchDiscovery sessions={sessions} />
        )}
      </section>
    </main>
  );
}

function LoadingBranchDiscovery() {
  return (
    <div
      className="mt-6 grid gap-7 md:mt-8 md:grid-cols-3 md:gap-5"
      aria-busy="true"
    >
      <StateMessage className="sr-only">Loading sessions…</StateMessage>
      {sessionBranches.map((branch) => (
        <section
          aria-hidden="true"
          className="min-w-0 border-t border-border-soft pt-3"
          key={branch}
        >
          <div className="ui-skeleton mb-5 h-6 w-24" />
          <div className="ui-skeleton mb-3 h-4 w-14" />
          <div className="ui-skeleton h-12 w-full" />
        </section>
      ))}
    </div>
  );
}

function BranchDiscovery({ sessions }: { sessions: PublicSessionSummary[] }) {
  return (
    <div className="mt-6 grid gap-7 md:mt-8 md:grid-cols-3 md:gap-5">
      {sessionBranches.map((branch) => (
        <BranchColumn
          key={branch}
          branch={branch}
          sessions={sessions.filter((session) => session.branch === branch)}
        />
      ))}
    </div>
  );
}

function BranchColumn({
  branch,
  sessions,
}: {
  branch: SessionBranch;
  sessions: PublicSessionSummary[];
}) {
  const live = sessions.filter((session) => session.status === 'live');
  const past = sessions
    .filter((session) => session.status === 'ended')
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return (
    <section className="min-w-0" aria-labelledby={`branch-${branch}-heading`}>
      <h2
        className="mb-2 mt-0 text-lg font-semibold leading-[26px]"
        id={`branch-${branch}-heading`}
      >
        {sessionBranchLabels[branch]}
      </h2>
      <div
        className="space-y-6 md:max-h-[calc(100dvh-14rem)] md:overflow-y-auto md:overscroll-contain md:pr-2"
        role="region"
        aria-label={`${sessionBranchLabels[branch]} session history`}
        tabIndex={0}
      >
        <SessionGroup
          title="Live"
          sessions={live}
          emptyMessage="No live session right now."
        />
        <SessionGroup
          title="Past"
          sessions={past}
          emptyMessage="No past sessions yet."
        />
      </div>
    </section>
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
    <section aria-label={title}>
      <h3 className="mb-2 mt-0 text-sm font-semibold leading-5 text-muted">
        {title}
      </h3>
      {sessions.length ? (
        <ul className="m-0 list-none p-0">
          {sessions.map((session) => (
            <li className="border-b border-border-soft" key={session.id}>
              <Link
                className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded px-2 py-3 text-ink no-underline hover:bg-hover focus-visible:relative focus-visible:z-10 [&:hover_.session-title]:text-accent-hover [&:hover_.session-title]:underline"
                href={`/sessions/${encodeURIComponent(session.id)}`}
              >
                <span className="session-title min-w-0 break-words font-semibold">
                  {session.title}
                </span>
                <time
                  className="col-start-2 row-start-1 shrink-0 text-right text-sm text-muted"
                  dateTime={session.date}
                >
                  {formatCalendarDate(session.date)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-muted">{emptyMessage}</p>
      )}
    </section>
  );
}

export type SessionState =
  | { status: 'loading' }
  | {
      status: 'error';
      errorKind?: 'permission' | 'connection';
      onRetry: () => void;
    }
  | { status: 'unavailable'; kind?: 'session' | 'problem' }
  | {
      status: 'ready';
      session: PublicSessionSummary;
      selectedProblemId?: string | null;
      problems:
        | { status: 'loading' }
        | {
            status: 'error';
            errorKind?: 'permission' | 'connection';
            onRetry: () => void;
          }
        | { status: 'ready'; records: PublicProblem[] };
      loadRevealedSolutions: (
        problemId: string,
      ) => Promise<SolutionApproach[] | ProblemSolutions>;
    };

export function PublicSessionView({ state }: { state: SessionState }) {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <AppHeader current="sessions" />
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
            {state.kind !== 'problem'
              ? 'Session unavailable'
              : 'Problem unavailable'}
          </h1>
          <p>
            {state.kind !== 'problem'
              ? 'This session is unavailable or cannot be viewed.'
              : 'This problem is not available in this session.'}
          </p>
          <Link
            className="text-accent underline-offset-4 hover:text-accent-hover hover:underline"
            href="/"
          >
            ← Sessions
          </Link>
        </section>
      ) : state.status === 'error' ? (
        <section
          className="mx-auto w-[calc(100%-32px)] max-w-[1440px] py-6 sm:w-[calc(100%-48px)]"
          role="alert"
        >
          <p>
            {state.errorKind === 'permission'
              ? 'You do not have permission to view this Session.'
              : 'Session updates could not be synchronized. Check your connection and retry.'}
          </p>
          <button
            className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 text-ink hover:bg-hover"
            type="button"
            onClick={state.onRetry}
          >
            Retry session updates
          </button>
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
  const router = useRouter();
  const problems = useMemo(
    () =>
      state.problems.status === 'ready'
        ? [...state.problems.records].sort(
            (a, b) => a.order - b.order || a.id.localeCompare(b.id),
          )
        : [],
    [state.problems],
  );
  const requestedProblemId = state.selectedProblemId ?? null;
  const effectiveSelectedProblemId =
    requestedProblemId ?? problems[0]?.id ?? null;
  const selectedProblem = problems.find(
    (problem) => problem.id === effectiveSelectedProblemId,
  );

  useEffect(() => {
    if (
      state.problems.status === 'ready' &&
      requestedProblemId === null &&
      problems[0]
    ) {
      router.replace(
        `/sessions/${encodeURIComponent(state.session.id)}/${encodeURIComponent(problems[0].id)}`,
      );
    }
  }, [
    problems,
    requestedProblemId,
    router,
    state.problems.status,
    state.session.id,
  ]);

  function selectProblem(problemId: string) {
    router.push(
      `/sessions/${encodeURIComponent(state.session.id)}/${encodeURIComponent(problemId)}`,
    );
  }

  return (
    <section className="mx-auto w-[calc(100%-32px)] max-w-[1440px] py-4 leading-relaxed sm:w-[calc(100%-48px)] sm:pt-5">
      {state.session.status === 'ended' && (
        <Link
          className="mb-3 inline-flex min-h-10 items-center text-sm text-muted underline-offset-4 hover:text-accent-hover hover:underline"
          href="/"
        >
          ← Sessions
        </Link>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="m-0 text-[22px] font-semibold leading-7 tracking-tight sm:text-[24px] sm:leading-8">
          {state.session.title}
        </h1>
        <span
          className={`inline-flex min-h-7 shrink-0 items-center rounded border px-2.5 py-0.5 text-sm font-semibold capitalize leading-5 ${state.session.status === 'live' ? 'border-success/50 bg-success-surface text-success' : 'border-border-soft text-muted'}`}
        >
          {state.session.status === 'live' ? 'Live' : 'Ended'}
        </span>
        <span className="text-sm text-muted">
          {sessionBranchLabels[state.session.branch]}
        </span>
        <time
          className="text-sm leading-5 text-muted"
          dateTime={state.session.date}
        >
          {formatCalendarDate(state.session.date)}
        </time>
      </div>

      {state.problems.status === 'loading' ? (
        <p role="status">Loading problems…</p>
      ) : state.problems.status === 'error' ? (
        <div
          className="mt-4 rounded-md border border-border-strong bg-surface p-4"
          role="alert"
        >
          <p>
            {state.problems.errorKind === 'permission'
              ? 'You do not have permission to view these Problems.'
              : 'Problems could not be loaded. Check your connection and retry.'}
          </p>
          <button
            className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 hover:bg-hover"
            type="button"
            onClick={state.problems.onRetry}
          >
            Retry problems
          </button>
        </div>
      ) : requestedProblemId !== null && !selectedProblem ? (
        <section role="alert" aria-labelledby="problem-unavailable-title">
          <h2 id="problem-unavailable-title">Problem unavailable</h2>
          <p>This problem is not part of this session.</p>
          <Link href={`/sessions/${encodeURIComponent(state.session.id)}`}>
            ← Session problems
          </Link>
        </section>
      ) : problems.length === 0 ? (
        <p className="text-muted">No problems are available in this session.</p>
      ) : (
        <>
          {selectedProblem ? (
            <ProblemContent
              key={selectedProblem.id}
              session={state.session}
              problem={selectedProblem}
              problems={problems}
              selectedProblemId={effectiveSelectedProblemId ?? ''}
              onSelectProblem={selectProblem}
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
  problems,
  selectedProblemId,
  onSelectProblem,
  loadRevealedSolutions,
}: {
  session: PublicSessionSummary;
  problem: PublicProblem;
  problems: PublicProblem[];
  selectedProblemId: string;
  onSelectProblem: (problemId: string) => void;
  loadRevealedSolutions: (
    problemId: string,
  ) => Promise<SolutionApproach[] | ProblemSolutions>;
}) {
  const [visibilityRetry, setVisibilityRetry] = useState(0);
  const isEnded = session.status === 'ended';
  const visibility = useAnswersVisible(
    isEnded ? null : session.id,
    isEnded ? null : problem.id,
    visibilityRetry,
  );

  return (
    <div className={sessionProblemWorkspaceClass}>
      <div
        className="min-w-0 min-[1100px]:h-full min-[1100px]:overflow-y-auto min-[1100px]:overscroll-contain min-[1100px]:pr-5 min-[1100px]:focus-visible:outline-2 min-[1100px]:focus-visible:outline-offset-[-2px] min-[1100px]:focus-visible:outline-accent"
        role="region"
        aria-label="Problem"
        tabIndex={0}
      >
        <div className="mb-3 border-b border-border-soft pb-1">
          <ProblemTabs
            problems={problems}
            selectedId={selectedProblemId}
            onSelect={onSelectProblem}
          />
        </div>
        <article
          className="min-w-0"
          id={`problem-panel-${problem.id}`}
          role="tabpanel"
          aria-labelledby={`problem-tab-${problem.id}`}
          tabIndex={0}
        >
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="m-0 text-2xl font-semibold leading-8">
              {problem.title}
            </h2>
            <ProblemDifficultyBadge difficulty={problem.difficulty} />
          </div>
          <ProblemLink href={problem.leetcodeUrl} />
          <section className="mt-4 mb-8 min-w-0" aria-label="Problem content">
            <div className="space-y-5">
              {problem.description ? (
                <div className="break-words">
                  <ProblemMarkdown>{problem.description}</ProblemMarkdown>
                </div>
              ) : null}
              {problem.constraints ? (
                <section
                  className="border-t border-border-soft pt-4"
                  aria-labelledby={`constraints-${problem.id}`}
                >
                  <h3
                    className="mb-2 mt-0 text-base font-semibold leading-6"
                    id={`constraints-${problem.id}`}
                  >
                    Constraints
                  </h3>
                  <p className="m-0 max-w-[80ch] whitespace-pre-wrap break-words text-base leading-[26px]">
                    {problem.constraints}
                  </p>
                </section>
              ) : null}
              <section
                className="border-t border-border-soft pt-4"
                aria-labelledby={`examples-${problem.id}`}
              >
                <h3
                  className="mb-2 mt-0 text-base font-semibold leading-6"
                  id={`examples-${problem.id}`}
                >
                  Examples
                </h3>
                <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-border-soft">
                  <section className="min-w-0 py-2 sm:pr-5">
                    <h4 className="mb-1 mt-0 text-sm font-semibold leading-5 text-muted">
                      Input
                    </h4>
                    <div className="min-w-0 break-words font-mono text-[15px] leading-[23px]">
                      <ProblemMarkdown>
                        {problem.exampleInput || 'No example input'}
                      </ProblemMarkdown>
                    </div>
                  </section>
                  <section className="min-w-0 border-t border-border-soft py-3 sm:border-t-0 sm:pl-5 sm:pt-2">
                    <h4 className="mb-1 mt-0 text-sm font-semibold leading-5 text-muted">
                      Expected output
                    </h4>
                    <div className="min-w-0 break-words font-mono text-[15px] leading-[23px]">
                      <ProblemMarkdown>
                        {problem.exampleOutput || 'No expected output'}
                      </ProblemMarkdown>
                    </div>
                  </section>
                </div>
              </section>
            </div>
          </section>
        </article>
      </div>
      <section
        className="min-w-0 min-[1100px]:h-full min-[1100px]:overflow-y-auto min-[1100px]:overscroll-contain min-[1100px]:pl-5 min-[1100px]:focus-visible:outline-2 min-[1100px]:focus-visible:outline-offset-[-2px] min-[1100px]:focus-visible:outline-accent"
        aria-labelledby="solutions-heading"
      >
        <h2
          className="mb-3 mt-0 text-2xl font-semibold leading-8"
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
          <div className="flex min-h-40 flex-col items-center justify-center border border-border-soft bg-surface p-6 text-center">
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
    </div>
  );
}

function RevealedSolutions({
  sessionId,
  problemId,
  loadRevealedSolutions,
}: {
  sessionId: string;
  problemId: string;
  loadRevealedSolutions: (
    problemId: string,
  ) => Promise<SolutionApproach[] | ProblemSolutions>;
}) {
  const [approaches, setApproaches] = useState<SolutionApproach[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setApproaches(null);
    setFailed(false);
    void loadRevealedSolutions(problemId).then(
      (result) => {
        if (active) {
          const records = Array.isArray(result)
            ? result
            : [
                {
                  id: 'primary',
                  name: 'Primary Approach',
                  tags: [],
                  order: 0,
                  solutions: result,
                },
              ];
          setApproaches(records);
        }
      },
      () => {
        if (active) {
          setApproaches(null);
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
  if (!approaches) return <p role="status">Loading solutions…</p>;
  return (
    <MemberSolutionViewer
      approaches={approaches}
      modelPath={`member/${sessionId}/${problemId}`}
    />
  );
}
