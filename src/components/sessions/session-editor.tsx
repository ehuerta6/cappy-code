'use client';

import { useRef, useState } from 'react';
import {
  deleteSession,
  transitionSession,
  updateSession,
  type SessionRecord,
} from '@/lib/firebase/sessions';
import { validateSessionMetadata } from '@/lib/session-metadata';
import styles from './sessions.module.css';
import OfficerProblems from '../problems/officer-problems';

export default function SessionEditor({
  record,
  onClose,
}: {
  record: SessionRecord;
  onClose: () => void;
}) {
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [problemBusy, setProblemBusy] = useState(false);
  const [title, setTitle] = useState(record.session.title);
  const [date, setDate] = useState(record.session.date);
  const [saved, setSaved] = useState({
    title: record.session.title,
    date: record.session.date,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [status, setStatus] = useState(record.session.status);
  const [problemCount, setProblemCount] = useState(record.problemCount);
  const [transitionPending, setTransitionPending] = useState(false);
  const [transitionError, setTransitionError] = useState(false);
  const busy = useRef(false);
  const dirty = title !== saved.title || date !== saved.date;

  function lifecycleActions() {
    if (status === 'draft') {
      return (
        <div className={styles.lifecycle}>
          <button
            className={styles.primaryButton}
            onClick={() => void transition('live')}
            disabled={
              problemCount === 0 ||
              dirty ||
              saving ||
              deleting ||
              transitionPending
            }
          >
            {transitionPending ? 'Starting…' : 'Go Live'}
          </button>
          {problemCount === 0 ? (
            <span className={styles.reason}>
              Add a Problem before going live.
            </span>
          ) : null}
        </div>
      );
    }
    if (status === 'live') {
      return (
        <button
          className={styles.button}
          onClick={() => void transition('ended')}
          disabled={dirty || saving || deleting || transitionPending}
        >
          {transitionPending ? 'Ending…' : 'End Session'}
        </button>
      );
    }
    return null;
  }

  function saveStatus() {
    return (
      <p className={styles.saveStatus} role="status">
        {saving
          ? 'Saving…'
          : saveError
            ? 'Save failed'
            : dirty
              ? 'Unsaved changes — leave a field to save'
              : 'Saved ✓'}
      </p>
    );
  }

  async function transition(nextStatus: 'live' | 'ended') {
    if (busy.current || dirty) return;
    if (
      nextStatus === 'ended' &&
      !window.confirm(
        `End “${title}”? Members can still access this session according to its publication and answer visibility settings.`,
      )
    ) {
      return;
    }
    busy.current = true;
    setTransitionPending(true);
    setTransitionError(false);
    try {
      await transitionSession(record.id, nextStatus);
      setStatus(nextStatus);
    } catch {
      setTransitionError(true);
    } finally {
      busy.current = false;
      setTransitionPending(false);
    }
  }

  async function save() {
    if (!dirty || busy.current) return;
    let metadata;
    try {
      metadata = validateSessionMetadata({ title, date });
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Check the title and date.',
      );
      return;
    }
    busy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await updateSession(record.id, metadata);
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
      <section className={styles.editor} aria-label="Officer session workspace">
        <button
          className={styles.button}
          disabled={problemBusy}
          onClick={() => setProblemsOpen(false)}
        >
          Back to session
        </button>
        <div className={styles.workspaceHeader}>
          <div>
            <h1>{title}</h1>
            <p className={styles.sessionContext}>
              CIC Intro Session <span aria-hidden="true">•</span>{' '}
              <time dateTime={date}>{formatDate(date)}</time>
            </p>
          </div>
          <div className={styles.workspaceActions}>
            <span className={`${styles.status} ${styles[status]}`}>
              {status}
            </span>
            {saveStatus()}
            {lifecycleActions()}
          </div>
        </div>
        {transitionError && (
          <p className={styles.error} role="alert">
            Session status could not be changed. Check your connection and try
            again.
          </p>
        )}
        <OfficerProblems
          sessionId={record.id}
          sessionStatus={status}
          onBusyChange={setProblemBusy}
          onProblemCountChange={setProblemCount}
        />
      </section>
    );

  return (
    <section className={styles.editor} aria-label="Session metadata">
      <button
        className={styles.button}
        onClick={onClose}
        disabled={dirty || saving || deleting || transitionPending}
      >
        Back to Sessions
      </button>
      <div className={styles.workspaceHeader}>
        <div>
          <h1>{record.session.title}</h1>
          <p className={styles.sessionContext}>
            CIC Intro Session <span aria-hidden="true">•</span>{' '}
            <time dateTime={date}>{formatDate(date)}</time>
          </p>
        </div>
        <div className={styles.workspaceActions}>
          <span className={`${styles.status} ${styles[status]}`}>{status}</span>
          {saveStatus()}
          {lifecycleActions()}
        </div>
      </div>
      {saveError && (
        <div role="alert">
          <p>{saveError}</p>
          <button
            className={styles.button}
            onClick={() => void save()}
            disabled={saving || deleting || transitionPending}
          >
            Retry save
          </button>
        </div>
      )}
      {transitionError && (
        <p className={styles.error} role="alert">
          Session status could not be changed. Check your connection and try
          again.
        </p>
      )}
      <label className={styles.field}>
        Session title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void save()}
          disabled={saving || deleting || transitionPending}
          required
        />
      </label>
      <label className={styles.field}>
        Session date
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          onBlur={() => void save()}
          disabled={saving || deleting || transitionPending}
          required
        />
      </label>
      <p>
        Title and date save when you leave a field. Finish saving before
        returning to Sessions.
      </p>
      <button
        className={styles.button}
        disabled={dirty || saving || deleting || transitionPending}
        onClick={() => setProblemsOpen(true)}
      >
        Manage problems
      </button>
      <button
        className={styles.button}
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
