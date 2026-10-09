import 'client-only';

import {
  connectStorageEmulator,
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  type FirebaseStorage,
} from 'firebase/storage';
import { getOfficerAuth } from './auth';
import { getFirebaseApp } from './client';
import { FIREBASE_EMULATOR_CONFIG, useFirebaseEmulators } from './config';

const maxImageSize = 5 * 1024 * 1024;
const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/png': (bytes) =>
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => bytes[index] === byte,
    ),
  'image/jpeg': (bytes) =>
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff,
  'image/webp': (bytes) =>
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP',
};

declare global {
  var __cappyCodeEmulatorStorage: WeakSet<FirebaseStorage> | undefined;
}

export function getFirebaseStorage() {
  const storage = getStorage(getFirebaseApp());
  if (useFirebaseEmulators()) {
    globalThis.__cappyCodeEmulatorStorage ??= new WeakSet();
    if (!globalThis.__cappyCodeEmulatorStorage.has(storage)) {
      connectStorageEmulator(
        storage,
        FIREBASE_EMULATOR_CONFIG.host,
        FIREBASE_EMULATOR_CONFIG.storagePort,
      );
      globalThis.__cappyCodeEmulatorStorage.add(storage);
    }
  }
  return storage;
}

export async function uploadProblemImage(file: File): Promise<string> {
  const user = getOfficerAuth().currentUser;
  if (!user || user.isAnonymous)
    throw new Error('Sign in to Officer Mode to upload Problem images.');
  if (!Object.hasOwn(signatures, file.type))
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size === 0 || file.size > maxImageSize)
    throw new Error('Choose an image smaller than 5 MB.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!signatures[file.type](bytes))
    throw new Error('The selected file content does not match its image type.');

  const storage = getFirebaseStorage();
  const imageRef = ref(
    storage,
    `problem-images/${user.uid}/${crypto.randomUUID()}`,
  );
  await uploadBytes(imageRef, file, {
    contentType: file.type,
    cacheControl: 'public,max-age=31536000,immutable',
  });
  return getDownloadURL(imageRef);
}
