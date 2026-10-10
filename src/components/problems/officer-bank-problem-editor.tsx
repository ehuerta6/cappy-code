'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProblemMarkdown from '@/components/member/problem-markdown';
import { Button, StateMessage } from '@/components/ui/primitives';
import SolutionPanel, {
  languageNames,
} from '@/components/solutions/solution-panel';
import { getSharedEditorHeight } from '@/components/solutions/solution-sizing';
import {
  ProblemApproachTags,
  ProblemDifficultyBadge,
  ProblemLink,
} from '@/components/problems/problem-bank-metadata';
import { ProblemUsageHistory } from '@/components/problems/problem-usage';
import DsaTagPicker from '@/components/problems/dsa-tag-picker';
import {
  createApproach,
  deleteApproach,
  reorderApproaches,
} from '@/lib/firebase/solutions';
import {
  deleteBankProblem,
  getBankProblem,
  updateBankApproach,
  updateBankProblem,
  updateBankSolution,
  type BankProblemContent,
  type BankProblemRecord,
} from '@/lib/firebase/problem-bank';
import { listProblemUsageSummaries } from '@/lib/firebase/problem-usage';
import type { ProblemUsageSummary } from '@/lib/problem-usage';
import {
  languages,
  problemCategories,
  type Language,
  type Solution,
  type SolutionApproach,
} from '@/lib/domain';
import { bankProblemPath } from '@/lib/firebase/paths';

const categoryLabels = {
  custom: 'Custom',
  'interview-style': 'Interview-style',
  'competitive-programming': 'Competitive Programming',
} as const;

type WorkspaceState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      content: BankProblemContent;
      savedContent: BankProblemContent;
      approaches: SolutionApproach[];
      savedApproaches: SolutionApproach[];
    };

type UsageState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; summary: ProblemUsageSummary };

function contentFor(problem: BankProblemRecord): BankProblemContent {
  return {
    title: problem.title,
    description: problem.description,
    constraints: problem.constraints,
    exampleInput: problem.exampleInput,
    exampleOutput: problem.exampleOutput,
    category: problem.category,
    difficulty: problem.difficulty,
    leetcodeUrl: problem.leetcodeUrl,
  };
}

