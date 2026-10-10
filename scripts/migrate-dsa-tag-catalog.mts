import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import {
  normalizeDsaTagId,
  orderDsaTagIds,
  type DsaTag,
} from '../src/lib/dsa-tags.ts';

const initialDsaTags: DsaTag[] = [
  ['arrays', 'Arrays', 'data'],
  ['hash-map', 'Hash Map', 'data'],
  ['two-pointers', 'Two Pointers', 'data'],
  ['binary-search', 'Binary Search', 'search'],
  ['stack', 'Stack', 'data'],
  ['queue', 'Queue', 'data'],
  ['linked-list', 'Linked List', 'data'],
  ['tree', 'Tree', 'data'],
  ['graph', 'Graph', 'graph'],
  ['dfs', 'DFS', 'search'],
  ['bfs', 'BFS', 'search'],
  ['dynamic-programming', 'Dynamic Programming', 'strategy'],
  ['greedy', 'Greedy', 'strategy'],
  ['backtracking', 'Backtracking', 'strategy'],
  ['union-find', 'Union Find', 'graph'],
  ['shortest-path', 'Shortest Path', 'graph'],
].map(
  ([id, label, family], order) =>
    ({ id, label, family, order, active: true }) as DsaTag,
);

const write = process.argv.includes('--write-production');
const acceptUnknown = process.argv.includes('--accept-unknown-tags');
const expectedProjectId = process.argv
  .find((arg) => arg.startsWith('--expected-project-id='))
  ?.split('=')[1];
const reconciliationFile = process.argv
  .find((arg) => arg.startsWith('--reconciliation-file='))
  ?.slice('--reconciliation-file='.length);
const targetProjectId = 'cappycode-f133c';
if (write && expectedProjectId !== targetProjectId)
  throw new Error(
    `Production migration requires --expected-project-id=${targetProjectId}.`,
  );
if (write && !acceptUnknown)
  throw new Error(
    'Review unknown legacy tag labels in the dry run, then add --accept-unknown-tags to preserve them as catalog entries.',
  );
if (
  process.argv.some(
    (arg) =>
      arg.startsWith('--') &&
      !['--write-production', '--accept-unknown-tags'].includes(arg) &&
      !arg.startsWith('--expected-project-id=') &&
      !arg.startsWith('--reconciliation-file='),
  )
)
  throw new Error('Unsupported migration flag.');
const credentialProject =
  process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
if (credentialProject && credentialProject !== targetProjectId)
  throw new Error(
    `Credentials target ${credentialProject}, not ${targetProjectId}.`,
  );
