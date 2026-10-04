import 'client-only';

import { getAuth } from 'firebase/auth';
import { getFirebaseApp } from './client';

export function getOfficerAuth() {
  return getAuth(getFirebaseApp());
}
