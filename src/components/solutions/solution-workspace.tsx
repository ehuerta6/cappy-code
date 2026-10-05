'use client';

import { languages } from '@/lib/domain';
import type { ProblemSolutions } from '@/lib/firebase/solutions';
import SolutionPanel from './solution-panel';

// Read-only rendering receives already-authorized data; it never fetches solutions.
export default function SolutionWorkspace({
  solutions,
  modelPath,
}: {
  solutions: ProblemSolutions;
  modelPath: string;
}) {
  return (
    <div className="animate-[reveal_200ms_ease-out_both]">
      <div
        className="overflow-x-auto p-1 -m-1 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        tabIndex={0}
        aria-label="Three-language solution comparison"
      >
        <div className="grid grid-cols-[repeat(3,minmax(min(360px,calc(100vw-40px)),1fr))] gap-4">
          {languages.map((language) => (
            <SolutionPanel
              key={language}
              mode="member"
              language={language}
              solution={solutions[language]}
              modelPath={`${modelPath}/${language}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
