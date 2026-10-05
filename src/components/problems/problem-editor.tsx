'use client';

import { useRef, useState } from 'react';
import {
  updateProblem,
  validateProblemContent,
  type ProblemContent,
  type ProblemRecord,
} from '@/lib/firebase/problems';

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
      <p className="text-sm text-muted" role="status">
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
            className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 hover:bg-hover disabled:cursor-default disabled:bg-raised disabled:text-muted"
            onClick={() => void save()}
            disabled={saving || disabled}
          >
            Retry problem save
          </button>
        </div>
      )}
      <label className="my-5 flex max-w-3xl flex-col gap-2">
        Problem title
        <input
          className="min-h-11 w-full rounded border border-border-strong bg-surface px-3 py-2 text-2xl font-semibold leading-8 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
          id="problem-title"
          value={content.title}
          onChange={(event) => edit('title', event.target.value)}
          onBlur={() => void save()}
          disabled={saving || disabled}
          required
        />
      </label>
      <label className="my-5 flex max-w-3xl flex-col gap-2">
        Description
        <textarea
          className="min-h-[100px] w-full resize-y rounded border border-border-strong bg-surface px-3 py-2 leading-6 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
          rows={5}
          value={content.description}
          onChange={(event) => edit('description', event.target.value)}
          onBlur={() => void save()}
          disabled={saving || disabled}
        />
      </label>
      <section className="my-6" aria-labelledby="officer-examples-heading">
        <h3
          className="mb-0 mt-0 text-base font-semibold leading-6"
          id="officer-examples-heading"
        >
          Examples
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="my-3 flex flex-col gap-2">
            Example input
            <textarea
              className="min-h-[76px] w-full resize-y rounded border border-border-strong bg-surface px-3 py-2 font-mono text-[15px] leading-6 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
              rows={3}
              value={content.exampleInput}
              onChange={(event) => edit('exampleInput', event.target.value)}
              onBlur={() => void save()}
              disabled={saving || disabled}
            />
          </label>
          <label className="my-3 flex flex-col gap-2">
            Example output
            <textarea
              className="min-h-[76px] w-full resize-y rounded border border-border-strong bg-surface px-3 py-2 font-mono text-[15px] leading-6 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
              rows={3}
              value={content.exampleOutput}
              onChange={(event) => edit('exampleOutput', event.target.value)}
              onBlur={() => void save()}
              disabled={saving || disabled}
            />
          </label>
        </div>
      </section>
      <p className="text-sm text-muted">
        Problem fields save when you leave a field. Finish saving before
        switching problems or returning to the session.
      </p>
    </div>
  );
}
