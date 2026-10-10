import 'client-only';

import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocsFromServer,
  getDocFromServer,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { getOfficerAuth } from './auth';
import { getFirestoreDb } from './client';
import {
  dsaTagFamilies,
  normalizeDsaTagId,
  type DsaTag,
  type DsaTagFamily,
} from '../dsa-tags';

const catalogPath = 'dsaTags';

function officerDb() {
  getOfficerAuth();
  return getFirestoreDb();
}

function validTag(tag: DsaTag): boolean {
  return (
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag.id) &&
    tag.label.trim().length > 0 &&
    tag.label.length <= 512 &&
    dsaTagFamilies.includes(tag.family) &&
    Number.isInteger(tag.order) &&
    tag.order >= 0 &&
    typeof tag.active === 'boolean'
  );
}

export async function listDsaTags(includeArchived = false): Promise<DsaTag[]> {
  const snapshot = await getDocsFromServer(
    collection(getFirestoreDb(), catalogPath),
  );
  const tags = snapshot.docs.map(
    (entry) => ({ id: entry.id, ...entry.data() }) as DsaTag,
  );
  return tags
    .filter((tag) => includeArchived || tag.active)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export async function createDsaTag(input: {
  label: string;
  family: DsaTagFamily;
  order: number;
}): Promise<DsaTag> {
  const db = officerDb();
  const label = input.label.trim();
  const id = normalizeDsaTagId(label);
  const tag = {
    id,
    label,
    family: input.family,
    order: input.order,
    active: true,
  };
  if (!validTag(tag))
    throw new Error('Enter a tag name using at least one letter or number.');
  const existing = await getDocsFromServer(collection(db, catalogPath));
  if (
    existing.docs.some(
      (entry) =>
        entry.id === tag.id ||
        String(entry.data().label).trim().toLowerCase() === label.toLowerCase(),
    )
  ) {
    throw new Error('A DSA tag with that name already exists.');
  }
  await setDoc(doc(db, catalogPath, tag.id), {
    label: tag.label,
    family: tag.family,
    order: tag.order,
    active: true,
  });
  return tag;
}

export async function updateDsaTag(tag: DsaTag): Promise<void> {
  const db = officerDb();
  if (!validTag(tag)) throw new Error('DSA tag details are invalid.');
  const allTags = await getDocsFromServer(collection(db, catalogPath));
  if (
    allTags.docs.some(
      (entry) =>
        entry.id !== tag.id &&
        String(entry.data().label).trim().toLowerCase() ===
          tag.label.trim().toLowerCase(),
    )
  ) {
    throw new Error('A DSA tag with that name already exists.');
  }
  const current = await getDocFromServer(doc(db, catalogPath, tag.id));
  if (!current.exists()) throw new Error('This DSA tag no longer exists.');
  await setDoc(doc(db, catalogPath, tag.id), {
    label: tag.label.trim(),
    family: tag.family,
    order: tag.order,
    active: tag.active,
  });
}

export async function countDsaTagReferences(tagId: string): Promise<number> {
  const snapshot = await getDocsFromServer(
    query(
      collectionGroup(getFirestoreDb(), 'approaches'),
      where('tags', 'array-contains', tagId),
    ),
  );
  return snapshot.size;
}

export async function archiveDsaTag(tag: DsaTag): Promise<void> {
  await updateDsaTag({ ...tag, active: false });
}

export async function deleteUnusedDsaTag(tagId: string): Promise<void> {
  const db = officerDb();
  if ((await countDsaTagReferences(tagId)) > 0) {
    throw new Error(
      'This tag is used by existing Approaches. Archive it to preserve historical content.',
    );
  }
  await deleteDoc(doc(db, catalogPath, tagId));
}

export async function reorderDsaTags(tags: DsaTag[]): Promise<void> {
  const db = officerDb();
  await Promise.all(
    tags.map((tag, order) =>
      setDoc(doc(db, catalogPath, tag.id), { order }, { merge: true }),
    ),
  );
}
