'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  languages,
  type Language,
  type Solution,
  type SolutionApproach,
} from '@/lib/domain';
import {
  createApproach,
  deleteApproach,
  getApproaches,
  reorderApproaches,
  saveApproach,
  updateSolution,
  type ProblemSolutions,
} from '@/lib/firebase/solutions';
import SolutionPanel, { languageNames } from './solution-panel';
import { getSharedEditorHeight } from './solution-sizing';
import type {
  OfficerSaveState,
  SaveStateReporter,
} from '@/components/officer-save-state';
import { isPermissionDenied } from '@/lib/firebase/errors';
import { problemPath } from '@/lib/firebase/paths';

const buttonClass =
  'min-h-10 rounded border border-border-strong bg-surface px-3 py-2 text-ink hover:bg-hover disabled:cursor-default disabled:bg-raised disabled:text-muted';

type Props = {
  sessionId: string;
  problemId: string;
  onPendingChange?: (pending: boolean) => void;
  onSaveStateChange?: SaveStateReporter;
  disabled?: boolean;
  structuralChangesAllowed?: boolean;
};

// The parent must prevent navigation/deletion while onPendingChange reports true.
export default function OfficerSolutions(props: Props) {
  return (
    <ProblemSolutionsEditor
      key={`${props.sessionId}/${props.problemId}`}
      {...props}
    />
  );
}

