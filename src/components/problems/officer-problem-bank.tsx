'use client';

import { useCallback, useEffect, useState } from 'react';
import SolutionPanel from '@/components/solutions/solution-panel';
import { ProblemUsageHistory, ProblemUsageMetadata } from './problem-usage';
import { getSharedEditorHeight } from '@/components/solutions/solution-sizing';
import {
  createApproach,
  deleteApproach,
  reorderApproaches,
} from '@/lib/firebase/solutions';
import { bankProblemPath } from '@/lib/firebase/paths';
import {
  languages,
  problemCategories,
  type Language,
  type Solution,
  type SolutionApproach,
} from '@/lib/domain';
import {
  createBankProblem,
  getBankProblem,
  listOfficerBankProblems,
  updateBankPublication,
  updateBankProblem,
  updateBankSolution,
  updateBankApproach,
  type BankProblemContent,
  type BankProblemRecord,
  type BankSolutions,
} from '@/lib/firebase/problem-bank';
import { listProblemUsageSummaries } from '@/lib/firebase/problem-usage';
import type { ProblemUsageSummary } from '@/lib/problem-usage';

const labels = {
  custom: 'Custom',
  'interview-style': 'Interview-style',
  'competitive-programming': 'Competitive Programming',
} as const;
const buttonClass =
  'min-h-11 rounded border border-border-strong bg-surface px-3 py-2 text-ink hover:bg-hover disabled:cursor-default disabled:bg-raised disabled:text-muted';

