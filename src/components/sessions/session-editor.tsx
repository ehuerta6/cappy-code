'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  deleteSession,
  duplicateSession,
  transitionSession,
  updateSession,
  type ProblemCountState,
  type SessionRecord,
} from '@/lib/firebase/sessions';
import { validateSessionMetadata } from '@/lib/session-metadata';
import { formatCalendarDate } from '@/lib/calendar-date';
import OfficerProblems from '../problems/officer-problems';
import type { OfficerSaveState } from '@/components/officer-save-state';
import { isPermissionDenied } from '@/lib/firebase/errors';
import { listProblems } from '@/lib/firebase/problems';
import { getApproaches } from '@/lib/firebase/solutions';
import { problemPath } from '@/lib/firebase/paths';
import { getProblemReadiness } from '@/lib/preparation-readiness';
import { Badge, Button } from '@/components/ui/primitives';
import {
  sessionBranchLabels,
  sessionBranches,
  type SessionBranch,
} from '@/lib/domain';

const contextualButtonClass = 'ui-button ui-button--quiet text-sm';

export default function SessionEditor({
  record,
  onClose,
  onDuplicated,
}: {
  record: SessionRecord;
  onClose: () => void;
  onDuplicated: (id: string) => void;
}) {
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [problemBusy, setProblemBusy] = useState(false);
  const [contentSaveState, setContentSaveState] =
    useState<OfficerSaveState | null>(null);
  const [title, setTitle] = useState(record.session.title);
  const [date, setDate] = useState(record.session.date);
  const [branch, setBranch] = useState(record.session.branch);
  const [saved, setSaved] = useState({
    branch: record.session.branch,
    title: record.session.title,
    date: record.session.date,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [status, setStatus] = useState(record.session.status);
  const [problemCount, setProblemCount] = useState<ProblemCountState>(
    record.problemCount === null
      ? { status: 'unavailable' }
      : { status: 'ready', count: record.problemCount },
  );
  const [transitionPending, setTransitionPending] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<
    'live' | 'draft' | 'ended' | null
  >(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [readinessWarnings, setReadinessWarnings] = useState<string[] | null>(
    null,
  );
  const [readinessChecking, setReadinessChecking] = useState(false);
  const readinessDialog = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const dirty =
    branch !== saved.branch || title !== saved.title || date !== saved.date;
  const contentBusy =
    contentSaveState?.dirty === true || contentSaveState?.saving === true;
  const workspaceDirty = dirty || contentSaveState?.dirty === true;
  const workspaceSaving = saving || contentSaveState?.saving === true;

  useEffect(() => {
    if (!workspaceDirty) return;
    const workspaceUrl = window.location.href;
    const workspaceHistoryState = window.history.state;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const guardHistoryNavigation = () => {
      if (window.location.href === workspaceUrl) return;
      if (!window.confirm('Leave this Session and discard unsaved changes?')) {
        window.history.pushState(workspaceHistoryState, '', workspaceUrl);
      }
    };
    const guardNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (
        link.origin !== window.location.origin ||
        link.pathname === window.location.pathname
      )
        return;
      if (!window.confirm('Leave this Session and discard unsaved changes?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', guardHistoryNavigation);
    document.addEventListener('click', guardNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', guardHistoryNavigation);
      document.removeEventListener('click', guardNavigation, true);
    };
  }, [workspaceDirty]);

  async function saveWorkspace() {
    if (workspaceSaving) return;
    const outcomes = await Promise.all([
      dirty ? save() : Promise.resolve(true),
      contentSaveState?.dirty ? contentSaveState.save() : Promise.resolve(true),
    ]);
    return outcomes.every(Boolean);
  }

  useEffect(() => {
    if (!readinessWarnings) return;
    readinessDialog.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setReadinessWarnings(null);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [readinessWarnings]);

  function updateTitle(value: string) {
    setTitle(value);
    if (branch === saved.branch && value === saved.title && date === saved.date)
      setSaveError(null);
  }

  function updateDate(value: string) {
    setDate(value);
    if (
      branch === saved.branch &&
      title === saved.title &&
      value === saved.date
    )
      setSaveError(null);
  }

  function lifecycleActions() {
    if (status === 'draft') {
      const countKnown = problemCount.status === 'ready';
      const noProblems = countKnown && problemCount.count === 0;
      return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button
            variant="primary"
            onClick={() => void checkReadinessAndGoLive()}
            disabled={
              !countKnown ||
              noProblems ||
              dirty ||
              saving ||
              deleting ||
              transitionPending ||
              problemBusy ||
              readinessChecking
            }
          >
            {readinessChecking
              ? 'Checking…'
              : transitionTarget === 'live'
                ? 'Starting…'
                : 'Go Live'}
          </Button>
          {problemCount.status === 'loading' ? (
            <span className="text-sm text-muted">Checking Problems…</span>
          ) : problemCount.status === 'unavailable' ? (
            <span className="text-sm text-muted">
              Problem count unavailable. Open Manage problems to retry.
            </span>
          ) : noProblems ? (
            <span className="text-sm text-muted">
              Add a Problem before going live.
            </span>
          ) : null}
        </div>
      );
    }
    if (status === 'live') {
      return (
        <>
          <Button
            variant="quiet"
            className="text-sm text-muted hover:text-accent-hover hover:underline"
            onClick={() => void transition('draft')}
            disabled={
              dirty || saving || deleting || transitionPending || problemBusy
            }
          >
            {transitionTarget === 'draft' ? 'Updating…' : 'Not Live'}
          </Button>
          <Button
            variant="danger"
            className="text-sm"
            onClick={() => void transition('ended')}
            disabled={
              dirty || saving || deleting || transitionPending || problemBusy
            }
          >
            {transitionTarget === 'ended' ? 'Ending…' : 'End Session'}
          </Button>
        </>
      );
    }
    return null;
  }

  function saveStatus() {
    const failed = saveError || contentSaveState?.error;
    const isSaving = workspaceSaving;
    return (
      <div
        className="flex items-center gap-2 text-sm leading-5"
        role="status"
        aria-live="polite"
      >
        {failed ? (
          <span className="text-danger">Save failed — Retry</span>
        ) : isSaving ? (
          <span className="text-muted">Saving…</span>
        ) : workspaceDirty ? (
          <span className="text-muted">Unsaved changes</span>
        ) : (
          <span className="text-muted">Saved ✓</span>
        )}
      </div>
    );
  }

  async function transition(nextStatus: 'live' | 'draft' | 'ended') {
    if (
      busy.current ||
      dirty ||
      problemBusy ||
      (nextStatus === 'live' &&
        (problemCount.status !== 'ready' || problemCount.count === 0))
    )
      return;
    if (
      nextStatus === 'ended' &&
      !window.confirm(
        `End “${title}”? It will move to Past, and all prepared Python, Java, and C++ Solutions will become public regardless of each Problem's answer visibility.`,
      )
    ) {
      return;
    }
    busy.current = true;
    setTransitionPending(true);
    setTransitionTarget(nextStatus);
    setTransitionError(null);
    try {
      await transitionSession(record.id, nextStatus);
      setStatus(nextStatus);
    } catch (error) {
      setTransitionError(
        error instanceof Error &&
          /^Another (Intro|General|ICPC) Session is already live\./.test(
            error.message,
          )
          ? error.message
          : isPermissionDenied(error)
            ? 'Permission denied. Sign in to Officer Mode and retry the status change.'
            : 'Session status could not be changed. Check your connection and try again.',
      );
    } finally {
      busy.current = false;
      setTransitionPending(false);
      setTransitionTarget(null);
    }
  }

  async function checkReadinessAndGoLive() {
    if (
      busy.current ||
      dirty ||
      problemBusy ||
      problemCount.status !== 'ready' ||
      problemCount.count === 0
    )
      return;
    setReadinessChecking(true);
    setTransitionError(null);
    try {
      const problems = await listProblems(record.id);
      const readiness = await Promise.all(
        problems.map(async ({ id, problem }) => {
          const approaches = await getApproaches(problemPath(record.id, id));
          return {
            title: problem.title,
            warnings: getProblemReadiness(problem, approaches).warnings,
          };
        }),
      );
      const warnings = readiness.flatMap(
        ({ title: problemTitle, warnings: items }) =>
          items.map((warning) => `${problemTitle}: ${warning}`),
      );
      if (warnings.length) {
        setReadinessWarnings(warnings);
        return;
      }
      setReadinessChecking(false);
      await transition('live');
    } catch {
      setReadinessWarnings([
        'Readiness could not be checked because Problem content could not be loaded.',
      ]);
    } finally {
      setReadinessChecking(false);
    }
  }

  async function continueGoLive() {
    setReadinessWarnings(null);
    await transition('live');
  }

  async function save(): Promise<boolean> {
    if (!dirty) return true;
    if (busy.current) return false;
    let metadata;
    try {
      metadata = validateSessionMetadata({ branch, title, date });
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Check the title and date.',
      );
      return false;
    }
    if (
      metadata.branch === saved.branch &&
      metadata.title === saved.title &&
      metadata.date === saved.date
    ) {
      setBranch(metadata.branch);
      setTitle(metadata.title);
      setDate(metadata.date);
      setSaveError(null);
      return true;
    }
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await updateSession(record.id, metadata);
      setBranch(metadata.branch);
      setTitle(metadata.title);
      setSaved(metadata);
      return true;
    } catch (error) {
      setSaveError(
        isPermissionDenied(error)
          ? 'Permission denied. Your edits are still here; sign in to Officer Mode and retry.'
          : 'Save failed. Your edits are still here. Check your connection and retry.',
      );
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function remove() {
    if (
      busy.current ||
      !window.confirm(
        `Delete “${title}”? This permanently removes the session, its problems, and all prepared solutions.`,
      )
    )
      return;
    busy.current = true;
    setDeleting(true);
    setDeleteError(false);
    try {
      await deleteSession(record.id);
      onClose();
    } catch {
      setDeleteError(true);
    } finally {
      busy.current = false;
      setDeleting(false);
    }
  }

  async function duplicate() {
    if (
      busy.current ||
      dirty ||
      contentBusy ||
      problemBusy ||
      duplicating ||
      deleting ||
      saving
    )
      return;
    busy.current = true;
    setDuplicating(true);
    setDuplicateError(null);
    try {
      onDuplicated(await duplicateSession(record.id));
    } catch (error) {
      setDuplicateError(
        error instanceof Error
          ? error.message
          : 'Session could not be duplicated. Check your connection and try again.',
      );
    } finally {
      busy.current = false;
      setDuplicating(false);
    }
  }

  if (problemsOpen)
    return (
      <section
        className="w-full max-w-[1440px] text-base leading-relaxed"
        aria-label="Officer session workspace"
      >
        <Button
          variant="quiet"
          className={`${contextualButtonClass} mb-3`}
          disabled={problemBusy || contentBusy}
          aria-describedby={
            contentBusy ? 'session-content-save-guard' : undefined
          }
          onClick={() => setProblemsOpen(false)}
        >
          Back to session
        </Button>
        {contentBusy && (
          <p
            id="session-content-save-guard"
            className="mb-3 text-sm text-muted"
            role="status"
          >
            Save or revert Problem and Solution edits before returning to this
            Session.
          </p>
        )}
        <div className="mb-6 flex items-start justify-between gap-4 max-sm:mb-5 max-sm:flex-col">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="m-0 text-[28px] font-semibold leading-9 tracking-tight">
                {title}
              </h1>
              <Badge
                tone={
                  status === 'live'
                    ? 'success'
                    : status === 'draft'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {status}
              </Badge>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm leading-5 text-muted">
              CIC {sessionBranchLabels[branch]} Session{' '}
              <span aria-hidden="true">•</span>{' '}
              <time dateTime={date}>{formatCalendarDate(date)}</time>
            </p>
          </div>
          <div
            className="flex flex-wrap items-center justify-start gap-2"
            role="group"
            aria-label="Session actions"
          >
            {saveStatus()}
            <Button
              variant="primary"
              disabled={
                !workspaceDirty ||
                workspaceSaving ||
                deleting ||
                transitionPending
              }
              onClick={() => void saveWorkspace()}
            >
              {workspaceSaving
                ? 'Saving…'
                : saveError || contentSaveState?.error
                  ? 'Retry save'
                  : 'Save changes'}
            </Button>
            {(status === 'live' || status === 'ended') && (
              <Link
                className="ui-button ui-button--quiet text-sm"
                href={`/sessions/${encodeURIComponent(record.id)}`}
              >
                View as Member
              </Link>
            )}
            {lifecycleActions()}
          </div>
        </div>
        {transitionError && (
          <p className="text-danger" role="alert">
            {transitionError}
          </p>
        )}
        {readinessWarnings && (
          <div
            className="my-4 rounded-md border border-warning/50 bg-surface p-4"
            role="group"
            aria-labelledby="readiness-warning-heading"
            tabIndex={-1}
            ref={readinessDialog}
          >
            <h2
              className="m-0 text-base font-semibold"
              id="readiness-warning-heading"
            >
              Preparation warnings
            </h2>
            <p className="my-2">
              Some Problems are incomplete. Review the warnings, or continue to
              Go Live anyway.
            </p>
            <ul className="my-2 list-disc pl-5">
              {readinessWarnings.map((warning, index) => (
                <li key={`${index}-${warning}`}>{warning}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="quiet"
                className="text-sm text-muted"
                autoFocus
                onClick={() => setReadinessWarnings(null)}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void continueGoLive()}>
                Go Live Anyway
              </Button>
            </div>
          </div>
        )}
        <OfficerProblems
          sessionId={record.id}
          sessionStatus={status}
          onBusyChange={setProblemBusy}
          onSaveStateChange={setContentSaveState}
          onProblemCountStateChange={setProblemCount}
        />
      </section>
    );

  return (
    <section
      className="w-full max-w-[1440px] text-base leading-relaxed"
      aria-label="Session metadata"
    >
      <Button
        variant="quiet"
        className={`${contextualButtonClass} mb-3`}
        onClick={onClose}
        disabled={dirty || saving || deleting || transitionPending}
      >
        Back to Sessions
      </Button>
      <div className="mb-6 flex items-start justify-between gap-4 max-sm:mb-5 max-sm:flex-col">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-[28px] font-semibold leading-9 tracking-tight">
              {title}
            </h1>
            <Badge
              tone={
                status === 'live'
                  ? 'success'
                  : status === 'draft'
                    ? 'warning'
                    : 'neutral'
              }
            >
              {status}
            </Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm leading-5 text-muted">
            CIC {sessionBranchLabels[branch]} Session{' '}
            <span aria-hidden="true">•</span>{' '}
            <time dateTime={date}>{formatCalendarDate(date)}</time>
          </p>
        </div>
        <div
          className="flex flex-wrap items-center justify-start gap-2"
          role="group"
          aria-label="Session actions"
        >
          {saveStatus()}
          <Button
            variant="primary"
            disabled={
              !workspaceDirty ||
              workspaceSaving ||
              deleting ||
              transitionPending
            }
            onClick={() => void saveWorkspace()}
          >
            {workspaceSaving
              ? 'Saving…'
              : saveError || contentSaveState?.error
                ? 'Retry save'
                : 'Save changes'}
          </Button>
          {(status === 'live' || status === 'ended') && (
            <Link
              className="ui-button ui-button--quiet text-sm"
              href={`/sessions/${encodeURIComponent(record.id)}`}
            >
              View as Member
            </Link>
          )}
          {lifecycleActions()}
        </div>
      </div>
      {saveError && (
        <div role="alert">
          <p>{saveError}</p>
        </div>
      )}
      {dirty && (
        <p className="text-sm text-muted">
          Save or revert changes before leaving this Session.
        </p>
      )}
      {transitionError && (
        <p className="text-danger" role="alert">
          {transitionError}
        </p>
      )}
      {readinessWarnings && (
        <div
          className="my-4 rounded-md border border-warning/50 bg-surface p-4"
          role="group"
          aria-labelledby="readiness-warning-heading"
          tabIndex={-1}
          ref={readinessDialog}
        >
          <h2
            className="m-0 text-base font-semibold"
            id="readiness-warning-heading"
          >
            Preparation warnings
          </h2>
          <p className="my-2">
            Some Problems are incomplete. Review the warnings, or continue to Go
            Live anyway.
          </p>
          <ul className="my-2 list-disc pl-5">
            {readinessWarnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="quiet"
              className="text-sm text-muted"
              autoFocus
              onClick={() => setReadinessWarnings(null)}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void continueGoLive()}>
              Go Live Anyway
            </Button>
          </div>
        </div>
      )}
      <label className="my-5 flex max-w-3xl flex-col gap-2">
        Session branch
        <select
          className="ui-field"
          aria-label="Session branch"
          value={branch}
          onChange={(event) => {
            setBranch(event.target.value as SessionBranch);
            if (
              title === saved.title &&
              date === saved.date &&
              event.target.value === saved.branch
            ) {
              setSaveError(null);
            }
          }}
          disabled={
            status === 'live' || saving || deleting || transitionPending
          }
        >
          {sessionBranches.map((option) => (
            <option key={option} value={option}>
              {sessionBranchLabels[option]}
            </option>
          ))}
        </select>
        {status === 'live' ? (
          <span className="text-sm text-muted">
            Set this Session to Not Live before changing its branch.
          </span>
        ) : null}
      </label>
      <label className="my-5 flex max-w-3xl flex-col gap-2">
        Session title
        <input
          className="ui-field"
          value={title}
          onChange={(event) => updateTitle(event.target.value)}
          disabled={saving || deleting || transitionPending}
          required
        />
      </label>
      <label className="my-5 flex max-w-3xl flex-col gap-2">
        Session date
        <input
          className="ui-field"
          type="date"
          value={date}
          onChange={(event) => updateDate(event.target.value)}
          disabled={saving || deleting || transitionPending}
          required
        />
      </label>
      <Button
        variant="primary"
        disabled={saving || deleting || transitionPending}
        onClick={() => setProblemsOpen(true)}
      >
        Manage problems
      </Button>
      <Button
        variant="quiet"
        className={`${contextualButtonClass} ml-2`}
        onClick={() => void duplicate()}
        aria-describedby={
          contentBusy ? 'session-content-save-guard' : undefined
        }
        disabled={
          dirty ||
          contentBusy ||
          problemBusy ||
          saving ||
          deleting ||
          duplicating ||
          transitionPending
        }
      >
        {duplicating ? 'Duplicating…' : 'Duplicate session'}
      </Button>
      {contentBusy && (
        <p
          id="session-content-save-guard"
          className="mt-3 text-sm text-muted"
          role="status"
        >
          Save or revert Problem and Solution edits before duplicating this
          Session.
        </p>
      )}
      <Button
        variant="danger"
        className="ml-2 text-sm"
        onClick={() => void remove()}
        disabled={saving || deleting || transitionPending || dirty}
      >
        {deleting ? 'Deleting…' : 'Delete session'}
      </Button>
      {deleteError && (
        <p role="alert">
          Session could not be deleted. Check your connection and try Delete
          session again.
        </p>
      )}
      {duplicateError && (
        <p role="alert" className="mt-3 text-danger">
          {duplicateError}
        </p>
      )}
    </section>
  );
}
