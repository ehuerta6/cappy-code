# Firebase foundation

## Local emulator development

Routine development and destructive testing use the Firebase Emulator Suite.
The project uses Firestore on `127.0.0.1:8080` and Authentication on
`127.0.0.1:9099`. Firebase CLI is installed with the project dependencies;
Firestore Emulator requires Java 11 or newer.

Copy the local example and start the emulators in one terminal:

```bash
cp .env.example .env.local
npm ci
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
one Live Session per branch, two Draft Sessions, and twelve Past Sessions dated
across multiple weeks. The three live Sessions share a Bank Problem to exercise
independent live hiding. It intentionally includes linked LeetCode and custom Problems,
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
the GitHub repository `ehuerta6/cappy-code` and uses `main` as its production
branch. Changes merged to `main` trigger production deployments. Firebase
provides Authentication and Firestore; Firestore Security Rules deploy
separately. The project stays on Firebase Spark. Do not enable Firebase App
Hosting, Blaze, Storage, or another paid Firebase service.

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

For an authorized production release, verify anonymous Member access and
authenticated Officer workflows against the deployed application. Emulator or
preview results do not establish production behavior. Avoid creating production
content for routine checks; production data changes require a separately
approved operation.

## Historical production verification from October 8, 2026 (#134)

This records the production configuration observed on October 8, 2026. It is
historical verification and does not identify the current production
deployment. At that time:

- Vercel project: `cappycode`, connected to `ehuerta6/cappy-code`.
- Production deployment observed: READY, built from `main` at
  `484656a02a79abcf13d620f2095090a37bca3dc0`.
- At that time, the Vercel Production environment's
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID` was `cappycode-f133c` and
  `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` was `false`.
- The deployed client called Firebase's default `getFirestore` instance. The
  Firebase project `cappycode-f133c` had the native Firestore database
  `projects/cappycode-f133c/databases/(default)`.

That verification identified `cappycode-f133c` / `(default)` as the deployed
app's Firestore target and the intended #131 import target at the time. It used
the Vercel Production deployment and environment configuration plus Firebase
project/database metadata, not `.firebaserc` or local emulator settings. No
secret values are recorded here. No production data was written during
verification.

## Local and production configuration

Use the Auth and Firestore emulators for development, tests, and destructive
testing. Follow [Getting started](GETTING_STARTED.md) for the supported
`npm ci`, seed, reset, and development commands. The local example uses the
`demo-cappycode-local` project ID and cannot fall back to production.

