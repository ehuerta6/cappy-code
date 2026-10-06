# Definition of done

A change is done when the requested behavior is complete and supported by evidence.

## Requirements

- the approved requirement is satisfied;
- acceptance criteria are accounted for;
- no important requirement was silently skipped;
- no unrequested feature was added.

## Scope

- the change stays within the intended scope;
- unrelated refactors and accidental files are absent;
- project-specific architecture and constraints are respected.

## Behavior

- important success states work;
- relevant failure and edge states are handled;
- UI changes include appropriate accessibility and responsive behavior when applicable.

## Quality

- code is understandable;
- unnecessary complexity was avoided;
- new dependencies are justified;
- dead or debug code is removed.

## Verification

- changed behavior has a direct verification signal;
- relevant repository checks were actually run;
- failures are reported instead of hidden;
- the final diff was reviewed.

## Documentation

Update documentation when the change alters something users or maintainers need to know.

Do not update documentation merely to create activity.

## Delivery

When using GitHub:

- the issue is linked when applicable;
- the PR explains the change and verification;
- claims about checks are accurate.

## Final rule

Automated checks are necessary evidence, not proof that the right product behavior was implemented.

A technically green change that violates the requirement is not done.
