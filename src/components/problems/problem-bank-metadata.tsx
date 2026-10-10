import type { ProblemDifficulty } from '@/lib/domain';
import { Badge } from '@/components/ui/primitives';
import { resolveDsaTag, type DsaTagFamily } from '@/lib/dsa-tags';
import { useDsaTagCatalog } from './dsa-tag-catalog-provider';

const difficultyLabels: Record<ProblemDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const difficultyStyles: Record<ProblemDifficulty, string> = {
  easy: 'border-success/50 bg-success-surface text-ink',
  medium: 'border-warning/50 bg-warning/10 text-ink',
  hard: 'border-danger/50 bg-danger-surface text-ink',
};

export function ProblemDifficultyBadge({
  difficulty,
}: {
  difficulty?: ProblemDifficulty;
}) {
  if (!difficulty) return null;

  return (
    <Badge
      tone={
        difficulty === 'easy'
          ? 'success'
          : difficulty === 'medium'
            ? 'warning'
            : 'danger'
      }
      className={difficultyStyles[difficulty]}
    >
      {difficultyLabels[difficulty]}
    </Badge>
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
        <DsaTagBadge id={tag} key={tag} />
      ))}
    </div>
  );
}

export function DsaTagBadge({ id }: { id: string }) {
  const tag = resolveDsaTag(id, useDsaTagCatalog());
  return (
    <Badge
      className={`text-ink ${tagFamilies[tag.family]}`}
      data-tag-family={tag.family}
    >
      {tag.label}
    </Badge>
  );
}

export function ProblemLink({ href }: { href?: string }) {
  if (!href) return null;
  return (
    <a
      className="inline-flex min-h-11 items-center px-1 text-sm text-muted underline decoration-border-strong underline-offset-4 hover:text-ink focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      Problem link ↗
    </a>
  );
}

const tagFamilies: Record<DsaTagFamily, string> = {
  data: 'border-[var(--tag-data-border)] bg-[var(--tag-data-bg)]',
  search: 'border-[var(--tag-search-border)] bg-[var(--tag-search-bg)]',
  graph: 'border-[var(--tag-graph-border)] bg-[var(--tag-graph-bg)]',
  strategy: 'border-[var(--tag-strategy-border)] bg-[var(--tag-strategy-bg)]',
};
