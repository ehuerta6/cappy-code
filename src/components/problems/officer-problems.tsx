'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  createProblem,
  deleteProblem,
  listProblems,
  reorderProblems,
  setAnswersVisible,
  type ProblemRecord,
} from '@/lib/firebase/problems';
import ProblemEditor from './problem-editor';
import styles from './problems.module.css';
import OfficerSolutions from '../solutions/officer-solutions';

export default function OfficerProblems({
  sessionId,
  onBusyChange,
  onProblemCountChange,
}: {
  sessionId: string;
  onBusyChange: (busy: boolean) => void;
  onProblemCountChange: (count: number) => void;
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
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lock = useRef(false);
  const tabs = useRef(new Map<string, HTMLButtonElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const actionsButton = useRef<HTMLButtonElement>(null);
  const selected = records.find((record) => record.id === selectedId);
  const blocked = editing || solutionPending || operation !== null;

  useEffect(() => {
    onBusyChange(blocked);
  }, [blocked, onBusyChange]);

  useEffect(() => {
    if (!loading && !loadError) onProblemCountChange(records.length);
  }, [loadError, loading, onProblemCountChange, records.length]);

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
    <section className={styles.workspace} aria-label="Session problems">
      <h2>Problems</h2>
      {loading ? (
        <p role="status">Loading problems…</p>
      ) : loadError ? (
        <div role="alert">
          <p>Problems could not be loaded. Check your connection and retry.</p>
          <button className={styles.button} onClick={reload}>
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
                className={styles.button}
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
                className={styles.button}
                disabled={blocked}
                onClick={add}
              >
                + Add problem
              </button>
            </div>
          ) : (
            <>
              <div className={styles.toolbar}>
                <div
                  className={styles.tabs}
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
                      className={styles.tab}
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
                  className={styles.button}
                  disabled={blocked}
                  onClick={add}
                  aria-label="Add problem"
                >
                  +
                </button>
                <button
                  ref={actionsButton}
                  className={styles.button}
                  disabled={blocked}
                  aria-expanded={actionsOpen}
                  aria-controls="problem-actions"
                  onClick={() => setActionsOpen((open) => !open)}
                >
                  Problem actions
                </button>
              </div>
              {actionsOpen && selected && (
                <div
                  id="problem-actions"
                  className={styles.actions}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setActionsOpen(false);
                      actionsButton.current?.focus();
                    }
                  }}
                >
                  <button
                    autoFocus
                    className={styles.button}
                    disabled={blocked}
                    onClick={() => {
                      setActionsOpen(false);
                      document.getElementById('problem-title')?.focus();
                    }}
                  >
                    Rename
                  </button>
                  <button
                    className={styles.button}
                    disabled={blocked || records[0].id === selected.id}
                    onClick={() => move(-1)}
                  >
                    Move earlier
                  </button>
                  <button
                    className={styles.button}
                    disabled={blocked || records.at(-1)?.id === selected.id}
                    onClick={() => move(1)}
                  >
                    Move later
                  </button>
                  <button
                    className={styles.button}
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
                  className={styles.actions}
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
                    className={styles.button}
                    disabled={blocked}
                    onClick={() => {
                      setConfirmDelete(false);
                      actionsButton.current?.focus();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.button}
                    disabled={blocked}
                    onClick={remove}
                  >
                    Confirm delete problem
                  </button>
                </div>
              )}
              {selected && (
                <>
                  <div className={styles.reveal}>
                    <p>
                      Answers are{' '}
                      {selected.problem.answersVisible ? 'visible' : 'hidden'}{' '}
                      to members for this problem.
                    </p>
                    <button
                      className={styles.button}
                      disabled={blocked}
                      onClick={toggleAnswers}
                    >
                      {selected.problem.answersVisible
                        ? 'Hide Answers'
                        : 'Show Answers'}
                    </button>
                  </div>
                  <ProblemEditor
                    key={selected.id}
                    sessionId={sessionId}
                    record={selected}
                    disabled={operation !== null}
                    onBusyChange={setEditing}
                    onSaved={(content) =>
                      setRecords((records) =>
                        records.map((record) =>
                          record.id === selected.id
                            ? {
                                ...record,
                                problem: { ...record.problem, ...content },
                              }
                            : record,
                        ),
                      )
                    }
                  />
                  <OfficerSolutions
                    key={`${sessionId}/${selected.id}`}
                    sessionId={sessionId}
                    problemId={selected.id}
                    disabled={operation !== null}
                    onPendingChange={setSolutionPending}
                  />
                </>
              )}
              {editing && (
                <p>Save problem changes before using problem actions.</p>
              )}
              {solutionPending && (
                <p>Finish saving solution changes before changing problems.</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
