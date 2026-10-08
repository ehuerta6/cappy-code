'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  createProblem,
  deleteProblem,
  listProblems,
  reorderProblems,
  setAnswersVisible,
  type ProblemContent,
  type ProblemRecord,
} from '@/lib/firebase/problems';
import type { ProblemCountState } from '@/lib/firebase/sessions';
import type { Problem, SessionStatus } from '@/lib/domain';
import {
  addBankProblemToSession,
  listOfficerBankProblems,
  materializeSessionProblemInBank,
  type BankProblemRecord,
} from '@/lib/firebase/problem-bank';
import ProblemEditor from './problem-editor';
import OfficerSolutions from '../solutions/officer-solutions';
import type {
  OfficerSaveState,
  SaveStateReporter,
} from '@/components/officer-save-state';

const buttonClass =
  'min-h-11 rounded border border-border-strong bg-surface px-3 py-2 text-ink hover:bg-hover disabled:cursor-default disabled:bg-raised disabled:text-muted';

export default function OfficerProblems({
  sessionId,
  sessionStatus,
  onBusyChange,
  onSaveStateChange,
  onProblemCountStateChange,
}: {
  sessionId: string;
  sessionStatus: SessionStatus;
  onBusyChange: (busy: boolean) => void;
  onSaveStateChange: SaveStateReporter;
  onProblemCountStateChange: (state: ProblemCountState) => void;
}) {
  const [records, setRecords] = useState<ProblemRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [operation, setOperation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [solutionPending, setSolutionPending] = useState(false);
  const [problemSaveState, setProblemSaveState] =
    useState<OfficerSaveState | null>(null);
  const [solutionSaveState, setSolutionSaveState] =
    useState<OfficerSaveState | null>(null);
  const [materializingBankCopy, setMaterializingBankCopy] = useState(false);
  const [materializationError, setMaterializationError] = useState<
    string | null
  >(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bankPicker, setBankPicker] = useState<
    | { status: 'closed' | 'loading' | 'error' }
    | { status: 'ready'; records: BankProblemRecord[] }
  >({ status: 'closed' });
  const lock = useRef(false);
  const tabs = useRef(new Map<string, HTMLButtonElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const actionsButton = useRef<HTMLButtonElement>(null);
  const selected = records.find((record) => record.id === selectedId);
  const hasPendingBankCopy = records.some(
    (record) => record.problem.bankCopyPending === true,
  );
  const blocked =
    editing || solutionPending || operation !== null || materializingBankCopy;
  const handleProblemSaved = useCallback(
    (content: ProblemContent) => {
      if (!selectedId) return;
      setRecords((currentRecords) =>
        currentRecords.map((record) => {
          if (record.id !== selectedId) return record;
          const { difficulty, ...savedContent } = content;
          const problem: Problem = { ...record.problem, ...savedContent };
          if (!content.leetcodeUrl) delete problem.leetcodeUrl;
          if (difficulty) problem.difficulty = difficulty;
          else delete problem.difficulty;
          return { ...record, problem };
        }),
      );
    },
    [selectedId],
  );
  const workspaceDirty =
    problemSaveState?.dirty === true || solutionSaveState?.dirty === true;
  const workspaceSaving =
    problemSaveState?.saving === true ||
    solutionSaveState?.saving === true ||
    materializingBankCopy;
  const workspaceError =
    problemSaveState?.error || solutionSaveState?.error || materializationError;
  const bankCopyReadyToCreate =
    selected?.problem.bankCopyPending === true &&
    selected.problem.title !== 'Untitled Problem';
  const saveWorkspace = useCallback(async () => {
    if (workspaceSaving) return false;
    setMaterializationError(null);
    const results = await Promise.all([
      problemSaveState?.dirty ? problemSaveState.save() : true,
      solutionSaveState?.dirty ? solutionSaveState.save() : true,
    ]);
    if (!results.every(Boolean)) return false;

    if (selected?.problem.bankCopyPending) {
      setMaterializingBankCopy(true);
      try {
        const result = await materializeSessionProblemInBank(
          sessionId,
          selected.id,
        );
        if (result)
          setRecords((current) =>
            current.map((record) =>
              record.id === selected.id
                ? {
                    ...record,
                    problem: {
                      ...record.problem,
                      bankProblemId: result.bankProblemId,
                      bankCopyPending: false,
                    },
                  }
                : record,
            ),
          );
        return true;
      } catch {
        setMaterializationError(
          'Reusable Bank copy could not be created. Your Session content is saved; retry to create the copy.',
        );
        return false;
      } finally {
        setMaterializingBankCopy(false);
      }
    }
    return true;
  }, [
    problemSaveState,
    selected,
    sessionId,
    solutionSaveState,
    workspaceSaving,
  ]);

  useEffect(() => {
    onBusyChange(blocked || hasPendingBankCopy);
  }, [blocked, hasPendingBankCopy, onBusyChange]);

  useEffect(() => {
    onSaveStateChange(
      workspaceDirty || workspaceSaving
        ? {
            dirty: workspaceDirty,
            saving: workspaceSaving,
            error: workspaceError ?? undefined,
            save: saveWorkspace,
          }
        : null,
    );
  }, [
    onSaveStateChange,
    saveWorkspace,
    workspaceDirty,
    workspaceError,
    workspaceSaving,
  ]);

  useEffect(() => {
    if (loading) {
      onProblemCountStateChange({ status: 'loading' });
    } else if (loadError) {
      onProblemCountStateChange({ status: 'unavailable' });
    } else {
      onProblemCountStateChange({ status: 'ready', count: records.length });
    }
  }, [loadError, loading, onProblemCountStateChange, records.length]);

  useEffect(() => {
    let cancelled = false;
    listProblems(sessionId).then(
      (problems) => {
        if (cancelled) return;
        setRecords(problems);
        setSelectedId((id) =>
          problems.some((record) => record.id === id)
            ? id
            : (problems[0]?.id ?? null),
        );
        setLoading(false);
      },
      () => {
        if (!cancelled) {
          setLoadError(true);
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sessionId, revision]);

  function reload() {
    setError(null);
    setActionsOpen(false);
    setConfirmDelete(false);
    setLoadError(false);
    setLoading(true);
    setRevision((value) => value + 1);
  }
  function select(id: string) {
    setSelectedId(id);
    setActionsOpen(false);
    setConfirmDelete(false);
  }
  function focusProblem(id: string | null) {
    requestAnimationFrame(() => {
      if (id) tabs.current.get(id)?.focus();
      else addButton.current?.focus();
    });
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? records.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + records.length) %
            records.length;
    tabs.current.get(records[next].id)?.focus();
  }
  async function act(label: string, action: () => Promise<void>) {
    if (blocked || lock.current) return;
    lock.current = true;
    setOperation(label);
    setError(null);
    try {
      await action();
    } catch {
      setError(`${label} failed. Check your connection and try again.`);
    } finally {
      lock.current = false;
      setOperation(null);
    }
  }
  function add() {
    void act('Creating problem', async () => {
      const record = await createProblem(sessionId);
      setRecords((records) => [...records, record]);
      select(record.id);
      focusProblem(record.id);
    });
  }
  async function openBankPicker() {
    setBankPicker({ status: 'loading' });
    try {
      setBankPicker({
        status: 'ready',
        records: await listOfficerBankProblems(),
      });
    } catch {
      setBankPicker({ status: 'error' });
    }
  }
  function addFromBank(bankProblem: BankProblemRecord) {
    void act('Adding Problem from bank', async () => {
      const result = await addBankProblemToSession(sessionId, bankProblem.id);
      const record: ProblemRecord = { id: result.id, problem: result.problem };
      setRecords((current) => [...current, record]);
      setBankPicker({ status: 'closed' });
      select(record.id);
      focusProblem(record.id);
    });
  }
  function move(direction: number) {
    if (!selected) return;
    const index = records.findIndex((record) => record.id === selected.id);
    const reordered = [...records];
    [reordered[index], reordered[index + direction]] = [
      reordered[index + direction],
      reordered[index],
    ];
    void act('Reordering problems', async () => {
      await reorderProblems(
        sessionId,
        reordered.map((record) => record.id),
      );
      setRecords(
        reordered.map((record, order) => ({
          ...record,
          problem: { ...record.problem, order },
        })),
      );
      setActionsOpen(false);
      focusProblem(selected.id);
    });
  }
  function remove() {
    if (!selected) return;
    void act('Deleting problem', async () => {
      await deleteProblem(sessionId, selected.id);
      const index = records.findIndex((record) => record.id === selected.id);
      const remaining = records.filter((record) => record.id !== selected.id);
      const next = remaining[Math.min(index, remaining.length - 1)]?.id ?? null;
      setRecords(remaining);
      setSelectedId(next);
      setConfirmDelete(false);
      setActionsOpen(false);
      focusProblem(next);
    });
  }

  function toggleAnswers() {
    if (!selected) return;
    const visible = !selected.problem.answersVisible;
    void act(visible ? 'Showing answers' : 'Hiding answers', async () => {
      await setAnswersVisible(sessionId, selected.id, visible);
      setRecords((records) =>
        records.map((record) =>
          record.id === selected.id
            ? {
                ...record,
                problem: { ...record.problem, answersVisible: visible },
              }
            : record,
        ),
      );
    });
  }

  return (
    <section
      className="text-base leading-relaxed text-ink"
      aria-label="Session problems"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-semibold leading-[26px]">Problems</h2>
          <p className="mb-0 mt-1 text-sm text-muted">
            Changes here apply to this Session only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={buttonClass}
            disabled={blocked || sessionStatus === 'live'}
            onClick={() => void openBankPicker()}
          >
            Add from Problem Bank
          </button>
          {selected &&
            (workspaceDirty ||
              bankCopyReadyToCreate ||
              materializationError) && (
              <button
                className={buttonClass}
                disabled={workspaceSaving || operation !== null}
                onClick={() => void saveWorkspace()}
              >
                {workspaceSaving
                  ? 'Saving…'
                  : workspaceError
                    ? 'Retry'
                    : 'Save changes'}
              </button>
            )}
        </div>
      </div>
      {bankPicker.status !== 'closed' && (
        <section
          className="mb-4 rounded-md border border-border-soft bg-surface p-3"
          aria-label="Choose a bank Problem"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="m-0 text-base font-semibold">Problem Bank</h3>
            <button
              className={buttonClass}
              onClick={() => setBankPicker({ status: 'closed' })}
            >
              Close
            </button>
          </div>
          <p className="my-2 text-sm text-muted">
            Adding a Problem copies its current content and Solutions into this
            Session.
          </p>
          {bankPicker.status === 'loading' ? (
            <p role="status">Loading bank Problems…</p>
          ) : null}
          {bankPicker.status === 'error' ? (
            <div role="alert">
              <p>Problem Bank could not be loaded.</p>
              <button
                className={buttonClass}
                onClick={() => void openBankPicker()}
              >
                Retry
              </button>
            </div>
          ) : null}
          {bankPicker.status === 'ready' &&
            (bankPicker.records.length ? (
              <ul className="m-0 list-none p-0">
                {bankPicker.records.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft py-2"
                  >
                    <span>
                      <strong>{entry.title}</strong>
                      <span className="ml-2 text-sm text-muted">
                        {entry.category}
                      </span>
                    </span>
                    <button
                      className={buttonClass}
                      disabled={blocked}
                      onClick={() => addFromBank(entry)}
                    >
                      Add to Session
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No reusable Problems yet.</p>
            ))}
        </section>
      )}
      {workspaceDirty && (
        <p className="mb-3 text-sm text-muted">
          Unsaved changes. Save or revert changes before leaving this Problem.
        </p>
      )}
      {workspaceError && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {workspaceError}
        </p>
      )}
      {selected?.problem.bankCopyPending && (
        <p className="mb-3 text-sm text-muted" role="status">
          Save a titled Problem to create its reusable Bank copy.
        </p>
      )}
      {loading ? (
        <p role="status">Loading problems…</p>
      ) : loadError ? (
        <div role="alert">
          <p>Problems could not be loaded. Check your connection and retry.</p>
          <button className={buttonClass} onClick={reload}>
            Retry loading problems
          </button>
        </div>
      ) : (
        <>
          {operation && <p role="status">{operation}…</p>}
          {error && (
            <div role="alert">
              <p>{error}</p>
              <button
                className={buttonClass}
                disabled={blocked}
                onClick={reload}
              >
                Reload problems
              </button>
            </div>
          )}
          {records.length === 0 ? (
            <div>
              <h3>No problems yet</h3>
              <p>Add the first problem to this session.</p>
              <button
                ref={addButton}
                className={buttonClass}
                disabled={blocked}
                onClick={add}
              >
                + Add problem
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-stretch gap-2 border-b border-border-soft">
                <div
                  className="flex min-w-0 max-w-full flex-1 basis-80 overflow-x-auto [scrollbar-width:thin]"
                  role="tablist"
                  aria-label="Problems"
                >
                  {records.map((record, index) => (
                    <button
                      key={record.id}
                      ref={(element) => {
                        if (element) tabs.current.set(record.id, element);
                        else tabs.current.delete(record.id);
                      }}
                      className="min-h-11 shrink-0 border-b-2 border-transparent px-3 py-2 text-muted hover:bg-hover hover:text-ink aria-selected:border-accent aria-selected:font-semibold aria-selected:text-ink"
                      role="tab"
                      id={`problem-tab-${record.id}`}
                      aria-controls={`problem-panel-${record.id}`}
                      aria-selected={selectedId === record.id}
                      tabIndex={selectedId === record.id ? 0 : -1}
                      disabled={blocked}
                      onKeyDown={(event) => keyboard(event, index)}
                      onClick={() => select(record.id)}
                    >
                      {record.problem.title}
                    </button>
                  ))}
                </div>
                <button
                  ref={addButton}
                  className={buttonClass}
                  disabled={blocked || sessionStatus === 'live'}
                  onClick={add}
                  aria-label="Add problem"
                >
                  + Add problem
                </button>
                {selected && (
                  <button
                    ref={actionsButton}
                    className="min-h-10 min-w-10 rounded-md px-2 text-lg text-muted hover:bg-hover hover:text-ink disabled:cursor-default disabled:text-muted"
                    disabled={blocked}
                    aria-label={`Manage ${selected.problem.title}`}
                    aria-expanded={actionsOpen}
                    aria-controls="problem-actions"
                    onClick={() => setActionsOpen((open) => !open)}
                  >
                    ···
                  </button>
                )}
              </div>
              {actionsOpen && selected && (
                <div
                  id="problem-actions"
                  className="my-3 flex flex-wrap items-center gap-2 border-y border-border-soft py-3 [&>p]:m-0 [&>p]:basis-full"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setActionsOpen(false);
                      actionsButton.current?.focus();
                    }
                  }}
                >
                  <button
                    autoFocus
                    className={buttonClass}
                    disabled={blocked}
                    onClick={() => {
                      setActionsOpen(false);
                      document.getElementById('problem-title')?.focus();
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className={buttonClass}
                    disabled={blocked || records[0].id === selected.id}
                    onClick={() => move(-1)}
                  >
                    Move earlier
                  </button>
                  <button
                    className={buttonClass}
                    disabled={blocked || records.at(-1)?.id === selected.id}
                    onClick={() => move(1)}
                  >
                    Move later
                  </button>
                  <button
                    className={buttonClass}
                    disabled={blocked}
                    onClick={() => {
                      setConfirmDelete(true);
                      setActionsOpen(false);
                    }}
                  >
                    Delete problem
                  </button>
                </div>
              )}
              {confirmDelete && selected && (
                <div
                  className="my-3 flex flex-wrap items-center gap-2 rounded-md border border-border-strong bg-surface p-3 [&>p]:m-0 [&>p]:basis-full"
                  role="group"
                  aria-label="Confirm problem deletion"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && !blocked) {
                      setConfirmDelete(false);
                      actionsButton.current?.focus();
                    }
                  }}
                >
                  <p>
                    Delete “{selected.problem.title}”? This permanently removes
                    the problem and all three prepared solutions.
                  </p>
                  <button
                    autoFocus
                    className={buttonClass}
                    disabled={blocked}
                    onClick={() => {
                      setConfirmDelete(false);
                      actionsButton.current?.focus();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className={buttonClass}
                    disabled={blocked}
                    onClick={remove}
                  >
                    Confirm delete problem
                  </button>
                </div>
              )}
              {selected && (
                <>
                  {sessionStatus === 'live' ? (
                    <div className="my-3 flex flex-wrap items-center gap-3 border-b border-border-soft py-2 pb-3">
                      <p className="m-0 flex items-center gap-2 text-sm">
                        <span
                          aria-hidden="true"
                          className={
                            selected.problem.answersVisible
                              ? 'text-success'
                              : 'text-muted'
                          }
                        >
                          ●
                        </span>
                        <span className="font-semibold">
                          {selected.problem.answersVisible
                            ? 'Visible to members'
                            : 'Hidden from members'}
                        </span>
                        <span className="text-muted">
                          for {selected.problem.title}
                        </span>
                      </p>
                      <button
                        className={
                          selected.problem.answersVisible
                            ? 'min-h-10 rounded-md px-3 py-2 text-sm text-muted hover:bg-hover hover:text-ink disabled:text-muted'
                            : 'min-h-10 rounded-md border border-accent bg-accent px-3 py-2 text-sm font-semibold text-accent-contrast hover:bg-accent-hover disabled:cursor-default disabled:border-border-strong disabled:bg-raised disabled:text-muted'
                        }
                        disabled={blocked}
                        onClick={toggleAnswers}
                      >
                        {selected.problem.answersVisible
                          ? 'Hide answers'
                          : 'Show answers'}
                      </button>
                    </div>
                  ) : sessionStatus === 'ended' ? (
                    <div className="my-3 flex flex-wrap items-center justify-between gap-3 border-b border-border-soft py-2 pb-3">
                      <p className="m-0">
                        Solutions are public in ended sessions.
                      </p>
                    </div>
                  ) : null}
                  <ProblemEditor
                    key={selected.id}
                    sessionId={sessionId}
                    record={selected}
                    disabled={operation !== null}
                    onBusyChange={setEditing}
                    onSaveStateChange={setProblemSaveState}
                    onSaved={handleProblemSaved}
                  />
                  <OfficerSolutions
                    key={`${sessionId}/${selected.id}`}
                    sessionId={sessionId}
                    problemId={selected.id}
                    disabled={operation !== null}
                    onPendingChange={setSolutionPending}
                    onSaveStateChange={setSolutionSaveState}
                  />
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
