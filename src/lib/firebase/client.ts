import 'client-only';

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import {
  FIREBASE_EMULATOR_CONFIG,
  getFirebaseConfig,
  useFirebaseEmulators,
} from './config';

declare global {
  var __cappyCodeEmulatorFirestore: WeakSet<Firestore> | undefined;
}

export function getFirebaseApp() {
  if (typeof window === 'undefined') {
    throw new Error('Access Firebase from a browser event handler or effect.');
  }

  const defaultApp = getApps().find((app) => app.name === '[DEFAULT]');
  return defaultApp ? getApp() : initializeApp(getFirebaseConfig());
}

export function getFirestoreDb() {
  const database = getFirestore(getFirebaseApp());
  if (useFirebaseEmulators()) {
    globalThis.__cappyCodeEmulatorFirestore ??= new WeakSet();
    if (!globalThis.__cappyCodeEmulatorFirestore.has(database)) {
      connectFirestoreEmulator(
        database,
        FIREBASE_EMULATOR_CONFIG.host,
        FIREBASE_EMULATOR_CONFIG.firestorePort,
      );
      globalThis.__cappyCodeEmulatorFirestore.add(database);
    }
  }
  return database;
}
