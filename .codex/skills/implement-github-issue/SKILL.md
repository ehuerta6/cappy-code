---
name: implement-github-issue
description: Use when implementing a GitHub Issue in CappyCode, from issue scope through a focused, unmerged pull request.
---

# Implement a GitHub Issue

1. Read the issue and its acceptance criteria. Inspect only relevant repository files, using `README.md` and applicable `docs/` as source of truth.
2. Start from the latest `main`; never work directly on it. Create a short-lived branch that follows `docs/GIT_CONVENTIONS.md`.
3. Implement only the issue scope. Verify each acceptance criterion and run the relevant repository checks.
4. Review the final diff for correctness, scope, and unrelated changes.
5. Commit with a Conventional Commit message. Open a focused PR with `Closes #<issue>` in its description and report the changes, checks, commit, and PR.
6. Do not merge the PR unless explicitly instructed.
