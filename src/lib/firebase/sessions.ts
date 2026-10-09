import 'client-only';

import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocFromServer,
  getDocsFromServer,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Problem, Session } from '../domain';
import { languages, problemSchema, sessionSchema } from '../domain';
import {
  validateSessionMetadata,
  type SessionMetadata,
} from '../session-metadata';
import { todayCalendarDate } from '../calendar-date';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import {
  approachCollectionPath,
  approachSolutionPath,
  bankProblemPath,
  problemPath,
  sessionPath,
} from './paths';
import { appendProblemDeletion } from './problems';
import { getApproaches } from './solutions';

export interface SessionRecord {
  id: string;
  session: Session;
  problemCount: number | null;
}

export type ProblemCountState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; count: number };

function officerDb() {
  const user = getOfficerAuth().currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('Sign in to Officer Mode to manage sessions.');
  }
  return getFirestoreDb();
}

export async function createSession(
  metadata: SessionMetadata,
): Promise<string> {
  const db = officerDb();
  const fields = validateSessionMetadata(metadata);
  const reference = await addDoc(collection(db, 'sessions'), {
    ...fields,
    status: 'draft',
    bankProblemIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function duplicateSession(id: string): Promise<string> {
  const db = officerDb();
  const sourceReference = doc(db, sessionPath(id));
  const sourceSnapshot = await getDocFromServer(sourceReference);
  if (!sourceSnapshot.exists())
    throw new Error('This Session no longer exists.');
  if (sourceSnapshot.metadata.hasPendingWrites)
    throw new Error('Session changes are awaiting confirmation.');
  const parsed = sessionSchema.safeParse(sourceSnapshot.data());
  if (!parsed.success)
    throw new Error(
      'This Session has invalid saved metadata and cannot be copied.',
    );

  const sourceProblems = await getDocsFromServer(
    collection(db, `${sessionPath(id)}/problems`),
  );
  if (sourceProblems.docs.some((problem) => problem.metadata.hasPendingWrites))
    throw new Error('Problem changes are awaiting confirmation.');
  const problems = sourceProblems.docs
    .map((problem) => {
      const data = problem.data();
      const hasValidOrder =
        typeof data.order === 'number' && Number.isFinite(data.order);
      const result = problemSchema.safeParse({
        ...data,
        order: hasValidOrder ? data.order : 0,
      });
      if (!result.success)
        throw new Error('A saved Problem is invalid and cannot be copied.');
      return { id: problem.id, problem: result.data, hasValidOrder };
    })
    .sort((left, right) => {
      if (left.hasValidOrder && right.hasValidOrder) {
        if (left.problem.order < right.problem.order) return -1;
        if (left.problem.order > right.problem.order) return 1;
      }
      if (left.hasValidOrder !== right.hasValidOrder)
        return left.hasValidOrder ? -1 : 1;
      if (left.id < right.id) return -1;
      if (left.id > right.id) return 1;
      return 0;
    });
  const prepared = await Promise.all(
    problems.map(async ({ id: problemId, problem }) => ({
      problem,
      approaches: await getApproaches(problemPath(id, problemId)),
    })),
  );
  const writeCount =
    1 +
    prepared.reduce(
      (total, entry) => total + 1 + entry.approaches.length * 4,
      0,
    );
  if (writeCount > 500)
    throw new Error(
      'This Session is too large to duplicate in one Firestore batch.',
    );

  const duplicateReference = doc(collection(db, 'sessions'));
  const batch = writeBatch(db);
  const bankProblemIds = [
    ...new Set(
      prepared.flatMap(({ problem }) =>
        problem.bankCopyPending === true || !problem.bankProblemId
          ? []
          : [problem.bankProblemId],
      ),
    ),
  ];
  batch.set(duplicateReference, {
    branch: parsed.data.branch,
    title: `${parsed.data.title} Copy`,
    date: todayCalendarDate(),
    status: 'draft',
    bankProblemIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  for (const [order, entry] of prepared.entries()) {
    const problemReference = doc(
      collection(db, `${sessionPath(duplicateReference.id)}/problems`),
    );
    const copiedProblem: Problem = {
      ...entry.problem,
      order,
      answersVisible: false,
    };
    for (const field of [
      'leetcodeUrl',
      'difficulty',
      'bankProblemId',
      'bankOrigin',
      'bankCopyPending',
    ] as const) {
      if (copiedProblem[field] === undefined) delete copiedProblem[field];
    }
    if (copiedProblem.bankCopyPending === true) {
      delete copiedProblem.bankCopyPending;
      delete copiedProblem.bankProblemId;
      delete copiedProblem.bankOrigin;
    }
    batch.set(problemReference, { ...copiedProblem, approachesEnabled: true });
    for (const [approachOrder, approach] of entry.approaches.entries()) {
      const approachReference = doc(
        collection(
          db,
          approachCollectionPath(
            problemPath(duplicateReference.id, problemReference.id),
          ),
        ),
      );
      batch.set(approachReference, {
        name: approach.name,
        tags: approach.tags,
        order: approachOrder,
      });
      for (const language of languages) {
        batch.set(
          doc(
            db,
            approachSolutionPath(
              problemPath(duplicateReference.id, problemReference.id),
              approachReference.id,
              language,
            ),
          ),
          approach.solutions[language],
        );
      }
    }
  }
  await batch.commit();
  return duplicateReference.id;
}

export async function listSessions(): Promise<SessionRecord[]> {
  const db = officerDb();
  const snapshot = await getDocsFromServer(collection(db, 'sessions'));
  const records = await Promise.all(
    snapshot.docs.map(async (document): Promise<SessionRecord> => {
      // A server read can still include local pending writes. Never invent timestamps.
      if (document.metadata.hasPendingWrites) {
        throw new Error(
          'Session changes are still awaiting confirmation. Retry when connected.',
        );
      }
      const parsed = sessionSchema.safeParse(document.data());
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const message = issue?.message;
        if (issue?.path[0] === 'date' || issue?.path[0] === 'title')
          throw new Error(message);
        throw new Error(
          message === 'Choose Intro, General, or ICPC for this session.'
            ? message
            : 'A stored session has invalid fields. Check its Firestore document.',
        );
      }
      const session = parsed.data;
      let problemCount: number | null = null;
      try {
        const problems = await getCountFromServer(
          collection(db, `${sessionPath(document.id)}/problems`),
        );
        problemCount = problems.data().count;
      } catch {
        // Keep the Session available so the Officer can still open it and retry.
      }
      return {
        id: document.id,
        problemCount,
        session,
      };
    }),
  );
  return records.sort(
    (a, b) =>
      a.session.date.localeCompare(b.session.date) || a.id.localeCompare(b.id),
  );
}

export async function transitionSession(
  id: string,
  nextStatus: 'live' | 'draft' | 'ended',
): Promise<void> {
  if (
    nextStatus !== 'live' &&
    nextStatus !== 'draft' &&
    nextStatus !== 'ended'
  ) {
    throw new Error('Unsupported session status transition.');
  }
  const db = officerDb();
  const reference = doc(db, sessionPath(id));

  if (nextStatus === 'live') {
    const problems = await getDocsFromServer(
      collection(db, `${sessionPath(id)}/problems`),
    );
    if (problems.empty) {
      throw new Error('Add at least one problem before going live.');
    }
  }

  const liveSessionReference = doc(db, 'sessionControl/liveSession');
  const legacyLiveSessions =
    nextStatus === 'live' &&
    !(await getDocFromServer(liveSessionReference)).exists()
      ? (
          await getDocsFromServer(
            query(collection(db, 'sessions'), where('status', '==', 'live')),
          )
        ).docs
      : [];

  await runTransaction(db, async (transaction) => {
    const liveSessionSnapshot = await transaction.get(liveSessionReference);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) {
      throw new Error('This session no longer exists.');
    }
    const currentStatus = snapshot.data().status;
    const expectedStatus = nextStatus === 'live' ? 'draft' : 'live';
    if (currentStatus !== expectedStatus) {
      throw new Error(
        nextStatus === 'live'
          ? 'Only draft sessions can go live.'
          : `Only live sessions can be marked ${nextStatus === 'draft' ? 'not live' : 'ended'}.`,
      );
    }

    let liveSessionId: string | null = liveSessionSnapshot.exists()
      ? (liveSessionSnapshot.data().sessionId as string | null)
      : null;

    if (!liveSessionSnapshot.exists()) {
      const otherLiveSession = legacyLiveSessions.find(
        (liveSession) => liveSession.id !== id,
      );

      if (nextStatus === 'live' && otherLiveSession) {
        throw new Error(
          'Another Session is already live. Set it to Not Live or end it before starting this one.',
        );
      }

      liveSessionId = legacyLiveSessions[0]?.id ?? null;
      if (nextStatus !== 'live') liveSessionId = null;
    }

    if (nextStatus === 'live' && liveSessionId && liveSessionId !== id) {
      throw new Error(
        'Another Session is already live. Set it to Not Live or end it before starting this one.',
      );
    }
    const releasesLiveClaim = nextStatus !== 'live' && liveSessionId === id;
    const bankProblemIds: string[] = Array.isArray(
      snapshot.data().bankProblemIds,
    )
      ? [
          ...new Set<string>(
            snapshot
              .data()
              .bankProblemIds.filter(
                (bankId: unknown): bankId is string =>
                  typeof bankId === 'string',
              ),
          ),
        ]
      : [];
    const bankSnapshots = await Promise.all(
      (nextStatus === 'live'
        ? bankProblemIds
        : releasesLiveClaim
          ? bankProblemIds
          : []
      ).map((bankId) => transaction.get(doc(db, bankProblemPath(bankId)))),
    );
    if (nextStatus === 'live' || releasesLiveClaim) {
      transaction.set(liveSessionReference, {
        sessionId: nextStatus === 'live' ? id : null,
      });
    }
    if (nextStatus === 'live' || releasesLiveClaim) {
      for (const bankSnapshot of bankSnapshots) {
        if (!bankSnapshot.exists()) continue;
        transaction.update(bankSnapshot.ref, {
          hiddenByLiveSessionId: nextStatus === 'live' ? id : null,
        });
      }
    }
    transaction.update(reference, {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function updateSession(
  id: string,
  metadata: SessionMetadata,
): Promise<void> {
  const db = officerDb();
  await updateDoc(doc(db, sessionPath(id)), {
    ...validateSessionMetadata(metadata),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSession(id: string): Promise<void> {
  const db = officerDb();
  const problems = await getDocsFromServer(
    collection(db, `${sessionPath(id)}/problems`),
  );
  const sessionReference = doc(db, sessionPath(id));
  const liveSessionReference = doc(db, 'sessionControl/liveSession');
  const [session, liveSession] = await Promise.all([
    getDocFromServer(sessionReference),
    getDocFromServer(liveSessionReference),
  ]);
  const releasesLiveClaim =
    session.exists() &&
    session.data().status === 'live' &&
    liveSession.exists() &&
    liveSession.data().sessionId === id;
  const bankProblemIds: string[] =
    session.exists() && Array.isArray(session.data().bankProblemIds)
      ? [
          ...new Set<string>(
            session
              .data()
              .bankProblemIds.filter(
                (bankId: unknown): bankId is string =>
                  typeof bankId === 'string',
              ),
          ),
        ]
      : [];
  const bankSnapshots = releasesLiveClaim
    ? await Promise.all(
        bankProblemIds.map((bankId) =>
          getDocFromServer(doc(db, bankProblemPath(bankId))),
        ),
      )
    : [];
  const approachSnapshots = await Promise.all(
    problems.docs.map((problem) =>
      getDocsFromServer(
        collection(db, approachCollectionPath(problemPath(id, problem.id))),
      ),
    ),
  );
  const problemWrites = problems.docs.reduce(
    (count, _problem, index) =>
      count + 4 + approachSnapshots[index].docs.length * 4,
    0,
  );
  const bankVisibilityWrites = bankSnapshots.filter((item) =>
    item.exists(),
  ).length;
  // Keep the entire cascade atomic within Firestore's 500-write batch limit.
  const writeCount =
    problemWrites + 1 + Number(releasesLiveClaim) + bankVisibilityWrites;
  if (writeCount > 500)
    throw new Error('Too many problems to delete this session in one batch.');
  const batch = writeBatch(db);
  problems.docs.forEach((problem, index) =>
    appendProblemDeletion(
      batch,
      db,
      id,
      problem.id,
      approachSnapshots[index].docs.map(({ id: approachId }) => approachId),
    ),
  );
  if (releasesLiveClaim) {
    batch.update(liveSessionReference, { sessionId: null });
    for (const bank of bankSnapshots) {
      if (bank.exists()) {
        batch.update(bank.ref, { hiddenByLiveSessionId: null });
      }
    }
  }
  batch.delete(sessionReference);
  await batch.commit();
}
