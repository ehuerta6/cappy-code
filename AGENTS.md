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
- Runtime translation uses a server-side coding model through POST /api/translate. Keep model credentials server-side, and start translation only when the officer explicitly chooses Translate.
- CIC Intro officers operate the showcase; students view the solution projected during a session.
- Keep problem tabs and Python, Java, and C++ Monaco editors side by side, with one officer-selected source language.
- Translation is manual through the Translate action. Do not trigger it from edits or typing pauses.
- Browser-local session persistence is optional; accounts and a database are outside the initial scope.

## Code quality

- Prefer simple, direct, readable code with descriptive names. Favor maintainability over cleverness.
- Keep functions and components focused on one responsibility. Follow existing patterns; avoid premature abstractions, wrappers, indirection, and unnecessary design patterns.
- Prefer clear statements over clever one-liners. Let structure and naming explain the code; do not add comments that narrate it. Use comments for non-obvious reasons, invariants, external constraints, or unavoidable workarounds.
