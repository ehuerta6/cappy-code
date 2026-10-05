import 'client-only';

import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { getFirebaseApp } from './client';
import { FIREBASE_EMULATOR_CONFIG, useFirebaseEmulators } from './config';

declare global {
  var __cappyCodeEmulatorAuth: WeakSet<Auth> | undefined;
}

export function getOfficerAuth() {
  const auth = getAuth(getFirebaseApp());
  if (useFirebaseEmulators()) {
    globalThis.__cappyCodeEmulatorAuth ??= new WeakSet();
    if (!globalThis.__cappyCodeEmulatorAuth.has(auth)) {
      connectAuthEmulator(
        auth,
        `http://${FIREBASE_EMULATOR_CONFIG.host}:${FIREBASE_EMULATOR_CONFIG.authPort}`,
        { disableWarnings: true },
      );
      globalThis.__cappyCodeEmulatorAuth.add(auth);
    }
  }
  return auth;
}
