---
name: review-pr
description: Review a pull request or completed diff separately against its requirements and against the repository's engineering standards.
metadata:
  adapted_from:
    - cappy-hub review-pr
    - cappycode review-pull-request
    - mattpocock/skills code-review
---

# Review PR

Review completed work along two independent axes:

1. requirements;
2. engineering quality.

A change can succeed on one axis and fail on the other.

Do not let good code excuse incorrect product behavior, or correct behavior excuse unsafe code.

## Process

### 1. Gather context

Read:

- the complete diff;
- linked issue;
- acceptance criteria;
- approved spec when available;
- relevant project instructions;
- surrounding implementation where needed.

Review the whole change, not isolated snippets.

### 2. Review requirements

Check whether the implementation:

- satisfies every acceptance criterion;
- matches the approved spec;
- preserves explicitly required behavior;
- omits requested behavior;
- adds behavior that was not requested;
- handles required states and edge cases.

Report requirement mismatches separately from code-quality findings.

### 3. Review engineering quality

Check for:

- correctness bugs;
- regressions;
- unsafe assumptions;
- unnecessary complexity;
- speculative abstractions;
- unnecessary dependencies;
- duplicate logic where an established project pattern already exists;
- missing validation;
- missing tests;
- error handling that hides failures;
- security or authorization mistakes;
- data integrity problems;
- accessibility regressions when UI changed.

Respect documented project standards over generic preferences.

Do not report stylistic preferences that tooling already enforces.

### 4. Evaluate verification

Check whether the evidence actually demonstrates the changed behavior.

Look for:

- missing tests;
- tests that only verify implementation details;
- acceptance criteria with no verification;
- checks claimed as passing without evidence.

### 5. Report findings

Order findings by severity.

For each finding include:

- severity;
- file or relevant location;
- what is wrong;
- concrete failure scenario or impact;
- requirement or standard involved when applicable.

Do not manufacture findings to make the review look thorough.

If no actionable findings exist, say so.

### 6. Report residual risk

After findings, note meaningful verification gaps or areas not exercised.

Give a clear recommendation:

- ready;
- changes required.

## Review axes

Keep these mentally separate:

### Requirements

Did we build the right thing?

### Engineering

Did we build it safely and maintainably?

## Rules

- Findings first.
- Evidence over preference.
- Do not nitpick for volume.
- Do not silently broaden the issue scope.
- Do not treat generic best practices as project requirements.
- Do not rewrite the implementation during review unless explicitly asked.
- Do not invent defects without a plausible failure mode.

## Completion

A review is complete when:

- the full diff has been inspected;
- requirements have been checked;
- engineering quality has been checked;
- verification gaps are identified;
- actionable findings include evidence;
- the final recommendation is clear.
