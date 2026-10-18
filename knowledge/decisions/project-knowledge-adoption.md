# Decision: Adopt the project knowledge workflow

Status: Accepted

## Context

CappyCode's product and architecture context already lives in its project instructions and official documentation. Agents need a repeatable way to retrieve relevant context and preserve approved decisions without duplicating those sources or treating routine work as durable knowledge.

## Decision

Adopt ai-setup's `project-knowledge` skill for Codex and Claude Code. Use `knowledge/` only for durable approved decisions and evidence-backed context that is not already maintained in GitHub or `docs/`. Keep the skill in testing until real usage provides evidence.

## Options considered

- Keep all context only in existing documentation and GitHub.
- Add a focused knowledge workflow that links to those canonical sources and records only durable context.

## Why

The user explicitly authorized selective adoption for CappyCode. Existing project documentation remains the authority for current behavior, while the skill defines retrieval, capture, reconciliation, and on-demand review.

## Consequences

- Routine Issues and pull requests do not require knowledge notes.
- Approved future decisions remain distinct from verified implementation.
- Ambiguous product or architecture choices and removal of important history remain under user authority.
- Adoption remains under evaluation; installing the workflow is not evidence of successful use in both agents.

## Approval source

The user explicitly authorized selective CappyCode adoption in this task. [CappyCode Issue #179](https://github.com/ehuerta6/cappy-code/issues/179) tracks its implementation.

## Replaces

None.
