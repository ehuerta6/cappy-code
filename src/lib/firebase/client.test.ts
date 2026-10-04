import { deleteApp, getApps, initializeApp } from 'firebase/app';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('client-only', () => ({}));

import { getFirebaseApp, getFirestoreDb } from './client';

afterEach(async () => {
  await Promise.all(getApps().map(deleteApp));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function configureBrowser() {
  vi.stubGlobal('window', {});
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'unit-test-api-key');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'unit-test.firebaseapp.com');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'unit-test');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'unit-test-app-id');
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
});
