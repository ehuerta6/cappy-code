# Firebase foundation

## Local emulator development

Routine development and destructive testing use the Firebase Emulator Suite.
The project uses Firestore on `127.0.0.1:8080` and Authentication on
`127.0.0.1:9099`. Firebase CLI is installed with the project dependencies;
Firestore Emulator requires Java 11 or newer.

Copy the local example and start the emulators in one terminal:

```bash
cp .env.example .env.local
npm install
npm run emulators
```

The example explicitly sets `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`. With
that flag, the existing Firebase client initializes with the harmless demo
project ID `demo-cappycode-local` and connects its normal Firestore and Officer
Auth clients to the local emulators. It does not need a Firebase Console project
or production Web app values. `firebase.json` loads the checked-in
[`firestore.rules`](../firestore.rules) for emulator use, the same Rules file
used by production.

In another terminal, seed the deterministic local data and start Next.js:

```bash
npm run seed
npm run dev
```

The deterministic reset creates one Officer account in the local Auth
Emulator:

| Field    | Local emulator value |
| -------- | -------------------- |
| Email    | `cappy@gmail.com`    |
| Password | `cappy123`           |

This credential is for the local Auth Emulator only. Never use it with
production Firebase; it is unrelated to and must not modify the production
Officer account. Members stay anonymous. The deterministic fixture contains
one Live Session, two Draft Sessions, and twelve Past Sessions dated across
multiple weeks. It intentionally includes linked LeetCode and custom Problems,
mixed reveal states, multiple Problems per Session, and prepared Python, Java,
and C++ Solutions for every Problem. This gives the Member archive,
Officer Past history, reveal controls, Monaco panels, and explicit Save flows
useful content immediately after reset.

After destructive testing, restore the known state with the emulators still
running:

```bash
npm run reset
```

Reset clears the local Auth and Firestore emulator data before restoring the
canonical local Officer and complete deterministic Session fixture.
`npm run seed` reapplies the fixture without clearing other local data. Neither
script targets a Firebase project outside the hard-coded
`demo-cappycode-local` project and local emulator endpoints.
The seed uses the existing Rules test helper to bypass Rules only while loading
local setup data. The running application still uses the checked-in Rules for
every app request.

To confirm the app is using emulators, keep the emulator process running, sign
in with the local Officer account, and inspect the browser Network panel for
Firestore requests to `127.0.0.1:8080` and Auth requests to `127.0.0.1:9099`.
If an enabled emulator is unavailable, requests fail visibly; the client does
not fall back to production. Emulator use accepts only the explicit values
`true` or `false`; an invalid value fails configuration, and `true` is rejected
in a production build.

Production uses the real Firebase Web app configuration with
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false` or the flag unset. Configure its
`NEXT_PUBLIC_FIREBASE_*` values in the deployment environment, never in a
committed file. Next.js inlines `NEXT_PUBLIC_` values when building, so the
production flag and real project values must be set for the production build.
Routine development and destructive testing belong on emulators; use production
only for targeted deployment smoke checks. Do not create test Sessions in
production.

## Production deployment (#73)

The Next.js production app is deployed to Vercel at
<https://cappycode.vercel.app>. The Vercel project `cappycode` is connected to
the GitHub repository `ehuerta6/cappy-code` (formerly
`ehuerta6/multi-language-ide`) and uses `main` as its production branch. Changes
merged to `main` trigger production deployments. Firebase remains the backend
for Firestore, Authentication, and Security Rules; do not enable Firebase App
Hosting or upgrade the Firebase project to Blaze for this deployment.

Configure the following project-level Vercel variables for the **Production**
environment, using the Web app config from the existing Firebase project
`cappycode-f133c`:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`

These public client config values are compiled into browser assets. Never put
Officer passwords, service account credentials, or other secrets in
`NEXT_PUBLIC_` variables. Changing a Vercel environment variable requires a
new deployment before the production build uses it. Confirm the deployed app's
Firestore requests target `cappycode-f133c`; production requests must not use
localhost or emulator endpoints. Deploy Firestore Security Rules separately
with the Firebase CLI when Rules changes are in scope.

For a production release, verify anonymous Member access and authenticated
Officer workflows with the production account, including explicit Save,
LeetCode links and history, solution reveal/hide, Session lifecycle and ended
archive, Monaco languages, and themes. Use only approved temporary smoke data
and remove it when finished. Do not treat emulator or preview-deployment
results as production verification.

## Local setup

