import type { FirebaseOptions } from 'firebase/app';

export const FIREBASE_EMULATOR_CONFIG = {
  host: '127.0.0.1',
  projectId: 'demo-cappycode-local',
  firestorePort: 8080,
  authPort: 9099,
  storagePort: 9199,
} as const;

export function useFirebaseEmulators(): boolean {
  const setting = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS;
  if (setting === undefined || setting === 'false') return false;
  if (setting !== 'true') {
    throw new Error(
      'NEXT_PUBLIC_USE_FIREBASE_EMULATORS must be either true or false.',
    );
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Firebase emulators cannot be enabled in a production build.',
    );
  }
  return true;
}

export function getFirebaseConfig(): FirebaseOptions {
  if (useFirebaseEmulators()) {
    return {
      apiKey: 'demo-api-key',
      authDomain: 'localhost',
      projectId: FIREBASE_EMULATOR_CONFIG.projectId,
      appId: 'demo-cappycode-local',
      storageBucket: 'demo-cappycode-local.appspot.com',
    };
  }

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  };

  const requiredValues = {
    NEXT_PUBLIC_FIREBASE_API_KEY: config.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: config.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: config.projectId,
    NEXT_PUBLIC_FIREBASE_APP_ID: config.appId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: config.storageBucket,
  };
  const missingVariables = Object.entries(requiredValues)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing Firebase configuration: ${missingVariables.join(', ')}. Set these values in .env.local.`,
    );
  }

  return config;
}
