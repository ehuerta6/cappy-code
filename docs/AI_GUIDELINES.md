# AI Development Guidelines

This document provides project context and guardrails for AI coding assistants working on CappyCode.

AI tools should follow the same repository rules as human contributors.

## Product Context

CappyCode is an educational web app for the **Coding Interview Club Intro branch**.

Its purpose is to help beginner students compare equivalent Data Structures & Algorithms solutions across:

- Python
- Java
- C++

A student writes interview-style code in one language and receives translated versions in the other two languages, along with concise explanations of meaningful language differences.

## Primary Audience

Assume the main audience is composed of freshmen and sophomores beginning to learn:

- LeetCode-style problem solving;
- Data Structures & Algorithms;
- technical interview patterns;
- differences between programming languages.

Avoid adding unnecessary technical complexity to the product experience.

## Core Product Rules

When implementing product behavior:

1. Preserve the algorithm during translation.
2. Preserve asymptotic time and space complexity whenever possible.
3. Prefer idiomatic target-language code over mechanical line-by-line translation.
4. Optimize for interview-style snippets, not arbitrary production applications.
5. Keep educational explanations short and beginner-friendly.
6. Do not expand scope without a clear product reason.

## Initial Supported Concepts

Prioritize support for:

- arrays;
- strings;
- hash maps and sets;
- stacks and queues;
- linked lists;
- two pointers;
- sliding window;
- binary search;
- trees;
- DFS and BFS;
- recursion;
- introductory dynamic programming.

## Out of Scope by Default

Do not introduce the following unless explicitly requested:

- authentication;
- user accounts;
- databases;
- profiles;
- leaderboards;
- social features;
- full online judge infrastructure;
- multi-file application translation;
- framework translation;
- additional programming languages;
- unnecessary microservices;
- unnecessary abstractions.

## Engineering Preferences

Prefer the simplest architecture that satisfies the current feature.

Avoid premature abstraction.

Do not create a generalized translation platform when the project only needs three supported languages and interview-style code.

Keep API keys and model credentials server-side.

Do not place secrets in client-side code or commit them to the repository.

Validate external/model output before relying on it.

Generated code should be treated as untrusted text when rendered in the browser.

## Translation UX

Automatic translation should use a debounce rather than sending a request for every keystroke.

The implementation should account for stale responses.

Example:

```text
User edits code
      ↓
debounce
      ↓
request A begins
      ↓
user edits code again
      ↓
request B begins
      ↓
request A returns
      ↓
ignore A because B represents newer input
```

The UI should clearly represent:

- idle;
- translating;
- success;
- failure.

## Cappy Theme

Cappy is the Coding Interview Club capybara mascot.

Cappy can appear in:

- educational tips;
- empty states;
- small pieces of friendly copy.

Do not let the mascot distract from code readability or the educational objective.

## Git Rules

Never implement directly on `main`.

Use the repository branch conventions documented in [GIT_CONVENTIONS.md](GIT_CONVENTIONS.md).

Examples:

```text
feat/code-editor
fix/stale-translation-response
docs/update-local-setup
```

Use Conventional Commit-style commits and PR titles:

```text
feat: add language tabs
fix: prevent stale translations
docs: update project scope
```

Keep branches and PRs focused on one logical change.

Before opening a PR, run the relevant:

- lint;
- typecheck;
- tests;
- build.

Use **Squash and Merge**, then delete the merged branch.

## When Making Product Decisions

Use the following question as the default filter:

> Does this make it easier for a beginner to understand the same interview algorithm across Python, Java, and C++?

If not, prefer leaving the feature out unless there is another clear requirement.
