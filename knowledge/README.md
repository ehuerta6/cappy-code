# Project knowledge

Use the [project-knowledge skill](../.agents/skills/project-knowledge/SKILL.md) when durable context can help a task, an approved decision should be preserved, or a Knowledge Review is requested. Do not create notes for routine Issues or pull requests.

Start with this guide, then inspect only knowledge relevant to the task. Keep GitHub Issues and pull requests as the record of work, `docs/` as the source for verified behavior, and `knowledge/` for durable approved decisions or context that would otherwise need to be rediscovered. Link to canonical sources instead of copying them.

Use descriptive Markdown files under `decisions/`, `architecture/`, or `context/` when a note is useful. Record the approval source and distinguish accepted future intent from implemented behavior. Ask the user before approving product or architecture decisions, resolving genuine ambiguity, or removing important history. Run a full Knowledge Review only when requested.

Canonical project sources include [AGENTS.md](../AGENTS.md), [Project Scope](../docs/PROJECT_SCOPE.md), [Design](../design.md), and [Firebase Foundation](../docs/FIREBASE.md). Future work belongs in [GitHub Issues](https://github.com/ehuerta6/cappy-code/issues).
