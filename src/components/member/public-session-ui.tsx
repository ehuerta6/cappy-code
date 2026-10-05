'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ProblemSolutions } from '@/lib/firebase/solutions';
import AppHeader from '@/components/app-header';
import SolutionWorkspace from '@/components/solutions/solution-workspace';
import { useAnswersVisible } from '@/hooks/use-answer-visibility';
import styles from './public-session-ui.module.css';

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
    <main className={styles.shell}>
      <AppHeader context="CIC Intro solution showcase">
        <Link href="/officer">Officer Login</Link>
      </AppHeader>
      <section className={styles.content} aria-labelledby="sessions-heading">
        <h1 id="sessions-heading">Sessions</h1>
        {state.status === 'loading' ? (
          <p role="status">Loading sessions…</p>
        ) : state.status === 'error' ? (
          <div className={styles.notice} role="alert">
            <p>Sessions could not be loaded.</p>
            <button type="button" onClick={state.onRetry}>
              Retry sessions
            </button>
          </div>
        ) : state.status === 'empty' ? (
          <>
            <SessionGroup
              title="Live now"
              sessions={[]}
              emptyMessage="No live session right now."
            />
            <SessionGroup
              title="Past sessions"
              sessions={[]}
              emptyMessage="No past sessions yet."
            />
          </>
        ) : (
          <>
            <SessionGroup
              title="Live now"
              sessions={sessions.filter((session) => session.status === 'live')}
              emptyMessage="No live session right now."
            />
            <SessionGroup
              title="Past sessions"
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
    <section className={styles.sessionGroup} aria-label={title}>
      <h2>{title}</h2>
      {sessions.length ? (
        <ul>
          {sessions.map((session) => (
            <li key={session.id}>
              <Link href={`/sessions/${encodeURIComponent(session.id)}`}>
                <span>{session.title}</span>
                <time dateTime={session.date}>{formatDate(session.date)}</time>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.quiet}>{emptyMessage}</p>
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
    <main className={styles.shell}>
      <AppHeader
        context={
          state.status === 'ready' && state.session.status === 'live'
            ? 'Live Session'
            : 'Member view'
        }
        live={state.status === 'ready' && state.session.status === 'live'}
      >
        <Link href="/officer">Officer Login</Link>
      </AppHeader>
      {state.status === 'loading' ? (
        <p className={styles.content} role="status">
          Loading session…
        </p>
      ) : state.status === 'unavailable' ? (
        <section className={styles.content} aria-labelledby="unavailable-title">
          <h1 id="unavailable-title">Session unavailable</h1>
          <p>This session is unavailable or cannot be viewed.</p>
          <Link href="/">Back to sessions</Link>
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
    <section className={styles.content}>
      <Link className={styles.backLink} href="/">
        ← All sessions
      </Link>
      <div className={styles.sessionHeading}>
        <div>
          <h1>{state.session.title}</h1>
          <p className={styles.sessionContext}>
            CIC Intro Session <span aria-hidden="true">•</span>{' '}
            <time dateTime={state.session.date}>
              {formatDate(state.session.date)}
            </time>
          </p>
        </div>
        <span
          className={`${styles.status} ${state.session.status === 'live' ? styles.live : ''}`}
        >
          {state.session.status === 'live' ? 'Live' : 'Ended'}
        </span>
      </div>

      {state.problems.status === 'loading' ? (
        <p role="status">Loading problems…</p>
      ) : state.problems.status === 'error' ? (
        <div className={styles.notice} role="alert">
          <p>Problems could not be loaded.</p>
          <button type="button" onClick={state.problems.onRetry}>
            Retry problems
          </button>
        </div>
      ) : problems.length === 0 ? (
        <p className={styles.quiet}>
          No problems are available in this session.
        </p>
      ) : (
        <>
          <div className={styles.problemNavigation}>
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
            <p className={styles.quiet} role="status">
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
    <div className={styles.tabs} role="tablist" aria-label="Problems">
      {problems.map((problem) => (
        <button
          key={problem.id}
          id={`problem-tab-${problem.id}`}
          type="button"
          role="tab"
          aria-selected={problem.id === selectedId}
          aria-controls={`problem-panel-${problem.id}`}
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
      className={styles.problem}
      id={`problem-panel-${problem.id}`}
      role="tabpanel"
      aria-labelledby={`problem-tab-${problem.id}`}
      tabIndex={0}
    >
      <h2>{problem.title}</h2>
      {problem.description ? (
        <p className={styles.description}>{problem.description}</p>
      ) : null}
      <section className={styles.examples} aria-labelledby="examples-heading">
        <h3 id="examples-heading">Examples</h3>
        <div className={styles.examplePair}>
          <section>
            <h4>Input</h4>
            <pre>{problem.exampleInput || 'No example input'}</pre>
          </section>
          <section>
            <h4>Output</h4>
            <pre>{problem.exampleOutput || 'No example output'}</pre>
          </section>
        </div>
      </section>
      <section className={styles.solutions} aria-labelledby="solutions-heading">
        <h2 id="solutions-heading">Solutions</h2>
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
          <div className={styles.notice} role="status">
            <p>Answer visibility could not be synchronized.</p>
            <button
              type="button"
              onClick={() => setVisibilityRetry((value) => value + 1)}
            >
              Retry sync
            </button>
          </div>
        ) : !visibility.value ? (
          <div className={styles.answerGate}>
            <svg
              className={styles.lockIcon}
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
            <h3>Answers hidden</h3>
            <p>Waiting for the officer to reveal the solution…</p>
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
      <div className={styles.notice} role="alert">
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
