import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import {
  getFirestore,
  type DocumentReference,
  type DocumentData,
  type Firestore,
} from 'firebase-admin/firestore';
import {
  buildImportPlan,
  classifyExisting,
  importTarget,
  missingBankFields,
  missingSolutionFields,
  newBankDocument,
  mergeBankProblemIds,
  assertWriteAuthorization,
  printPlan,
  validateManifest,
  type ExistingProblemState,
  type ImportManifest,
  type ImportProblem,
  type LiveState,
} from '../src/lib/problem-bank-import.ts';

const manifestPath = resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith('--manifest='))?.slice(11) ??
    'data/problem-bank/fall-2026-manifest.json',
);
const writeProduction = process.argv.includes('--write-production');
const expectedProject = process.argv
  .find((arg) => arg.startsWith('--expected-project-id='))
  ?.slice('--expected-project-id='.length);
const forbiddenFlags = process.argv.filter((arg) =>
  /--(write|production|live)(?!-production|=)/i.test(arg),
);

if (forbiddenFlags.length > 0)
  throw new Error(`Unsupported flag: ${forbiddenFlags.join(', ')}`);
assertWriteAuthorization(writeProduction, expectedProject);
if (
  !writeProduction &&
  expectedProject &&
  expectedProject !== importTarget.projectId
)
  throw new Error('Expected project ID does not match the manifest target.');
const declaredProject =
  process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
if (declaredProject && declaredProject !== importTarget.projectId)
  throw new Error(
    `Credential environment targets ${declaredProject}, not ${importTarget.projectId}.`,
  );

const manifest = JSON.parse(
  await readFile(manifestPath, 'utf8'),
) as ImportManifest;
validateManifest(manifest);

const app = initializeApp({
  credential: applicationDefault(),
  projectId: importTarget.projectId,
});
const db = getFirestore(app, importTarget.databaseId);
if (app.options.projectId !== importTarget.projectId)
  throw new Error(
    `Resolved Firebase project ${String(app.options.projectId)} does not match the expected target.`,
  );

function plain(data: DocumentData | undefined): Record<string, unknown> {
  return data
    ? (JSON.parse(JSON.stringify(data)) as Record<string, unknown>)
    : {};
}

async function readExistingProblem(
  database: Firestore,
  parent: FirebaseFirestore.DocumentReference,
): Promise<ExistingProblemState | undefined> {
  const parentSnapshot = await parent.get();
  if (!parentSnapshot.exists) return undefined;
  const approachSnapshots = await parent.collection('approaches').get();
  const approaches: ExistingProblemState['approaches'] = {};
  for (const approachDoc of approachSnapshots.docs) {
    const solutions = await approachDoc.ref.collection('solutions').get();
    approaches[approachDoc.id] = {
      data: plain(approachDoc.data()),
      solutions: Object.fromEntries(
        solutions.docs.map((solution) => [solution.id, plain(solution.data())]),
      ),
    };
  }
  return { data: plain(parentSnapshot.data()), approaches };
}

