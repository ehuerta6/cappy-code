# Engineering

Stable implementation rules for software engineering work.

## Before editing

Inspect:

- the relevant code;
- the current flow;
- related tests;
- project conventions;
- applicable requirements.

Understand the smallest correct change before writing code.

## Scope

Implement the requested behavior and nothing unrelated.

Do not bundle:

- speculative features;
- unrelated refactors;
- cleanup with no connection to the task;
- architecture for hypothetical future requirements.

If additional work is discovered, surface it separately.

## Simplicity

Prefer:

- direct code;
- explicit behavior;
- clear domain names;
- existing project patterns;
- focused functions and components.

Avoid premature:

- factories;
- service layers;
- generic managers;
- wrappers;
- abstraction hierarchies;
- dependencies;
- extensibility.

Readable duplication can be better than the wrong abstraction.

Before adding code, choose the first option that fully meets the requirement:

1. Skip behavior that is not needed.
2. Reuse existing project code and patterns.
3. Prefer platform features or the standard library.
4. Reuse installed dependencies when appropriate.
5. Write the smallest complete, readable implementation.

Optimize for the smallest complete change, not the fewest lines. Never sacrifice required behavior, validation, error handling, security, or relevant tests.

## Architecture

Use the existing architecture unless the requirement gives a concrete reason to change it.

Introduce a new abstraction only when it removes real complexity or represents a real variation in the system.

Do not redesign adjacent systems while implementing a focused task.

## State and behavior

Represent meaningful product state explicitly.

Do not replace real states with incidental UI or implementation state when doing so hides domain behavior.

Handle expected failure states intentionally.

## Errors

Do not hide failures with:

- broad catch-all handling;
- arbitrary fallback values;
- fake success states;
- silent error swallowing.

Expose actionable failures at the appropriate boundary.

## Comments

Comments should explain:

- why a decision exists;
- invariants;
- external constraints;
- non-obvious tradeoffs;
- intentional workarounds.

Do not narrate obvious code.

Delete dead code instead of commenting it out.

## Dependencies

Add a dependency only when it provides enough value to justify:

- maintenance;
- security surface;
- bundle or runtime cost;
- lock-in.

## Completion

Passing automated checks does not make an implementation correct if it solves the wrong product problem.

Requirements, behavior, verification, and scope all matter.
