# AI Development Guidelines

Use the repository's canonical instructions and documentation:

- [AGENTS.md](../AGENTS.md) defines project-wide instructions and source precedence.
- [Project Scope](PROJECT_SCOPE.md) defines product behavior and architecture.
- [Firebase Foundation](FIREBASE.md) documents Firebase setup and access boundaries.
- [Git Conventions](GIT_CONVENTIONS.md) defines branch, commit, PR, and merge practices.
- Existing CappyCode workflows live in [`.codex/skills/`](../.codex/skills/); the shared `project-knowledge` skill lives in [`.agents/skills/`](../.agents/skills/) for Codex and Claude Code.

Use the active issue and newest explicit project decisions to establish task scope. Existing code shows current behavior but does not override explicit requirements. Do not invent missing requirements.

AI assistants are development tools; runtime AI is outside CappyCode's product scope.
