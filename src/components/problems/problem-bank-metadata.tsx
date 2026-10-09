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
          className={`${badgeClass} ${tagFamilies[approachTagFamily(tag)]}`}
          data-tag-family={approachTagFamily(tag)}
          key={tag}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function ProblemLink({ href }: { href?: string }) {
  if (!href) return null;
  return (
    <a
      className="inline-flex min-h-10 items-center text-sm text-muted underline decoration-border-strong underline-offset-4 hover:text-ink focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      Problem link ↗
    </a>
  );
}

const tagFamilies: Record<string, string> = {
  'tag-data': 'border-[var(--tag-data-border)] bg-[var(--tag-data-bg)]',
  'tag-search': 'border-[var(--tag-search-border)] bg-[var(--tag-search-bg)]',
  'tag-graph': 'border-[var(--tag-graph-border)] bg-[var(--tag-graph-bg)]',
  'tag-strategy':
    'border-[var(--tag-strategy-border)] bg-[var(--tag-strategy-bg)]',
};

export function approachTagFamily(tag: string) {
  if (
    [
      'Arrays',
      'Hash Map',
      'Two Pointers',
      'Linked List',
      'Stack',
      'Queue',
      'Tree',
    ].includes(tag)
  )
    return 'tag-data';
  if (['Binary Search', 'DFS', 'BFS'].includes(tag)) return 'tag-search';
  if (['Graph', 'Union Find', 'Shortest Path'].includes(tag))
    return 'tag-graph';
  return 'tag-strategy';
}
