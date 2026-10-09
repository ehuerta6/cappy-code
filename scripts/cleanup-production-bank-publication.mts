import { applicationDefault, initializeApp } from 'firebase-admin/app';
import {
  FieldValue,
  getFirestore,
  type DocumentData,
} from 'firebase-admin/firestore';
import {
  assertBankCleanupWriteAuthorization,
  bankCleanupTarget,
  planBankPublicationCleanup,
} from '../src/lib/problem-bank-cleanup.ts';

const writeProduction = process.argv.includes('--write-production');
const expectedProjectId = process.argv
  .find((arg) => arg.startsWith('--expected-project-id='))
  ?.slice('--expected-project-id='.length);
const unsupported = process.argv.filter(
  (arg) =>
    arg.startsWith('--') &&
    !['--write-production'].includes(arg) &&
    !arg.startsWith('--expected-project-id='),
);
if (unsupported.length)
  throw new Error(`Unsupported flag: ${unsupported.join(', ')}`);
assertBankCleanupWriteAuthorization(writeProduction, expectedProjectId);

const credentialProject =
  process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
if (credentialProject && credentialProject !== bankCleanupTarget.projectId)
  throw new Error(
    `Credential environment targets ${credentialProject}, not ${bankCleanupTarget.projectId}.`,
  );

const app = initializeApp({
  credential: applicationDefault(),
  projectId: bankCleanupTarget.projectId,
});
if (app.options.projectId !== bankCleanupTarget.projectId)
  throw new Error('Resolved Firebase project does not match cleanup target.');
const db = getFirestore(app, bankCleanupTarget.databaseId);
const maximumDocumentsPerRun = 500;
const snapshot = await db
  .collection('problemBank')
  .limit(maximumDocumentsPerRun + 1)
  .get();
if (snapshot.size > maximumDocumentsPerRun)
  throw new Error(
    `Cleanup is limited to ${maximumDocumentsPerRun} Bank parents per run; no writes were made.`,
  );
const cleanup = planBankPublicationCleanup(
  snapshot.docs.map((document) => ({
    id: document.id,
    data: document.data() as DocumentData,
  })),
);

console.log(
  JSON.stringify(
    {
      mode: writeProduction ? 'write' : 'dry-run',
      projectId: bankCleanupTarget.projectId,
      databaseId: bankCleanupTarget.databaseId,
      documentsWithObsoleteFields: cleanup.length,
      obsoleteFields: cleanup,
    },
    null,
    2,
  ),
);

if (writeProduction) {
  for (let offset = 0; offset < cleanup.length; offset += 400) {
    const batch = db.batch();
    for (const { id, fields } of cleanup.slice(offset, offset + 400)) {
      const update = Object.fromEntries(
        fields.map((field) => [field, FieldValue.delete()]),
      );
      batch.update(db.doc(`problemBank/${id}`), update);
    }
    await batch.commit();
  }
  console.log(`Removed obsolete fields from ${cleanup.length} Bank documents.`);
} else {
  console.log('Dry run only; no Firestore writes were performed.');
}
