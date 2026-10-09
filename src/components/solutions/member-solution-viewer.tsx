'use client';

import { useEffect, useState } from 'react';
import { languages, type SolutionApproach } from '@/lib/domain';
import SolutionPanel, { languageNames } from './solution-panel';

export default function MemberSolutionViewer({
  approaches,
  modelPath,
}: {
  approaches: SolutionApproach[];
  modelPath: string;
}) {
  const [approachId, setApproachId] = useState(approaches[0]?.id ?? '');
  const [language, setLanguage] = useState<(typeof languages)[number]>(
    languages.find((item) => approaches[0]?.solutions[item].code.trim()) ??
      'python',
  );
  const [editorHeight, setEditorHeight] = useState(440);
  const selected =
    approaches.find(({ id }) => id === approachId) ?? approaches[0];

  useEffect(() => {
    function updateEditorHeight() {
      setEditorHeight(Math.max(300, Math.min(640, window.innerHeight - 360)));
    }
    updateEditorHeight();
    window.addEventListener('resize', updateEditorHeight);
    return () => window.removeEventListener('resize', updateEditorHeight);
  }, []);

  if (!selected) {
    return (
      <p
        className="m-0 rounded-md border border-border-soft bg-surface p-4 text-muted"
        role="status"
      >
        No solution approaches are available yet.
      </p>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="grid min-w-0 gap-1">
          {approaches.length === 1 ? (
            <div
              className="grid gap-1"
              role="group"
              aria-label={`Approach: ${selected.name}`}
            >
              <span
                className="text-sm font-semibold"
                id={`${modelPath}-approach-label`}
              >
                Approach
              </span>
              <p
                className="m-0 flex min-h-11 items-center rounded border border-border-soft bg-raised px-3 font-medium"
                aria-labelledby={`${modelPath}-approach-label`}
              >
                {selected.name}
              </p>
            </div>
          ) : (
            <>
              <label
                className="text-sm font-semibold"
                htmlFor={`${modelPath}-approach`}
              >
                Approach
              </label>
              <select
                className="min-h-11 min-w-0 rounded border border-border-strong bg-surface px-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                id={`${modelPath}-approach`}
                value={selected.id}
                onChange={(event) => setApproachId(event.target.value)}
              >
                {approaches.map((approach) => (
                  <option key={approach.id} value={approach.id}>
                    {approach.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="grid min-w-0 gap-1">
          <label
            className="text-sm font-semibold"
            htmlFor={`${modelPath}-language`}
          >
            Language
          </label>
          <select
            className="min-h-11 min-w-0 rounded border border-border-strong bg-surface px-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            id={`${modelPath}-language`}
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value as (typeof languages)[number])
            }
          >
            {languages.map((item) => (
              <option key={item} value={item}>
                {languageNames[item]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {selected.tags.length > 0 ? (
        <p className="mb-3 mt-0 text-sm text-muted">
          {selected.tags.join(' · ')}
        </p>
      ) : null}
      <SolutionPanel
        key={`${selected.id}/${language}`}
        mode="member"
        language={language}
        solution={selected.solutions[language]}
        modelPath={`${modelPath}/${selected.id}/${language}`}
        editorHeight={editorHeight}
      />
    </div>
  );
}
