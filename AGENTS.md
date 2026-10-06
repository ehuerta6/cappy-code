<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CappyCode

CappyCode is a live solution showcase for Coding Interview Club sessions.

## Context

Use the newest explicit project decision as the highest project authority.

For repository work, prefer:

1. the active GitHub Issue and accepted project decisions;
2. `docs/PROJECT_SCOPE.md`, `design.md`, `docs/FIREBASE.md`, and other relevant project docs;
3. existing code as evidence of current behavior.

Existing implementation does not override an explicit product requirement. Do not invent missing requirements.

## Project invariants

- Members are anonymous and read-only.
- Officers prepare Session and Problem content and control solution reveals.
- Firestore is canonical persistence.
- Firebase Authentication protects Officer Mode.
- Firestore Security Rules are the authorization boundary for protected content.
- Python, Java, and C++ are first-class supported languages.
- Use Monaco for the primary code presentation/editing experience.
- Keep Problem metadata separate from protected Solution content where required by the current model.
- Do not add runtime AI, code translation, code execution, compilers/interpreters, online judging, submissions, or `localStorage` as canonical persistence unless an explicit product decision changes scope.
- Follow `design.md` for project-specific UI direction.

## Reusable configuration

Use the applicable repository-scoped rule instead of duplicating generic engineering guidance:

- `.codex/rules/engineering.md`
- `.codex/rules/security.md`
- `.codex/rules/ui.md`
- `.codex/rules/writing.md`
- `.codex/rules/definition-of-done.md`

Use the applicable skill for procedural work:

- product ambiguity → `grill-me`
- specification → `to-spec`
- issue breakdown → `to-issues`
- issue implementation → `implement-issue`
- debugging → `debug-with-evidence`
- verification → `verify-change`
- PR review → `review-pr`
- Git/GitHub workflow → `github-flow`
- multiple related Issues → `issue-batch-orchestrator`
- Firebase → `firebase`
- UI/UX → `impeccable`
- handoff → `handoff`

Project-specific requirements override reusable defaults.

## Git

Follow `docs/GIT_CONVENTIONS.md`.

Never implement directly on `main`. Treat the active GitHub Issue as the implementation scope contract.

Do not claim verification succeeded unless the relevant checks actually ran successfully.
