import { describe, expect, it } from 'vitest';
import {
  deriveProblemUsage,
  formatRelativeSessionDate,
  type ProblemUsageSource,
} from './problem-usage';

const session = (
  sessionId: string,
  date: string,
  branch: ProblemUsageSource['branch'],
  status: ProblemUsageSource['status'] = 'ended',
  bankProblemIds = ['problem'],
): ProblemUsageSource => ({
  sessionId,
  title: `Session ${sessionId}`,
  date,
  branch,
  status,
  bankProblemIds,
});

describe('problem usage history', () => {
  it('derives distinct Session occurrences, branches, and newest first', () => {
    const result = deriveProblemUsage(
      'problem',
      [
        session('older', '2026-01-01', 'intro'),
        session('newer', '2026-10-08', 'general'),
        session('unrelated', '2026-10-08', 'icpc', 'ended', ['other']),
        session('older', '2026-01-01', 'intro'),
      ],
      '2026-10-08',
      'officer',
    );
    expect(result.count).toBe(2);
    expect(result.history.map(({ sessionId }) => sessionId)).toEqual([
      'newer',
      'older',
    ]);
    expect(result.lastUsed?.relativeDate).toBe('Today');
    expect(result.branches).toEqual(['general', 'intro']);
  });

  it('returns an empty summary and one-use summary', () => {
    expect(
      deriveProblemUsage('missing', [], '2026-10-08', 'member'),
    ).toMatchObject({
      count: 0,
      lastUsed: null,
      branches: [],
      history: [],
    });
    expect(
      deriveProblemUsage(
        'problem',
        [session('one', '2026-10-08', 'intro')],
        '2026-10-08',
        'member',
      ).count,
    ).toBe(1);
  });

  it('keeps drafts out of all member history fields and includes them for officers', () => {
    const sessions = [
      session('public', '2026-10-01', 'general'),
      session('draft', '2026-10-08', 'icpc', 'draft'),
    ];
    const member = deriveProblemUsage(
      'problem',
      sessions,
      '2026-10-08',
      'member',
    );
    expect(member.count).toBe(1);
    expect(member.history[0]).toMatchObject({
      sessionId: 'public',
      href: '/sessions/public',
    });
    expect(JSON.stringify(member)).not.toContain('draft');
    const officer = deriveProblemUsage(
      'problem',
      sessions,
      '2026-10-08',
      'officer',
    );
    expect(officer.count).toBe(2);
    expect(officer.history[0]).toMatchObject({ sessionId: 'draft' });
    expect(officer.history[0]).not.toHaveProperty('href');
  });
});

describe('relative Session calendar dates', () => {
  it.each([
    ['2026-10-08', 'Today'],
    ['2026-10-07', 'Yesterday'],
    ['2026-10-05', '3 days ago'],
    ['2026-09-24', '2 weeks ago'],
    ['2026-06-08', '4 months ago'],
    ['2025-10-08', '1 year ago'],
    ['2024-10-08', '2 years ago'],
  ])('formats %s as %s', (date, expected) => {
    expect(formatRelativeSessionDate(date, '2026-10-08')).toBe(expected);
  });

  it('handles future calendar dates deterministically', () => {
    expect(formatRelativeSessionDate('2026-10-11', '2026-10-08')).toBe(
      'In 3 days',
    );
  });
});
