// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProblemUsageHistory, ProblemUsageMetadata } from './problem-usage';
import type { ProblemUsageSummary } from '@/lib/problem-usage';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const summary: ProblemUsageSummary = {
  count: 2,
  lastUsed: {
    sessionId: 'newest',
    title: 'Newest Session',
    branch: 'general' as const,
    date: '2026-10-08',
    relativeDate: 'Today',
    status: 'ended' as const,
    href: '/sessions/newest',
  },
  branches: ['general', 'intro'],
  history: [
    {
      sessionId: 'newest',
      title: 'Newest Session',
      branch: 'general' as const,
      date: '2026-10-08',
      relativeDate: 'Today',
      status: 'ended' as const,
      href: '/sessions/newest',
    },
    {
      sessionId: 'draft',
      title: 'Draft Session',
      branch: 'intro' as const,
      date: '2026-10-01',
      relativeDate: '1 week ago',
      status: 'draft' as const,
    },
  ],
};

describe('Problem usage UI', () => {
  it('shows count, recency, and branch labels', () => {
    render(<ProblemUsageMetadata summary={summary} />);
    expect(document.body.textContent).toContain(
      'Used 2 times · Last used Newest Session · Today · General · Intro',
    );
  });

  it('shows newest-first Session details with links only when supplied', () => {
    render(<ProblemUsageHistory summary={summary} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe('Newest Session');
    expect(links[0].getAttribute('href')).toBe('/sessions/newest');
    expect(screen.getByText('Draft Session')).toBeTruthy();
    expect(screen.getByText('Oct 8, 2026')).toBeTruthy();
  });

  it('shows an empty history state', () => {
    render(
      <ProblemUsageHistory
        summary={{ count: 0, lastUsed: null, branches: [], history: [] }}
      />,
    );
    expect(screen.getByText('No Session history yet.')).toBeTruthy();
  });
});
