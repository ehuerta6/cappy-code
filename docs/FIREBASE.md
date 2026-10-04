# Firebase foundation

## Local setup

1. Create or select a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. Register a Web app under **Project settings → General → Your apps**. Copy its SDK configuration values. The [official Web SDK setup guide](https://firebase.google.com/docs/web/setup) describes these steps.
3. Create the default Cloud Firestore database under **Build → Firestore Database**, using production mode. Keep its initial access restrictions until deploying the baseline Session rules below; public access and answer reveal rules belong to Issue #42.
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

The public landing page does not fetch protected workspace content. Builds and unit tests require no live Firebase project. Tests exercise SDK initialization and paths locally and mock authentication interactions without network reads or writes. Concrete Session, Problem, and Officer Solution operations are described below; realtime updates and public access rules remain for later issues.

## Officer authentication

Enable **Email/Password** under Firebase Console → Authentication → Sign-in method, then create the single shared CIC Intro officer account under **Users → Add user**. Configure the application's host under Authentication → Settings → Authorized domains if needed. Keep the account password outside the repository and environment example. There is no signup or member account flow.

The secondary **Officer Login** link opens `/officer`. Its layout uses `OfficerAuthGate`, which renders a checking state until `useOfficerAuth()` receives Firebase's `onAuthStateChanged` result. Anonymous visitors see a compact login form; only confirmed authenticated users see the protected page. Initialization failures show an unavailable state without exposing Firebase configuration/errors. Logout calls Firebase `signOut`, hides protected content while pending, and returns to the login form when Firebase reports an anonymous session. Member Mode stays accessible through the public link throughout.

`getOfficerAuth()` in `src/lib/firebase/auth.ts` uses `getAuth(getFirebaseApp())`, reusing the existing default app. Firebase owns browser persistence; no custom session storage or persistence override is added. Login success alone does not open the gate: the Firebase observer remains authoritative. See [Firebase auth persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence).

Officer pages under `src/app/officer/` inherit the gate. `/officer` renders
`OfficerSessions` only through this authenticated surface. Session management does
not accept a Firebase User prop or subscribe to Auth; the gate owns auth rendering.
Each persistence operation rechecks `getOfficerAuth().currentUser` before obtaining
Firestore. Call SDK accessors from effects/event handlers. Do not pass protected
data through server-rendered children: this browser gate does not authorize server
responses. Firestore Security Rules independently enforce backend access.

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
- `order` is a numeric sort key within the session. Problem reordering writes dense zero-based integers; ties on reads sort by document ID.
- `output` is officer-prepared static text, not an execution result.

`sessionPath`, `problemPath`, and `solutionPath` centralize nested document paths and reject empty IDs or IDs containing `/`. They return strings for SDK `doc()` calls; collection access can use SDK `collection()` with `sessions`, or a document reference and its subcollection name. Session and Problem CRUD use small concrete Firestore functions. No generic repositories, converters, or unchecked typed snapshot casts are introduced. These TypeScript types describe the intended shape; they do not validate incoming Firestore data.

## Access boundary for later issues

Problem documents hold member-facing metadata and `answersVisible`. Prepared code and output exist only in the separate Solution subcollection, consistent with [Firestore's hierarchical data model](https://firebase.google.com/docs/firestore/data-model). Member metadata access must follow session status/publication rules; drafts remain officer-only. Future rules must allow member Solution reads only when session access permits them **and** the parent Problem's `answersVisible` is true. Officers will use Firebase Authentication for content management.

This foundation does not implement member rules or decide publication policy for ended sessions. Issues #38 and #39 use these paths and document fields; Issue #42 must define publication/access policy and enforce it alongside answer visibility. Hiding answers in the UI alone provides no protection.

## Officer Session preparation (#38)

`src/lib/firebase/sessions.ts` provides `createSession`, `listSessions`,
`updateSession`, and `deleteSession`, using the foundation's `Session` type and
`sessionPath`. Each operation checks the current user from
`getOfficerAuth()`; signed-out and anonymous-auth users are rejected
before Firestore access. Firebase sends the actual Auth token to Firestore;
Security Rules remain the backend boundary.

Creation writes `Untitled Session`, the browser's current local calendar date,
`draft`, `activeProblemId: null`, and server timestamps. It creates no Problems.
Calendar dates remain `YYYY-MM-DD` strings. Edits validate title/date and write
only those fields plus `updatedAt: serverTimestamp()`, preserving `createdAt`,
status, and the presenter pointer. Writes resolve only after backend confirmation.
The list uses `getDocsFromServer`; failed/offline reads remain errors rather than
using static content or presenting cached data as current. It validates stored
fields and rejects documents with pending writes or unresolved timestamps rather
than inventing client timestamps. Document IDs are separate read-model fields.

Title/date commit on blur, with visible unsaved, Saving, Saved, and retryable error
states. Failed edits remain in the fields. Navigation and deletion are disabled
until edits are saved. Lists distinguish loading, empty, failed, and populated
states. A successfully created document followed by a failed list refresh is
reported as a read failure, preventing an erroneous creation retry.

Deletion requires a browser confirmation naming the Session and its child content.
`deleteSession` reads the child Problem IDs from the server, then commits one
atomic batch deleting each Problem's fixed Python/Java/C++ Solution documents,
each Problem, and the Session. Missing Solution documents are safe delete targets.
The cascade rejects more than 499 child writes before issuing any writes; this
supports up to 124 Problems and comfortably covers the expected 1–3. A failed
read or commit remains a deletion error. Firestore does not recursively delete
subcollections; this explicit fixed-path cleanup adds no recursive infrastructure
and does not use `ended` as an archive flag. Preparation assumes one shared officer
is editing a Session at a time; concurrent child creation during a deletion is not
serialized by this small client-side cascade.

### Baseline Session Security Rules

`firebase.json` points to `firestore.rules`. The baseline permits Session document
reads/writes only for non-anonymous Firebase Auth users, under the POC assumption
that provisioned authenticated users are officers. Configure the shared officer
account as described above; there is no member account or signup workflow. Problem
documents also permit Officer reads/writes. Officers can read, create, update, and
delete Solution documents only at the fixed `python`, `java`, and `cpp` IDs.
Anonymous Solution access and all other paths remain denied by default.
No public Session reads or publication policy are introduced.

Deploy these rules to the intended Firebase project **before using Session CRUD**:

```bash
npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
```

Do not deploy with public/test-mode rules. This branch does not deploy rules or
modify any production project. #42 must extend this baseline with eligible public
Session reads, Problem metadata access, and protected Solution reveal rules.
#44 owns lifecycle transitions and the richer dashboard/history UI; the #38 list
is a flat preparation surface showing existing status without changing it.

Unit tests mock Firebase and require no project. They cover exact write fields,
calendar dates, stable creation timestamps, list mapping/pending writes, deletion,
current Auth guards, and UI persistence failures/retry/confirmation. Rules emulator
validation has not run: this development machine has no Java runtime or existing
Rules test infrastructure. Before deploying, validate with the Firestore Emulator
or Firebase Rules Playground: officer Session CRUD allowed; signed-out and
anonymous-auth Session reads/writes denied; Officer Problem CRUD allowed; Officer
deletes on the three fixed Solution paths allowed (including missing documents);
all Solution reads/creates/updates and other-language deletes denied; signed-out
and anonymous-auth Problem and Solution reads/writes denied. #46 owns comprehensive
permission test coverage.

## Officer Problem preparation (#39)

`src/lib/firebase/problems.ts` provides `createProblem`, `listProblems`,
`updateProblem`, `reorderProblems`, and `deleteProblem`. Every operation checks
the current non-anonymous Officer Auth session before accessing Firestore.
Creation reads the current order from the server and writes only `Untitled Problem`,
empty description/examples, the next order, and `answersVisible: false`.
No Solution documents or Solution fields are created in Problem metadata.
Server reads validate the existing `Problem` model and reject pending writes.
Content updates write only title, description, example input and example output;
reordering checks the current complete ID list and writes dense orders in one batch.
Problem deletion commits the three known Solution deletes and metadata delete
in one atomic batch, without reading protected source or output.

From a selected Session, **Manage problems** opens the preparation workspace.
Problem tabs use local Officer selection and never mutate `Session.activeProblemId`
or reveal state. Arrow keys/Home/End move focus, and Enter/Space activate tabs.
A compact contextual action group supports Rename, Delete and Move earlier/later;
Move actions replace drag infrastructure with a keyboard-accessible interaction.
Deletion uses a named confirmation with Cancel, keyboard dismissal, and focus
restoration to a remaining tab or Add problem. Empty Sessions show the Add first
problem state; loading and read failure remain distinct.

Problem content commits on blur with unsaved, saving, confirmed saved and retryable
failure states. Failed edits remain visible; navigation, creation, ordering and
deletion are blocked until content is saved. The Session workspace cannot close
while a child write/edit is pending. Creation uses the backend-confirmed record
directly rather than retrying a successful write after a failed refresh.
Operation errors offer a list reload, including when a remote list change prevents
reordering. Firestore is authoritative; no localStorage or member/public fetching
is added. There is no constraints field in the persisted model.

Unit tests mock Firebase, cover CRUD, ordering, fixed cleanup/cascade, authentication,
selection, save failures and loading/error/empty states, and require no production
project. **Rules emulator validation has not run:** `java -version` reports that no
Java Runtime is installed. Mocked tests are not a substitute for deployed Rules
validation; run the permission cases above in the Firestore Emulator or Rules
Playground before deployment. No rules were deployed by this change.

## Officer Solution preparation (#40)

`src/lib/firebase/solutions.ts` provides `getSolutionsForProblem` and
`updateSolution`, using only the fixed `python`, `java`, and `cpp` document IDs.
Every operation checks for a current non-anonymous Officer Auth session before
accessing Firestore. The language ID establishes which Language a document holds;
Solution records contain only `code` and prepared static `output`.

Solution documents are created lazily by the first confirmed edit. Reading a
Problem maps missing documents to empty editor values without creating data. The
officer workspace requests all three fixed documents from the server when a
Problem is selected. It does not store Solution fields in Problem metadata.

The three integrated Solution panels appear below the selected Problem content.
Each panel combines its language heading, Monaco source editor, and editable
prepared Output field. Code and output save independently per Language after a
short debounce. Failed saves retain edits and offer retry; unsaved changes block
Problem switching and leaving the Session workspace. Monaco's language mode is
fixed to Python, Java, or C++ for its panel. The reusable `SolutionWorkspace`
accepts already-authorized records for read-only rendering and does not fetch
Solution data itself; public data access remains for #41 and reveal authorization
for #42. The root landing page no longer mounts the temporary single-language-tab
Monaco workspace.

Rules permit non-anonymous officers to read, create, update, and delete Solution
documents only under the three fixed Language IDs. Anonymous access stays denied;
#42 must add eligible Session publication and parent `answersVisible` conditions
before any public Solution reads. Unit tests mock Firebase and require no project.
