# CappyCode

CappyCode is a live solution showcase for Coding Interview Club (CIC) Intro,
General, and ICPC sessions. All three branches use one shared Session → Problem
→ Solution workflow.

Officers sign in to prepare and explicitly save session content, then control
when solutions appear during a live session. Members join anonymously, choose
Problems independently, and read the public archive of ended sessions. Each
Problem can have multiple prepared Approaches, with Python, Java, or C++ code
and complexity details shown one selection at a time. CappyCode displays stored
content; it does not generate or run code.

The application uses Next.js, React, TypeScript, and Monaco. Firebase
Authentication and Firestore provide Officer access and canonical persistence;
Firestore Security Rules protect content. Firebase stays on the Spark plan.
Vercel hosts the production web app.

## Start locally

Follow [Getting started](docs/GETTING_STARTED.md) to run the seeded Auth and
Firestore emulators. Local development does not connect to production Firebase.

## Project documentation

- [Project scope](docs/PROJECT_SCOPE.md) — current workflow, access, and product boundaries.
- [Design](design.md) — current interface behavior and visual direction.
- [Firebase foundation](docs/FIREBASE.md) — emulators, data model, access rules, and deployment responsibilities.
- [Contributor guide](CONTRIBUTING.md) — how to work on an issue and open a pull request.
- [Getting started](docs/GETTING_STARTED.md) — local setup and development checks.
- [Maintainer handoff](docs/MAINTAINERS.md) — service access and handoff checks.
- [Git conventions](docs/GIT_CONVENTIONS.md) — branch, commit, and pull request conventions.
- [AI development guidelines](docs/AI_GUIDELINES.md) — repository guidance for coding agents.
