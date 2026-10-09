# Maintainer handoff

Use this checklist when CIC officers or project maintainers change. Keep access
with the active team and confirm a successor can operate each service before a
departing maintainer loses access.

## Transfer access

- **GitHub:** Confirm the incoming maintainers can access
  [`ehuerta6/cappy-code`](https://github.com/ehuerta6/cappy-code), review pull
  requests, and manage repository settings and Actions as needed. Keep
  repository ownership assigned to an active CIC maintainer.
- **Vercel:** Confirm access to the `cappycode` project and its production
  deployment. The project is connected to this repository and deploys `main`.
  Keep production environment variable access with maintainers who need it;
  never copy secret values into this guide, issues, or commits.
- **Firebase:** Confirm appropriate access to project `cappycode-f133c` for
  Firebase Authentication, Firestore, and Security Rules administration. The
  project must remain on the Spark plan; do not enable Blaze or paid services.
  Do not create another Firebase project for routine development.
- **Officer Mode:** CappyCode uses one shared Officer account. Transfer its
  credential through the team's approved password manager or another secure
  channel, and rotate it when officers change. Do not add member accounts or
  officer roles as part of handoff. Never record the password, recovery codes,
  or private recovery details in this repository or team chat.

## Separate local and production work

- Local development uses the Auth and Firestore emulators with project ID
  `demo-cappycode-local`, seeded by `npm run seed` or restored by
  `npm run reset`. Start with [Getting started](GETTING_STARTED.md) and keep
  emulator use enabled in `.env.local`.
- Production uses Firebase project `cappycode-f133c` and the Vercel Production
  environment. Do not use production credentials or data for local development
  or routine tests.
- Application changes merged to `main` trigger the connected Vercel
  deployment. Firestore Security Rules deploy separately; review the target
  project and follow the Firebase deployment instructions in
  [Firebase foundation](FIREBASE.md) when a Rules change is part of an approved
  release.

## Verify the handoff

1. Confirm incoming maintainers can open a pull request and see the relevant
   GitHub Actions checks.
2. Confirm an incoming maintainer can view the Vercel project and Firebase
   project without changing production configuration or data.
3. Open <https://cappycode.vercel.app/> and check that the public Member view
   loads. Open a public session or the Problem Bank and confirm its content
   appears.
4. Confirm the Officer credential is available to the incoming team through
   the approved secure channel. If checking the production sign-in, stop at the
   Officer dashboard; do not create or edit production content for this check.
5. Confirm Firebase remains on Spark and that the deployed app targets
   `cappycode-f133c`. Keep any needed Rules deployment as a separate, reviewed
   operation.

Record who owns each service and when access was reviewed in the team's
approved internal records, not in this public repository.
