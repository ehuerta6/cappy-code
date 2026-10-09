# CappyCode

**A live solution showcase platform for CIC Intro sessions.**

CappyCode helps Coding Interview Club (CIC) Intro officers prepare interview-style problems and solutions. Officers manage sessions from Officer Mode; members open an anonymous, read-only view, choose problems independently, and revisit ended sessions as a study archive.

Officers prepare Python, Java, and C++ solutions before a session. CappyCode presents those solutions side by side with prepared static output for each language. It does not generate, translate, compile, or run code.

## How a session works

1. An officer signs in to Officer Mode and creates a draft session.
2. The officer adds, edits, orders, and describes multiple problems, including examples.
3. For each problem, the officer prepares Python, Java, and C++ source and static output.
4. The officer starts the session, which becomes live. Members open the public session view without accounts.
5. While live, the officer uses **Show Answers** or **Hide Answers** for the selected problem; members viewing it receive changes in realtime.
6. Members can choose any problem independently. Ended sessions appear in **Past sessions** with all prepared solutions available.

Sessions have `draft`, `live`, and `ended` states. Members choose problems independently in their own view. During a live session, each problem's `answersVisible` state updates in realtime. Ended sessions expose all prepared solutions, regardless of that field's stored value.

## Modes and access

- **Officer Mode** requires Firebase Authentication. The proof of concept uses one shared CIC officer account. Officers manage sessions and their problems, prepare solutions and outputs, and control the presentation.
- **Member Mode** is anonymous. Members can read metadata for live and ended sessions; draft sessions are officer-only. Editors are read-only in Member Mode.
- Monaco editors are editable in Officer Mode and read-only in Member Mode. Python, Java, and C++ are presented together; there is no source-language selection.
- Problem descriptions and examples are public for live and ended sessions. Solution documents are stored separately from problem metadata.
- Firestore Security Rules enforce answer confidentiality. Hiding answers in the interface alone is not a security boundary: member clients must not be authorized to read hidden solution documents. Live solution reads require the parent problem's `answersVisible` to be true. Ended-session solutions are public regardless of that field. Draft solutions remain officer-only. Rules also restrict content management to authenticated officers.

## Persistence and architecture

Firestore is the canonical persistence layer for officer-managed content, session history, and live answer visibility. Firebase Authentication protects Officer Mode; public members do not sign in. The product has no runtime AI, LLM, translation, code execution, compiler, interpreter, or online judging system.

A session stores its status. Its ordered problems store titles, descriptions, examples, and per-problem `answersVisible`; these metadata are public only for live and ended sessions. Separate solution documents contain prepared source text and static output for Python, Java, and C++. Firestore Security Rules gate live solution reads on `answersVisible`, while every fixed-language solution is readable for ended sessions.

## Product principles

1. **Officer-led** — officers prepare and operate the showcase during CIC Intro sessions.
2. **Presentation first** — keep problems and all three language views clear, readable, and useful on a projected screen.
3. **Prepared content** — solutions and outputs are authored before presentation and shown as stored.
4. **Anonymous audience** — members can follow along without accounts and cannot edit content.
5. **Secure reveal** — live answer access is enforced by Firestore Security Rules and realtime visibility updates; ended sessions are a public study archive.

## Documentation

Project documentation lives in [`docs/`](docs/).

- [Project Scope](docs/PROJECT_SCOPE.md) — product goals, architecture, boundaries, and non-goals.
- [Feature Tracker](docs/FEATURES.md) — implementation checklist and product roadmap.
- [Git & Pull Request Conventions](docs/GIT_CONVENTIONS.md) — branch, commit, PR, and merge rules.
- [AI Development Guidelines](docs/AI_GUIDELINES.md) — guardrails for AI coding assistants developing the repository. AI is outside the product runtime.
- [AI Configuration Adoption](docs/AI_CONFIGURATION.md) — repeatable manual comparison with canonical `ai-setup`.
- [Firebase Foundation](docs/FIREBASE.md) — local Firebase configuration, client access, and persisted document types.
- [Getting Started](docs/GETTING_STARTED.md) — first-time local setup, seeded emulators, and development checks.
- [Maintainer Handoff](docs/MAINTAINERS.md) — semester access transfer and post-handoff verification.

## Development workflow

Never develop directly on `main`. Use a short-lived branch and Conventional Commit messages and PR titles. See [Git & Pull Request Conventions](docs/GIT_CONVENTIONS.md).

## Local development

Use Node.js **24.11.0** and npm **11.6.2** for local development. The supported Node version is recorded in `.nvmrc` and `package.json`. Follow the [Getting Started](docs/GETTING_STARTED.md) guide for the seeded local setup and development checks. For Firebase emulator, project, and Rules details, see [Firebase foundation](docs/FIREBASE.md).
