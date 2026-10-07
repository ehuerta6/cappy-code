'use client';

import { languages } from '@/lib/domain';
import type { ProblemSolutions } from '@/lib/firebase/solutions';
import SolutionPanel from './solution-panel';
import { getSharedEditorHeight } from './solution-sizing';

// Read-only rendering receives already-authorized data; it never fetches solutions.
export default function SolutionWorkspace({
  solutions,
  modelPath,
}: {
  solutions: ProblemSolutions;
  modelPath: string;
}) {
  const editorHeight = getSharedEditorHeight(solutions);
  return (
    <div className="animate-[reveal_200ms_ease-out_both]">
      <div
        className="-m-1 overflow-x-auto rounded-lg border border-border-strong bg-surface p-1 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        role="region"
        tabIndex={0}
        aria-label="Three-language solution comparison"
      >
        <div className="grid grid-cols-[repeat(3,minmax(min(360px,calc(100vw-40px)),1fr))] divide-x divide-border-soft">
          {languages.map((language) => (
            <SolutionPanel
              key={language}
              mode="member"
              language={language}
              solution={solutions[language]}
              modelPath={`${modelPath}/${language}`}
              editorHeight={editorHeight}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