Production uses Firebase project `cappycode-f133c` with the existing Web app
configuration. Vercel supplies the `NEXT_PUBLIC_FIREBASE_*` values and sets
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`. Next.js embeds `NEXT_PUBLIC_`
values in the production build, so configuration changes require a new
deployment. These Firebase client values are public configuration, not
authorization credentials. Never put Officer passwords, service account keys,
or server secrets in them. `.env.local` is ignored by Git.

Firebase remains on Spark and is used for Authentication, Firestore, and
Firestore Security Rules. Production web hosting is on Vercel. There is no
Firebase App Hosting deployment or paid Firebase service. Deploy Firestore
Rules separately when an approved change requires it.

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

Enable **Email/Password** under Firebase Console → Authentication → Sign-in method, then create the shared CIC Officer account under **Users → Add user**. Configure the application's host under Authentication → Settings → Authorized domains if needed. Keep the account password outside the repository and environment example. There is no signup or member account flow.

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

| Path                                                             | Type               | Fields                                                                                                                    |
| ---------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `sessions/{sessionId}`                                           | `Session`          | `title`, `date`, `status`, `createdAt`, `updatedAt`                                                                       |
| `sessions/{sessionId}/problems/{problemId}`                      | `Problem`          | `title`, `description`, `exampleInput`, `exampleOutput`, `constraints`, `order`, `answersVisible`, optional `leetcodeUrl` |
| `sessionControl/{branch}`                                        | control            | `sessionId` (live Session ID or `null`), `bankProblemIds` (its reusable Problem IDs, or `[]` when unclaimed)              |
| `sessionControl/liveSession`                                     | legacy control     | `sessionId` (read only for compatibility migration; `null` after migration)                                               |
| `sessions/{sessionId}/problems/{problemId}/solutions/{language}` | `Solution`         | `code`                                                                                                                    |
| `problemBank/{problemId}`                                        | Bank Problem       | Problem content, `hiddenByLiveSessionId`, derived `approachTagSummary`                                                    |
| `problemBank/{problemId}/approaches/{approachId}`                | `SolutionApproach` | `name`, `tags`, `order`                                                                                                   |
| `dsaTags/{tagId}`                                                | DSA tag            | `label`, `family`, `order`, `active`; stable IDs are referenced by Approach `tags`                                        |
| `problemBank/{problemId}/solutions/{language}`                   | `Solution`         | `code`                                                                                                                    |

- `Language` is exactly `python | java | cpp`; each language identifies its own Solution document.
- `SessionStatus` is `draft | live | ended`.
- `date` is a calendar date string in `YYYY-MM-DD` format. `createdAt` and `updatedAt` are Firestore `Timestamp` values in resolved persisted records; later write workflows can use SDK `serverTimestamp()` and must handle pending timestamp snapshots if needed.
- `order` is a numeric sort key within the session. Problem reordering writes dense zero-based integers; ties on reads sort by document ID.
- `exampleOutput` is the Problem's officer-prepared expected result, not an execution result.

`sessionPath`, `problemPath`, and `solutionPath` centralize nested document paths and reject empty IDs or IDs containing `/`. They return strings for SDK `doc()` calls; collection access can use SDK `collection()` with `sessions`, or a document reference and its subcollection name. Session and Problem CRUD use small concrete Firestore functions. No generic repositories, converters, or unchecked typed snapshot casts are introduced. These TypeScript types describe the intended shape; they do not validate incoming Firestore data.

## Access boundary

Problem documents hold member-facing metadata, the shared example input and expected output, and `answersVisible`. Prepared code exists only in the separate Solution subcollection, consistent with [Firestore's hierarchical data model](https://firebase.google.com/docs/firestore/data-model). Draft Sessions are officer-only; anonymous members can read metadata under `live` and `ended` Sessions. Existing Solution documents may still contain a legacy `output` field; current readers ignore it and current writes omit it.

Anonymous Solution reads for live Sessions require the parent Problem's `answersVisible` to be true. For ended Sessions, all fixed-language Solution documents are public regardless of that field. Draft Solutions remain officer-only. Hiding live answers in the UI alone provides no protection; Firestore Rules deny those reads.

### Problem Bank visibility

Problem Bank content is public by default and is hidden while referenced by any
live Session. `hiddenByLiveSessionId` stays non-null while at least one branch
claim references the Problem and clears only after the last live use stops.
Member listings query the unhidden marker; Firestore Rules also check every
branch claim and the legacy pointer during compatibility migration, so a stale
marker cannot expose a live-used Problem. Rules remain the authorization
boundary, and Officers retain access while an entry is hidden.

`approachTagSummary` is a sorted, de-duplicated list derived from a Bank
Problem's Approach tags. It travels with each Bank Problem record so Member
lists can render and filter tags without reading every Approach subcollection.
Officer Approach changes update the summary in the same Firestore batch.

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

Deploy these rules to the intended Firebase project before using Session CRUD:

```bash
npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
```

Do not deploy with public/test-mode rules. The Rules test suite exercises these
permissions in the Firestore Emulator; deploying rules to a production project
is an operator task.

## Session lifecycle and history (#44)

`src/lib/firebase/sessions.ts` provides `transitionSession`, which accepts only
`live`, `draft`, or `ended` targets and uses a Firestore transaction to verify the
persisted transition. Only `draft → live`, `live → draft`, and `live → ended`
are allowed; ended Sessions are terminal. Go Live requires at least one Problem
and atomically claims `sessionControl/{branch}`. Intro, General,
and ICPC each have an independent claim, so up to three Sessions may be live at
once. Firestore Rules require the Session status and matching branch claim to
agree in the same write. Not Live clears only that branch claim and changes only
the Session status; it preserves
Problems, Solutions, ordering, and each Problem's `answersVisible` value. The
Officer dashboard groups rows by persisted status: live, draft (Upcoming), and
ended (Past Sessions). Dates sort rows within each group but do not determine
status. Ended Sessions remain editable and public. Ending changes only the
Session status and branch claim; it does not alter any Problem's `answersVisible`
value. The ended status itself makes all fixed-language Solutions publicly
readable.

### Branch live-control rollout and legacy compatibility

`sessionControl/liveSession` remains readable by the compatibility code and
Rules until its `sessionId` is cleared. Rules also consider that legacy Session
when enforcing Problem Bank hiding. On the first new lifecycle transition, the
client reads the old pointer and live Session in a transaction. If another
branch starts, it moves the still-live Session into the correct branch claim
while retaining `live`; if that Session stops, ends, or is deleted, it clears
the old pointer atomically. Migration never ends a Session as a side effect.
New lifecycle actions use only the branch documents after that conversion.

Production rollout requirements:

1. Export/backup Firestore. Inspect the old `sessionControl/liveSession`
   document, every live Session's branch and `bankProblemIds`, and the Bank
   hiding markers. Confirm there is at most one live Session per branch.
2. If the old pointer identifies a live Session, keep it live and confirm its
   branch. Do not clear it manually or end it as a migration shortcut.
3. Deploy the new Rules, then deploy the compatible application. Pause Officer
   lifecycle changes until the new application is available. Older clients can
   read current public Sessions, but their global-pointer Go Live writes are
   denied by the new Rules.
4. Verify the old pointer is null; every live Session has one matching branch
   claim; empty branches have no active claim; and shared Bank Problems stay
   hidden until their final live use stops. Verify anonymous reads, Officer
   writes, answer reveal, Not Live, End, and live deletion against the deployed
   Rules and application.

Compatibility risk: while the old pointer is present, it continues to protect
its live Session's Bank Problems. Older clients cannot start Sessions after the
Rules deployment. If rollout verification fails, restore the backup and roll
back Rules and application together. This change does not deploy Rules or modify
production data; production deployment and migration need separate
authorization.

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
see **Problem link ↗** when a link exists. The Officer Sessions dashboard loads
Past Session Problem history on demand when an Officer expands **Show
Problems**. It reads the ordered Problem documents to show titles, descriptions,
constraints, and links under the **Problem link:** label, or **No Problem link
provided** when a link is absent. Draft and live Sessions do not load this
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
Solution workspace lets the Officer select an Approach and a Language, then
shows one Monaco editor for that selection. Source and complexity edits stay
local while editing; the selected Problem's explicit save persists dirty
Problem content and language Solutions.
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

### Problem Bank Approach tag summaries

Member Bank lists use the parent `approachTagSummary` field for DSA badges and
filtering. New and updated Bank content maintains this field alongside its
Approach documents. For older parents without the field, the Member list loads
the missing Approach tags before returning its first list result; it does not
show an empty state and then add badges later. This compatibility path reads
Approaches only for parents missing the summary. Once all legacy parents are
backfilled, normal Member list reads use only the Bank parent query.

The backfill targets `cappycode-f133c` / `(default)` and is read-only by
default. Before using it, export a Firestore backup and review the project's
current Problem Bank content. Run a dry run with valid Application Default
Credentials and inspect every planned summary:

```bash
npm run problem-bank:backfill-tag-summary
```

If the plan is correct, schedule a short maintenance window so Officers do not
change Bank Approach tags between the scan and writes. An authorized maintainer
can then run the explicit write command after independently confirming the
project and backup:

```bash
npm run problem-bank:backfill-tag-summary -- --write-production --expected-project-id=cappycode-f133c
```

The script refuses writes unless the expected project ID is supplied, rejects
credentials configured for another Firebase project, requires no more than 500
Bank parents, and writes in batches of at most 400. Verify every
formerly missing parent now has a summary, and compare the saved tags with its
Approach documents. This change does not run the script or modify production
Firebase data.

### DSA tag catalog migration

The public `dsaTags/{tagId}` catalog stores display metadata with stable IDs.
Member clients can read this metadata; Officer clients alone can write it.
Approach documents in both Bank Problems and Session snapshots store unique
catalog IDs, with a maximum of 16 tags. Renaming a tag only changes its catalog
document. Archived tags remain readable and render on existing and historical
content, while filters and new selections use active tags only.

Deleting an unused tag queries the `approaches` collection group, which spans
Bank Approaches and Session snapshots (including historical or orphaned
Approach documents). The collection-group query filters `tags` with
`array-contains`; its single-field collection-group index is configured in
`firestore.indexes.json`, as required for filtered collection-group queries by
[Firestore's index documentation](https://firebase.google.com/docs/firestore/query-data/index-overview).
A recursive Rules match grants read access to this
query for Officers only; Members keep the existing path-specific visibility
rules. Rules cannot query an arbitrary collection group to prove that a tag has
no references, so permanent deletion goes through the Officer operation which
performs this scan immediately before deleting. A referenced tag is archived
instead. This is an application invariant, not a Rules-level guarantee against
a direct delete issued by a separately authorized Officer client.

#### Production rollout

The deployed application and Rules currently use the legacy display strings
(`Arrays`, `Hash Map`, and the other built-in labels). The application in this
change writes stable catalog IDs, and the matching Rules validate IDs. The two
versions are not safe to roll out independently: old clients can submit labels
the new Rules reject, and new clients can submit IDs old Rules reject. Use a
short maintenance window that pauses Officer Approach edits through migration
and coordinated application/Rules rollout. Do not reopen Officer edits until
the new application and Rules are both active.

1. **Confirm compatibility and scope.** Confirm the target is
   `cappycode-f133c`, the production app is still on the legacy-label schema,
   and no other writer or import script will update Approach tags during the
   maintenance window. Check that the deployed Rules still permit the current
   legacy application. Do not deploy only the new app or only the new Rules.
2. **Back up Firestore.** Export the full production database to a secured,
   access-controlled Cloud Storage bucket and wait for the export operation to
   finish before proceeding. For example, after selecting the production
   project and an approved bucket:

   ```bash
   gcloud firestore export gs://BUCKET_NAME/cappycode-pre-dsa-tag-catalog \
     --project=cappycode-f133c --database='(default)'
   ```

   See Google's [managed export and import documentation](https://cloud.google.com/firestore/docs/manage-data/export-import).
   The managed export is a recovery artifact, not a transactionally consistent
   point-in-time snapshot while writes continue. Keep the Officer write pause
   in place for the migration window.

3. **Run a dry run.** The command is read-only unless `--write-production` is
   supplied. It scans all Approach subcollections plus Bank tag summaries and
   reports the target project, tag totals, updates, unknown labels, and ID
   collisions:

   ```bash
   npm run dsa-tags:migrate
   ```

4. **Reconcile unknown labels.** The 16 built-in labels map to the stable IDs
   seeded by the migration. For every `unknownLegacyTags` entry, decide whether
   to preserve its exact label or map it to an existing catalog concept. To
   assign a reviewed ID, display label, and color family or resolve a slug
   collision, copy `scripts/dsa-tag-reconciliation.example.json` to a
   restricted local file and add an exact legacy-label mapping. Rerun the dry
   run with `--reconciliation-file=/path/to/dsa-tag-reconciliation.json` and
   confirm `reconciledLegacyTags` lists the intended entries,
   `unusedReconciliations` is empty, and `tagIdCollisions` is empty. Leave the
   mapping file out of the repository if it contains production taxonomy
   decisions. Unknown labels without an explicit mapping are preserved verbatim
   with deterministic IDs and the `strategy` color family. Do not use the write
   flag until every unknown is accounted for. The write command requires
   `--accept-unknown-tags` as an explicit acknowledgment.
5. **Apply in this order.** Keep Officer edits paused. First deploy the new
   Rules and index. Wait until the index is enabled, then run the reviewed
   migration write command. Deploy the new application immediately afterward,
   with the maintenance banner or access control still preventing Officer edits
   until the application, Rules, and index are confirmed active. Never run the
   migration against the old writer after it is complete.

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project cappycode-f133c
   npm run dsa-tags:migrate -- --write-production \
     --expected-project-id=cappycode-f133c --accept-unknown-tags
   ```

   Add `--reconciliation-file=/path/to/dsa-tag-reconciliation.json` to both
   migration commands when a reconciliation file is used.

   Coordinate the application release through the normal deployment workflow;
   this document does not authorize or perform that deployment.
   If any step fails after migration writes begin, keep Officer edits paused.
   The migration is rerunnable, but do not resume the legacy writer against
   stable IDs; inspect the dry-run result and either complete the rollout
   forward or use the approved backup recovery procedure.

6. **Verify before reopening edits.** Rerun the dry run with the same
   reconciliation file and confirm zero Approach documents and Bank summaries
   need migration, no unknown labels or collisions remain, every referenced ID
   resolves to a catalog label, and archived tags remain present for historical
   references. In the application, inspect representative Bank and Session
   Approaches, Member filters, and Officer selection. Confirm an archived tag
   remains visible on its historical content, is absent from new selections,
   an in-use tag cannot be deleted through the Officer catalog operation, and
   an unused tag can be removed. Only then reopen Officer editing.

The migration is bounded by Firestore's 500-write batch limit, writes in batches
of at most 450, and never runs on application startup. No production migration,
Rules deployment, or application deployment was run as part of this change.

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
