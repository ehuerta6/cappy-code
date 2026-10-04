'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { languages, type Language, type Solution } from '@/lib/domain';
import {
  getSolutionsForProblem,
  updateSolution,
  type ProblemSolutions,
} from '@/lib/firebase/solutions';
import SolutionPanel, { languageNames } from './solution-panel';
import styles from './solutions.module.css';

type Props = {
  sessionId: string;
  problemId: string;
  onPendingChange?: (pending: boolean) => void;
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
  disabled,
}: Props) {
  const [solutions, setSolutions] = useState<ProblemSolutions | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<Record<Language, boolean>>({
    python: false,
    java: false,
    cpp: false,
  });
  const reportPending = useCallback((language: Language, value: boolean) => {
    setPending((previous) =>
      previous[language] === value
        ? previous
        : { ...previous, [language]: value },
    );
  }, []);
  const hasPendingChanges = languages.some((language) => pending[language]);
  useEffect(() => {
    onPendingChange?.(hasPendingChanges);
  }, [hasPendingChanges, onPendingChange]);
  useEffect(() => {
    let active = true;
    getSolutionsForProblem(sessionId, problemId)
      .then((loaded) => {
        if (active) setSolutions(loaded);
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
            className={styles.button}
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
          <p className={styles.hint}>
            Code and prepared output save after a short pause. Finish saving
            before switching Problems. In Monaco, press Ctrl+M to toggle Tab key
            navigation.
          </p>
          <div
            className={styles.rail}
            tabIndex={0}
            aria-label="Three-language solution comparison"
          >
            <div className={styles.grid}>
              {languages.map((language) => (
                <EditableSolution
                  key={language}
                  sessionId={sessionId}
                  problemId={problemId}
                  language={language}
                  initial={solutions[language]}
                  disabled={disabled}
                  onPendingChange={reportPending}
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
  disabled,
  onPendingChange,
}: {
  sessionId: string;
  problemId: string;
  language: Language;
  initial: Solution;
  disabled?: boolean;
  onPendingChange: (language: Language, pending: boolean) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const dirty = draft.code !== saved.code || draft.output !== saved.output;
  useEffect(() => {
    onPendingChange(language, dirty || saving);
  }, [language, dirty, saving, onPendingChange]);
  const save = useCallback(async () => {
    if (!dirty || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(false);
    try {
      await updateSolution(sessionId, problemId, language, draft);
      setSaved(draft);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, [dirty, sessionId, problemId, language, draft]);
  useEffect(() => {
    if (!dirty || saving || error) return;
    const timer = window.setTimeout(() => void save(), 700);
    return () => window.clearTimeout(timer);
  }, [dirty, saving, error, save]);
  return (
    <div>
      <SolutionPanel
        mode="officer"
        language={language}
        solution={draft}
        modelPath={`officer/${sessionId}/${problemId}/${language}`}
        disabled={disabled}
        onChange={(next) => {
          setDraft(next);
          if (next.code === saved.code && next.output === saved.output)
            setError(false);
        }}
      />
      <p
        className={styles.saveStatus}
        role="status"
        aria-label={`${languageNames[language]} save status`}
      >
        {saving
          ? 'Saving…'
          : error && dirty
            ? 'Save failed — edits retained'
            : dirty
              ? 'Unsaved changes'
              : 'Saved ✓'}
      </p>
      {error && dirty && (
        <div role="alert">
          <p>
            {languageNames[language]} changes could not be saved. Your edits are
            still here.
          </p>
          <button
            className={styles.button}
            onClick={() => void save()}
            disabled={saving || disabled}
          >
            Retry {languageNames[language]} save
          </button>
        </div>
      )}
    </div>
  );
}
