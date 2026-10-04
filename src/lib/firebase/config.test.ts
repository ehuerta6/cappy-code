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
});
