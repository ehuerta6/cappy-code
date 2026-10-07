'use client';

import { useCallback, useEffect, useState } from 'react';
import SolutionPanel from '@/components/solutions/solution-panel';
import { getSharedEditorHeight } from '@/components/solutions/solution-sizing';
import {
  languages,
  problemCategories,
  type Language,
  type Solution,
} from '@/lib/domain';
import {
  createBankProblem,
  getBankProblem,
  listOfficerBankProblems,
  updateBankProblem,
  updateBankSolution,
  type BankProblemContent,
  type BankProblemRecord,
  type BankSolutions,
} from '@/lib/firebase/problem-bank';

const labels = {
  custom: 'Custom',
  'interview-style': 'Interview-style',
  'competitive-programming': 'Competitive Programming',
} as const;
const buttonClass =
  'min-h-11 rounded border border-border-strong bg-surface px-3 py-2 text-ink hover:bg-hover disabled:cursor-default disabled:bg-raised disabled:text-muted';

export default function OfficerProblemBank() {
  const [records, setRecords] = useState<BankProblemRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState<BankProblemContent | null>(null);
  const [savedContent, setSavedContent] = useState<BankProblemContent | null>(
    null,
  );
  const [solutions, setSolutions] = useState<BankSolutions | null>(null);
  const [savedSolutions, setSavedSolutions] = useState<BankSolutions | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const selected = records.find(({ id }) => id === selectedId);
  const dirty =
    Boolean(
      content &&
      savedContent &&
      JSON.stringify(content) !== JSON.stringify(savedContent),
    ) ||
    Boolean(
      solutions &&
      savedSolutions &&
      languages.some(
        (language) =>
          JSON.stringify(solutions[language]) !==
          JSON.stringify(savedSolutions[language]),
      ),
    );

  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const guardLink = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.origin !== window.location.origin) return;
      if (
        !window.confirm(
          'Leave this page and discard unsaved Problem Bank changes?',
        )
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', guardLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', guardLink, true);
    };
  }, [dirty, saving]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listOfficerBankProblems().then(
      (items) => {
        if (!active) return;
        setRecords(items);
        setSelectedId((current) =>
          current && items.some((item) => item.id === current)
            ? current
            : (items[0]?.id ?? null),
        );
        setLoading(false);
      },
      () => {
        if (!active) return;
        setError('Problem Bank could not be loaded.');
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [revision]);

  useEffect(() => {
    if (!selectedId) {
      setContent(null);
      setSavedContent(null);
      setSolutions(null);
      setSavedSolutions(null);
      return;
    }
    let active = true;
    setContent(null);
    setSolutions(null);
    setError(null);
    getBankProblem(selectedId, true).then(
      (result) => {
        if (!active) return;
        if (!result) {
          setError('This Problem no longer exists. Reload the Problem Bank.');
          return;
        }
        const fields = Object.fromEntries(
          Object.entries(result.problem).filter(([key]) => key !== 'id'),
        ) as BankProblemContent;
        setContent(fields);
        setSavedContent(fields);
        setSolutions(result.solutions);
        setSavedSolutions(result.solutions);
        setError(null);
      },
      () => {
        if (active) setError('Problem content could not be loaded.');
      },
    );
    return () => {
      active = false;
    };
  }, [revision, selectedId]);

  const save = useCallback(async () => {
    if (!selectedId || !content || !solutions || saving) return;
    setSaving(true);
    setError(null);
    try {
      const work: Promise<void>[] = [];
      if (
        savedContent &&
        JSON.stringify(content) !== JSON.stringify(savedContent)
      )
        work.push(updateBankProblem(selectedId, content));
      for (const language of languages) {
        if (
          savedSolutions &&
          JSON.stringify(solutions[language]) !==
            JSON.stringify(savedSolutions[language])
        )
          work.push(
            updateBankSolution(selectedId, language, solutions[language]),
          );
      }
      await Promise.all(work);
      setSavedContent(content);
      setSavedSolutions(solutions);
      setRecords((items) =>
        items.map((item) =>
          item.id === selectedId ? { ...item, ...content } : item,
        ),
      );
    } catch {
      setError(
        'Save failed. Your edits are still here. Check the connection and retry.',
      );
    } finally {
      setSaving(false);
    }
  }, [content, savedContent, savedSolutions, saving, selectedId, solutions]);

  async function add() {
    setError(null);
    setSaving(true);
    try {
      const record = await createBankProblem();
      setRecords((items) => [...items, record]);
      setSelectedId(record.id);
    } catch {
      setError('Problem Bank entry could not be created.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="problem-bank-heading">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className="m-0 text-[28px] font-semibold leading-9 tracking-tight"
            id="problem-bank-heading"
          >
            Problem Bank
          </h1>
          <p className="mb-0 mt-1 text-muted">
            Prepare reusable Problems and their Python, Java, and C++ Solutions.
          </p>
        </div>
        <button
          className={buttonClass}
          disabled={saving || dirty}
          onClick={() => void add()}
        >
          + New Problem
        </button>
      </div>
      {error && (
        <p role="alert">
          {error}{' '}
          <button
            className={buttonClass}
            onClick={() => setRevision((value) => value + 1)}
          >
            Reload
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading Problem Bank…</p>
      ) : records.length === 0 ? (
        <p>No reusable Problems yet. Create one here or from a Session.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(220px,300px)_minmax(0,1fr)]">
          <nav aria-label="Bank Problems" className="space-y-5">
            {problemCategories.map((category) => {
              const items = records.filter(
                (item) => item.category === category,
              );
              return (
                <section key={category} aria-labelledby={`bank-${category}`}>
                  <h2
                    className="mb-2 mt-0 text-base font-semibold"
                    id={`bank-${category}`}
                  >
                    {labels[category]}
                  </h2>
                  {items.length ? (
                    <ul className="m-0 list-none p-0">
                      {items.map((item) => (
                        <li key={item.id}>
                          <button
                            className={`min-h-11 w-full rounded px-3 py-2 text-left hover:bg-hover ${selectedId === item.id ? 'bg-raised font-semibold' : ''}`}
                            aria-current={
                              selectedId === item.id ? 'true' : undefined
                            }
                            disabled={saving || dirty}
                            onClick={() => setSelectedId(item.id)}
                          >
                            {item.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 text-sm text-muted">No Problems</p>
                  )}
                </section>
              );
            })}
          </nav>
          {selected && content && solutions ? (
            <section className="min-w-0" aria-label={`Edit ${selected.title}`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 text-sm text-muted">
                  Visible to Members immediately after each save, unless used by
                  the live Session.
                </p>
                <button
                  className={buttonClass}
                  disabled={!dirty || saving}
                  onClick={() => void save()}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
              <p
                className="mb-4 mt-0 text-sm text-muted"
                role="status"
                aria-live="polite"
              >
                {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved ✓'}
              </p>
              <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
                <label className="grid gap-1 font-medium">
                  Problem title
                  <input
                    className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 font-normal"
                    value={content.title}
                    disabled={saving}
                    onChange={(event) =>
                      setContent({ ...content, title: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1 font-medium">
                  Problem type
                  <select
                    className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 font-normal"
                    value={content.category}
                    disabled={saving}
                    onChange={(event) =>
                      setContent({
                        ...content,
                        category: event.target
                          .value as BankProblemContent['category'],
                      })
                    }
                  >
                    {problemCategories.map((category) => (
                      <option key={category} value={category}>
                        {labels[category]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 font-medium">
                  Difficulty
                  <select
                    className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 font-normal"
                    value={content.difficulty ?? ''}
                    disabled={saving}
                    onChange={(event) =>
                      setContent({
                        ...content,
                        difficulty: event.target.value
                          ? (event.target
                              .value as BankProblemContent['difficulty'])
                          : undefined,
                      })
                    }
                  >
                    <option value="">Not set</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <label className="grid gap-1 font-medium">
                  LeetCode link (optional)
                  <input
                    className="min-h-11 rounded border border-border-strong bg-surface px-3 py-2 font-normal"
                    type="url"
                    disabled={saving}
                    value={content.leetcodeUrl ?? ''}
                    placeholder="https://leetcode.com/problems/two-sum/"
                    onChange={(event) =>
                      setContent({
                        ...content,
                        leetcodeUrl: event.target.value || undefined,
                      })
                    }
                  />
                </label>
              </div>
              <label className="my-4 grid max-w-3xl gap-1 font-medium">
                Description (Markdown supported)
                <textarea
                  className="min-h-32 rounded border border-border-strong bg-surface px-3 py-2 font-normal"
                  value={content.description}
                  disabled={saving}
                  onChange={(event) =>
                    setContent({
                      ...content,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label className="my-4 grid max-w-3xl gap-1 font-medium">
                Constraints
                <textarea
                  className="min-h-20 rounded border border-border-strong bg-surface px-3 py-2 font-normal"
                  value={content.constraints}
                  disabled={saving}
                  onChange={(event) =>
                    setContent({
                      ...content,
                      constraints: event.target.value,
                    })
                  }
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 font-medium">
                  Example input
                  <textarea
                    className="min-h-20 rounded border border-border-strong bg-surface px-3 py-2 font-mono font-normal"
                    value={content.exampleInput}
                    disabled={saving}
                    onChange={(event) =>
                      setContent({
                        ...content,
                        exampleInput: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="grid gap-1 font-medium">
                  Expected output
                  <textarea
                    className="min-h-20 rounded border border-border-strong bg-surface px-3 py-2 font-mono font-normal"
                    value={content.exampleOutput}
                    disabled={saving}
                    onChange={(event) =>
                      setContent({
                        ...content,
                        exampleOutput: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <h2 className="mb-3 mt-7 text-lg font-semibold">
                Prepared Solutions
              </h2>
              <div className="overflow-x-auto pb-2">
                <div className="grid min-w-[1080px] grid-cols-3 gap-4">
                  {languages.map((language: Language) => (
                    <SolutionPanel
                      key={language}
                      mode="officer"
                      language={language}
                      solution={solutions[language]}
                      modelPath={`bank/${selectedId}/${language}`}
                      editorHeight={getSharedEditorHeight(solutions)}
                      onChange={(solution: Solution) =>
                        setSolutions((current) =>
                          current
                            ? { ...current, [language]: solution }
                            : current,
                        )
                      }
                      disabled={saving}
                    />
                  ))}
                </div>
              </div>
            </section>
          ) : error ? null : (
            <p role="status">Loading selected Problem…</p>
          )}
        </div>
      )}
    </section>
  );
}
