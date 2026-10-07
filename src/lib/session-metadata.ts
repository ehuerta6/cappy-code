import {
  sessionBranchSchema,
  type Session,
  type SessionBranch,
} from './domain';
import { calendarDateSchema } from './calendar-date';

export type SessionMetadata = Pick<Session, 'branch' | 'title' | 'date'>;
export type SessionMetadataInput = Pick<Session, 'title' | 'date'> & {
  branch?: unknown;
};

export function validateSessionBranch(value: unknown): SessionBranch {
  if (value === undefined) return 'intro';
  const branch = sessionBranchSchema.safeParse(value);
  if (!branch.success) {
    throw new Error('Choose Intro, General, or ICPC for this session.');
  }
  return branch.data;
}

export function validateSessionMetadata(
  metadata: SessionMetadataInput,
): SessionMetadata {
  const title = metadata.title.trim();
  if (!title) throw new Error('Enter a session title.');
  const branch = validateSessionBranch(metadata.branch);

  const date = calendarDateSchema.safeParse(metadata.date);
  if (!date.success) throw new Error(date.error.issues[0]?.message);
  return { branch, title, date: metadata.date };
}
