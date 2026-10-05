# AI Development Guidelines

This document provides project context and guardrails for AI coding assistants used to develop CappyCode. AI assistants are development tools only; AI and LLMs are outside the CappyCode runtime and product architecture.

Follow the repository instructions in root [AGENTS.md](../AGENTS.md), the current GitHub Issue, and applicable repository-scoped skills in `.codex/skills/`. When older documentation conflicts with the issue being implemented, use the issue as the current source of truth.

## Product context

CappyCode is **a live solution showcase platform for CIC Intro sessions**. CIC officers authenticate to Officer Mode, prepare ordered problems and their Python, Java, and C++ solutions, and present them to members in a live session. One shared officer account is used for the proof of concept. Members use an anonymous, read-only public view.

Firestore is canonical persistence. Sessions have `draft`, `live`, and `ended` states and support session history. Live-session `answersVisible` updates in realtime for members viewing that problem. Draft sessions and metadata are officer-only; live and ended sessions are public. Problem metadata is stored separately from solution documents. Firestore Security Rules require `answersVisible` for live solutions, while fixed-language solutions are always public for ended sessions; UI hiding alone is not a security boundary.

Officers prepare problem descriptions, examples, source code, and static output for Python, Java, and C++ ahead of time. Monaco is editable in Officer Mode and read-only in Member Mode. There is no source-language selection, translation, code generation, compilation, or execution. Members choose problems independently and can revisit ended sessions in a public archive. Keep the interface readable and presentation-focused.

## Scope guidance

When implementing an issue:

1. Follow the issue's acceptance criteria and keep the change focused.
2. Preserve the anonymous, read-only member experience and authenticated officer management model.
3. Treat Firestore as the source of truth and Security Rules as the answer permission boundary.
4. Keep problem metadata separate from solution documents. Keep drafts private, gate live solutions with `answersVisible`, and allow all ended-session solutions.
5. Keep member and officer problem selection local to each view; preserve realtime `answersVisible` updates for live-session answer reveal. Ending a session does not mass-update its problems.
6. Avoid product or architecture features outside the issue's scope.

Do not introduce runtime AI or LLM functionality, coding-model providers or credentials, translation APIs, source-language selection, Tree-sitter, parsers, AST translation, an intermediate representation, emitters, transpilers, code execution, compilers, interpreters, online judging, sandboxing, or `localStorage` as canonical persistence.

## Engineering preferences

- Prefer the simplest architecture that meets the issue's requirements.
- Follow existing project patterns and use descriptive names.
- Keep functions and components focused; avoid premature abstractions.
- Keep secrets out of client code and source control.
- Treat public member access and answer confidentiality as backend authorization concerns.
- Preserve presentation readability across supported screen sizes.

## Git and validation

Never implement directly on `main`. Use the branch conventions in [GIT_CONVENTIONS.md](GIT_CONVENTIONS.md), Conventional Commit messages, and focused pull requests. Run the checks required by root `AGENTS.md` before opening a pull request.
