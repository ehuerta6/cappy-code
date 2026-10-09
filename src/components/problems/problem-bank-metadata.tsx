import type { ProblemDifficulty } from '@/lib/domain';

const difficultyLabels: Record<ProblemDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const difficultyStyles: Record<ProblemDifficulty, string> = {
  easy: 'border-success/50 bg-success-surface',
  medium: 'border-warning/50 bg-warning/10',
  hard: 'border-danger/50 bg-danger-surface',
};

const badgeClass =
  'inline-flex min-h-7 items-center rounded border px-2 py-0.5 text-sm font-medium leading-5 text-ink';

export function ProblemDifficultyBadge({
  difficulty,
}: {
  difficulty?: ProblemDifficulty;
}) {
  if (!difficulty) return null;

  return (
    <span className={`${badgeClass} ${difficultyStyles[difficulty]}`}>
      {difficultyLabels[difficulty]}
    </span>
  );
}

export function ProblemApproachTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;

  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label="DSA / algorithm tags"
    >
      {tags.map((tag) => (
        <span
          className={`${badgeClass} border-border-soft bg-raised`}
          key={tag}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
