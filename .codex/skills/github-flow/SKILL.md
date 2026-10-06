---
name: github-flow
description: Execute Git and GitHub operations using the repository's documented conventions for commits, issues, pull requests, and merging.
metadata:
  adapted_from:
    - cappycode git conventions
    - cappy-hub development workflow
---

# GitHub flow

Use this skill when performing Git or GitHub workflow operations.

The stable conventions live in `rules/github.md`.

Read that file first.

Project-specific Git instructions override the global rule.

## Process

### 1. Inspect repository conventions

Before acting, determine:

- target branch;
- whether direct work on the target branch is allowed;
- branch naming requirements;
- commit conventions;
- required checks;
- PR requirements;
- merge strategy.

Do not assume every repository uses the same flow.

### 2. Prepare the change

Follow the repository's configured workflow.

Keep the change focused on one logical unit.

When using a branch, start from the latest intended base.

### 3. Commit

Use the repository's commit convention.

When none exists, follow `rules/github.md`.

Before committing:

- inspect staged changes;
- remove accidental files;
- confirm no secrets are included.

### 4. Prepare the PR

When a PR is part of the repository workflow:

- inspect the complete diff;
- verify acceptance criteria;
- run relevant checks;
- use `templates/PULL_REQUEST.md` when applicable;
- link the implementation issue.

Only report checks that actually ran.

### 5. Merge

Use the repository's configured merge strategy.

Do not merge unless the user or repository workflow grants that authority.

Clean up temporary branches when appropriate.

## Completion

GitHub workflow work is complete when:

- the change is in the correct place;
- commit history follows project conventions;
- verification claims are accurate;
- issue and PR relationships are preserved;
- no unintended files or secrets were included.
