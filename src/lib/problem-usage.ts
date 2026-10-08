import type { SessionBranch, SessionStatus } from './domain';
import { sessionBranchLabels } from './domain';

export interface ProblemUsageSource {
  sessionId: string;
  title: string;
  branch: SessionBranch;
  date: string;
  status: SessionStatus;
  bankProblemIds: string[];
}

export interface ProblemUsageOccurrence {
  sessionId: string;
  title: string;
  branch: SessionBranch;
  date: string;
  relativeDate: string;
  status: SessionStatus;
  href?: string;
}

export interface ProblemUsageSummary {
  count: number;
  lastUsed: ProblemUsageOccurrence | null;
  branches: SessionBranch[];
  history: ProblemUsageOccurrence[];
}

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function formatRelativeSessionDate(
  sessionDate: string,
  today: string,
): string {
  const difference = dayNumber(today) - dayNumber(sessionDate);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  if (difference < 0) {
    const days = Math.abs(difference);
    return days === 1 ? 'Tomorrow' : `In ${days} days`;
  }
  if (difference < 7) return `${difference} days ago`;
  if (difference < 30) return `${Math.floor(difference / 7)} weeks ago`;

  const [sessionYear, sessionMonth] = sessionDate.split('-').map(Number);
  const [todayYear, todayMonth] = today.split('-').map(Number);
  let months = (todayYear - sessionYear) * 12 + todayMonth - sessionMonth;
  const sessionDay = Number(sessionDate.slice(-2));
  const todayDay = Number(today.slice(-2));
  if (todayDay < sessionDay) months -= 1;
  if (months < 12) return `${Math.max(1, months)} months ago`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

export function deriveProblemUsage(
  problemId: string,
  sessions: ProblemUsageSource[],
  today: string,
  audience: 'member' | 'officer',
): ProblemUsageSummary {
  const bySession = new Map<string, ProblemUsageSource>();
  for (const session of sessions) {
    if (audience === 'member' && session.status === 'draft') continue;
    if (session.bankProblemIds.includes(problemId))
      bySession.set(session.sessionId, session);
  }
  const history = [...bySession.values()]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || a.sessionId.localeCompare(b.sessionId),
    )
    .map((session) => ({
      sessionId: session.sessionId,
      title: session.title,
      branch: session.branch,
      date: session.date,
      relativeDate: formatRelativeSessionDate(session.date, today),
      status: session.status,
      ...(session.status !== 'draft'
        ? { href: `/sessions/${encodeURIComponent(session.sessionId)}` }
        : {}),
    }));
  const branches = [...new Set(history.map(({ branch }) => branch))].sort(
    (a, b) => sessionBranchLabels[a].localeCompare(sessionBranchLabels[b]),
  );
  return {
    count: history.length,
    lastUsed: history[0] ?? null,
    branches,
    history,
  };
}

export { sessionBranchLabels };
