import type { FirebaseOptions } from 'firebase/app';

export function getFirebaseConfig(): FirebaseOptions {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const requiredValues = {
    NEXT_PUBLIC_FIREBASE_API_KEY: config.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: config.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: config.projectId,
    NEXT_PUBLIC_FIREBASE_APP_ID: config.appId,
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
