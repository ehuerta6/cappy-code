import Link from 'next/link';
import { formatCalendarDate } from '@/lib/calendar-date';
import { sessionBranchLabels } from '@/lib/problem-usage';
import type { ProblemUsageSummary } from '@/lib/problem-usage';

export function ProblemUsageMetadata({
  summary,
  failed = false,
}: {
  summary: ProblemUsageSummary | undefined;
  failed?: boolean;
}) {
  if (!summary)
    return (
      <p className="m-0 px-3 pb-2 text-sm text-secondary" role="status">
        {failed ? 'Usage history unavailable.' : 'Loading usage…'}
      </p>
    );
  return (
    <p className="m-0 px-3 pb-2 text-sm text-secondary">
      Used {summary.count} {summary.count === 1 ? 'time' : 'times'}
      {summary.lastUsed ? (
        <>
          {' · Last used '}
          {summary.lastUsed.href ? (
            <Link
              className="text-accent underline-offset-4 hover:underline"
              href={summary.lastUsed.href}
            >
              {summary.lastUsed.title}
            </Link>
          ) : (
            summary.lastUsed.title
          )}
          {` · ${summary.lastUsed.relativeDate}`}
        </>
      ) : null}
      {summary.branches.length
        ? ` · ${summary.branches.map((branch) => sessionBranchLabels[branch]).join(' · ')}`
        : ''}
    </p>
  );
}

export function ProblemUsageHistory({
  summary,
  failed = false,
  title = 'Used in Sessions',
}: {
  summary: ProblemUsageSummary | undefined;
  failed?: boolean;
  title?: string;
}) {
  return (
    <section className="mt-6" aria-labelledby="usage-history-heading">
      <h2
        className="mb-2 mt-0 text-lg font-semibold"
        id="usage-history-heading"
      >
        {title}
      </h2>
      {!summary ? (
        <p role="status">
          {failed ? 'Usage history unavailable.' : 'Loading usage history…'}
        </p>
      ) : summary.history.length === 0 ? (
        <p>No Session history yet.</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-border-soft p-0">
          {summary.history.map((entry) => (
            <li
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2"
              key={entry.sessionId}
            >
              {entry.href ? (
                <Link
                  className="font-medium text-accent underline-offset-4 hover:underline"
                  href={entry.href}
                >
                  {entry.title}
                </Link>
              ) : (
                <span className="font-medium">{entry.title}</span>
              )}
              <span className="text-sm text-secondary">
                {sessionBranchLabels[entry.branch]}
              </span>
              <time className="text-sm text-secondary" dateTime={entry.date}>
                {formatCalendarDate(entry.date)}
              </time>
              <span className="text-sm text-secondary">
                {entry.relativeDate}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
