<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CappyCode guidance

- Treat GitHub Issues as the scope for implementation. Keep each branch and PR focused; do not implement later issues opportunistically.
- Read `README.md` and relevant files in `docs/` for project source of truth. Follow `docs/GIT_CONVENTIONS.md` for branches, commits, and PRs.
- Never develop directly on `main`. Start from the latest `main` and use a short-lived branch.
- Run the repository checks before opening a PR: `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`, and `npm run build`.
- CappyCode is a live solution showcase platform for CIC Intro sessions. AI and LLMs are outside the product runtime and architecture.
- CIC Intro officers authenticate to Officer Mode and manage sessions; anonymous members use a public, read-only view.
- Use Firebase Authentication for Officer Mode only, with one shared CIC officer account for the proof of concept. Firestore is canonical persistence.
- Sessions have `draft`, `live`, and `ended` states, contain multiple ordered problems, and remain available in session history.
- Keep public problem descriptions and examples separate from protected solution documents. Officers manually prepare Python, Java, and C++ source plus static output for each language.
- Monaco editors are editable in Officer Mode and read-only in Member Mode. Show all three languages together; there is no source language or translation flow.
- Draft sessions are officer-only; member reads of problem metadata follow session status/publication rules. Firestore Security Rules permit solution reads only when the parent problem's `answersVisible` and session access rules allow them.
- Realtime presentation state uses session-level `activeProblemId` for navigation and problem-level `answersVisible` for answer reveal; members can use Follow Presenter.
- Provide an officer dashboard and a responsive, presentation-focused interface that stays readable when projected.
- Do not add runtime AI, translation, code execution, compilers/interpreters, online judging, or browser `localStorage` as canonical persistence.

## Code quality

- Prefer simple, direct, readable code with descriptive names. Favor maintainability over cleverness.
- Keep functions and components focused on one responsibility. Follow existing patterns; avoid premature abstractions, wrappers, indirection, and unnecessary design patterns.
- Prefer clear statements over clever one-liners. Let structure and naming explain the code; do not add comments that narrate it. Use comments for non-obvious reasons, invariants, external constraints, or unavoidable workarounds.