async function readState(
  database: Firestore,
  selected: ImportProblem[],
): Promise<LiveState> {
  const problems: LiveState['problems'] = {};
  const bankSnapshots = await database.collection('problemBank').get();
  for (const snapshot of bankSnapshots.docs) {
    const existing = await readExistingProblem(database, snapshot.ref);
    if (existing) problems[snapshot.id] = existing;
  }
  const normalizeUrl = (value: string) => {
    const url = new URL(value);
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, '').toLowerCase()}`;
  };
  for (const problem of selected) {
    const match = bankSnapshots.docs.find((snapshot) => {
      const savedUrl = snapshot.get('leetcodeUrl');
      if (problem.sourceUrl && typeof savedUrl === 'string')
        return normalizeUrl(savedUrl) === normalizeUrl(problem.sourceUrl);
      return (
        (savedUrl === undefined || savedUrl === null || savedUrl === '') &&
        typeof snapshot.get('title') === 'string' &&
        (snapshot.get('title') as string).trim().toLowerCase() ===
          problem.title.trim().toLowerCase()
      );
    });
    if (match && match.id !== problem.id) {
      const existing = problems[match.id];
      if (existing) problems[`identity-conflict:${problem.id}`] = existing;
    }
  }
  const sessions: LiveState['sessions'] = {};
  const currentSessions = await database.collection('sessions').get();
  const sessionIds = new Set([
    ...currentSessions.docs.map((session) => session.id),
    ...selected.flatMap((problem) =>
      problem.provenanceBackfills.map((entry) => entry.sessionId),
    ),
    ...manifest.unresolvedHistoricalSnapshots.map((entry) => entry.sessionId),
  ]);
  for (const sessionId of sessionIds) {
    const sessionRef = database.doc(`sessions/${sessionId}`);
    const sessionSnapshot = await sessionRef.get();
    if (!sessionSnapshot.exists) continue;
    const problemSnapshots = await sessionRef.collection('problems').get();
    sessions[sessionId] = {
      data: plain(sessionSnapshot.data()),
      problems: Object.fromEntries(
        problemSnapshots.docs.map((snapshot) => [
          snapshot.id,
          plain(snapshot.data()),
        ]),
      ),
    };
  }
  return { problems, sessions };
}

async function writeProblem(database: Firestore, problem: ImportProblem) {
  const parent = database.doc(`problemBank/${problem.id}`);
  await database.runTransaction(async (transaction) => {
    const parentSnapshot = await transaction.get(parent);
    const current: ExistingProblemState | undefined = parentSnapshot.exists
      ? { data: plain(parentSnapshot.data()), approaches: {} }
      : undefined;
    const refs = problem.approaches.map((approach) => ({
      approach,
      parent: parent.collection('approaches').doc(approach.id),
    }));
    if (current) {
      for (const ref of refs) {
        const approachSnapshot = await transaction.get(ref.parent);
        const solutionSnapshots = await Promise.all(
          ['python', 'java', 'cpp'].map((language) =>
            transaction.get(ref.parent.collection('solutions').doc(language)),
          ),
        );
        current.approaches[ref.approach.id] = {
          data: plain(approachSnapshot.data()),
          solutions: Object.fromEntries(
            solutionSnapshots
              .filter((snapshot) => snapshot.exists)
              .map((snapshot) => [snapshot.id, plain(snapshot.data())]),
          ),
        };
      }
    } else {
      for (const ref of refs) {
        await transaction.get(ref.parent);
        await Promise.all(
          ['python', 'java', 'cpp'].map((language) =>
            transaction.get(ref.parent.collection('solutions').doc(language)),
          ),
        );
      }
    }
    const status = classifyExisting(problem, current);
    if (status === 'CONFLICT')
      throw new Error(
        `Production changed during import review: ${problem.title}.`,
      );
    if (!parentSnapshot.exists) {
      transaction.create(parent, newBankDocument(problem));
    } else if (status === 'RECONCILE') {
      const data = parentSnapshot.data() ?? {};
      const updates = missingBankFields(problem, data);
      if (Object.keys(updates).length > 0) transaction.update(parent, updates);
    }
    for (const { approach, parent: approachRef } of refs) {
      const saved = current?.approaches[approach.id];
      if (!saved || !current) {
        transaction.create(approachRef, {
          name: approach.name,
          tags: approach.tags,
          order: approach.order,
        });
      } else if (
        !saved.data.name ||
        !Array.isArray(saved.data.tags) ||
        saved.data.order === undefined
      ) {
        transaction.set(
          approachRef,
          { name: approach.name, tags: approach.tags, order: approach.order },
          { merge: true },
        );
      }
      for (const language of ['python', 'java', 'cpp'] as const) {
        const solutionRef = approachRef.collection('solutions').doc(language);
        if (!saved?.solutions[language])
          transaction.create(solutionRef, approach.solutions[language]);
        else {
          const updates = missingSolutionFields(
            approach.solutions[language],
            saved.solutions[language],
          );
          if (Object.keys(updates).length > 0)
            transaction.update(solutionRef, updates);
        }
      }
    }
  });
}

async function backfillSession(
  database: Firestore,
  sessionId: string,
  entries: Array<{ problem: ImportProblem; sessionProblemId: string }>,
) {
  const sessionRef = database.doc(`sessions/${sessionId}`);
  await database.runTransaction(async (transaction) => {
    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists)
      throw new Error(`Session ${sessionId} disappeared.`);
    const snapshots = await Promise.all(
      entries.map(({ sessionProblemId }) =>
        transaction.get(
          sessionRef.collection('problems').doc(sessionProblemId),
        ),
      ),
    );
    const oldIds = sessionSnapshot.data()?.bankProblemIds;
    const additions = entries.map(({ problem }) => problem.id);
    const newIds = mergeBankProblemIds(oldIds, additions);
    const updates: Array<{ ref: DocumentReference; bankId: string }> = [];
    snapshots.forEach((snapshot, index) => {
      const { problem } = entries[index];
      const backfill = problem.provenanceBackfills.find(
        (entry) =>
          entry.sessionId === sessionId && entry.problemId === snapshot.id,
      );
      if (!snapshot.exists || !backfill)
        throw new Error(
          `Historical snapshot ${sessionId}/${snapshot.id} disappeared.`,
        );
      const data = snapshot.data() ?? {};
      if (
        !Object.entries(backfill.expectedSnapshot).every(
          ([key, value]) => data[key] === value,
        )
      )
        throw new Error(
          `Historical snapshot ${sessionId}/${snapshot.id} no longer exactly matches.`,
        );
      if (data.bankProblemId !== undefined && data.bankProblemId !== problem.id)
        throw new Error(
          `Historical snapshot ${sessionId}/${snapshot.id} has a conflicting Bank reference.`,
        );
      if (data.bankProblemId !== problem.id)
        updates.push({
          ref: sessionRef.collection('problems').doc(snapshot.id),
          bankId: problem.id,
        });
    });
    if (
      !Array.isArray(oldIds) ||
      oldIds.length !== newIds.length ||
      oldIds.some((id: unknown) => !newIds.includes(String(id)))
    )
      transaction.update(sessionRef, { bankProblemIds: newIds });
    for (const update of updates)
      transaction.update(update.ref, { bankProblemId: update.bankId });
  });
}

const state = await readState(db, manifest.problems);
const plan = buildImportPlan(manifest, state);
console.log(printPlan(plan, writeProduction));
for (const problem of plan.problems) {
  if (problem.status === 'CONFLICT')
    console.log(`CONFLICT: ${problem.title} (${problem.problemId})`);
}
if (
  plan.conflicts.length > 0 ||
  plan.unresolvedOccurrences > 0 ||
  plan.unresolvedHistoricalSnapshots > 0
) {
  console.log(
    'Import is blocked until all conflicts and unresolved manifest items are reviewed.',
  );
  process.exitCode = 2;
} else if (writeProduction) {
  for (const problem of manifest.problems) {
    const planned = plan.problems.find(
      (entry) => entry.problemId === problem.id,
    );
    if (planned && planned.status !== 'UNCHANGED')
      await writeProblem(db, problem);
  }
  const backfillsBySession = new Map<
    string,
    Array<{ problem: ImportProblem; sessionProblemId: string }>
  >();
  for (const problem of manifest.problems) {
    for (const backfill of problem.provenanceBackfills) {
      const entries = backfillsBySession.get(backfill.sessionId) ?? [];
      entries.push({ problem, sessionProblemId: backfill.problemId });
      backfillsBySession.set(backfill.sessionId, entries);
    }
  }
  for (const [sessionId, entries] of backfillsBySession)
    await backfillSession(db, sessionId, entries);
  console.log('PRODUCTION WRITES: ENABLED; approved plan applied.');
} else {
  console.log('Dry run complete. No Firestore writes were performed.');
}
