'use client';

import { useRef, useState } from 'react';
import {
  updateProblem,
  validateProblemContent,
  type ProblemContent,
  type ProblemRecord,
} from '@/lib/firebase/problems';
import styles from './problems.module.css';

export default function ProblemEditor({
  sessionId,
  record,
  onSaved,
  onBusyChange,
  disabled,
}: {
  sessionId: string;
  record: ProblemRecord;
  onSaved: (content: ProblemContent) => void;
  onBusyChange: (busy: boolean) => void;
  disabled: boolean;
}) {
  const [content, setContent] = useState<ProblemContent>(() =>
    validateProblemContent(record.problem),
  );
  const [saved, setSaved] = useState(content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const dirty = Object.keys(content).some(
    (key) =>
      content[key as keyof ProblemContent] !==
      saved[key as keyof ProblemContent],
  );

  function edit(field: keyof ProblemContent, value: string) {
    const next = { ...content, [field]: value };
    setContent(next);
    setError(null);
    onBusyChange(
      Object.keys(next).some(
        (key) =>
          next[key as keyof ProblemContent] !==
          saved[key as keyof ProblemContent],
      ),
    );
  }
  async function save() {
    if (!dirty || busy.current) return;
    let fields;
    try {
      fields = validateProblemContent(content);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Check problem content.',
      );
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    onBusyChange(true);
    try {
      await updateProblem(sessionId, record.id, fields);
      setContent(fields);
      setSaved(fields);
      onSaved(fields);
      onBusyChange(false);
    } catch {
      setError(
        'Save failed. Your edits are still here. Check your connection and retry.',
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <div
      role="tabpanel"
      id={`problem-panel-${record.id}`}
      aria-labelledby={`problem-tab-${record.id}`}
    >
      <p role="status">
        {saving
          ? 'Saving problem…'
          : error
            ? 'Problem save failed'
            : dirty
              ? 'Unsaved problem changes — leave a field to save'
              : 'Problem saved ✓'}
      </p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className={styles.button}
            onClick={() => void save()}
            disabled={saving || disabled}
          >
            Retry problem save
          </button>
        </div>
      )}
      <label className={`${styles.field} ${styles.titleField}`}>
        Problem title
        <input
          id="problem-title"
          value={content.title}
          onChange={(event) => edit('title', event.target.value)}
          onBlur={() => void save()}
          disabled={saving || disabled}
          required
        />
      </label>
      <label className={styles.field}>
        Description
        <textarea
          rows={5}
          value={content.description}
          onChange={(event) => edit('description', event.target.value)}
          onBlur={() => void save()}
          disabled={saving || disabled}
        />
      </label>
      <section
        className={styles.examples}
        aria-labelledby="officer-examples-heading"
      >
        <h3 id="officer-examples-heading">Examples</h3>
        <div className={styles.examplesGrid}>
          <label className={styles.field}>
            Example input
            <textarea
              rows={3}
              value={content.exampleInput}
              onChange={(event) => edit('exampleInput', event.target.value)}
              onBlur={() => void save()}
              disabled={saving || disabled}
            />
          </label>
          <label className={styles.field}>
            Example output
            <textarea
              rows={3}
              value={content.exampleOutput}
              onChange={(event) => edit('exampleOutput', event.target.value)}
              onBlur={() => void save()}
              disabled={saving || disabled}
            />
          </label>
        </div>
      </section>
      <p>
        Problem fields save when you leave a field. Finish saving before
        switching problems or returning to the session.
      </p>
    </div>
  );
}
