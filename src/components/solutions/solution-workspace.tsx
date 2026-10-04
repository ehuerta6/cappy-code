'use client';

import { languages } from '@/lib/domain';
import type { ProblemSolutions } from '@/lib/firebase/solutions';
import SolutionPanel from './solution-panel';
import styles from './solutions.module.css';

// Read-only rendering receives already-authorized data; it never fetches solutions.
export default function SolutionWorkspace({
  solutions,
  modelPath,
}: {
  solutions: ProblemSolutions;
  modelPath: string;
}) {
  return (
    <div className={styles.revealed}>
      <div
        className={styles.rail}
        tabIndex={0}
        aria-label="Three-language solution comparison"
      >
        <div className={styles.grid}>
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
