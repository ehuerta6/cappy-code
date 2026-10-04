import 'client-only';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFirebaseConfig } from './config';

export function getFirebaseApp() {
  if (typeof window === 'undefined') {
    throw new Error('Access Firebase from a browser event handler or effect.');
  }

  const defaultApp = getApps().find((app) => app.name === '[DEFAULT]');
  return defaultApp ? getApp() : initializeApp(getFirebaseConfig());
}

export function getFirestoreDb() {
  return getFirestore(getFirebaseApp());
}
