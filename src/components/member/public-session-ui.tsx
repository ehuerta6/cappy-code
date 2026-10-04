'use client';

import Link from 'next/link';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ProblemSolutions } from '@/lib/firebase/solutions';
import SolutionWorkspace from '@/components/solutions/solution-workspace';
import {
  createFollowPresenterState,
  reduceFollowPresenterState,
  useActiveProblemId,
  useAnswersVisible,
} from '@/hooks/use-presentation-state';
import styles from './public-session-ui.module.css';

export interface PublicSessionSummary {
  id: string;
  title: string;
  date: string;
  status: 'live' | 'ended';
  activeProblemId?: string | null;
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
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="CappyCode home">
          CappyCode
        </Link>
        <span className={styles.context}>CIC Intro solution showcase</span>
        <Link className={styles.officerLink} href="/officer">
          Officer Login
        </Link>
      </header>
      <section className={styles.content} aria-labelledby="sessions-heading">
        <p className={styles.eyebrow}>Member view</p>
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
          <p className={styles.quiet}>No public sessions are available.</p>
        ) : (
          <>
            <SessionGroup
              title="Live"
              sessions={sessions.filter((session) => session.status === 'live')}
            />
            <SessionGroup
              title="Past sessions"
              sessions={sessions.filter(
                (session) => session.status === 'ended',
              )}
            />
            {sessions.length === 0 ? (
              <p className={styles.quiet}>No public sessions are available.</p>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

function SessionGroup({
  title,
  sessions,
}: {
  title: string;
  sessions: PublicSessionSummary[];
}) {
  if (!sessions.length) return null;
  return (
    <section className={styles.sessionGroup} aria-label={title}>
      <h2>{title}</h2>
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
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="CappyCode home">
          CappyCode
        </Link>
        <span className={styles.context}>Member view</span>
        <Link className={styles.officerLink} href="/officer">
          Officer Login
        </Link>
      </header>
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
  const [presenterState, dispatchPresenter] = useReducer(
    reduceFollowPresenterState,
    state.session.activeProblemId ?? null,
    createFollowPresenterState,
  );
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [presentationRetry, setPresentationRetry] = useState(0);
  const observedPresenterId = useRef(state.session.activeProblemId ?? null);
  const presenter = useActiveProblemId(state.session.id, presentationRetry);
  const activeProblemId =
    presenter.status === 'ready'
      ? presenter.value
      : presenterState.activeProblemId;
  const selectedProblem = problems.find(
    (problem) => problem.id === presenterState.selectedProblemId,
  );
  const presenterProblem = problems.find(
    (problem) => problem.id === presenterState.activeProblemId,
  );

  useEffect(() => {
    if (state.problems.status !== 'ready' || selectionInitialized) return;
    const initialActiveId =
      presenter.status === 'ready'
        ? presenter.value
        : (state.session.activeProblemId ?? null);
    const initialProblem = problems.find(
      (problem) => problem.id === initialActiveId,
    );
    observedPresenterId.current = initialActiveId;
    dispatchPresenter({
      type: 'initial_selection_resolved',
      problemId: initialProblem?.id ?? problems[0]?.id ?? null,
    });
    setSelectionInitialized(true);
  }, [
    problems,
    presenter,
    selectionInitialized,
    state.problems.status,
    state.session.activeProblemId,
  ]);

  useEffect(() => {
    if (
      !selectionInitialized ||
      presenter.status !== 'ready' ||
      observedPresenterId.current === presenter.value
    ) {
      return;
    }
    observedPresenterId.current = presenter.value;
    dispatchPresenter({
      type: 'presenter_changed',
      problemId: presenter.value,
    });
  }, [presenter, selectionInitialized]);

  function selectProblem(problemId: string) {
    if (problemId === presenterState.selectedProblemId) return;
    dispatchPresenter({ type: 'select_problem', problemId });
  }

  function followPresenter() {
    dispatchPresenter({
      type: 'presenter_changed',
      problemId: activeProblemId,
    });
    dispatchPresenter({ type: 'follow_presenter' });
  }

  return (
    <section className={styles.content}>
      <Link className={styles.backLink} href="/">
        ← All sessions
      </Link>
      <div className={styles.sessionHeading}>
        <div>
          <h1>{state.session.title}</h1>
          <time dateTime={state.session.date}>
            {formatDate(state.session.date)}
          </time>
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
              selectedId={presenterState.selectedProblemId ?? ''}
              onSelect={selectProblem}
            />
            <div className={styles.followControl}>
              <label>
                <input
                  type="checkbox"
                  checked={presenterState.isFollowing}
                  onChange={(event) =>
                    event.target.checked
                      ? followPresenter()
                      : dispatchPresenter({ type: 'unfollow_presenter' })
                  }
                />
                Follow presenter
              </label>
              <span
                className={styles.quiet}
                aria-live="polite"
                aria-atomic="true"
              >
                {presenter.status === 'error'
                  ? 'Presenter updates are unavailable.'
                  : presenterState.isFollowing
                    ? presenterProblem
                      ? `Following ${presenterProblem.title}.`
                      : presenterState.activeProblemId
                        ? 'The presenter’s Problem is not available in this session.'
                        : 'No Problem is currently selected by the presenter.'
                    : 'Browsing Problems independently.'}
              </span>
              {presenter.status === 'error' ? (
                <button
                  type="button"
                  onClick={() => setPresentationRetry((value) => value + 1)}
                >
                  Retry sync
                </button>
              ) : null}
            </div>
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
              {presenter.status === 'ready' && presenter.value
                ? 'The presenter’s Problem is not available in this session.'
                : 'The presenter has not selected a Problem.'}
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
  const visibility = useAnswersVisible(session.id, problem.id, visibilityRetry);

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
      <div className={styles.examples}>
        <section>
          <h3>Input</h3>
          <pre>{problem.exampleInput || 'No example input'}</pre>
        </section>
        <section>
          <h3>Output</h3>
          <pre>{problem.exampleOutput || 'No example output'}</pre>
        </section>
      </div>
      <section className={styles.solutions} aria-labelledby="solutions-heading">
        <h2 id="solutions-heading">Solutions</h2>
        {visibility.status === 'loading' ? (
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
            <h3>Answers hidden</h3>
            <p>
              {session.status === 'ended'
                ? 'Answers are hidden for this Problem.'
                : 'Waiting for the officer to reveal the solution…'}
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
