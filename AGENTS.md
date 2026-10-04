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
- AI/LLMs are development tools only; runtime translation uses the deterministic parser, IR, and emitter pipeline.

## Code quality

- Prefer simple, direct, readable code with descriptive names. Favor maintainability over cleverness.
- Keep functions and components focused on one responsibility. Follow existing patterns; avoid premature abstractions, wrappers, indirection, and unnecessary design patterns.
- Prefer clear statements over clever one-liners. Let structure and naming explain the code; do not add comments that narrate it. Use comments for non-obvious reasons, invariants, external constraints, or unavoidable workarounds.
