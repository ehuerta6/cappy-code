import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  assertBankApproachTagSummaryWriteAuthorization,
  bankApproachTagSummaryTarget,
  planBankApproachTagSummaryBackfill,
} from '../src/lib/problem-bank-tag-summary.ts';

const writeProduction = process.argv.includes('--write-production');
const expectedProjectId = process.argv
  .find((argument) => argument.startsWith('--expected-project-id='))
  ?.slice('--expected-project-id='.length);
const unsupported = process.argv.filter(
  (argument) =>
    argument.startsWith('--') &&
    !['--write-production'].includes(argument) &&
    !argument.startsWith('--expected-project-id='),
);
if (unsupported.length)
  throw new Error(`Unsupported flag: ${unsupported.join(', ')}`);
assertBankApproachTagSummaryWriteAuthorization(
  writeProduction,
  expectedProjectId,
);

const credentialProject =
  process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
if (
  credentialProject &&
  credentialProject !== bankApproachTagSummaryTarget.projectId
)
  throw new Error(
    `Credential environment targets ${credentialProject}, not ${bankApproachTagSummaryTarget.projectId}.`,
  );

const app = initializeApp({
  credential: applicationDefault(),
  projectId: bankApproachTagSummaryTarget.projectId,
});
if (app.options.projectId !== bankApproachTagSummaryTarget.projectId)
  throw new Error(
    'Resolved Firebase project does not match the backfill target.',
  );

const db = getFirestore(app, bankApproachTagSummaryTarget.databaseId);
const maximumParents = 500;
const parents = await db
  .collection('problemBank')
  .limit(maximumParents + 1)
  .get();
if (parents.size > maximumParents)
  throw new Error(
    `Backfill requires ${maximumParents} or fewer Bank parents; no writes were made.`,
  );

const records = await Promise.all(
  parents.docs.map(async (parent) => {
    const data = parent.data();
    if (Array.isArray(data.approachTagSummary))
      return { id: parent.id, data, approaches: [] };
    const approaches = await parent.ref.collection('approaches').get();
    return {
      id: parent.id,
      data,
      approaches: approaches.docs.map((approach) => approach.data()),
    };
  }),
);
const updates = planBankApproachTagSummaryBackfill(records);
console.log(
  JSON.stringify(
    {
      mode: writeProduction ? 'write' : 'dry-run',
      projectId: bankApproachTagSummaryTarget.projectId,
      databaseId: bankApproachTagSummaryTarget.databaseId,
      parentsScanned: parents.size,
      summariesToWrite: updates,
    },
    null,
    2,
  ),
);

if (writeProduction) {
  for (let offset = 0; offset < updates.length; offset += 400) {
    const batch = db.batch();
    for (const { id, approachTagSummary } of updates.slice(
      offset,
      offset + 400,
    ))
      batch.update(db.doc(`problemBank/${id}`), { approachTagSummary });
    await batch.commit();
  }
  console.log(`Updated ${updates.length} Bank tag summaries.`);
} else {
  console.log('Dry run only; no Firestore writes were performed.');
}
