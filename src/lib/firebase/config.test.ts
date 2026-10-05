import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFirebaseConfig } from './config';

const environment = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'unit-test-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'unit-test.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'unit-test',
  NEXT_PUBLIC_FIREBASE_APP_ID: 'unit-test-app-id',
};

function configureEnvironment() {
  for (const [name, value] of Object.entries(environment)) {
    vi.stubEnv(name, value);
  }
}

afterEach(() => vi.unstubAllEnvs());

describe('Firebase configuration', () => {
  it('maps public environment variables to Firebase options', () => {
    configureEnvironment();
    expect(getFirebaseConfig()).toEqual({
      apiKey: environment.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: environment.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: environment.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  });

  it.each(Object.keys(environment))('requires %s', (name) => {
    configureEnvironment();
    vi.stubEnv(name, undefined);
    expect(getFirebaseConfig).toThrow(name);
  });

  it('reports all empty or whitespace-only values without exposing config', () => {
    configureEnvironment();
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '  ');
    expect(getFirebaseConfig).toThrow(
      'Missing Firebase configuration: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID. Set these values in .env.local.',
    );
  });

  it('uses harmless demo configuration when emulators are explicitly enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_USE_FIREBASE_EMULATORS', 'true');
    expect(getFirebaseConfig()).toEqual({
      apiKey: 'demo-api-key',
      authDomain: 'localhost',
      projectId: 'demo-cappycode-local',
      appId: 'demo-cappycode-local',
    });
  });

  it('keeps production Firebase configuration when emulators are disabled', () => {
    configureEnvironment();
    vi.stubEnv('NEXT_PUBLIC_USE_FIREBASE_EMULATORS', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    expect(getFirebaseConfig()).toEqual({
      apiKey: environment.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: environment.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: environment.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  });

  it.each(['yes', '1', 'TRUE', ''])(
    'rejects ambiguous emulator setting %j',
    (value) => {
      vi.stubEnv('NEXT_PUBLIC_USE_FIREBASE_EMULATORS', value);
      expect(getFirebaseConfig).toThrow(
        'NEXT_PUBLIC_USE_FIREBASE_EMULATORS must be either true or false.',
      );
    },
  );

  it('rejects emulator mode in production', () => {
    vi.stubEnv('NEXT_PUBLIC_USE_FIREBASE_EMULATORS', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    expect(getFirebaseConfig).toThrow(
      'Firebase emulators cannot be enabled in a production build.',
    );
  });
});
