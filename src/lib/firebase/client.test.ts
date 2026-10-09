import { deleteApp, getApps, initializeApp } from 'firebase/app';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('client-only', () => ({}));
const firestoreEmulator = vi.hoisted(() => ({
  connect: vi.fn(),
  databases: new WeakMap<object, { app: unknown }>(),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: (app: object) => {
    let database = firestoreEmulator.databases.get(app);
    if (!database) {
      database = { app };
      firestoreEmulator.databases.set(app, database);
    }
    return database;
  },
  connectFirestoreEmulator: firestoreEmulator.connect,
}));

import { getFirebaseApp, getFirestoreDb } from './client';

afterEach(async () => {
  await Promise.all(getApps().map(deleteApp));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  firestoreEmulator.connect.mockClear();
});

function configureBrowser() {
  vi.stubGlobal('window', {});
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'unit-test-api-key');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'unit-test.firebaseapp.com');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'unit-test');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'unit-test-app-id');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'unit-test.appspot.com');
}

describe('Firebase client initialization', () => {
  it('prevents initialization during server rendering', () => {
    expect(getFirebaseApp).toThrow('browser event handler or effect');
    expect(getApps()).toHaveLength(0);
  });

  it('reuses the default app and Firestore instance across repeated calls', async () => {
    configureBrowser();
    const app = getFirebaseApp();
    const db = getFirestoreDb();
    expect(app.options.projectId).toBe('unit-test');
    expect(db.app).toBe(app);
    expect(getFirebaseApp()).toBe(app);
    expect(getFirestoreDb()).toBe(db);

    vi.resetModules();
    const reloaded = await import('./client');
    expect(reloaded.getFirebaseApp()).toBe(app);
    expect(reloaded.getFirestoreDb()).toBe(db);
    expect(getApps()).toHaveLength(1);
  });

  it('initializes the default app even if a named app already exists', () => {
    configureBrowser();
    initializeApp({ projectId: 'other-unit-test' }, 'other');
    expect(getFirebaseApp().name).toBe('[DEFAULT]');
    expect(getApps()).toHaveLength(2);
  });

  it('connects the application Firestore client only when emulator mode is enabled', () => {
    configureBrowser();
    vi.stubEnv('NEXT_PUBLIC_USE_FIREBASE_EMULATORS', 'true');
    const database = getFirestoreDb();
    getFirestoreDb();
    expect(firestoreEmulator.connect).toHaveBeenCalledTimes(1);
    expect(firestoreEmulator.connect).toHaveBeenCalledWith(
      database,
      '127.0.0.1',
      8080,
    );
  });

  it('does not connect Firestore to an emulator in production mode', () => {
    configureBrowser();
    vi.stubEnv('NEXT_PUBLIC_USE_FIREBASE_EMULATORS', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    getFirestoreDb();
    expect(firestoreEmulator.connect).not.toHaveBeenCalled();
  });
});
