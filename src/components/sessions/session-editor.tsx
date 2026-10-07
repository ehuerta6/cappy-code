'use client';

import { useRef, useState } from 'react';
import {
  deleteSession,
  transitionSession,
  updateSession,
  type ProblemCountState,
  type SessionRecord,
} from '@/lib/firebase/sessions';
import { validateSessionMetadata } from '@/lib/session-metadata';
import OfficerProblems from '../problems/officer-problems';
import type { OfficerSaveState } from '@/components/officer-save-state';
import {
  sessionBranchLabels,
  sessionBranches,
  type SessionBranch,
} from '@/lib/domain';

const contextualButtonClass =
  'min-h-10 rounded px-2 py-2 text-sm text-muted underline-offset-4 hover:bg-hover hover:text-accent-hover hover:underline disabled:cursor-default disabled:text-muted';
const primaryButtonClass =
  'min-h-11 rounded border border-accent bg-accent px-3 py-2 font-semibold text-accent-contrast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-default disabled:border-border-strong disabled:bg-raised disabled:text-muted';
const statusTone = {
  draft: 'border-warning/50 text-warning',
  live: 'border-success/50 bg-success-surface text-success',
  ended: 'border-border-soft text-muted',
};

export default function SessionEditor({
  record,
  onClose,
}: {
  record: SessionRecord;
  onClose: () => void;
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
  const busy = useRef(false);
  const dirty =
    branch !== saved.branch || title !== saved.title || date !== saved.date;

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
          <button
            className={primaryButtonClass}
            onClick={() => void transition('live')}
            disabled={
              !countKnown ||
              noProblems ||
              dirty ||
              saving ||
              deleting ||
              transitionPending ||
              problemBusy
            }
          >
            {transitionTarget === 'live' ? 'Starting…' : 'Go Live'}
          </button>
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
          <button
            className={contextualButtonClass}
            onClick={() => void transition('draft')}
            disabled={
              dirty || saving || deleting || transitionPending || problemBusy
            }
          >
            {transitionTarget === 'draft' ? 'Updating…' : 'Not Live'}
          </button>
          <button
            className="min-h-10 rounded-md border border-danger/50 px-3 py-2 text-sm text-danger hover:bg-danger-surface disabled:cursor-default disabled:border-border-soft disabled:text-muted"
            onClick={() => void transition('ended')}
            disabled={
              dirty || saving || deleting || transitionPending || problemBusy
            }
          >
            {transitionTarget === 'ended' ? 'Ending…' : 'End Session'}
          </button>
        </>
      );
    }
    return null;
  }

  function saveStatus() {
    const failed = saveError || contentSaveState?.error;
    const isSaving = saving || contentSaveState?.saving;
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
        ) : dirty || contentSaveState?.dirty ? (
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
          error.message.startsWith('Another Session is already live.')
          ? error.message
          : 'Session status could not be changed. Check your connection and try again.',
      );
    } finally {
      busy.current = false;
      setTransitionPending(false);
      setTransitionTarget(null);
    }
  }

  async function save() {
    if (!dirty || busy.current) return;
    let metadata;
    try {
      metadata = validateSessionMetadata({ branch, title, date });
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Check the title and date.',
      );
      return;
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
      return;
    }
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await updateSession(record.id, metadata);
      setBranch(metadata.branch);
      setTitle(metadata.title);
      setSaved(metadata);
    } catch {
      setSaveError(
        'Save failed. Your edits are still here. Check your connection and retry.',
      );
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

  if (problemsOpen)
    return (
      <section
        className="w-full max-w-[1440px] text-base leading-relaxed"
        aria-label="Officer session workspace"
      >
        <button
          className={`${contextualButtonClass} mb-3`}
          disabled={problemBusy}
          onClick={() => setProblemsOpen(false)}
        >
          Back to session
        </button>
        <div className="mb-6 flex items-start justify-between gap-4 max-sm:mb-5 max-sm:flex-col">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="m-0 text-[28px] font-semibold leading-9 tracking-tight">
                {title}
              </h1>
              <span
                className={`inline-flex min-h-7 items-center rounded-md border px-2.5 py-0.5 text-sm font-semibold capitalize leading-5 ${statusTone[status]}`}
              >
                {status}
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm leading-5 text-muted">
              CIC {sessionBranchLabels[branch]} Session{' '}
              <span aria-hidden="true">•</span>{' '}
              <time dateTime={date}>{formatDate(date)}</time>
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-2">
            {saveStatus()}
            {lifecycleActions()}
          </div>
        </div>
        {transitionError && (
          <p className="text-danger" role="alert">
            {transitionError}
          </p>
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
      <button
        className={`${contextualButtonClass} mb-3`}
        onClick={onClose}
        disabled={dirty || saving || deleting || transitionPending}
      >
        Back to Sessions
      </button>
      <div className="mb-6 flex items-start justify-between gap-4 max-sm:mb-5 max-sm:flex-col">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-[28px] font-semibold leading-9 tracking-tight">
              {title}
            </h1>
            <span
              className={`inline-flex min-h-7 items-center rounded-md border px-2.5 py-0.5 text-sm font-semibold capitalize leading-5 ${statusTone[status]}`}
            >
              {status}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm leading-5 text-muted">
            CIC {sessionBranchLabels[branch]} Session{' '}
            <span aria-hidden="true">•</span>{' '}
            <time dateTime={date}>{formatDate(date)}</time>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-x-3 gap-y-2">
          {saveStatus()}
          <button
            className={primaryButtonClass}
            disabled={!dirty || saving || deleting || transitionPending}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : saveError ? 'Retry' : 'Save changes'}
          </button>
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
      <label className="my-5 flex max-w-3xl flex-col gap-2">
        Session branch
        <select
          className="min-h-11 w-full rounded border border-border-strong bg-surface px-3 py-2 text-ink"
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
          disabled={saving || deleting || transitionPending}
        >
          {sessionBranches.map((option) => (
            <option key={option} value={option}>
              {sessionBranchLabels[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="my-5 flex max-w-3xl flex-col gap-2">
        Session title
        <input
          className="min-h-11 w-full rounded border border-border-strong bg-surface px-3 py-2 text-ink"
          value={title}
          onChange={(event) => updateTitle(event.target.value)}
          disabled={saving || deleting || transitionPending}
          required
        />
      </label>
      <label className="my-5 flex max-w-3xl flex-col gap-2">
        Session date
        <input
          className="min-h-11 w-full rounded border border-border-strong bg-surface px-3 py-2 text-ink"
          type="date"
          value={date}
          onChange={(event) => updateDate(event.target.value)}
          disabled={saving || deleting || transitionPending}
          required
        />
      </label>
      <button
        className={primaryButtonClass}
        disabled={dirty || saving || deleting || transitionPending}
        onClick={() => setProblemsOpen(true)}
      >
        Manage problems
      </button>
      <button
        className="ml-2 min-h-11 rounded px-3 py-2 text-sm text-danger hover:bg-danger-surface disabled:cursor-default disabled:text-muted"
        onClick={() => void remove()}
        disabled={saving || deleting || transitionPending || dirty}
      >
        {deleting ? 'Deleting…' : 'Delete session'}
      </button>
      {deleteError && (
        <p role="alert">
          Session could not be deleted. Check your connection and try Delete
          session again.
        </p>
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