export default function OfficerBankProblemEditor({
  problemId,
}: {
  problemId: string;
}) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    status: 'loading',
  });
  const [usage, setUsage] = useState<UsageState>({ status: 'loading' });
  const [retry, setRetry] = useState(0);
  const [usageRetry, setUsageRetry] = useState(0);
  const [approachId, setApproachId] = useState('');
  const [language, setLanguage] = useState<Language>('python');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [structuralBusy, setStructuralBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [historySettling, setHistorySettling] = useState(false);
  const allowHistoryNavigation = useRef(false);
  const dirtyHistoryEntry = useRef(false);
  const historyCleanupInProgress = useRef(false);

  useEffect(() => {
    let active = true;
    setWorkspace({ status: 'loading' });
    getBankProblem(problemId, true).then(
      (result) => {
        if (!active) return;
        if (!result) {
          setWorkspace({ status: 'error' });
          return;
        }
        const content = contentFor(result.problem);
        setWorkspace({
          status: 'ready',
          content,
          savedContent: content,
          approaches: result.approaches,
          savedApproaches: result.approaches,
        });
        const first = result.approaches[0];
        setApproachId(first?.id ?? '');
        setLanguage(
          languages.find((item) => first?.solutions[item].code.trim()) ??
            'python',
        );
      },
      () => {
        if (active) setWorkspace({ status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [problemId, retry]);

  useEffect(() => {
    let active = true;
    setUsage({ status: 'loading' });
    listProblemUsageSummaries([problemId], true).then(
      (summaries) => {
        if (!active) return;
        setUsage({
          status: 'ready',
          summary: summaries[problemId] ?? {
            count: 0,
            lastUsed: null,
            branches: [],
            history: [],
          },
        });
      },
      () => {
        if (active) setUsage({ status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [problemId, usageRetry]);

  const ready = workspace.status === 'ready' ? workspace : null;
  const activeApproach = ready?.approaches.find(({ id }) => id === approachId);
  const dirty = Boolean(
    ready &&
    (JSON.stringify(ready.content) !== JSON.stringify(ready.savedContent) ||
      JSON.stringify(ready.approaches) !==
        JSON.stringify(ready.savedApproaches)),
  );
  const editorHeight = useMemo(
    () =>
      activeApproach
        ? getSharedEditorHeight(activeApproach.solutions)
        : 'clamp(18.75rem, 55dvh, 40rem)',
    [activeApproach],
  );

  useEffect(() => {
    if (!dirty && !saving) {
      if (
        (!dirtyHistoryEntry.current || historyCleanupInProgress.current) &&
        !window.history.state?.cappyDirtyGuard
      )
        return;
      dirtyHistoryEntry.current = false;
      historyCleanupInProgress.current = true;
      setHistorySettling(true);
      const settle = () => {
        historyCleanupInProgress.current = false;
        setHistorySettling(false);
      };
      const timeout = window.setTimeout(settle, 50);
      window.addEventListener('popstate', settle, { once: true });
      window.history.back();
      return () => {
        window.clearTimeout(timeout);
        window.removeEventListener('popstate', settle);
      };
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const guardLinks = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.origin !== window.location.origin) return;
      if (
        !window.confirm(
          'Leave this Problem editor and discard unsaved changes?',
        )
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const currentUrl = window.location.href;
    if (!dirtyHistoryEntry.current) {
      const state = window.history.state;
      window.history.pushState(
        {
          ...(state && typeof state === 'object' ? state : {}),
          cappyDirtyGuard: true,
        },
        '',
        currentUrl,
      );
      dirtyHistoryEntry.current = true;
    }
    const guardHistory = (event: PopStateEvent) => {
      if (allowHistoryNavigation.current) return;
      if (
        window.confirm('Leave this Problem editor and discard unsaved changes?')
      ) {
        allowHistoryNavigation.current = true;
        window.history.back();
      } else {
        event.stopImmediatePropagation();
        window.history.pushState(
          { ...(window.history.state ?? {}), cappyDirtyGuard: true },
          '',
          currentUrl,
        );
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', guardLinks, true);
    window.addEventListener('popstate', guardHistory, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', guardLinks, true);
      window.removeEventListener('popstate', guardHistory, true);
    };
  }, [dirty, saving]);

  const save = useCallback(async () => {
    if (!ready || !dirty || saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      const writes: Promise<void>[] = [];
      if (JSON.stringify(ready.content) !== JSON.stringify(ready.savedContent))
        writes.push(updateBankProblem(problemId, ready.content));
      for (const approach of ready.approaches) {
        const previous = ready.savedApproaches.find(
          ({ id }) => id === approach.id,
        );
        if (!previous) continue;
        if (JSON.stringify(approach) === JSON.stringify(previous)) continue;
        if (
          approach.name !== previous.name ||
          approach.order !== previous.order ||
          JSON.stringify(approach.tags) !== JSON.stringify(previous.tags)
        ) {
          writes.push(updateBankApproach(problemId, approach));
        }
        for (const item of languages) {
          if (
            JSON.stringify(approach.solutions[item]) !==
            JSON.stringify(previous.solutions[item])
          ) {
            writes.push(
              updateBankSolution(
                problemId,
                item,
                approach.solutions[item],
                approach.id,
              ),
            );
          }
        }
      }
      await Promise.all(writes);
      setWorkspace((current) =>
        current.status === 'ready'
          ? {
              ...current,
              savedContent: current.content,
              savedApproaches: current.approaches,
            }
          : current,
      );
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }, [dirty, problemId, ready, saving]);

  function editContent(field: keyof BankProblemContent, value: string) {
    if (!ready) return;
    setWorkspace({
      ...ready,
      content: {
        ...ready.content,
        [field]: value,
      },
    });
    setSaveFailed(false);
  }

  function editActiveApproach(
    update: (approach: SolutionApproach) => SolutionApproach,
  ) {
    if (!ready || !activeApproach) return;
    setWorkspace({
      ...ready,
      approaches: ready.approaches.map((approach) =>
        approach.id === approachId ? update(approach) : approach,
      ),
    });
    setSaveFailed(false);
  }

  async function addApproach() {
    if (!ready || structuralBusy || dirty) return;
    setStructuralBusy(true);
    setActionError(false);
    try {
      const added = await createApproach(bankProblemPath(problemId));
      const approaches = [...ready.approaches, added];
      setWorkspace({ ...ready, approaches, savedApproaches: approaches });
      setApproachId(added.id);
      setLanguage('python');
    } catch {
      setActionError(true);
    } finally {
      setStructuralBusy(false);
    }
  }

  async function removeApproach() {
    if (!ready || !activeApproach || structuralBusy || dirty) return;
    if (!window.confirm('Delete this Approach and its three Solutions?'))
      return;
    setStructuralBusy(true);
    setActionError(false);
    try {
      await deleteApproach(bankProblemPath(problemId), activeApproach.id);
      const approaches = ready.approaches
        .filter(({ id }) => id !== activeApproach.id)
        .map((approach, order) => ({ ...approach, order }));
      setWorkspace({ ...ready, approaches, savedApproaches: approaches });
      setApproachId(approaches[0]?.id ?? '');
    } catch {
      setActionError(true);
    } finally {
      setStructuralBusy(false);
    }
  }

  async function moveApproach(direction: -1 | 1) {
    if (!ready || !activeApproach || structuralBusy || dirty) return;
    const index = ready.approaches.findIndex(({ id }) => id === approachId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ready.approaches.length) return;
    const ordered = [...ready.approaches];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const approaches = ordered.map((approach, order) => ({
      ...approach,
      order,
    }));
    setStructuralBusy(true);
    setActionError(false);
    try {
      await reorderApproaches(bankProblemPath(problemId), approaches);
      setWorkspace({ ...ready, approaches, savedApproaches: approaches });
    } catch {
      setActionError(true);
    } finally {
      setStructuralBusy(false);
    }
  }

  async function removeProblem() {
    if (!ready || dirty || saving || deleting || structuralBusy) return;
    setDeleting(true);
    setDeleteConfirmOpen(false);
    setDeleteFailed(false);
    try {
      await deleteBankProblem(problemId);
      router.push('/officer/problem-bank');
    } catch {
      setDeleteFailed(true);
      setDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section
        className="ui-page-shell"
        aria-labelledby="officer-bank-problem-heading"
      >
        <Link
          className="text-accent underline-offset-4 hover:underline"
          href="/officer/problem-bank"
        >
          ← Problem Bank
        </Link>
        <header className="mb-5 mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="m-0 break-words text-2xl font-semibold leading-8 tracking-tight"
              id="officer-bank-problem-heading"
            >
              {ready?.content.title ||
                (workspace.status === 'error'
                  ? 'Problem unavailable'
                  : 'Problem editor')}
            </h1>
          </div>
          {ready && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p
                className="m-0 px-1 text-sm text-secondary"
                role={saveFailed ? 'alert' : 'status'}
                aria-live="polite"
              >
                {saving || historySettling
                  ? 'Saving…'
                  : saveFailed
                    ? 'Save failed. Your edits are still here.'
                    : dirty
                      ? 'Unsaved changes'
                      : 'Saved ✓'}
              </p>
              <Button
                variant="primary"
                disabled={
                  !dirty ||
                  saving ||
                  historySettling ||
                  deleting ||
                  structuralBusy
                }
                onClick={() => void save()}
              >
                {saveFailed ? 'Retry save' : 'Save changes'}
              </Button>
              <details className="relative">
                <summary className="ui-button ui-button--secondary cursor-pointer list-none">
                  More
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-border-strong bg-surface p-3 shadow-lg">
                  <p className="mb-2 mt-0 text-sm font-semibold text-danger">
                    Destructive actions
                  </p>
                  <Button
                    className="w-full justify-start"
                    variant="danger"
                    disabled={
                      dirty ||
                      saving ||
                      historySettling ||
                      deleting ||
                      structuralBusy
                    }
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    {deleting ? 'Deleting…' : 'Delete Problem'}
                  </Button>
                  <p className="mb-0 mt-2 text-xs leading-5 text-secondary">
                    Existing Session copies and their history will remain.
                  </p>
                </div>
              </details>
            </div>
          )}
        </header>

        {workspace.status === 'loading' ? (
          <div className="ui-loading-block min-h-56" aria-busy="true">
            <StateMessage>Loading Problem editor…</StateMessage>
          </div>
        ) : workspace.status === 'error' ? (
          <StateMessage role="alert">
            This Problem could not be loaded. It may no longer be in the Bank.{' '}
            <Button onClick={() => setRetry((value) => value + 1)}>
              Retry
            </Button>{' '}
            <Link href="/officer/problem-bank">Return to Problem Bank</Link>
          </StateMessage>
        ) : (
          <>
            {deleteConfirmOpen ? (
              <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
                <section
                  aria-labelledby="delete-problem-title"
                  aria-modal="true"
                  className="grid w-full max-w-md gap-4 rounded-xl border border-border-strong bg-surface p-5 shadow-xl"
                  role="alertdialog"
                >
                  <h2
                    className="m-0 text-lg font-semibold"
                    id="delete-problem-title"
                  >
                    Delete Problem?
                  </h2>
                  <p className="m-0 text-sm text-secondary">
                    Delete this reusable Problem Bank source and its stored
                    Approaches and Solutions? Existing Session copies and their
                    history will remain unchanged.
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      disabled={deleting}
                      onClick={() => setDeleteConfirmOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={deleting}
                      onClick={() => void removeProblem()}
                      variant="danger"
                    >
                      {deleting ? 'Deleting…' : 'Delete Problem'}
                    </Button>
                  </div>
                </section>
              </div>
            ) : null}
            {deleteFailed && (
              <StateMessage role="alert">
                Delete failed. The Problem is still in the Bank.{' '}
                <Button onClick={() => void removeProblem()}>
                  Retry delete
                </Button>
              </StateMessage>
            )}
            {actionError && (
              <StateMessage role="alert">
                Approach could not be updated. Retry the action.
              </StateMessage>
            )}
            <div className="grid min-w-0 gap-8 min-[1100px]:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] min-[1100px]:gap-0 min-[1100px]:divide-x min-[1100px]:divide-border-soft">
              <section
                className="min-w-0 min-[1100px]:pr-6"
                aria-labelledby="problem-content-heading"
              >
                <h2
                  className="mb-5 mt-0 text-lg font-semibold"
                  id="problem-content-heading"
                >
                  Problem
                </h2>
                <section aria-labelledby="problem-basics-heading">
                  <h3
                    className="mb-3 mt-0 text-base font-semibold"
                    id="problem-basics-heading"
                  >
                    Basics
                  </h3>
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    <label className="grid min-w-0 gap-1 text-sm font-semibold sm:col-span-2">
                      Title
                      <input
                        className="ui-field min-w-0 font-normal"
                        value={workspace.content.title}
                        disabled={saving || deleting}
                        onChange={(event) =>
                          editContent('title', event.target.value)
                        }
                      />
                    </label>
                    <label className="grid min-w-0 gap-1 text-sm font-semibold">
                      Category
                      <select
                        className="ui-field min-w-0 font-normal"
                        value={workspace.content.category}
                        disabled={saving || deleting}
                        onChange={(event) =>
                          editContent('category', event.target.value)
                        }
                      >
                        {problemCategories.map((category) => (
                          <option key={category} value={category}>
                            {categoryLabels[category]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid min-w-0 gap-1 text-sm font-semibold">
                      Difficulty
                      <select
                        className="ui-field min-w-0 font-normal"
                        value={workspace.content.difficulty ?? ''}
                        disabled={saving || deleting}
                        onChange={(event) =>
                          editContent('difficulty', event.target.value)
                        }
                      >
                        <option value="">Not set</option>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </label>
                    <div className="flex min-h-11 flex-wrap items-center gap-3 sm:col-span-2">
                      <ProblemDifficultyBadge
                        difficulty={workspace.content.difficulty}
                      />
                      <ProblemLink href={workspace.content.leetcodeUrl} />
                    </div>
                    <label className="grid min-w-0 gap-1 text-sm font-semibold sm:col-span-2">
                      Problem link
                      <input
                        className="ui-field min-w-0 font-normal"
                        type="url"
                        inputMode="url"
                        placeholder="https://leetcode.com/problems/two-sum/"
                        value={workspace.content.leetcodeUrl ?? ''}
                        disabled={saving || deleting}
                        onChange={(event) =>
                          editContent('leetcodeUrl', event.target.value)
                        }
                      />
                    </label>
                  </div>
                </section>
                <section
                  className="mt-7"
                  aria-labelledby="problem-statement-heading"
                >
                  <h3
                    className="mb-3 mt-0 text-base font-semibold"
                    id="problem-statement-heading"
                  >
                    Statement
                  </h3>
                  <label className="grid min-w-0 gap-1 text-sm font-semibold">
                    Description
                    <span className="text-sm font-normal text-secondary">
                      Markdown supported
                    </span>
                    <textarea
                      className="ui-field min-h-36 min-w-0 resize-y font-normal leading-6"
                      rows={6}
                      value={workspace.content.description}
                      disabled={saving || deleting}
                      onChange={(event) =>
                        editContent('description', event.target.value)
                      }
                    />
                  </label>
                  {workspace.content.description.trim() && (
                    <div
                      className="mt-4 border-l-2 border-border-soft pl-4"
                      aria-label="Statement preview"
                    >
                      <ProblemMarkdown>
                        {workspace.content.description}
                      </ProblemMarkdown>
                    </div>
                  )}
                </section>
                <section
                  className="mt-7"
                  aria-labelledby="problem-constraints-heading"
                >
                  <h3
                    className="mb-3 mt-0 text-base font-semibold"
                    id="problem-constraints-heading"
                  >
                    Constraints
                  </h3>
                  <label className="grid min-w-0 gap-1 text-sm font-semibold">
                    Constraints
                    <textarea
                      className="ui-field min-h-20 min-w-0 resize-y font-normal leading-6"
                      rows={3}
                      value={workspace.content.constraints}
                      disabled={saving || deleting}
                      onChange={(event) =>
                        editContent('constraints', event.target.value)
                      }
                    />
                  </label>
                </section>
                <section
                  className="mt-7"
                  aria-labelledby="problem-example-heading"
                >
                  <h3
                    className="mb-3 mt-0 text-base font-semibold"
                    id="problem-example-heading"
                  >
                    Example
                  </h3>
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    <label className="grid min-w-0 gap-1 text-sm font-semibold">
                      Input
                      <textarea
                        className="ui-field min-h-20 min-w-0 resize-y font-mono text-sm font-normal leading-6"
                        rows={3}
                        value={workspace.content.exampleInput}
                        disabled={saving || deleting}
                        onChange={(event) =>
                          editContent('exampleInput', event.target.value)
                        }
                      />
                    </label>
                    <label className="grid min-w-0 gap-1 text-sm font-semibold">
                      Expected output
                      <textarea
                        className="ui-field min-h-20 min-w-0 resize-y font-mono text-sm font-normal leading-6"
                        rows={3}
                        value={workspace.content.exampleOutput}
                        disabled={saving || deleting}
                        onChange={(event) =>
                          editContent('exampleOutput', event.target.value)
                        }
                      />
                    </label>
                  </div>
                </section>
              </section>

              <section
                className="min-w-0 min-[1100px]:pl-6"
                aria-labelledby="solution-content-heading"
              >
                <h2
                  className="mb-5 mt-0 text-lg font-semibold"
                  id="solution-content-heading"
                >
                  Solution
                </h2>
                <div className="mb-4 grid min-w-0 gap-3 sm:grid-cols-2">
                  <div className="grid min-w-0 gap-1">
                    {workspace.approaches.length === 1 ? (
                      <div
                        role="group"
                        aria-label={`Approach: ${activeApproach?.name}`}
                      >
                        <span className="text-sm font-semibold">Approach</span>
                        <p className="m-0 flex min-h-11 items-center px-0 font-medium">
                          {activeApproach?.name}
                        </p>
                      </div>
                    ) : workspace.approaches.length > 1 ? (
                      <label className="grid min-w-0 gap-1 text-sm font-semibold">
                        Approach
                        <select
                          className="ui-field min-w-0"
                          value={approachId}
                          disabled={dirty || saving || structuralBusy}
                          onChange={(event) => {
                            const next = workspace.approaches.find(
                              ({ id }) => id === event.target.value,
                            );
                            setApproachId(event.target.value);
                            setLanguage(
                              languages.find((item) =>
                                next?.solutions[item].code.trim(),
                              ) ?? 'python',
                            );
                          }}
                        >
                          {workspace.approaches.map((approach) => (
                            <option key={approach.id} value={approach.id}>
                              {approach.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div>
                        <span className="text-sm font-semibold">Approach</span>
                        <p className="m-0 flex min-h-11 items-center text-sm text-secondary">
                          No approaches yet
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={dirty || saving || structuralBusy || deleting}
                        onClick={() => void addApproach()}
                      >
                        + Add approach
                      </Button>
                      <details className="relative">
                        <summary
                          className="ui-button ui-button--secondary cursor-pointer list-none"
                          aria-label="Manage approaches"
                        >
                          Manage approaches
                        </summary>
                        <div
                          aria-label="Manage approaches"
                          className="fixed left-1/2 top-1/2 z-20 grid max-h-[min(60vh,36rem)] -translate-x-1/2 -translate-y-1/2 gap-3 overflow-y-auto rounded-md border border-border-strong bg-surface p-4 shadow-lg"
                          role="region"
                          style={{ width: 'min(20rem, calc(100vw - 2rem))' }}
                        >
                          {activeApproach ? (
                            <>
                              <label className="grid gap-1 text-sm font-semibold">
                                Approach name
                                <input
                                  className="ui-field font-normal"
                                  value={activeApproach.name}
                                  disabled={
                                    saving || structuralBusy || deleting
                                  }
                                  onChange={(event) =>
                                    editActiveApproach((item) => ({
                                      ...item,
                                      name: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <fieldset className="grid gap-2 border-0 p-0">
                                <legend className="text-sm font-semibold">
                                  DSA / algorithm tags
                                </legend>
                                <DsaTagPicker
                                  selected={activeApproach.tags}
                                  onChange={(tags) =>
                                    editActiveApproach((item) => ({
                                      ...item,
                                      tags,
                                    }))
                                  }
                                />
                              </fieldset>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  disabled={
                                    dirty ||
                                    saving ||
                                    structuralBusy ||
                                    approachesIndex(
                                      workspace.approaches,
                                      approachId,
                                    ) === 0
                                  }
                                  onClick={() => void moveApproach(-1)}
                                >
                                  Move up
                                </Button>
                                <Button
                                  disabled={
                                    dirty ||
                                    saving ||
                                    structuralBusy ||
                                    approachesIndex(
                                      workspace.approaches,
                                      approachId,
                                    ) ===
                                      workspace.approaches.length - 1
                                  }
                                  onClick={() => void moveApproach(1)}
                                >
                                  Move down
                                </Button>
                              </div>
                              <Button
                                variant="danger"
                                disabled={
                                  dirty || saving || structuralBusy || deleting
                                }
                                onClick={() => void removeApproach()}
                              >
                                Delete Approach
                              </Button>
                            </>
                          ) : (
                            <p className="m-0 text-sm text-secondary">
                              Add an Approach to prepare a Solution.
                            </p>
                          )}
                        </div>
                      </details>
                    </div>
                  </div>
                  <label className="grid min-w-0 gap-1 text-sm font-semibold">
                    Language
                    <select
                      className="ui-field min-w-0"
                      value={language}
                      disabled={!activeApproach || saving || deleting}
                      onChange={(event) =>
                        setLanguage(event.target.value as Language)
                      }
                    >
                      {languages.map((item) => (
                        <option key={item} value={item}>
                          {languageNames[item]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {activeApproach && (
                  <>
                    <ProblemApproachTags tags={activeApproach.tags} />
                    <SolutionPanel
                      mode="officer"
                      language={language}
                      solution={activeApproach.solutions[language]}
                      modelPath={`bank/${problemId}/${approachId}/${language}`}
                      editorHeight={editorHeight}
                      onChange={(solution: Solution) =>
                        editActiveApproach((approach) => ({
                          ...approach,
                          solutions: {
                            ...approach.solutions,
                            [language]: solution,
                          },
                        }))
                      }
                      disabled={saving || deleting}
                    />
                  </>
                )}
              </section>
            </div>
            <section
              className="mt-8 border-t border-border-soft pt-5"
              aria-label="Usage history"
            >
              {usage.status === 'loading' ? (
                <>
                  <h2 className="mb-2 mt-0 text-lg font-semibold">
                    Usage history
                  </h2>
                  <StateMessage>Loading usage history…</StateMessage>
                </>
              ) : usage.status === 'error' ? (
                <>
                  <h2 className="mb-2 mt-0 text-lg font-semibold">
                    Usage history
                  </h2>
                  <StateMessage>
                    Usage history could not be loaded.
                  </StateMessage>
                  <Button onClick={() => setUsageRetry((value) => value + 1)}>
                    Retry
                  </Button>
                </>
              ) : (
                <ProblemUsageHistory
                  summary={usage.summary}
                  title="Usage history"
                />
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function approachesIndex(approaches: SolutionApproach[], id: string) {
  return approaches.findIndex((approach) => approach.id === id);
}
