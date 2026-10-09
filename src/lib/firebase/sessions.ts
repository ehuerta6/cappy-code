import 'client-only';

import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocFromServer,
  getDocsFromServer,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { Problem, Session, SessionBranch } from '../domain';
import {
  languages,
  problemSchema,
  sessionBranches,
  sessionBranchLabels,
  sessionSchema,
} from '../domain';
import {
  validateSessionMetadata,
  type SessionMetadata,
} from '../session-metadata';
import { todayCalendarDate } from '../calendar-date';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import {
  approachPath,
  approachCollectionPath,
  approachSolutionPath,
  bankProblemPath,
  problemPath,
  sessionPath,
  solutionPath,
} from './paths';
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

function branchFromData(data: Record<string, unknown>): SessionBranch {
  const branch = data.branch ?? 'intro';
  if (sessionBranches.includes(branch as SessionBranch))
    return branch as SessionBranch;
  throw new Error('This Session has an unsupported CIC branch.');
}

function bankIdsFromData(data: Record<string, unknown>): string[] {
  return Array.isArray(data.bankProblemIds)
    ? [
        ...new Set(
          data.bankProblemIds.filter(
            (value): value is string => typeof value === 'string',
          ),
        ),
      ]
    : [];
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

export async function getSession(id: string): Promise<SessionRecord | null> {
  const db = officerDb();
  const [snapshot, problemCount] = await Promise.all([
    getDocFromServer(doc(db, sessionPath(id))),
    getCountFromServer(collection(db, `${sessionPath(id)}/problems`))
      .then((result) => result.data().count)
      .catch(() => null),
  ]);
  if (!snapshot.exists()) return null;
  if (snapshot.metadata.hasPendingWrites)
    throw new Error('Session changes are awaiting confirmation.');
  const parsed = sessionSchema.safeParse(snapshot.data());
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
  return { id, session: parsed.data, problemCount };
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
  await runTransaction(db, async (transaction) => {
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

    const targetBranch = branchFromData(snapshot.data());
    const branchReferences = Object.fromEntries(
      sessionBranches.map((branch) => [
        branch,
        doc(db, `sessionControl/${branch}`),
      ]),
    ) as Record<SessionBranch, ReturnType<typeof doc>>;
    const [legacyControl, ...branchClaims] = await Promise.all([
      transaction.get(doc(db, 'sessionControl/liveSession')),
      ...sessionBranches.map((branch) =>
        transaction.get(branchReferences[branch]),
      ),
    ]);
    const claims = Object.fromEntries(
      sessionBranches.map((branch, index) => [branch, branchClaims[index]]),
    ) as Record<SessionBranch, (typeof branchClaims)[number]>;
    const legacyId = legacyControl.exists()
      ? legacyControl.data().sessionId
      : null;
    let legacySnapshot: Awaited<ReturnType<typeof transaction.get>> | null =
      null;
    if (typeof legacyId === 'string') {
      legacySnapshot =
        legacyId === id
          ? snapshot
          : await transaction.get(doc(db, sessionPath(legacyId)));
    }
    const legacyData = legacySnapshot?.data() as
      Record<string, unknown> | undefined;
    const legacyIsLive =
      legacySnapshot?.exists() && legacyData?.status === 'live';
    const legacyBranch = legacyIsLive ? branchFromData(legacyData!) : null;

    if (nextStatus === 'live') {
      const claim = claims[targetBranch];
      const claimedId = claim.exists() ? claim.data().sessionId : null;
      const legacyBlocksBranch = legacyIsLive && legacyBranch === targetBranch;
      if (
        (typeof claimedId === 'string' && claimedId !== id) ||
        legacyBlocksBranch
      ) {
        throw new Error(
          `Another ${sessionBranchLabels[targetBranch]} Session is already live. Set it to Not Live or end it before starting this one.`,
        );
      }
      if (claim.exists() && claimedId === id) {
        throw new Error(
          `The ${sessionBranchLabels[targetBranch]} live claim is stale. Set this Session to Not Live before starting it again.`,
        );
      }
    }

    const migrateLegacy =
      typeof legacyId === 'string' &&
      legacyIsLive &&
      legacyId !== id &&
      legacyBranch !== null;
    if (migrateLegacy && legacyBranch) {
      const legacyClaim = claims[legacyBranch];
      const existingId = legacyClaim.exists()
        ? legacyClaim.data().sessionId
        : null;
      if (typeof existingId === 'string' && existingId !== legacyId) {
        throw new Error(
          `The existing live ${sessionBranchLabels[legacyBranch]} Session has a conflicting branch claim.`,
        );
      }
    }

    const releaseTargetClaim =
      nextStatus !== 'live' &&
      claims[targetBranch].exists() &&
      claims[targetBranch].data().sessionId === id;
    const transitionBankIds = new Set<string>();
    const releasesLegacyTarget =
      nextStatus !== 'live' && legacyId === id && legacyIsLive;
    if (nextStatus === 'live' || releaseTargetClaim || releasesLegacyTarget) {
      for (const bankId of bankIdsFromData(snapshot.data()))
        transitionBankIds.add(bankId);
    }
    if (migrateLegacy && legacySnapshot) {
      for (const bankId of bankIdsFromData(legacyData ?? {}))
        transitionBankIds.add(bankId);
    }

    const claimOwners = new Map<
      SessionBranch,
      { id: string; data: Record<string, unknown> }
    >();
    for (const branch of sessionBranches) {
      const claim = claims[branch];
      const ownerId = claim.exists() ? claim.data().sessionId : null;
      if (
        typeof ownerId !== 'string' ||
        (ownerId === id && nextStatus !== 'live')
      )
        continue;
      claimOwners.set(branch, { id: ownerId, data: claim.data() ?? {} });
    }
    if (nextStatus === 'live')
      claimOwners.set(targetBranch, { id, data: snapshot.data() });
    if (migrateLegacy && legacyBranch && legacySnapshot?.exists())
      claimOwners.set(legacyBranch, {
        id: legacyId as string,
        data: legacyData ?? {},
      });
    if (nextStatus !== 'live') claimOwners.delete(targetBranch);

    const bankReferences = [...transitionBankIds].map((bankId) =>
      doc(db, bankProblemPath(bankId)),
    );
    const bankSnapshots = await Promise.all(
      bankReferences.map((bankReference) => transaction.get(bankReference)),
    );

    if (migrateLegacy && legacyBranch && typeof legacyId === 'string') {
      if (
        !claims[legacyBranch].exists() ||
        claims[legacyBranch].data().sessionId !== legacyId
      )
        transaction.set(branchReferences[legacyBranch], {
          sessionId: legacyId,
          bankProblemIds: bankIdsFromData(legacyData ?? {}),
        });
      transaction.update(doc(db, 'sessionControl/liveSession'), {
        sessionId: null,
      });
    } else if (
      typeof legacyId === 'string' &&
      ((legacyId === id && nextStatus !== 'live') || !legacyIsLive)
    ) {
      transaction.update(doc(db, 'sessionControl/liveSession'), {
        sessionId: null,
      });
    }
    if (nextStatus === 'live')
      transaction.set(branchReferences[targetBranch], {
        sessionId: id,
        bankProblemIds: bankIdsFromData(snapshot.data()),
      });
    else if (releaseTargetClaim)
      transaction.set(branchReferences[targetBranch], {
        sessionId: null,
        bankProblemIds: [],
      });

    for (const bankSnapshot of bankSnapshots) {
      if (!bankSnapshot.exists()) continue;
      const currentMarker = bankSnapshot.data().hiddenByLiveSessionId;
      const users = [...claimOwners.values()]
        .filter(({ data }) => bankIdsFromData(data).includes(bankSnapshot.id))
        .map(({ id: ownerId }) => ownerId);
      const marker =
        typeof currentMarker === 'string' && users.includes(currentMarker)
          ? currentMarker
          : (users[0] ?? null);
      if (currentMarker !== marker)
        transaction.update(bankSnapshot.ref, { hiddenByLiveSessionId: marker });
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
  if (problemWrites + 1 > 500)
    throw new Error('Too many problems to delete this session in one batch.');

  await runTransaction(db, async (transaction) => {
    const session = await transaction.get(sessionReference);
    const legacyReference = doc(db, 'sessionControl/liveSession');
    const branchReferences = Object.fromEntries(
      sessionBranches.map((item) => [item, doc(db, `sessionControl/${item}`)]),
    ) as Record<SessionBranch, ReturnType<typeof doc>>;
    const [legacyControl, ...branchClaims] = await Promise.all([
      transaction.get(legacyReference),
      ...sessionBranches.map((item) => transaction.get(branchReferences[item])),
    ]);
    const claims = Object.fromEntries(
      sessionBranches.map((branch, index) => [branch, branchClaims[index]]),
    ) as Record<SessionBranch, (typeof branchClaims)[number]>;
    const branch = session.exists() ? branchFromData(session.data()) : null;
    const branchClaim = branch ? claims[branch] : undefined;
    const legacyId = legacyControl.exists()
      ? legacyControl.data().sessionId
      : null;
    let legacyOwner: Awaited<ReturnType<typeof transaction.get>> | null = null;
    if (typeof legacyId === 'string' && legacyId !== id)
      legacyOwner = await transaction.get(doc(db, sessionPath(legacyId)));

    const releasesLiveClaim =
      session.exists() &&
      session.data().status === 'live' &&
      ((branchClaim?.exists() && branchClaim.data().sessionId === id) ||
        legacyId === id);
    const bankProblemIds = releasesLiveClaim
      ? bankIdsFromData(session.data())
      : [];
    const bankSnapshots = await Promise.all(
      bankProblemIds.map((bankId) =>
        transaction.get(doc(db, bankProblemPath(bankId))),
      ),
    );

    const branchOwners = new Map<string, Record<string, unknown>>();
    for (const claim of branchClaims) {
      const ownerId = claim.exists() ? claim.data().sessionId : null;
      if (typeof ownerId !== 'string' || ownerId === id) continue;
      branchOwners.set(ownerId, claim.data() ?? {});
    }
    const legacyOwnerData = legacyOwner?.exists()
      ? (legacyOwner.data() as Record<string, unknown>)
      : null;
    if (
      typeof legacyId === 'string' &&
      legacyId !== id &&
      legacyOwnerData?.status === 'live'
    )
      branchOwners.set(legacyId, legacyOwnerData);

    const branchClaimReleased =
      releasesLiveClaim &&
      branchClaim?.exists() &&
      branchClaim.data().sessionId === id;
    const legacyClaimReleased = releasesLiveClaim && legacyId === id;
    const bankMarkerUpdates = bankSnapshots.flatMap((bank) => {
      if (!bank.exists()) return [];
      const remainingUser = [...branchOwners.entries()].find(([, data]) =>
        bankIdsFromData(data).includes(bank.id),
      )?.[0];
      const marker = remainingUser ?? null;
      return bank.data().hiddenByLiveSessionId === marker
        ? []
        : [{ reference: bank.ref, marker }];
    });
    const writeCount =
      problemWrites +
      1 +
      Number(branchClaimReleased) +
      Number(legacyClaimReleased) +
      bankMarkerUpdates.length;
    if (writeCount > 500)
      throw new Error('Too many problems to delete this session in one batch.');

    for (const [problemIndex, problem] of problems.docs.entries()) {
      for (const { id: approachId } of approachSnapshots[problemIndex].docs) {
        for (const language of languages)
          transaction.delete(
            doc(
              db,
              approachSolutionPath(
                problemPath(id, problem.id),
                approachId,
                language,
              ),
            ),
          );
        transaction.delete(
          doc(db, approachPath(problemPath(id, problem.id), approachId)),
        );
      }
      for (const language of languages)
        transaction.delete(doc(db, solutionPath(id, problem.id, language)));
      transaction.delete(doc(db, problemPath(id, problem.id)));
    }
    if (branchClaimReleased)
      transaction.update(branchReferences[branch!], {
        sessionId: null,
        bankProblemIds: [],
      });
    if (legacyClaimReleased)
      transaction.update(legacyReference, { sessionId: null });
    for (const update of bankMarkerUpdates)
      transaction.update(update.reference, {
        hiddenByLiveSessionId: update.marker,
      });
    transaction.delete(sessionReference);
  });
}
