# Git & Pull Request Conventions

Use a short-lived branch for every change.

Never develop directly on `main`.

## Branch Names

Branch names should use:

- `feat/<short-description>`
- `fix/<short-description>`
- `docs/<short-description>`
- `refactor/<short-description>`
- `chore/<short-description>`
- `ci/<short-description>`

Examples:

```text
feat/add-player-inventory
fix/game-reset-state
docs/update-local-setup
```

For CappyCode, examples may include:

```text
feat/code-editor
feat/session-dashboard
fix/editor-layout
docs/update-readme
chore/configure-linting
ci/add-build-checks
```

## Commits and PR Titles

Use Conventional Commit-style commit messages and PR titles:

```text
feat: add player inventory
fix: prevent duplicate enemies
docs: update setup instructions
```

Examples for this project:

```text
feat: add code editor
feat: add session dashboard
fix: correct editor layout
docs: document local setup
```

## Scope

Keep each branch and PR focused on one logical change.

Avoid unrelated changes in the same PR.

A branch named:

```text
feat/code-editor
```

should not also introduce deployment configuration, unrelated documentation rewrites, and a new API architecture unless those changes are genuinely required for the editor feature.

## GitHub Issues

When implementing a GitHub Issue, link it from the PR using:

```text
Closes #32
```

This should appear in the PR description.

## Before Opening a PR

Make sure the branch is based on the latest `main`.

Run the project's relevant checks before opening the PR:

- lint;
- typecheck;
- tests;
- production build.

The exact commands should be documented in the repository once the technical stack is finalized.

## Pull Request Description

PRs should briefly explain:

- what problem is being solved;
- what changed;
- how it was tested;
- any important implementation decisions.

Recommended template:

```markdown
## Problem

Describe the problem or feature.

## Changes

- Change one
- Change two

## Testing

- `lint command`
- `typecheck command`
- `test command`
- `build command`

## Implementation Decisions

Explain any important technical decisions.

Closes #123
```

Remove `Closes #123` when the PR is not associated with an Issue.

## Merging

Merge PRs using **Squash and Merge**.

The squash commit on `main` should use the PR title so merged history stays clean:

```text
feat: add player inventory
fix: prevent duplicate enemies
```

Delete the feature branch after merging.

## Expected Workflow

```text
main
  │
  ├── create short-lived branch
  │
  ├── implement one logical change
  │
  ├── commit using Conventional Commit style
  │
  ├── update branch from latest main
  │
  ├── run checks
  │
  ├── open PR
  │
  ├── review
  │
  ├── Squash and Merge
  │
  └── delete branch
```

`main` should remain in a healthy, buildable state.
