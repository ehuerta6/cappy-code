import 'client-only';

import {
  collection,
  getDocsFromServer,
  query,
  where,
} from 'firebase/firestore';
import { problemSchema, sessionSchema } from '../domain';
import { todayCalendarDate } from '../calendar-date';
import {
  deriveProblemUsage,
  type ProblemUsageSource,
  type ProblemUsageSummary,
} from '../problem-usage';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import { sessionPath } from './paths';

export async function listProblemUsageSummaries(
  problemIds: string[],
  officer = false,
): Promise<Record<string, ProblemUsageSummary>> {
  const user = getOfficerAuth().currentUser;
  if (officer && (!user || user.isAnonymous))
    throw new Error(
      'Sign in to Officer Mode to inspect complete usage history.',
    );

  const db = getFirestoreDb();
  const sessions = await getDocsFromServer(
    officer
      ? collection(db, 'sessions')
      : query(
          collection(db, 'sessions'),
          where('status', 'in', ['live', 'ended']),
        ),
  );
  const sources: ProblemUsageSource[] = await Promise.all(
    sessions.docs.map(async (document) => {
      if (document.metadata.hasPendingWrites)
        throw new Error('Session changes are awaiting confirmation.');
      const session = sessionSchema.parse(document.data());
      const problemSnapshots = await getDocsFromServer(
        collection(db, `${sessionPath(document.id)}/problems`),
      );
      const bankProblemIds = problemSnapshots.docs.flatMap(
        (problemDocument) => {
          if (problemDocument.metadata.hasPendingWrites)
            throw new Error('Problem changes are awaiting confirmation.');
          const problem = problemSchema.parse(problemDocument.data());
          return problem.bankCopyPending === true || !problem.bankProblemId
            ? []
            : [problem.bankProblemId];
        },
      );
      return {
        sessionId: document.id,
        title: session.title,
        date: session.date,
        branch: session.branch,
        status: session.status,
        bankProblemIds,
      };
    }),
  );
  const today = todayCalendarDate();
  return Object.fromEntries(
    problemIds.map((problemId) => [
      problemId,
      deriveProblemUsage(
        problemId,
        sources,
        today,
        officer ? 'officer' : 'member',
      ),
    ]),
  );
}
