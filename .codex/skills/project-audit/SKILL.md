---
name: project-audit
description: Audit a project's AI configuration against current project needs and ai-setup to detect duplication, drift, stale instructions, and missing reusable configuration.
---

# Project audit

Audit an existing project's AI configuration.

## Inspect

Read:

- project instructions and AGENTS files;
- current skills, agents, rules, and templates;
- product and architecture sources;
- Git workflow;
- the canonical `ai-setup/README.md` and `ai-setup/WORKFLOWS.md` from the latest available source.

If `ai-setup` is not checked out locally, use the canonical repository source supplied by the project or task through an available GitHub connection. If neither source is available, report that comparison gap rather than assuming local copies are current.

## Classify

For each relevant configuration item return:

- KEEP — correct and project-specific;
- UPDATE — still useful but stale or weaker;
- REMOVE — unnecessary or duplicated;
- MOVE — reusable behavior that belongs in ai-setup;
- ADD — useful configuration currently missing.

## Check for

- duplicated instructions;
- conflicting sources of truth;
- stale project decisions;
- copied skills that drifted from canonical versions;
- oversized instruction files;
- configuration with no evidence of use;
- recurring friction or successful outcomes recorded in retros or task history;
- generic rules embedded in project-specific context.

Treat missing usage evidence as unknown, not proof that configuration is unused. Do not change registry adoption status without explicit user approval.

Project-specific behavior wins over reusable defaults.

Do not make changes until the proposed cleanup is approved.

## Completion

Return:

- findings;
- recommended changes;
- affected files;
- migration risks.
