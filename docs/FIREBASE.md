# Firebase foundation

## Local setup

1. Create or select a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. Register a Web app under **Project settings → General → Your apps**. Copy its SDK configuration values. The [official Web SDK setup guide](https://firebase.google.com/docs/web/setup) describes these steps.
3. Create the default Cloud Firestore database under **Build → Firestore Database**, using production mode. Keep its initial access restrictions; application permission rules belong to Issue #42.
4. Copy the checked-in environment example at the repository root:

   ```bash
   cp .env.example .env.local
   ```

5. Fill in these values from the Web app configuration:

   | Environment variable               | Firebase config field |
   | ---------------------------------- | --------------------- |
   | `NEXT_PUBLIC_FIREBASE_API_KEY`     | `apiKey`              |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain`          |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | `projectId`           |
   | `NEXT_PUBLIC_FIREBASE_APP_ID`      | `appId`               |

6. Install dependencies with `npm install`, then start the existing application with `npm run dev`. Restart the server after changing `.env.local`.

These are public Firebase client configuration values, bundled into browser code by Next.js. They are not authorization credentials. Never put officer passwords, service account keys, or server secrets in `NEXT_PUBLIC_` variables. `.env.local` is ignored by Git. Storage, Analytics, and Messaging configuration is unnecessary for this foundation.

## Client access

`src/lib/firebase/client.ts` exposes `getFirebaseApp()` and `getFirestoreDb()`. It is marked `client-only`, so Next.js rejects imports from Server Components. Call the accessors from browser event handlers or effects in a Client Component, rather than during rendering or at module scope. They reject server execution, initialize lazily, and reuse the default app and its Firestore instance across development hot reloads. Missing or blank required configuration produces an error naming the missing variables.

For later data access, use the modular Firebase SDK directly:

```ts
import { doc } from 'firebase/firestore';
import { getFirestoreDb } from '@/lib/firebase/client';
import { problemPath } from '@/lib/firebase/paths';

// Inside a browser event handler or effect:
const problemRef = doc(getFirestoreDb(), problemPath(sessionId, problemId));
```

The current workspace does not call these accessors or persist its editor content yet. Builds and unit tests require no live Firebase project. Tests exercise local SDK initialization and paths without reading or writing the network. Authentication UI, content workflows, realtime updates, and permission rules remain for later issues. Issue #37 can obtain Auth with the SDK's `getAuth(getFirebaseApp())`; members do not sign in.

## Persisted model

`src/lib/domain.ts` defines document fields, with IDs held in document paths rather than duplicated inside records:

| Path                                                             | Type       | Fields                                                                             |
| ---------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `sessions/{sessionId}`                                           | `Session`  | `title`, `date`, `status`, `activeProblemId`, `createdAt`, `updatedAt`             |
| `sessions/{sessionId}/problems/{problemId}`                      | `Problem`  | `title`, `description`, `exampleInput`, `exampleOutput`, `order`, `answersVisible` |
| `sessions/{sessionId}/problems/{problemId}/solutions/{language}` | `Solution` | `code`, `output`                                                                   |

- `Language` is exactly `python | java | cpp`; each language identifies its own Solution document.
- `SessionStatus` is `draft | live | ended`.
- `date` is a calendar date string in `YYYY-MM-DD` format. `createdAt` and `updatedAt` are Firestore `Timestamp` values in resolved persisted records; later write workflows can use SDK `serverTimestamp()` and must handle pending timestamp snapshots if needed.
- `activeProblemId` is a problem document ID or `null` when no problem is selected.
- `order` is a numeric sort key within the session. Problem CRUD will define how reordering writes it.
- `output` is officer-prepared static text, not an execution result.

`sessionPath`, `problemPath`, and `solutionPath` centralize the nested document paths to avoid inconsistent strings. They reject empty IDs and IDs containing `/`. They return strings for SDK `doc()` calls; collection access can use SDK `collection()` with `sessions`, or a document reference and its subcollection name. No CRUD services, converters, or unchecked typed snapshot casts are introduced. These TypeScript types describe the intended shape; they do not validate incoming Firestore data.

## Access boundary for later issues

Problem documents hold member-facing metadata and `answersVisible`. Prepared code and output exist only in the separate Solution subcollection, consistent with [Firestore's hierarchical data model](https://firebase.google.com/docs/firestore/data-model). Member metadata access must follow session status/publication rules; drafts remain officer-only. Future rules must allow member Solution reads only when session access permits them **and** the parent Problem's `answersVisible` is true. Officers will use Firebase Authentication for content management.

This foundation does not implement those rules or decide publication policy for ended sessions. Issues #38 and #39 should use these paths and document fields; Issue #42 must define the publication/access policy and enforce it alongside answer visibility. Hiding answers in the UI alone provides no protection.