1. Create or select a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. Register a Web app under **Project settings → General → Your apps**. Copy its SDK configuration values. The [official Web SDK setup guide](https://firebase.google.com/docs/web/setup) describes these steps.
3. Create the default Cloud Firestore database under **Build → Firestore Database**, using production mode. Deploy [`firestore.rules`](../firestore.rules) before enabling public Session access.
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

Builds and normal unit tests require no live Firebase project. Concrete Session, Problem, Officer Solution, and public read operations are described below; Firestore Rules enforce which public documents can be read.

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

| Path                                                             | Type       | Fields                                                                                                                    |
| ---------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `sessions/{sessionId}`                                           | `Session`  | `title`, `date`, `status`, `createdAt`, `updatedAt`                                                                       |
| `sessions/{sessionId}/problems/{problemId}`                      | `Problem`  | `title`, `description`, `exampleInput`, `exampleOutput`, `constraints`, `order`, `answersVisible`, optional `leetcodeUrl` |
| `sessionControl/liveSession`                                     | control    | `sessionId` (active Session ID, or `null` when no Session is live)                                                        |
| `sessions/{sessionId}/problems/{problemId}/solutions/{language}` | `Solution` | `code`                                                                                                                    |

- `Language` is exactly `python | java | cpp`; each language identifies its own Solution document.
- `SessionStatus` is `draft | live | ended`.
- `date` is a calendar date string in `YYYY-MM-DD` format. `createdAt` and `updatedAt` are Firestore `Timestamp` values in resolved persisted records; later write workflows can use SDK `serverTimestamp()` and must handle pending timestamp snapshots if needed.
- `order` is a numeric sort key within the session. Problem reordering writes dense zero-based integers; ties on reads sort by document ID.
- `exampleOutput` is the Problem's officer-prepared expected result, not an execution result.

`sessionPath`, `problemPath`, and `solutionPath` centralize nested document paths and reject empty IDs or IDs containing `/`. They return strings for SDK `doc()` calls; collection access can use SDK `collection()` with `sessions`, or a document reference and its subcollection name. Session and Problem CRUD use small concrete Firestore functions. No generic repositories, converters, or unchecked typed snapshot casts are introduced. These TypeScript types describe the intended shape; they do not validate incoming Firestore data.

## Access boundary

Problem documents hold member-facing metadata, the shared example input and expected output, and `answersVisible`. Prepared code exists only in the separate Solution subcollection, consistent with [Firestore's hierarchical data model](https://firebase.google.com/docs/firestore/data-model). Draft Sessions are officer-only; anonymous members can read metadata under `live` and `ended` Sessions. Existing Solution documents may still contain a legacy `output` field; current readers ignore it and current writes omit it.

Anonymous Solution reads for live Sessions require the parent Problem's `answersVisible` to be true. For ended Sessions, all fixed-language Solution documents are public regardless of that field. Draft Solutions remain officer-only. Hiding live answers in the UI alone provides no protection; Firestore Rules deny those reads.

## Officer Session preparation (#38)

`src/lib/firebase/sessions.ts` provides `createSession`, `listSessions`,
`updateSession`, and `deleteSession`, using the foundation's `Session` type and
`sessionPath`. Each operation checks the current user from
`getOfficerAuth()`; signed-out and anonymous-auth users are rejected
before Firestore access. Firebase sends the actual Auth token to Firestore;
Security Rules remain the backend boundary.

Creation writes `Untitled Session`, the browser's current local calendar date,
`draft`, and server timestamps. It creates no Problems.
Calendar dates remain `YYYY-MM-DD` strings. Edits validate title/date and write
only those fields plus `updatedAt: serverTimestamp()`, preserving `createdAt`,
and status. Writes resolve only after backend confirmation.
The list uses `getDocsFromServer`; failed/offline reads remain errors rather than
using static content or presenting cached data as current. It validates stored
fields and rejects documents with pending writes or unresolved timestamps rather
than inventing client timestamps. Document IDs are separate read-model fields.

Title/date edits remain local until **Save changes** is selected, with visible
unsaved, Saving, Saved, and retryable error states. Failed edits remain in the
fields. Navigation and deletion are disabled until edits are saved. Lists
distinguish loading, empty, failed, and populated states. A successfully created
document followed by a failed list refresh is reported as a read failure,
preventing an erroneous creation retry.

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

### Session and answer security rules

`firebase.json` points to `firestore.rules`. Authenticated Officers can read and
write Sessions, Problems, and the fixed `python`, `java`, and `cpp` Solution
documents. Anonymous members can read Sessions and Problems when the parent
Session status is `live` or `ended`. For live Sessions, they can read a fixed
Solution document only when its Problem has `answersVisible: true`; every fixed
Solution document is readable for ended Sessions. Anonymous writes are denied.
A broad Session query does not filter drafts through Rules; public discovery uses
separate queries constrained to `live` and `ended`.

Deploy these rules to the intended Firebase project **before using Session CRUD**:

```bash
npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
```

Do not deploy with public/test-mode rules. The Rules test suite exercises these
permissions in the Firestore Emulator; deploying rules to a production project
is an operator task.

## Session lifecycle and history (#44)

`src/lib/firebase/sessions.ts` provides `transitionSession`, which accepts only
`live`, `draft`, or `ended` as requested targets and uses a Firestore transaction
to verify the persisted transition. Only `draft → live`, `live → draft`, and
`live → ended` are allowed; ended Sessions are terminal. Go Live also requires at
least one Problem and atomically claims `sessionControl/liveSession`. If this
control document is missing, the client checks for legacy live Sessions before
the transaction. The transaction then claims the singleton document, whose
concurrent creation/update conflicts make a competing transition retry and read
the current claim. Firestore Rules require Session lifecycle changes and the live
pointer to agree in the same write, preventing concurrent clients from claiming
different live Sessions.
Not Live clears the pointer and changes only the Session status; it preserves
Problems, Solutions, ordering, and each Problem's `answersVisible` value. The
Officer dashboard groups rows by persisted status: live, draft (Upcoming), and
ended (Past Sessions). Dates sort rows within each group but do not determine
status. Ended Sessions remain editable and public. Ending changes only the
Session status and pointer; it does not alter any Problem's `answersVisible`
value. The ended status itself makes all fixed-language Solutions publicly
readable.

Normal unit tests mock Firebase and require no project. Rules tests use the actual
emulator to verify officer access, public status access, answer reveal/revocation,
fixed Solution IDs, and anonymous write denial.

## Officer Problem preparation (#39)

`src/lib/firebase/problems.ts` provides `createProblem`, `listProblems`,
`updateProblem`, `reorderProblems`, and `deleteProblem`. Every operation checks
the current non-anonymous Officer Auth session before accessing Firestore.
Creation reads the current order from the server and writes only `Untitled Problem`,
empty description/examples/constraints, the next order, and
`answersVisible: false`. The optional `leetcodeUrl` is omitted for custom
Problems and on older documents; readers accept its absence without a migration.
The plain multiline `constraints` field is backward-compatible: readers treat a
missing value as empty, with no migration required. Officers can enter a link in the
Problem editor, where a blank value clears the field and a nonblank value must
be an HTTPS URL on `leetcode.com` or `www.leetcode.com` at `/problems/{slug}`.
The link saves with the Problem's explicit **Save changes** workflow. Members
see **View on LeetCode** only when a link exists. The Officer Sessions dashboard
loads an ordered Problem summary under each Past Session, using existing
Problem documents to show titles, descriptions, constraints, and links (or the Officer-only
**No LeetCode link provided** label). Draft and live Sessions do not load this
history, and no separate history records are stored.
No Solution documents or Solution fields are created in Problem metadata.
Server reads validate the existing `Problem` model and reject pending writes.
Content updates write only title, description, example input, expected output,
and constraints;
reordering checks the current complete ID list and writes dense orders in one batch.
Problem deletion commits the three known Solution deletes and metadata delete
in one atomic batch, without reading protected source or output.

From a selected Session, **Manage problems** opens the preparation workspace.
Problem tabs use local Officer selection and never mutate session metadata
or answer visibility. Arrow keys/Home/End move focus, and Enter/Space activate tabs.
A compact contextual action group supports Rename, Delete and Move earlier/later;
Move actions replace drag infrastructure with a keyboard-accessible interaction.
Deletion uses a named confirmation with Cancel, keyboard dismissal, and focus
restoration to a remaining tab or Add problem. Empty Sessions show the Add first
problem state; loading and read failure remain distinct.

Problem metadata and all dirty language source edits stay local until one
**Save changes** action persists the selected Problem workspace. Successful parts
are confirmed independently; failed parts stay dirty and provide a specific
retryable error. Failed edits remain visible; navigation, creation, ordering and
deletion are blocked until content is saved. The Session workspace cannot close
while a child write/edit is pending. Creation uses the backend-confirmed record
directly rather than retrying a successful write after a failed refresh.
Operation errors offer a list reload, including when a remote list change prevents
reordering. Firestore is authoritative; no localStorage or member/public fetching
is added. Members see constraints with the description and shared examples before
Solutions, regardless of answer reveal state. Existing Problems need no migration.

Unit tests mock Firebase, cover CRUD, ordering, fixed cleanup/cascade, authentication,
selection, reveal persistence, save failures and loading/error/empty states, and
require no production project. The Firestore Rules test suite is described below.
No rules were deployed to a production project by this change.

## Officer Solution preparation (#40)

`src/lib/firebase/solutions.ts` provides `getSolutionsForProblem` and
`updateSolution`, using only the fixed `python`, `java`, and `cpp` document IDs.
Every operation checks for a current non-anonymous Officer Auth session before
accessing Firestore. The language ID establishes which Language a document holds;
the active Solution record contains only `code`.

Solution documents are created lazily by the first confirmed save. Reading a
Problem maps missing documents to empty editor values without creating data. The
officer workspace requests all three fixed documents from the server when a
Problem is selected. It does not store Solution fields in Problem metadata.

The Problem editor prepares the shared example input and expected output. The
three integrated Solution panels appear below the selected Problem content and
contain a language heading and Monaco source editor. Source updates stay local
while editing; the selected Problem's single explicit save persists dirty
Problem content and language documents.
Confirmed language documents stay confirmed if another write fails. Failed saves
retain edits, identify the affected Language, and can be retried without rewriting
clean language documents. Unsaved changes block Problem switching and leaving the
Session workspace. Monaco's language mode is fixed to Python, Java, or C++ for its
panel. The reusable `SolutionWorkspace`
accepts already-authorized records for read-only rendering and does not fetch
Solution data itself; the public view fetches live records only after Problem
metadata reports answers visible. It fetches ended-session records automatically.

Firestore Rules allow anonymous Session and Problem reads only for `live` and
`ended` Sessions. Live Solution reads require `answersVisible: true`; ended
Sessions allow all fixed-language Solutions regardless of that value. Draft
Solutions, unsupported language IDs, and anonymous writes remain denied.
Authenticated Officers retain access to the fixed Solution documents. Ending a
Session changes only its status; it does not rewrite Problem documents.

## Public Member view and archive (#41, #64)

`src/lib/firebase/member.ts` provides anonymous server reads for public
discovery, a selected Session, its ordered Problem metadata, and the three fixed
Solution documents. Discovery runs separate `status == live` and
`status == ended` queries because Firestore Rules do not filter broad Session
queries. Drafts are not returned. The selected Session and Problem reads still
go through Firestore Rules, which remain authoritative if access changes.

The public home shows **Live now** and newest-first **Past sessions**. It shows
“No live session right now” when the live group is empty; ended Sessions remain
visible in the archive. Drafts are not returned.

The member pages call read functions from Client Component effects; no Officer
Auth gate, account UI, or write function is used. For live Sessions, the hidden
AnswerGate renders without requesting Solution documents until
`answersVisible` becomes true. For ended Sessions, all three fixed Solution
documents are requested automatically, regardless of `answersVisible`. The
read model maps missing documents to empty source and ignores any legacy
Solution `output` field. Firestore Rules remain authoritative for every read.
The shared Problem example appears before Solutions, and the reusable
`SolutionWorkspace` renders returned records in read-only Monaco panels.

## Realtime answer visibility

`src/lib/firebase/answer-visibility.ts` subscribes to the viewed Problem's
`answersVisible` field for live Sessions. The hook in
`src/hooks/use-answer-visibility.ts` tracks one Problem at a time and
unsubscribes on change or unmount. Ended Sessions do not need this listener;
their Solutions are public based on the parent Session status. Member and
Officer tab selections are local to each view and do not synchronize through
Firestore.

The officer's **Show Answers** and **Hide Answers** controls update the selected
Problem's `answersVisible` field while a Session is live. Members viewing that
Problem receive the change in realtime. The member view fetches live Solutions
only after the listener confirms `answersVisible: true`; when it reports false,
the Solution component unmounts and clears its loaded data. Firestore Rules also
deny anonymous reads while live answers are hidden. Listener and permission
failures show generic retry states; raw Firebase errors are not rendered.

Legacy `activeProblemId` fields on existing Session documents are ignored by
readers. New Session documents do not write that field. No data migration is
required.

## Firestore Rules tests

The Rules tests use `@firebase/rules-unit-testing` against the Firestore Emulator.
Install a supported Java JDK (11 or newer) for local emulator runs, then run:

```bash
npm run test:rules
```

CI runs this command separately from the normal Vitest suite. The GitHub Actions
workflow installs Java 21 before running the emulator so permission tests
exercise the actual `firestore.rules` file.
