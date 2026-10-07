'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  updateProblem,
  validateProblemContent,
  type ProblemContent,
  type ProblemRecord,
} from '@/lib/firebase/problems';
import type { SaveStateReporter } from '@/components/officer-save-state';
import type { ProblemCategory } from '@/lib/domain';

export default function ProblemEditor({
  sessionId,
  record,
  onSaved,
  onBusyChange,
  onSaveStateChange,
  disabled,
}: {
  sessionId: string;
  record: ProblemRecord;
  onSaved: (content: ProblemContent) => void;
  onBusyChange: (busy: boolean) => void;
  onSaveStateChange: SaveStateReporter;
  disabled: boolean;
}) {
  const [content, setContent] = useState<ProblemContent>(() =>
    validateProblemContent(record.problem),
  );
  const [saved, setSaved] = useState(content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
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
    setFieldError(null);
  }
  const save = useCallback(async () => {
    if (!dirty || busy.current) return;
    let fields;
    try {
      fields = validateProblemContent(content);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Check problem content.';
      setError(message);
      setFieldError(message.includes('LeetCode') ? message : null);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const updates = Object.fromEntries(
        (Object.keys(fields) as Array<keyof ProblemContent>)
          .filter((field) => fields[field] !== saved[field])
          .map((field) => [field, fields[field]]),
      ) as Partial<ProblemContent>;
      if (Object.keys(updates).length === 0) {
        setContent(fields);
        setSaved(fields);
        onSaved(fields);
        return;
      }
      await updateProblem(sessionId, record.id, updates);
      setContent(fields);
      setSaved(fields);
      onSaved(fields);
    } catch {
      setError(
        'Save failed. Your edits are still here. Check your connection and retry.',
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, [dirty, content, onSaved, record.id, sessionId]);

  useEffect(() => {
    const isDirty = dirty || Boolean(error);
    onBusyChange(isDirty || saving);
    onSaveStateChange(
      isDirty || saving
        ? {
            dirty: isDirty,
            saving,
            error: error ?? undefined,
            save,
          }
        : null,
    );
  }, [dirty, error, onBusyChange, onSaveStateChange, save, saving]);
  return (
    <div
      role="tabpanel"
      id={`problem-panel-${record.id}`}
      aria-labelledby={`problem-tab-${record.id}`}
    >
      <label className="my-5 flex max-w-3xl flex-col gap-2">
        Problem title
        <input
          className="min-h-11 w-full rounded border border-border-strong bg-surface px-3 py-2 text-2xl font-semibold leading-8 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
          id="problem-title"
          value={content.title}
          onChange={(event) => edit('title', event.target.value)}
          disabled={saving || disabled}
          required
        />
      </label>
      <label className="my-5 flex max-w-xs flex-col gap-2">
        Problem category
        <select
          className="min-h-11 w-full rounded border border-border-strong bg-surface px-3 py-2 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
          value={content.category}
          onChange={(event) =>
            edit('category', event.target.value as ProblemCategory)
          }
          disabled={saving || disabled}
        >
          <option value="custom">Custom</option>
          <option value="interview-style">Interview-style</option>
          <option value="competitive-programming">
            Competitive Programming
          </option>
        </select>
      </label>
      <label className="my-5 flex max-w-xs flex-col gap-2">
        Difficulty
        <select
          className="min-h-11 w-full rounded border border-border-strong bg-surface px-3 py-2 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
          value={content.difficulty}
          onChange={(event) => edit('difficulty', event.target.value)}
          disabled={saving || disabled}
        >
          <option value="">Not set</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label className="my-5 flex max-w-3xl flex-col gap-2">
        <span>
          Description{' '}
          <span aria-hidden="true" className="text-sm font-normal text-muted">
            (Markdown supported)
          </span>
        </span>
        <textarea
          aria-label="Description"
          className="min-h-[100px] w-full resize-y rounded border border-border-strong bg-surface px-3 py-2 leading-6 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
          rows={5}
          value={content.description}
          onChange={(event) => edit('description', event.target.value)}
          disabled={saving || disabled}
        />
      </label>
      <label className="my-5 flex max-w-3xl flex-col gap-2">
        Constraints
        <textarea
          className="min-h-[76px] w-full resize-y rounded border border-border-strong bg-surface px-3 py-2 leading-6 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
          rows={3}
          value={content.constraints}
          onChange={(event) => edit('constraints', event.target.value)}
          disabled={saving || disabled}
        />
      </label>
      <label className="my-5 flex max-w-3xl flex-col gap-2">
        LeetCode link (optional)
        <input
          className="min-h-11 w-full min-w-0 rounded border border-border-strong bg-surface px-3 py-2 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
          type="url"
          inputMode="url"
          placeholder="https://leetcode.com/problems/two-sum/"
          value={content.leetcodeUrl}
          onChange={(event) => edit('leetcodeUrl', event.target.value)}
          disabled={saving || disabled}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? 'leetcode-url-error' : undefined}
        />
        {fieldError ? (
          <span className="text-sm text-danger" id="leetcode-url-error">
            {fieldError}
          </span>
        ) : null}
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
            <span>
              Example input{' '}
              <span
                aria-hidden="true"
                className="text-sm font-normal text-muted"
              >
                (Markdown supported)
              </span>
            </span>
            <textarea
              aria-label="Example input"
              className="min-h-[76px] w-full resize-y rounded border border-border-strong bg-surface px-3 py-2 font-mono text-[15px] leading-6 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
              rows={3}
              value={content.exampleInput}
              onChange={(event) => edit('exampleInput', event.target.value)}
              disabled={saving || disabled}
            />
          </label>
          <label className="my-3 flex flex-col gap-2">
            <span>
              Expected output{' '}
              <span
                aria-hidden="true"
                className="text-sm font-normal text-muted"
              >
                (Markdown supported)
              </span>
            </span>
            <textarea
              aria-label="Expected output"
              className="min-h-[76px] w-full resize-y rounded border border-border-strong bg-surface px-3 py-2 font-mono text-[15px] leading-6 text-ink disabled:cursor-default disabled:bg-raised disabled:text-muted"
              rows={3}
              value={content.exampleOutput}
              onChange={(event) => edit('exampleOutput', event.target.value)}
              disabled={saving || disabled}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
