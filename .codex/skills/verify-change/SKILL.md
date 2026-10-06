---
name: verify-change
description: Verify a code change using the repository's actual configured checks and report concrete evidence without hiding failures.
metadata:
  adapted_from:
    - cappy-hub verify-change
---

# Verify change

Verify that a change works and is safe to deliver.

Do not assume every repository uses the same commands.

Discover the project's real validation workflow first.

## Process

### 1. Identify what changed

Determine:

- intended behavior;
- affected boundaries;
- relevant acceptance criteria;
- likely regression areas.

Use the issue, spec, and final diff as evidence.

### 2. Discover repository checks

Inspect the repository for configured validation such as:

- test scripts;
- type checking;
- linting;
- formatting;
- builds;
- integration tests;
- end-to-end tests;
- database validation;
- CI workflows.

Use project-provided commands instead of inventing replacements.

### 3. Run focused checks

During iteration, prefer the smallest check that exercises the changed behavior.

Examples:

- one test file;
- one package;
- one route;
- one affected subsystem.

Do not rerun the full suite after every minor edit.

### 4. Run required completion checks

Before delivery, run the repository's relevant full checks.

Only run checks that actually apply to the project and change.

If a check cannot be run:

- say which check;
- explain why;
- identify the resulting verification gap.

### 5. Inspect the final diff

Verify that the diff contains:

- only intended changes;
- no debug output;
- no accidental generated files;
- no credentials or secrets;
- no unexplained dependency additions;
- tests when behavior changed.

### 6. Report evidence

Report each meaningful check and its actual result.

Example:

- `npm test`: passed
- `npm run typecheck`: passed
- `npm run build`: failed because `<reason>`
- manual browser verification: not performed

Never convert an unrun check into a pass.

## Rules

- Verification is evidence, not assumption.
- Prefer configured project commands.
- Do not bypass or disable failing checks to make the change appear complete.
- Do not hide failures.
- Automated checks passing does not prove the product requirement was implemented correctly.
- Verify both behavior and repository health.

## Completion

Verification is complete when:

- the changed behavior has a direct verification signal;
- relevant repository checks have been run;
- the final diff has been inspected;
- all results and remaining gaps are reported accurately.
