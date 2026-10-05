import { deleteApp, getApps } from 'firebase/app';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('client-only', () => ({}));
const authEmulator = vi.hoisted(() => ({
  connect: vi.fn(),
  instances: new WeakMap<object, { app: unknown }>(),
}));
vi.mock('firebase/auth', () => ({
  getAuth: (app: unknown) => {
    let auth = authEmulator.instances.get(app as object);
    if (!auth) {
      auth = { app };
      authEmulator.instances.set(app as object, auth);
    }
    return auth;
  },
  connectAuthEmulator: authEmulator.connect,
}));

import { getOfficerAuth } from './auth';

afterEach(async () => {
  await Promise.all(getApps().map(deleteApp));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  authEmulator.connect.mockClear();
});

function configureBrowser() {
  vi.stubGlobal('window', {});
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'unit-test-api-key');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'unit-test.firebaseapp.com');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'unit-test');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'unit-test-app-id');
}

describe('Firebase Auth initialization', () => {
  it('connects Officer Auth to the emulator only when explicitly enabled', () => {
    configureBrowser();
    vi.stubEnv('NEXT_PUBLIC_USE_FIREBASE_EMULATORS', 'true');
    const auth = getOfficerAuth();
    getOfficerAuth();
    expect(authEmulator.connect).toHaveBeenCalledTimes(1);
    expect(authEmulator.connect).toHaveBeenCalledWith(
      auth,
      'http://127.0.0.1:9099',
      { disableWarnings: true },
    );
  });

  it('does not connect Auth to an emulator in production mode', () => {
    configureBrowser();
    vi.stubEnv('NEXT_PUBLIC_USE_FIREBASE_EMULATORS', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    getOfficerAuth();
    expect(authEmulator.connect).not.toHaveBeenCalled();
  });
});