export default function OfficerProblemBank() {
  const [records, setRecords] = useState<BankProblemRecord[]>([]);
  const [usage, setUsage] = useState<Record<string, ProblemUsageSummary>>({});
  const [usageFailed, setUsageFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState<BankProblemContent | null>(null);
  const [savedContent, setSavedContent] = useState<BankProblemContent | null>(
    null,
  );
  const [solutions, setSolutions] = useState<BankSolutions | null>(null);
  const [approaches, setApproaches] = useState<SolutionApproach[]>([]);
  const [savedApproaches, setSavedApproaches] = useState<SolutionApproach[]>(
    [],
  );
  const [approachId, setApproachId] = useState('primary');
  const activeApproach = approaches.find(({ id }) => id === approachId);
  const [savedSolutions, setSavedSolutions] = useState<BankSolutions | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publicationSaving, setPublicationSaving] = useState(false);
  const [structuralBusy, setStructuralBusy] = useState(false);
  const [publicationError, setPublicationError] = useState<boolean | null>(
    null,
  );
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
    ) ||
    JSON.stringify(approaches) !== JSON.stringify(savedApproaches);
  const approachActionsDisabled = dirty || saving || structuralBusy;

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
    setUsage({});
    setUsageFailed(false);
    listOfficerBankProblems().then(
      (items) => {
        if (!active) return;
        setRecords(items);
        setUsageFailed(false);
        if (items.length === 0) {
          setUsage({});
        } else {
          listProblemUsageSummaries(
            items.map(({ id }) => id),
            true,
          ).then(
            (summaries) => {
              if (active) setUsage(summaries);
            },
            () => {
              if (active) {
                setUsage({});
                setUsageFailed(true);
              }
            },
          );
        }
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
      setApproaches([]);
      setSavedApproaches([]);
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
          Object.entries(result.problem).filter(
            ([key]) =>
              key !== 'id' &&
              key !== 'isPublished' &&
              key !== 'isTemporarilyHidden',
          ),
        ) as BankProblemContent;
        setContent(fields);
        setSavedContent(fields);
        setSolutions(result.solutions);
        setSavedSolutions(result.solutions);
        setApproaches(result.approaches);
        setSavedApproaches(result.approaches);
        setApproachId(result.approaches[0]?.id ?? 'primary');
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
            updateBankSolution(
              selectedId,
              language,
              solutions[language],
              approachId,
            ),
          );
      }
      // Persist language values before legacy-primary conversion reads the old
      // flat documents. Once conversion completes, nested data is canonical.
      await Promise.all(work);
      if (activeApproach)
        await updateBankApproach(selectedId, {
          ...activeApproach,
          solutions,
        });
      const savedApproachList = approaches.map((approach) =>
        approach.id === approachId ? { ...approach, solutions } : approach,
      );
      setSavedContent(content);
      setSavedSolutions(solutions);
      setApproaches(savedApproachList);
      setSavedApproaches(savedApproachList);
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
  }, [
    activeApproach,
    approaches,
    approachId,
    content,
    savedContent,
    savedSolutions,
    saving,
    selectedId,
    solutions,
  ]);

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

  async function changePublication(isPublished: boolean) {
    if (!selectedId || publicationSaving) return;
    setPublicationSaving(true);
    setPublicationError(null);
    try {
      await updateBankPublication(selectedId, isPublished);
      setRecords((items) =>
        items.map((item) =>
          item.id === selectedId ? { ...item, isPublished } : item,
        ),
      );
    } catch {
      setPublicationError(isPublished);
    } finally {
      setPublicationSaving(false);
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
            Changes apply to future Session copies; existing Sessions keep their
            snapshots.
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
                          <ProblemUsageMetadata
                            summary={usage[item.id]}
                            failed={usageFailed}
                          />
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
                <p className="m-0 text-sm text-muted" role="status">
                  Publication:{' '}
                  {selected.isPublished ? 'Published' : 'Unpublished'}
                  {selected.isPublished && selected.isTemporarilyHidden
                    ? ' · temporarily hidden during the live Session'
                    : ''}
                </p>
                <button
                  className={buttonClass}
                  disabled={publicationSaving}
                  onClick={() => void changePublication(!selected.isPublished)}
                >
                  {publicationSaving
                    ? 'Saving publication…'
                    : selected.isPublished
                      ? 'Unpublish'
                      : 'Publish'}
                </button>
                <button
                  className={buttonClass}
                  disabled={!dirty || saving}
                  onClick={() => void save()}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
              {publicationError !== null && (
                <p role="alert">
                  Publication update failed. Retry to confirm the selected
                  state.{' '}
                  <button
                    className={buttonClass}
                    disabled={publicationSaving}
                    onClick={() => void changePublication(publicationError)}
                  >
                    Retry {publicationError ? 'Publish' : 'Unpublish'}
                  </button>
                </p>
              )}
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
              {approaches.length > 1 && (
                <div
                  className="mb-3 flex flex-wrap gap-2"
                  aria-label="Solution approaches"
                >
                  {approaches.map((approach) => (
                    <button
                      key={approach.id}
                      type="button"
                      className={buttonClass}
                      disabled={approachActionsDisabled}
                      aria-pressed={approach.id === approachId}
                      onClick={() => {
                        setApproachId(approach.id);
                        setSolutions(approach.solutions);
                        setSavedSolutions(approach.solutions);
                      }}
                    >
                      {approach.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <button
                  className={buttonClass}
                  type="button"
                  disabled={approachActionsDisabled}
                  onClick={async () => {
                    setError(null);
                    setStructuralBusy(true);
                    try {
                      const added = await createApproach(
                        bankProblemPath(selected.id),
                      );
                      const next = [...approaches, added].map(
                        (approach, order) => ({ ...approach, order }),
                      );
                      setApproaches(next);
                      setSavedApproaches(next);
                      setApproachId(added.id);
                      setSolutions(added.solutions);
                      setSavedSolutions(added.solutions);
                    } catch {
                      setError('Approach could not be added. Retry.');
                    } finally {
                      setStructuralBusy(false);
                    }
                  }}
                >
                  Add Approach
                </button>
                {activeApproach && (
                  <>
                    <label>
                      Approach name
                      <input
                        className="ml-2 rounded border border-border-strong bg-surface px-2 py-2"
                        value={activeApproach.name}
                        onChange={(event) =>
                          setApproaches((items) =>
                            items.map((item) =>
                              item.id === approachId
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Tags
                      <input
                        className="ml-2 rounded border border-border-strong bg-surface px-2 py-2"
                        value={activeApproach.tags.join(', ')}
                        onChange={(event) =>
                          setApproaches((items) =>
                            items.map((item) =>
                              item.id === approachId
                                ? {
                                    ...item,
                                    tags: event.target.value
                                      .split(',')
                                      .map((tag) => tag.trim())
                                      .filter(Boolean),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      className={buttonClass}
                      type="button"
                      disabled={saving}
                      onClick={() => void save()}
                    >
                      Save approach details
                    </button>
                    <button
                      className={buttonClass}
                      type="button"
                      disabled={approachActionsDisabled}
                      onClick={async () => {
                        setError(null);
                        setStructuralBusy(true);
                        try {
                          await deleteApproach(
                            bankProblemPath(selected.id),
                            approachId,
                          );
                          const next = approaches
                            .filter((approach) => approach.id !== approachId)
                            .map((approach, order) => ({ ...approach, order }));
                          const empty = {
                            python: { code: '' },
                            java: { code: '' },
                            cpp: { code: '' },
                          };
                          setApproaches(next);
                          setSavedApproaches(next);
                          setApproachId(next[0]?.id ?? '');
                          setSolutions(next[0]?.solutions ?? empty);
                          setSavedSolutions(next[0]?.solutions ?? empty);
                        } catch {
                          setError('Approach could not be deleted. Retry.');
                        } finally {
                          setStructuralBusy(false);
                        }
                      }}
                    >
                      Delete Approach
                    </button>
                    <button
                      className={buttonClass}
                      type="button"
                      disabled={approachActionsDisabled}
                      onClick={async () => {
                        const index = approaches.findIndex(
                          (item) => item.id === approachId,
                        );
                        if (index > 0) {
                          const order = [...approaches];
                          [order[index - 1], order[index]] = [
                            order[index],
                            order[index - 1],
                          ];
                          setError(null);
                          setStructuralBusy(true);
                          try {
                            await reorderApproaches(
                              bankProblemPath(selected.id),
                              order,
                            );
                            const next = order.map((item, i) => ({
                              ...item,
                              order: i,
                            }));
                            setApproaches(next);
                            setSavedApproaches(next);
                          } catch {
                            setError(
                              'Approaches could not be reordered. Retry.',
                            );
                          } finally {
                            setStructuralBusy(false);
                          }
                        }
                      }}
                    >
                      Move Approach earlier
                    </button>
                    <button
                      className={buttonClass}
                      type="button"
                      disabled={approachActionsDisabled}
                      onClick={async () => {
                        const index = approaches.findIndex(
                          (item) => item.id === approachId,
                        );
                        if (index >= 0 && index < approaches.length - 1) {
                          const order = [...approaches];
                          [order[index], order[index + 1]] = [
                            order[index + 1],
                            order[index],
                          ];
                          setError(null);
                          setStructuralBusy(true);
                          try {
                            await reorderApproaches(
                              bankProblemPath(selected.id),
                              order,
                            );
                            const next = order.map((item, i) => ({
                              ...item,
                              order: i,
                            }));
                            setApproaches(next);
                            setSavedApproaches(next);
                          } catch {
                            setError(
                              'Approaches could not be reordered. Retry.',
                            );
                          } finally {
                            setStructuralBusy(false);
                          }
                        }
                      }}
                    >
                      Move Approach later
                    </button>
                  </>
                )}
              </div>
              {activeApproach?.tags.length ? (
                <p className="text-sm text-muted">
                  {activeApproach.tags.join(' · ')}
                </p>
              ) : null}
              <h2 className="mb-3 mt-7 text-lg font-semibold">
                Prepared Solutions
              </h2>
              {activeApproach ? (
                <div className="overflow-x-auto pb-2">
                  <div className="grid min-w-[1080px] grid-cols-3 gap-4">
                    {languages.map((language: Language) => (
                      <SolutionPanel
                        key={language}
                        mode="officer"
                        language={language}
                        solution={solutions[language]}
                        modelPath={`bank/${selectedId}/${approachId}/${language}`}
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
              ) : (
                <p>
                  No solution approaches yet. Add an Approach to prepare
                  Solutions.
                </p>
              )}
              <ProblemUsageHistory
                summary={usage[selected.id]}
                failed={usageFailed}
              />
            </section>
          ) : error ? null : (
            <p role="status">Loading selected Problem…</p>
          )}
        </div>
      )}
    </section>
  );
}
