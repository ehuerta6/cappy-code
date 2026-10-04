import { afterEach, describe, expect, it, vi } from 'vitest';
import { todayCalendarDate, validateSessionMetadata } from './session-metadata';

afterEach(() => vi.useRealTimers());

describe('session calendar metadata', () => {
  it('trims the title and preserves a calendar date string', () => {
    expect(
      validateSessionMetadata({ title: ' Arrays ', date: '2028-02-29' }),
    ).toEqual({ title: 'Arrays', date: '2028-02-29' });
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
});
