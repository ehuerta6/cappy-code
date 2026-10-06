---
name: firebase
description: Work safely with Firebase projects including Firestore, Authentication, Security Rules, Emulator Suite, Cloud Functions, Storage, indexes, seeds, and trusted server access.
metadata:
  source: firebase-official-docs
---

# Firebase

Use this skill for Firebase-specific implementation, debugging, review, setup, or local development.

## Before changing anything

Inspect the actual project first:

- `firebase.json`
- `.firebaserc`
- Firestore rules
- Storage rules
- Firestore indexes
- Firebase initialization code
- Auth setup
- Cloud Functions or trusted backend code
- package scripts
- emulator configuration
- tests
- seed scripts

Determine which Firebase products the project actually uses.

Do not introduce unused Firebase services.

## Environment

Identify whether the task affects:

- Local Emulator Suite
- a development Firebase project
- staging
- production

Prefer local emulators for development and destructive testing when practical.

Never modify production data, users, rules, or configuration unless the task explicitly requires it and the user has authorized it.

## Client vs trusted server

Treat these as different trust boundaries.

### Client SDK

Web and mobile clients rely on Firebase Authentication and Security Rules for access control.

Do not rely on UI checks alone for authorization.

### Admin SDK / server libraries

Treat Admin SDK and server environments as privileged.

Server Firestore access does not rely on normal client Security Rules.

Keep privileged credentials and service accounts out of browser code.

Use least privilege in trusted environments.

## Firestore

When changing data access:

- inspect the existing collection/document model;
- preserve established naming;
- consider query requirements;
- consider indexes;
- consider atomicity and concurrency;
- avoid unnecessary reads and writes;
- do not duplicate derived state without a reason.

Use transactions or atomic operations when correctness requires them.

Do not assume Emulator Suite perfectly reproduces all production limits or index behavior.

When query/index behavior matters, verify production requirements before considering the work complete.

## Security Rules

Security Rules are part of the implementation, not an afterthought.

For rule changes:

1. identify the intended actor;
2. identify allowed reads/writes;
3. identify forbidden access;
4. validate incoming data when relevant;
5. preserve least privilege;
6. test allowed and denied cases.

Prefer automated Security Rules tests using Emulator Suite.

Include negative tests.

A rule is not sufficiently tested if only the allowed path was exercised.

## Authentication

When changing Auth:

- distinguish authentication from authorization;
- inspect existing providers and flows;
- handle loading and signed-out states explicitly;
- avoid assuming a user document exists merely because authentication succeeded;
- keep privileged account management on a trusted boundary.

When using test accounts locally, keep their credentials clearly non-production.

## Emulator Suite

Use Emulator Suite for local integration whenever it gives a useful feedback loop.

Keep project IDs and emulator configuration consistent across:

- Firebase CLI;
- application initialization;
- tests;
- seed scripts.

If the project seeds local data:

- make the seed deterministic when practical;
- make it obvious that the data is local/test data;
- avoid touching production;
- make rerunning the seed safe or reset the emulator first.

## Cloud Functions

For Functions:

- inspect triggers carefully;
- consider retries and duplicate execution;
- keep privileged operations server-side;
- validate input;
- avoid hidden coupling between triggers.

Use local emulation when supported and useful.

## Storage

When using Firebase Storage:

- review Storage Rules alongside upload/download behavior;
- validate file ownership and authorization;
- consider file type and size restrictions when the product requires them;
- do not trust client-provided metadata as authorization evidence.

## Secrets

Never commit:

- service account private keys;
- production credentials;
- secrets;
- private environment files.

Prefer environment configuration and the deployment platform's secret mechanism.

## Debugging

Use `debug-with-evidence`.

For Firebase-specific failures inspect:

- emulator logs;
- Auth state;
- Security Rules decisions;
- network requests;
- Firestore paths;
- project IDs;
- environment configuration;
- Functions logs;
- SDK initialization.

Do not change rules to `allow read, write: if true` merely to make an error disappear.

## Verification

Use `verify-change`.

When applicable verify:

- client behavior;
- Security Rules;
- Auth states;
- Firestore reads/writes;
- emulator reset/seed behavior;
- Functions behavior;
- configured project checks.

## Completion

Firebase work is complete when:

- the intended behavior works;
- authorization boundaries are preserved;
- Rules were verified when relevant;
- local and production assumptions are distinguished;
- privileged credentials remain protected;
- remaining emulator-vs-production gaps are identified.
