'use client';

import { useRef, useState } from 'react';
import {
  deleteSession,
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
  const busy = useRef(false);
  const dirty = title !== saved.title || date !== saved.date;

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
        <h1>{title}</h1>
        <p className={styles.status}>{record.session.status}</p>
        <OfficerProblems sessionId={record.id} onBusyChange={setProblemBusy} />
      </section>
    );

  return (
    <section className={styles.editor} aria-label="Session metadata">
      <button
        className={styles.button}
        onClick={onClose}
        disabled={dirty || saving || deleting}
      >
        Back to Sessions
      </button>
      <h2>{record.session.title}</h2>
      <p className={styles.status}>{record.session.status}</p>
      <p role="status">
        {saving
          ? 'Saving…'
          : saveError
            ? 'Save failed'
            : dirty
              ? 'Unsaved changes — leave a field to save'
              : 'Saved ✓'}
      </p>
      {saveError && (
        <div role="alert">
          <p>{saveError}</p>
          <button
            className={styles.button}
            onClick={() => void save()}
            disabled={saving || deleting}
          >
            Retry save
          </button>
        </div>
      )}
      <label className={styles.field}>
        Session title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => void save()}
          disabled={saving || deleting}
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
          disabled={saving || deleting}
          required
        />
      </label>
      <p>
        Title and date save when you leave a field. Finish saving before
        returning to Sessions.
      </p>
      <button
        className={styles.button}
        disabled={dirty || saving || deleting}
        onClick={() => setProblemsOpen(true)}
      >
        Manage problems
      </button>
      <button
        className={styles.button}
        onClick={() => void remove()}
        disabled={saving || deleting || dirty}
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
