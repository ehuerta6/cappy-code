import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatCalendarDate, todayCalendarDate } from './calendar-date';
import { validateSessionMetadata } from './session-metadata';

afterEach(() => vi.useRealTimers());

describe('session calendar metadata', () => {
  it('trims the title and preserves a calendar date string', () => {
    expect(
      validateSessionMetadata({ title: ' Arrays ', date: '2028-02-29' }),
    ).toEqual({ branch: 'intro', title: 'Arrays', date: '2028-02-29' });
  });
  it('accepts each supported Session branch and maps legacy missing values to Intro', () => {
    expect(
      validateSessionMetadata({ title: 'Arrays', date: '2026-10-08' }).branch,
    ).toBe('intro');
    for (const branch of ['intro', 'general', 'icpc'] as const) {
      expect(
        validateSessionMetadata({ branch, title: 'Arrays', date: '2026-10-08' })
          .branch,
      ).toBe(branch);
    }
  });
  it('rejects unsupported Session branches', () => {
    expect(() =>
      validateSessionMetadata({
        branch: 'other',
        title: 'Arrays',
        date: '2026-10-08',
      }),
    ).toThrow('Choose Intro, General, or ICPC');
  });
  it.each([
    '2026-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-01',
    '2026-01-00',
    '0000-01-01',
    '10/08/2026',
    '2026-10-08T00:00:00Z',
  ])('rejects invalid date %s', (date) => {
    expect(() => validateSessionMetadata({ title: 'Arrays', date })).toThrow();
  });
  it('rejects an empty title', () => {
    expect(() =>
      validateSessionMetadata({ title: ' ', date: '2026-10-08' }),
    ).toThrow('title');
  });
  it('uses local calendar components for the default date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 8, 23, 30));
    expect(todayCalendarDate()).toBe('2026-10-08');
  });
  it('formats a calendar date without shifting it across time zones', () => {
    expect(formatCalendarDate('2026-10-08')).toBe('Oct 8, 2026');
    expect(formatCalendarDate('not-a-date')).toBe('not-a-date');
  });
});
