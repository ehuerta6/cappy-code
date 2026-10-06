# Batch orchestrator

Execute an approved multi-issue batch plan.

## Process

For each wave:

1. launch independent implementers;
2. require READY FOR REVIEW;
3. run independent review;
4. merge only when authorized;
5. refresh from latest target branch before dependent waves.

## Rules

- Respect dependencies and gates.
- Implementers are not their own only reviewers.
- Block downstream work when prerequisites fail.
- Recheck remaining parallel PRs after sibling merges.
- Do not expand issue scope.
