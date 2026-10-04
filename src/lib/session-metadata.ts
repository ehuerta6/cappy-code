import type { Session } from './domain';

export type SessionMetadata = Pick<Session, 'title' | 'date'>;

export function validateSessionMetadata(
  metadata: SessionMetadata,
): SessionMetadata {
  const title = metadata.title.trim();
  if (!title) throw new Error('Enter a session title.');

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(metadata.date);
  if (!match) throw new Error('Enter a date in YYYY-MM-DD format.');
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) {
    throw new Error('Enter a valid calendar date.');
  }
  return { title, date: metadata.date };
}

export function todayCalendarDate(): string {
  const today = new Date();
  return [
    String(today.getFullYear()).padStart(4, '0'),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}
