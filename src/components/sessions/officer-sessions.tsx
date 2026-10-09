'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSession,
  getSession,
  listSessions,
  type SessionRecord,
} from '@/lib/firebase/sessions';
import { listProblems, type ProblemRecord } from '@/lib/firebase/problems';
import {
  sessionBranches,
  sessionBranchLabels,
  type SessionBranch,
} from '@/lib/domain';
import { todayCalendarDate } from '@/lib/calendar-date';
import SessionEditor from './session-editor';
import { Button } from '@/components/ui/primitives';

export default function OfficerSessions({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [sessionRequest, setSessionRequest] = useState<
    | {
        sessionId: string;
        revision: number;
        status: 'loading';
      }
    | {
        sessionId: string;
        revision: number;
        status: 'ready';
        record: SessionRecord | null;
      }
    | {
        sessionId: string;
        revision: number;
        status: 'error';
      }
    | null
  >(null);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [createBranch, setCreateBranch] = useState<SessionBranch>('intro');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    if (sessionId) {
      getSession(sessionId).then(
        (session) => {
          if (cancelled) return;
          setSessionRequest({
            sessionId,
            revision,
            status: 'ready',
            record: session,
          });
          setLoading(false);
        },
        () => {
          if (cancelled) return;
          setSessionRequest({ sessionId, revision, status: 'error' });
          setLoadError(true);
          setLoading(false);
        },
      );
    } else {
      listSessions().then(
        (sessions) => {
          if (cancelled) return;
          setRecords(sessions);
          setDashboardLoaded(true);
          setLoading(false);
        },
        () => {
          if (cancelled) return;
          setDashboardLoaded(true);
          setLoadError(true);
          setLoading(false);
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [revision, sessionId]);

  function reload() {
    setLoading(true);
    setLoadError(false);
    setRevision((value) => value + 1);
  }

  async function create() {
    setCreating(true);
    setCreateError(false);
    try {
      const id = await createSession({
        branch: createBranch,
        title: 'Untitled Session',
        date: todayCalendarDate(),
      });
      router.push(`/officer/sessions/${encodeURIComponent(id)}`);
    } catch {
      setCreateError(true);
    } finally {
      setCreating(false);
    }
  }

  const currentSessionRequest =
    sessionId &&
    sessionRequest?.sessionId === sessionId &&
    sessionRequest.revision === revision
      ? sessionRequest
      : null;
  const selected =
    currentSessionRequest?.status === 'ready'
      ? (currentSessionRequest.record ?? undefined)
      : undefined;
  if (sessionId && !currentSessionRequest) {
    return (
      <section className="ui-loading-block min-h-56" aria-busy="true">
        <p className="ui-state-message m-0" role="status">
          Loading Session…
        </p>
      </section>
    );
  }
  if (selected) {
    return (
      <SessionEditor
        key={selected.id}
        record={selected}
        onDuplicated={(id) => {
          router.push(`/officer/sessions/${encodeURIComponent(id)}`);
        }}
        onClose={() => {
          router.push('/officer');
        }}
      />
    );
  }

  if (
    sessionId &&
    currentSessionRequest?.status === 'ready' &&
    currentSessionRequest.record === null
  ) {
    return (
      <section
        className="mx-auto w-full max-w-[1440px]"
        aria-label="Session unavailable"
      >
        <h1 className="text-2xl font-semibold">Session unavailable</h1>
        <p>
          This Session may have been deleted or you may not have access to it.
        </p>
        <Button onClick={() => router.push('/officer')}>
          Back to Sessions
        </Button>
      </section>
    );
  }

  if (sessionId && currentSessionRequest?.status === 'error') {
    return (
      <section role="alert" aria-label="Session load failed">
        <h1 className="text-2xl font-semibold">Session could not be loaded</h1>
        <p>Check your connection and retry loading this Session.</p>
        <Button onClick={reload}>Retry loading Session</Button>
      </section>
    );
  }

  if (sessionId && currentSessionRequest?.status === 'loading') {
    return (
      <section className="ui-loading-block min-h-56" aria-busy="true">
        <p className="ui-state-message m-0" role="status">
          Loading Session…
        </p>
      </section>
    );
  }

  return (
    <section
      className="flex w-full flex-col text-base leading-relaxed"
      aria-label="Officer sessions"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sm:gap-6">
        <h1 className="m-0 text-[28px] font-semibold leading-9 tracking-tight">
          Sessions
        </h1>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>Branch for new session</span>
            <select
              className="ui-field"
              aria-label="Branch for new session"
              value={createBranch}
              onChange={(event) =>
                setCreateBranch(event.target.value as SessionBranch)
              }
              disabled={creating || loading || loadError}
            >
              {sessionBranches.map((branch) => (
                <option key={branch} value={branch}>
                  {sessionBranchLabels[branch]}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="primary"
            onClick={() => void create()}
            disabled={creating || loading || loadError}
          >
            {creating ? 'Creating…' : '+ New session'}
          </Button>
        </div>
      </div>
      {createError && (
        <p role="alert">
          Session could not be created. Check your connection and try New
          session again.
        </p>
      )}
      {loading || !dashboardLoaded ? (
        <p className="ui-state-message m-0" role="status">
          Loading sessions…
        </p>
      ) : loadError ? (
        <div role="alert">
          <p>Sessions could not be loaded. Check your connection and retry.</p>
          <Button onClick={reload}>Retry loading sessions</Button>
        </div>
      ) : records.length === 0 ? (
        <p>No Sessions yet</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-3 md:gap-4">
          {sessionBranches.map((branch) => (
            <section
              className="min-w-0"
              key={branch}
              aria-labelledby={`branch-${branch}-heading`}
            >
              <h2
                className="mb-2 mt-7 text-lg font-semibold leading-[26px] md:mt-0"
                id={`branch-${branch}-heading`}
              >
                {sessionBranchLabels[branch]}
              </h2>
              <div
                className="space-y-5 md:max-h-[calc(100dvh-17rem)] md:overflow-y-auto md:overscroll-contain md:pr-2"
                role="region"
                aria-label={`${sessionBranchLabels[branch]} session history`}
                tabIndex={0}
              >
                {statusGroups(branch, records).map(
                  ({ label, records: group }) => (
                    <section
                      key={label}
                      aria-label={`${label} ${sessionBranchLabels[branch]} sessions`}
                    >
                      <h3 className="mb-2 mt-0 text-sm font-semibold leading-5 text-muted">
                        {label}
                      </h3>
                      {group.length ? (
                        <ul className="m-0 list-none p-0">
                          {group.map((record) => (
                            <li
                              className="border-b border-border-soft"
                              key={record.id}
                            >
                              <Button
                                variant="quiet"
                                className="min-h-14 w-full flex-wrap justify-start gap-x-3 gap-y-1 px-2 py-3 text-left focus-visible:relative focus-visible:z-10 max-sm:flex-col max-sm:items-start"
                                onClick={() => {
                                  router.push(
                                    `/officer/sessions/${encodeURIComponent(record.id)}`,
                                  );
                                }}
                                disabled={creating}
                              >
                                <span className="min-w-0 break-words font-semibold">
                                  {record.session.title}
                                </span>
                                <time
                                  className="shrink-0 text-sm text-muted"
                                  dateTime={record.session.date}
                                >
                                  {new Intl.DateTimeFormat('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    timeZone: 'UTC',
                                  }).format(
                                    new Date(
                                      `${record.session.date}T00:00:00Z`,
                                    ),
                                  )}
                                </time>
                                <span className="text-sm text-muted">
                                  {record.problemCount === null
                                    ? 'Problem count unavailable'
                                    : `${record.problemCount} ${record.problemCount === 1 ? 'Problem' : 'Problems'}`}
                                </span>
                              </Button>
                              {record.session.status === 'ended' ? (
                                <PastSessionProblemHistory
                                  sessionId={record.id}
                                  sessionTitle={record.session.title}
                                  problemCount={record.problemCount}
                                />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="m-0 text-sm text-muted">
                          No {label.toLowerCase()} sessions.
                        </p>
                      )}
                    </section>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function statusGroups(branch: SessionBranch, records: SessionRecord[]) {
  const branchRecords = records.filter(
    (record) => record.session.branch === branch,
  );
  return [
    { label: 'Live', status: 'live', reverse: false },
    { label: 'Upcoming', status: 'draft', reverse: false },
    { label: 'Past', status: 'ended', reverse: true },
  ].map(({ label, status, reverse }) => ({
    label,
    records: branchRecords
      .filter((record) => record.session.status === status)
      .sort((a, b) =>
        reverse
          ? b.session.date.localeCompare(a.session.date)
          : a.session.date.localeCompare(b.session.date),
      ),
  }));
}

function PastSessionProblemHistory({
  sessionId,
  sessionTitle,
  problemCount,
}: {
  sessionId: string;
  sessionTitle: string;
  problemCount: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'loaded'; problems: ProblemRecord[] }
    | { status: 'empty' }
    | { status: 'unavailable' }
  >({ status: 'loading' });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setState({ status: 'loading' });
    listProblems(sessionId).then(
      (problems) => {
        if (cancelled) return;
        setState(
          problems.length
            ? { status: 'loaded', problems }
            : { status: 'empty' },
        );
      },
      () => {
        if (!cancelled) setState({ status: 'unavailable' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [expanded, revision, sessionId]);

  return (
    <div className="mb-3 ml-3 sm:ml-[4.5rem]">
      <Button
        variant="quiet"
        className="min-h-11 px-2 text-sm"
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Hide' : 'Show'} Problem details for ${sessionTitle}`}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? 'Hide Problems' : 'Show Problems'}
        {problemCount === null ? '' : ` (${problemCount})`}
      </Button>
      {expanded && (
        <section
          className="mt-2 max-w-4xl border-l border-border-soft py-1 pl-4 sm:pl-5"
          aria-label={`Problem history for ${sessionTitle}`}
        >
          {state.status === 'loading' ? (
            <p className="m-0 text-sm text-muted" role="status">
              Loading Problems…
            </p>
          ) : state.status === 'unavailable' ? (
            <div className="text-sm text-muted">
              <p className="m-0">Problem history could not be loaded.</p>
              <Button
                variant="quiet"
                className="mt-1 min-h-11 px-2 text-accent underline underline-offset-2 hover:text-accent-hover"
                onClick={() => setRevision((value) => value + 1)}
              >
                Retry Problem history
              </Button>
            </div>
          ) : state.status === 'empty' ? (
            <p className="m-0 text-sm text-muted">No Problems recorded.</p>
          ) : (
            <ol className="m-0 grid gap-3 pl-5">
              {state.problems.map(({ id, problem }) => (
                <li className="min-w-0 pl-1" key={id}>
                  <h3 className="m-0 break-words text-sm font-semibold leading-5 text-ink">
                    {problem.title}
                  </h3>
                  <p className="m-0 mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-muted">
                    {problem.description || 'No description provided'}
                  </p>
                  {problem.constraints ? (
                    <p className="m-0 mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-muted">
                      <span className="font-medium text-ink">
                        Constraints:{' '}
                      </span>
                      {problem.constraints}
                    </p>
                  ) : null}
                  <p className="m-0 mt-1 min-w-0 break-all text-sm leading-5 text-muted">
                    <span className="font-medium text-ink">Problem link: </span>
                    {problem.leetcodeUrl ? (
                      <a
                        className="text-accent underline underline-offset-2 hover:text-accent-hover focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        href={problem.leetcodeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {problem.leetcodeUrl}
                      </a>
                    ) : (
                      'No Problem link provided'
                    )}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
