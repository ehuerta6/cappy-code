---
name: issue-batch-orchestrator
description: Analyze multiple GitHub Issues and produce safe parallel and sequential execution waves with review gates.
---

# Issue batch orchestrator

Plan execution for a batch of GitHub Issues.

## Process

1. Read every issue and relevant project context.
2. Inspect enough code to estimate dependencies and overlapping change surfaces.
3. Classify issues as prerequisite, independent, overlapping, deployment, or documentation work.
4. Build execution waves using maximum safe parallelism.
5. Add merge or deployment gates between dependent waves.
6. Generate one concise operational prompt for the batch orchestrator.

## Rules

- Issues are scope contracts.
- Dependent work starts after prerequisites merge.
- Parallel issues must be genuinely independent.
- Use one branch and PR per issue unless the repo says otherwise.
- Implementers stop at READY FOR REVIEW.
- Independent review controls merge readiness.
- Recheck parallel PRs after sibling PRs merge.
- Documentation sync normally runs last.
- External blockers stop dependent work.
- Do not redesign around blockers.

## Return

- dependency graph
- execution waves
- blockers and gates
- executable orchestrator prompt
