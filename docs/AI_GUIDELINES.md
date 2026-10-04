# AI Development Guidelines

This document provides project context and guardrails for AI coding assistants working on CappyCode. AI tools should follow the same repository rules as human contributors.

For implementation and review workflows, follow the root [AGENTS.md](../AGENTS.md) and the repository-scoped skills in .codex/skills/. This document is the source for product context and runtime model guidance.

CappyCode uses a server-side coding model for translation at runtime. Keep model credentials in server-side configuration and never expose them to browser code. AI coding assistants may also help develop CappyCode; development-time assistance and the product's runtime translation service have separate roles.

## Product Context

CappyCode is an officer-focused solution showcase for the Coding Interview Club Intro branch. CIC Intro officers operate it near the end of a session to present one interview-style solution in Python, Java, and C++ side by side. Students are the audience viewing the projected solution, not the primary operators of the app.

## Showcase Workflow

The expected flow is:

1. The officer selects a problem tab.
2. The officer reviews or enters code in the three side-by-side Monaco editors.
3. The officer selects exactly one source language: Python, Java, or C++.
4. The officer clicks **Translate** when ready.
5. The browser sends the selected source language and code to `POST /api/translate`.
6. The server-side endpoint calls a coding model and returns structured Python, Java, and C++ translations with **“What changed?”** explanations.
7. The officer presents the result to students.

Translation is manual and starts only when the officer uses the Translate action. Do not add live translation, debounce requirements, or automatic requests after typing or switching tabs.

The model provider is an implementation choice. Keep its credentials and provider configuration on the server. Validate requests and handle model errors without losing the active session.

## Product Goals

The showcase should help students recognize the same interview algorithm across three languages. Prioritize examples involving:

- arrays and strings;
- hash maps and sets;
- stacks and queues;
- linked lists;
- two pointers and sliding window;
- binary search;
- trees and graph traversal;
- recursion;
- introductory dynamic programming.

Preserve the intended algorithm and behavior when possible. Prefer idiomatic target-language code and concise explanations of relevant language differences. Do not expand the product into a general code translation platform.

## Session Persistence and Privacy

The proof of concept may optionally persist the current session in browser `localStorage` so an officer can restore it on the same browser and device. Accounts, authentication, server-side session storage, and a database are outside the initial scope. Do not store unnecessary user code on a server.

Treat model-generated code and explanations as untrusted text when rendering them in the browser.

## Engineering Preferences

Prefer the simplest architecture that satisfies the current feature. Avoid premature abstraction and unnecessary services.

When implementing product behavior:

- follow the product requirements in [Project Scope](PROJECT_SCOPE.md);
- keep model credentials server-side;
- preserve officer edits until the officer chooses to reset or replace them;
- start translation only from the explicit Translate action;
- present clear idle, translating, success, and failure states;
- keep generated output readable for projection and comparison.

## Cappy Theme

Cappy is the Coding Interview Club capybara mascot. Cappy can appear in educational tips, empty states, or small pieces of friendly copy, without distracting from the code or the officer's presentation.

## Git Rules

Never implement directly on main. Use the repository branch conventions documented in [GIT_CONVENTIONS.md](GIT_CONVENTIONS.md).

Use Conventional Commit-style commits and PR titles. Keep branches and PRs focused on one logical change. Before opening a PR, run the repository's lint, typecheck, tests, formatting check, and build commands.

## When Making Product Decisions

Use this question as the default filter:

> Does this help a CIC Intro officer present the same interview solution across Python, Java, and C++ so students can understand it?

If not, prefer leaving the feature out unless there is another clear requirement.
