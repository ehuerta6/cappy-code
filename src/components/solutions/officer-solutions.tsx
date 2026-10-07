'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { languages, type Language, type Solution } from '@/lib/domain';
import {
  getSolutionsForProblem,
  updateSolution,
  type ProblemSolutions,
} from '@/lib/firebase/solutions';
import SolutionPanel, { languageNames } from './solution-panel';
import { getSharedEditorHeight } from './solution-sizing';
import type {
  OfficerSaveState,
  SaveStateReporter,
} from '@/components/officer-save-state';

const buttonClass =
  'min-h-10 rounded border border-border-strong bg-surface px-3 py-2 text-ink hover:bg-hover disabled:cursor-default disabled:bg-raised disabled:text-muted';

type Props = {
  sessionId: string;
  problemId: string;
  onPendingChange?: (pending: boolean) => void;
  onSaveStateChange?: SaveStateReporter;
  disabled?: boolean;
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
}: Props) {
  const [solutions, setSolutions] = useState<ProblemSolutions | null>(null);
  const [currentCode, setCurrentCode] = useState<Record<
    Language,
    string
  > | null>(null);
  const [error, setError] = useState(false);
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
  const hasUnsavedContent = languages.some(
    (language) => saveStates[language]?.dirty || saveStates[language]?.saving,
  );
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
        save: async () => {
          await Promise.all(
            languages.map((language) => saveStates[language]?.save?.()),
          );
        },
      });
      return;
    }
    onSaveStateChange?.(
      hasUnsavedContent
        ? {
            dirty: true,
            saving: languages.some((language) => saveStates[language]?.saving),
            save: async () => {
              await Promise.all(
                languages.map((language) => saveStates[language]?.save?.()),
              );
            },
          }
        : null,
    );
  }, [hasUnsavedContent, onSaveStateChange, saveStates]);
  useEffect(() => {
    let active = true;
    getSolutionsForProblem(sessionId, problemId)
      .then((loaded) => {
        if (active) {
          setSolutions(loaded);
          setCurrentCode({
            python: loaded.python.code,
            java: loaded.java.code,
            cpp: loaded.cpp.code,
          });
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [sessionId, problemId, attempt]);
  return (
    <section aria-label="Solutions">
      <h2>Solutions</h2>
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
                  key={language}
                  sessionId={sessionId}
                  problemId={problemId}
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
  language,
  initial,
  editorHeight,
  disabled,
  onSaveStateChange,
  onCodeChange,
}: {
  sessionId: string;
  problemId: string;
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
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const dirty = draft.code !== saved.code;
  const save = useCallback(async () => {
    if (!dirty || busy.current) return;
    const submitted = draft;
    busy.current = true;
    setSaving(true);
    setError(false);
    try {
      await updateSolution(sessionId, problemId, language, submitted);
      setSaved(submitted);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, [dirty, sessionId, problemId, language, draft]);
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
                ? `${languageNames[language]} Solution could not be saved.`
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
          if (next.code === saved.code) setError(false);
        }}
      />
    </div>
  );
}
