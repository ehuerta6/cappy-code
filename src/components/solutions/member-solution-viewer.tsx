'use client';

import { useState } from 'react';
import { languages, type SolutionApproach } from '@/lib/domain';
import { ProblemApproachTags } from '@/components/problems/problem-bank-metadata';
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
  const selected =
    approaches.find(({ id }) => id === approachId) ?? approaches[0];

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
                className="m-0 flex min-h-9 items-center px-0 font-medium"
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
      <ProblemApproachTags tags={selected.tags} />
      <SolutionPanel
        mode="member"
        language={language}
        solution={selected.solutions[language]}
        modelPath={`${modelPath}/${selected.id}/${language}`}
        editorHeight="clamp(18.75rem, 55dvh, 40rem)"
      />
    </div>
  );
}