const app = initializeApp({
  credential: applicationDefault(),
  projectId: targetProjectId,
});
const db = getFirestore(app);
type Reconciliation = { id: string; label: string; family: DsaTag['family'] };
let reconciliations: Record<string, Reconciliation> = {};
if (reconciliationFile) {
  const parsed: unknown = JSON.parse(readFileSync(reconciliationFile, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('The reconciliation file must contain a JSON object.');
  reconciliations = parsed as Record<string, Reconciliation>;
  for (const [legacyLabel, tag] of Object.entries(reconciliations)) {
    if (
      !legacyLabel.trim() ||
      !tag ||
      typeof tag.id !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag.id) ||
      tag.id.length > 64 ||
      typeof tag.label !== 'string' ||
      !tag.label.trim() ||
      !['data', 'search', 'graph', 'strategy'].includes(tag.family)
    )
      throw new Error(`Invalid reconciliation for legacy tag: ${legacyLabel}`);
  }
}
const existingCatalog = await db.collection('dsaTags').get();
const catalogById = new Map<string, DsaTag>(
  initialDsaTags.map((tag) => [tag.id, tag]),
);
for (const entry of existingCatalog.docs)
  catalogById.set(entry.id, { id: entry.id, ...entry.data() } as DsaTag);
const knownCatalogIds = new Set(catalogById.keys());
const reconciledTagsById = new Map<string, Reconciliation>();
for (const [legacyLabel, tag] of Object.entries(reconciliations)) {
  const previous = reconciledTagsById.get(tag.id);
  if (
    previous &&
    (previous.label.trim() !== tag.label.trim() ||
      previous.family !== tag.family)
  )
    throw new Error(
      `Reconciliations for ${tag.id} disagree on label or family; use one canonical definition.`,
    );
  const existing = catalogById.get(tag.id);
  if (
    existing &&
    (existing.label.trim() !== tag.label.trim() ||
      existing.family !== tag.family)
  )
    throw new Error(
      `Reconciliation for ${legacyLabel} targets existing tag ${tag.id} with a different label or family. Match the existing catalog definition.`,
    );
  reconciledTagsById.set(tag.id, tag);
}
const approaches = await db.collectionGroup('approaches').get();
const observedUnknown = new Set<string>();
const labelsByUnknownId = new Map<string, Set<string>>();
const usedReconciliations = new Set<string>();
const bankTagsByProblem = new Map<string, string[]>();
function idForLegacyTag(label: string): string {
  const reconciliation = reconciliations[label];
  if (reconciliation) usedReconciliations.add(label);
  return reconciliation?.id ?? normalizeDsaTagId(label);
}
function includeUnknownLegacyTag(label: string) {
  const reconciliation = reconciliations[label];
  const id = idForLegacyTag(label);
  if (knownCatalogIds.has(id)) return;
  observedUnknown.add(label);
  const labels = labelsByUnknownId.get(id) ?? new Set<string>();
  labels.add(label);
  labelsByUnknownId.set(id, labels);
  if (!catalogById.has(id))
    catalogById.set(id, {
      id,
      label: reconciliation?.label.trim() ?? label,
      family: reconciliation?.family ?? 'strategy',
      order: catalogById.size,
      active: true,
    });
}
const updates: Array<{
  ref: FirebaseFirestore.DocumentReference;
  tags: string[];
}> = [];
for (const entry of approaches.docs) {
  const raw = entry.data().tags;
  if (!Array.isArray(raw)) continue;
  const values = raw.filter((tag): tag is string => typeof tag === 'string');
  const parentPath = entry.ref.parent.parent?.path;
  if (parentPath?.startsWith('problemBank/')) {
    const problemId = parentPath.slice('problemBank/'.length);
    bankTagsByProblem.set(problemId, [
      ...(bankTagsByProblem.get(problemId) ?? []),
      ...values,
    ]);
  }
  values.forEach(includeUnknownLegacyTag);
  const tags = orderDsaTagIds(values.map(idForLegacyTag), [
    ...catalogById.values(),
  ]);
  if (JSON.stringify(tags) !== JSON.stringify(raw))
    updates.push({ ref: entry.ref, tags });
}
const bankParents = await db.collection('problemBank').get();
const summaries: Array<{
  ref: FirebaseFirestore.DocumentReference;
  tags: string[];
}> = [];
for (const parent of bankParents.docs) {
  const raw = parent.data().approachTagSummary;
  const sourceTags = Array.isArray(raw)
    ? raw.filter((tag): tag is string => typeof tag === 'string')
    : (bankTagsByProblem.get(parent.id) ?? []);
  sourceTags.forEach(includeUnknownLegacyTag);
  const tags = orderDsaTagIds(sourceTags.map(idForLegacyTag), [
    ...catalogById.values(),
  ]);
  if (JSON.stringify(tags) !== JSON.stringify(raw))
    summaries.push({ ref: parent.ref, tags });
}
const collisions = [...labelsByUnknownId.entries()]
  .filter(
    ([, labels]) =>
      labels.size > 1 && [...labels].some((label) => !reconciliations[label]),
  )
  .map(([id, labels]) => ({ id, labels: [...labels].sort() }));
console.log(
  JSON.stringify(
    {
      mode: write ? 'write' : 'dry-run',
      targetProjectId,
      catalogEntries: catalogById.size,
      approachesScanned: approaches.size,
      approachDocumentsToMigrate: updates.length,
      bankSummariesToMigrate: summaries.length,
      unknownLegacyTags: [...observedUnknown].sort(),
      tagIdCollisions: collisions,
      reconciledLegacyTags: [...usedReconciliations].sort(),
      unusedReconciliations: Object.keys(reconciliations)
        .filter((label) => !usedReconciliations.has(label))
        .sort(),
    },
    null,
    2,
  ),
);
if (write && collisions.length)
  throw new Error(
    'Tag ID collisions need explicit reconciliation before migration writes; no writes were made.',
  );
if (!write) {
  console.log('Dry run only; no Firestore writes were performed.');
} else {
  const writes = [
    ...[...catalogById.values()].map((tag) => ({
      ref: db.doc(`dsaTags/${tag.id}`),
      data: {
        label: tag.label,
        family: tag.family,
        order: tag.order,
        active: tag.active,
      },
    })),
    ...updates.map(({ ref, tags }) => ({ ref, data: { tags } })),
    ...summaries.map(({ ref, tags }) => ({
      ref,
      data: { approachTagSummary: tags },
    })),
  ];
  for (let offset = 0; offset < writes.length; offset += 450) {
    const batch = db.batch();
    for (const writeRow of writes.slice(offset, offset + 450))
      batch.set(writeRow.ref, writeRow.data, { merge: true });
    await batch.commit();
  }
  console.log(
    `Migrated ${updates.length} Approach documents and ${summaries.length} Bank summaries; ${observedUnknown.size} unknown tags were preserved in the catalog.`,
  );
}
