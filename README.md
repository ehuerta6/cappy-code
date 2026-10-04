# CappyCode

**A live solution showcase platform for CIC Intro sessions.**

CappyCode helps Coding Interview Club (CIC) Intro officers prepare and present interview-style problems and solutions. Officers manage a session from Officer Mode; members open an anonymous, read-only view and follow the presentation as prepared answers are revealed.

Officers prepare Python, Java, and C++ solutions before a session. CappyCode presents those solutions side by side with prepared static output for each language. It does not generate, translate, compile, or run code.

## How a session works

1. An officer signs in to Officer Mode and creates a draft session.
2. The officer adds, edits, orders, and describes multiple problems, including examples.
3. For each problem, the officer prepares Python, Java, and C++ source and static output.
4. The officer starts the session, which becomes live. Members open the public session view without accounts.
5. The officer chooses the active problem and uses **Show Answers** or **Hide Answers** while presenting.
6. Members can use **Follow Presenter** to stay on the problem selected by the officer. Ended sessions remain available in session history.

Sessions have `draft`, `live`, and `ended` states. The session's `activeProblemId` is the shared presentation pointer. Each problem stores its own `answersVisible` state. Changes to the active problem and to each problem's answer visibility update in realtime for members following the presenter.

## Modes and access

- **Officer Mode** requires Firebase Authentication. The proof of concept uses one shared CIC officer account. Officers manage sessions and their problems, prepare solutions and outputs, and control the presentation.
- **Member Mode** is anonymous. Members can read problem metadata only when the session's status and publication rules allow member access, such as an eligible `live` session or a published `ended` session. Draft sessions are officer-only. Editors are read-only in Member Mode.
- Monaco editors are editable in Officer Mode and read-only in Member Mode. Python, Java, and C++ are presented together; there is no source-language selection.
- Problem descriptions and examples are member-readable metadata only when the session's status/publication rules permit it; they are not always publicly readable. Solution documents are stored separately from problem metadata.
- Firestore Security Rules enforce answer confidentiality. Hiding answers in the interface alone is not a security boundary: member clients must not be authorized to read hidden solution documents. Public solution reads require the parent problem's `answersVisible` to be true and the session to permit member access. Rules also restrict content management to authenticated officers.

## Persistence and architecture

Firestore is the canonical persistence layer for officer-managed content, session history, and live presentation state. Firebase Authentication protects Officer Mode; public members do not sign in. The product has no runtime AI, LLM, translation, code execution, compiler, interpreter, or online judging system.

Conceptually, a session stores its status and `activeProblemId`. Its ordered problems store titles, descriptions, examples, and per-problem `answersVisible`; these metadata are member-readable only when the session's status/publication rules permit access. Separate protected solution documents contain prepared source text and static output for Python, Java, and C++. Firestore Security Rules use the parent problem's `answersVisible` and session access rules to govern solution reads.

## Product principles

1. **Officer-led** — officers prepare and operate the showcase during CIC Intro sessions.
2. **Presentation first** — keep problems and all three language views clear, readable, and useful on a projected screen.
3. **Prepared content** — solutions and outputs are authored before presentation and shown as stored.
4. **Anonymous audience** — members can follow along without accounts and cannot edit content.
5. **Secure reveal** — answer access is enforced by Firestore Security Rules, with realtime presentation updates.

## Documentation

Project documentation lives in [`docs/`](docs/).

- [Project Scope](docs/PROJECT_SCOPE.md) — product goals, architecture, boundaries, and non-goals.
- [Feature Tracker](docs/FEATURES.md) — implementation checklist and product roadmap.
- [Git & Pull Request Conventions](docs/GIT_CONVENTIONS.md) — branch, commit, PR, and merge rules.
- [AI Development Guidelines](docs/AI_GUIDELINES.md) — guardrails for AI coding assistants developing the repository. AI is outside the product runtime.

## Development workflow

Never develop directly on `main`. Use a short-lived branch and Conventional Commit messages and PR titles. See [Git & Pull Request Conventions](docs/GIT_CONVENTIONS.md).

## Local development

Use Node.js **24.11.0** and npm **11.6.2** for local development. The supported Node version is recorded in `.nvmrc` and `package.json`.

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Run the project checks before opening a pull request:

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```