function ProblemSolutionsEditor({
  sessionId,
  problemId,
  onPendingChange,
  onSaveStateChange,
  disabled,
  structuralChangesAllowed = true,
}: Props) {
  const [solutions, setSolutions] = useState<ProblemSolutions | null>(null);
  const [approaches, setApproaches] = useState<SolutionApproach[]>([]);
  const [approachesLoaded, setApproachesLoaded] = useState(false);
  const [approachId, setApproachId] = useState('primary');
  const [approachName, setApproachName] = useState('Primary Approach');
  const [approachTags, setApproachTags] = useState('');
  const [currentCode, setCurrentCode] = useState<Record<
    Language,
    string
  > | null>(null);
  const [error, setError] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataError, setMetadataError] = useState<string | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [structuralBusy, setStructuralBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saveStates, setSaveStates] = useState<
    Record<Language, OfficerSaveState | null>
  >({
    python: null,
    java: null,
    cpp: null,
  });
  const reportSaveState = useCallback(
    (language: Language, state: OfficerSaveState | null) => {
      setSaveStates((previous) =>
        previous[language] === state
          ? previous
          : { ...previous, [language]: state },
      );
    },
    [],
  );
  const parentPath = problemPath(sessionId, problemId);
  const selectedApproach = approaches.find(({ id }) => id === approachId);
  const updatedApproach = useMemo(
    () =>
      selectedApproach
        ? {
            ...selectedApproach,
            name: approachName,
            tags: approachTags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
          }
        : null,
    [approachName, approachTags, selectedApproach],
  );
  const metadataDirty = Boolean(
    selectedApproach &&
    updatedApproach &&
    (selectedApproach.name !== updatedApproach.name ||
      JSON.stringify(selectedApproach.tags) !==
        JSON.stringify(updatedApproach.tags)),
  );
  const hasUnsavedContent =
    metadataDirty ||
    languages.some(
      (language) => saveStates[language]?.dirty || saveStates[language]?.saving,
    );
  const actionLocked = hasUnsavedContent || structuralBusy || metadataSaving;
  const saveApproachMetadata = useCallback(async () => {
    if (!updatedApproach || !metadataDirty) return true;
    setMetadataSaving(true);
    setMetadataError(undefined);
    const updated = {
      ...updatedApproach,
    };
    try {
      await saveApproach(parentPath, updated);
      setApproaches((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      return true;
    } catch {
      setMetadataError('Approach details could not be saved. Retry.');
      return false;
    } finally {
      setMetadataSaving(false);
    }
  }, [metadataDirty, parentPath, updatedApproach]);
  const saveAll = useCallback(async () => {
    const results = await Promise.all(
      languages.map((language) =>
        saveStates[language] ? saveStates[language]?.save() : true,
      ),
    );
    const metadataSaved = await saveApproachMetadata();
    return results.every(Boolean) && metadataSaved;
  }, [saveApproachMetadata, saveStates]);
  const editorHeight = solutions
    ? getSharedEditorHeight({
        ...solutions,
        python: {
          ...solutions.python,
          code: currentCode?.python ?? solutions.python.code,
        },
        java: {
          ...solutions.java,
          code: currentCode?.java ?? solutions.java.code,
        },
        cpp: {
          ...solutions.cpp,
          code: currentCode?.cpp ?? solutions.cpp.code,
        },
      })
    : 0;
  useEffect(() => {
    onPendingChange?.(hasUnsavedContent);
  }, [hasUnsavedContent, onPendingChange]);
  useEffect(() => {
    const failed = languages.find((language) => saveStates[language]?.error);
    if (failed) {
      onSaveStateChange?.({
        dirty: true,
        saving: languages.some((language) => saveStates[language]?.saving),
        error: saveStates[failed]?.error,
        save: saveAll,
      });
      return;
    }
    onSaveStateChange?.(
      hasUnsavedContent
        ? {
            dirty: true,
            saving:
              metadataSaving ||
              languages.some((language) => saveStates[language]?.saving),
            error: metadataError,
            save: saveAll,
          }
        : null,
    );
  }, [
    hasUnsavedContent,
    metadataError,
    metadataSaving,
    onSaveStateChange,
    saveAll,
    saveStates,
  ]);
  useEffect(() => {
    let active = true;
    getApproaches(parentPath)
      .then((loaded) => {
        if (active) {
          setApproaches(loaded);
          setApproachesLoaded(true);
          const selected =
            loaded.find(({ id }) => id === approachId) ?? loaded[0];
          setApproachId(selected?.id ?? 'primary');
          setApproachName(selected?.name ?? 'Primary Approach');
          setApproachTags(selected?.tags.join(', ') ?? '');
          setSolutions(selected?.solutions ?? null);
          setCurrentCode(
            selected
              ? {
                  python: selected?.solutions.python.code ?? '',
                  java: selected?.solutions.java.code ?? '',
                  cpp: selected?.solutions.cpp.code ?? '',
                }
              : null,
          );
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [sessionId, problemId, attempt, parentPath]);
  return (
    <section aria-label="Solutions">
      <h2>Solutions</h2>
      {approaches.length > 1 && (
        <div
          className="mb-3 flex flex-wrap gap-2"
          aria-label="Solution approaches"
        >
          {approaches.map((approach) => (
            <button
              key={approach.id}
              className={buttonClass}
              type="button"
              disabled={actionLocked}
              aria-pressed={approach.id === approachId}
              onClick={() => {
                setApproachId(approach.id);
                setApproachName(approach.name);
                setApproachTags(approach.tags.join(', '));
                setSolutions(approach.solutions);
                setCurrentCode({
                  python: approach.solutions.python.code,
                  java: approach.solutions.java.code,
                  cpp: approach.solutions.cpp.code,
                });
              }}
            >
              {approach.name}
            </button>
          ))}
        </div>
      )}
      {approachesLoaded && (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          {actionError && <p role="alert">{actionError}</p>}
          {structuralChangesAllowed && (
            <button
              className={buttonClass}
              type="button"
              disabled={disabled || actionLocked}
              onClick={async () => {
                setActionError(undefined);
                setStructuralBusy(true);
                try {
                  const added = await createApproach(parentPath);
                  const next = [...approaches, added].map((item, order) => ({
                    ...item,
                    order,
                  }));
                  setApproaches(next);
                  setApproachId(added.id);
                  setApproachName(added.name);
                  setApproachTags('');
                  setSolutions(added.solutions);
                  setCurrentCode({ python: '', java: '', cpp: '' });
                } catch {
                  setActionError('Approach could not be added. Retry.');
                } finally {
                  setStructuralBusy(false);
                }
              }}
            >
              Add Approach
            </button>
          )}
          {selectedApproach && (
            <>
              <label>
                Approach name
                <input
                  className="ml-2 rounded border border-border-strong bg-surface px-2 py-2"
                  value={approachName}
                  onChange={(event) => setApproachName(event.target.value)}
                />
              </label>
              <label>
                Tags (comma separated)
                <input
                  className="ml-2 rounded border border-border-strong bg-surface px-2 py-2"
                  value={approachTags}
                  onChange={(event) => setApproachTags(event.target.value)}
                />
              </label>
              <button
                className={buttonClass}
                type="button"
                onClick={() => void saveApproachMetadata()}
              >
                Save approach details
              </button>
            </>
          )}
          {selectedApproach && structuralChangesAllowed && (
            <>
              <button
                className={buttonClass}
                type="button"
                disabled={disabled || actionLocked}
                onClick={async () => {
                  setActionError(undefined);
                  setStructuralBusy(true);
                  try {
                    await deleteApproach(parentPath, approachId);
                    const nextApproaches = approaches
                      .filter(({ id }) => id !== approachId)
                      .map((item, order) => ({ ...item, order }));
                    const next = nextApproaches[0];
                    setApproaches(nextApproaches);
                    setApproachId(next?.id ?? 'primary');
                    setApproachName(next?.name ?? '');
                    setApproachTags(next?.tags.join(', ') ?? '');
                    setSolutions(next?.solutions ?? null);
                    setCurrentCode(
                      next
                        ? {
                            python: next.solutions.python.code,
                            java: next.solutions.java.code,
                            cpp: next.solutions.cpp.code,
                          }
                        : null,
                    );
                  } catch {
                    setActionError('Approach could not be deleted. Retry.');
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
                disabled={disabled || actionLocked}
                onClick={async () => {
                  const index = approaches.findIndex(
                    ({ id }) => id === approachId,
                  );
                  if (index > 0) {
                    const next = [...approaches];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    setActionError(undefined);
                    setStructuralBusy(true);
                    try {
                      await reorderApproaches(parentPath, next);
                      setApproaches(
                        next.map((item, order) => ({ ...item, order })),
                      );
                    } catch {
                      setActionError(
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
                disabled={disabled || actionLocked}
                onClick={async () => {
                  const index = approaches.findIndex(
                    ({ id }) => id === approachId,
                  );
                  if (index >= 0 && index < approaches.length - 1) {
                    const next = [...approaches];
                    [next[index], next[index + 1]] = [
                      next[index + 1],
                      next[index],
                    ];
                    setActionError(undefined);
                    setStructuralBusy(true);
                    try {
                      await reorderApproaches(parentPath, next);
                      setApproaches(
                        next.map((item, order) => ({ ...item, order })),
                      );
                    } catch {
                      setActionError(
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
      )}
      {error ? (
        <div role="alert">
          <p>Solutions could not be loaded. Check your connection and retry.</p>
          <button
            className={buttonClass}
            onClick={() => {
              setError(false);
              setAttempt((value) => value + 1);
            }}
          >
            Retry solutions
          </button>
        </div>
      ) : !approachesLoaded ? (
        <p role="status">Loading solutions…</p>
      ) : !selectedApproach ? (
        <p>No solution approaches yet. Add an Approach to prepare solutions.</p>
      ) : !solutions ? (
        <p role="status">Loading solutions…</p>
      ) : (
        <>
          <p className="text-sm leading-5 text-muted">
            Python, Java, and C++ solutions for this Problem.
          </p>
          <div
            className="overflow-x-auto p-1 -m-1 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            tabIndex={0}
            aria-label="Three-language solution comparison"
          >
            <div className="grid grid-cols-[repeat(3,minmax(min(360px,calc(100vw-40px)),1fr))] items-stretch gap-4">
              {languages.map((language) => (
                <EditableSolution
                  key={`${approachId}/${language}`}
                  sessionId={sessionId}
                  problemId={problemId}
                  approachId={approachId}
                  language={language}
                  initial={solutions[language]}
                  editorHeight={editorHeight}
                  disabled={disabled}
                  onSaveStateChange={reportSaveState}
                  onCodeChange={(code) =>
                    setCurrentCode((previous) =>
                      previous?.[language] === code
                        ? previous
                        : {
                            python: previous?.python ?? solutions.python.code,
                            java: previous?.java ?? solutions.java.code,
                            cpp: previous?.cpp ?? solutions.cpp.code,
                            [language]: code,
                          },
                    )
                  }
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function EditableSolution({
  sessionId,
  problemId,
  approachId,
  language,
  initial,
  editorHeight,
  disabled,
  onSaveStateChange,
  onCodeChange,
}: {
  sessionId: string;
  problemId: string;
  approachId: string;
  language: Language;
  initial: Solution;
  editorHeight: number;
  disabled?: boolean;
  onSaveStateChange: (
    language: Language,
    state: OfficerSaveState | null,
  ) => void;
  onCodeChange: (code: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const dirty =
    draft.code !== saved.code ||
    draft.timeComplexity !== saved.timeComplexity ||
    draft.timeComplexityReason !== saved.timeComplexityReason ||
    draft.spaceComplexity !== saved.spaceComplexity ||
    draft.spaceComplexityReason !== saved.spaceComplexityReason;
  const save = useCallback(async () => {
    if (!dirty || busy.current) return true;
    const submitted = draft;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      await updateSolution(
        sessionId,
        problemId,
        language,
        submitted,
        approachId,
      );
      setSaved(submitted);
      return true;
    } catch (error) {
      setError(
        isPermissionDenied(error)
          ? 'Permission denied. Sign in to Officer Mode and retry.'
          : 'Save failed. Check your connection and retry.',
      );
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, [dirty, sessionId, problemId, language, draft, approachId]);
  useEffect(() => {
    const isDirty = dirty;
    onSaveStateChange(
      language,
      isDirty || saving
        ? {
            dirty: Boolean(isDirty),
            saving,
            error:
              error && isDirty
                ? `${languageNames[language]} Solution could not be saved. ${error}`
                : undefined,
            save,
          }
        : null,
    );
  }, [language, dirty, saving, error, onSaveStateChange, save]);
  return (
    <div>
      <SolutionPanel
        mode="officer"
        language={language}
        solution={draft}
        editorHeight={editorHeight}
        modelPath={`officer/${sessionId}/${problemId}/${language}`}
        disabled={disabled}
        onChange={(next) => {
          setDraft(next);
          if (next.code !== draft.code) onCodeChange(next.code);
          if (
            next.code === saved.code &&
            next.timeComplexity === saved.timeComplexity &&
            next.timeComplexityReason === saved.timeComplexityReason &&
            next.spaceComplexity === saved.spaceComplexity &&
            next.spaceComplexityReason === saved.spaceComplexityReason
          )
            setError(null);
        }}
      />
    </div>
  );
}
