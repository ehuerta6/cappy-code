# CappyCode

**One solution. Three languages. Ready to present.**

CappyCode is an officer-focused solution showcase for the **Coding Interview Club (CIC) Intro branch**. Near the end of a session, an officer can present one interview-style solution in Python, Java, and C++ side by side while students follow along on the projected screen.

CappyCode is a focused teaching aid, not a general-purpose code translator or replacement for LeetCode. It helps the room compare how the same algorithm is expressed across languages.

## The Showcase Workflow

An officer can:

1. Select a problem from the problem tabs.
2. Review or enter code in the Python, Java, and C++ Monaco editors shown side by side.
3. Select one source language for the solution to translate from.
4. Click **Translate** when the solution is ready to present.
5. Present the structured results in all three languages and their **“What changed?”** explanations.

Translation is manual. Editing code or changing a tab does not trigger translation; there is no live or debounced translation.

The intended request flow is:

Problem tabs → three side-by-side Monaco editors → officer selects one source language and its code → Translate action → `POST /api/translate` → server-side coding model → structured Python, Java, and C++ translations plus “What changed?”

The model provider is an implementation choice; the product contract is a server-side coding model that returns structured translations and concise explanations. Model credentials stay on the server and must never be exposed to browser code.

## Teaching Goal

CappyCode is built for CIC Intro officers to use during a session. Students are the audience viewing the projected solution, rather than the primary operators of the app. The comparison should help students notice that the algorithm can stay the same while syntax, types, and standard-library APIs differ.

For example, a hash map solution can use dict in Python, HashMap in Java, and unordered_map in C++.

## Product Scope

The showcase focuses on common interview-style topics such as arrays and strings, hash maps and sets, stacks and queues, linked lists, two pointers, sliding window, binary search, trees, graph traversal, recursion, and introductory dynamic programming.

The proof of concept may optionally persist the current session in browser `localStorage` so an officer can restore a presentation locally. It does not require accounts, authentication, or a database.

The project does not aim to translate arbitrary applications, frameworks, servers, GUIs, or large production codebases. See [Project Scope](docs/PROJECT_SCOPE.md) for the complete boundaries and non-goals.

## Product Principles

1. **Officer-led** — optimize the workflow for presenting a solution during CIC Intro sessions.
2. **Three-language comparison** — keep Python, Java, and C++ visible together.
3. **Explicit control** — translate only when the officer chooses **Translate**.
4. **Teach the differences** — return short, relevant **“What changed?”** explanations.
5. **Keep session data local** — browser-local persistence is optional; accounts and databases are outside the POC.
6. **Keep main healthy** — merged changes should pass the repository checks.

## Documentation

Project documentation lives in [docs/](docs/).

- [Project Scope](docs/PROJECT_SCOPE.md) — product goals, boundaries, and non-goals.
- [Feature Tracker](docs/FEATURES.md) — implementation checklist and product roadmap.
- [Git & Pull Request Conventions](docs/GIT_CONVENTIONS.md) — branch, commit, PR, and merge rules.
- [AI Development Guidelines](docs/AI_GUIDELINES.md) — context and guardrails for AI coding assistants.

## Development Workflow

Never develop directly on main.

Every logical change should use a short-lived branch such as:

    feat/editor-layout
    feat/code-translation
    fix/stale-translation-response
    docs/update-local-setup

PR titles and commits follow Conventional Commit style:

    feat: add code editor
    fix: prevent stale translation responses
    docs: update local setup

See [Git & Pull Request Conventions](docs/GIT_CONVENTIONS.md) for the full workflow.

## Status

CappyCode is currently in early development. See the [Feature Tracker](docs/FEATURES.md) for the implementation checklist.

## Local Development

Use Node.js **24.11.0** and npm **11.6.2** for local development. The supported Node version is recorded in `.nvmrc` and `package.json`.

Install dependencies and start the development server:

    npm install
    npm run dev

Run the project checks before opening a pull request:

    npm run lint
    npm run typecheck
    npm test
    npm run format:check
    npm run build
