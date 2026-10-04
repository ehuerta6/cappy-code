# CappyCode

**Write once. Learn it in three languages.**

CappyCode is a beginner-friendly web app built for the **Coding Interview Club (CIC)** Intro branch.

The goal is simple: let students write interview-style code in **Python**, **Java**, or **C++**, then automatically translate the same solution into the other supported languages.

CappyCode is not meant to replace LeetCode or become a general-purpose code translator. Its purpose is educational: help students understand that the **algorithm stays the same even when syntax, types, and data structures change between languages**.

---

## What CappyCode Does

A student can:

- choose **Python**, **Java**, or **C++** as their input language;
- write an interview-style solution in a browser-based editor;
- automatically receive equivalent versions in the other two languages;
- compare the translated implementations;
- see short explanations of important language differences.

Example:

```text
Python dict
    ↓
Java HashMap
    ↓
C++ unordered_map
```

The translation should preserve the original:

- algorithm;
- time complexity;
- space complexity;
- data-structure choices;
- logical behavior.

Translations should be reasonably idiomatic for each target language rather than mechanical line-by-line conversions.

---

## Why This Project Exists

Students learning Data Structures & Algorithms often understand a solution in one language but struggle to recognize the same idea in another.

CappyCode helps separate two concepts:

```text
Algorithm
   ≠
Programming language syntax
```

For example, a hash map solution to Two Sum is still a hash map solution whether it uses:

- `dict` in Python;
- `HashMap` in Java;
- `unordered_map` in C++.

This makes CappyCode especially useful during CIC Intro sessions, where freshmen and sophomores are still building confidence with interview-style coding.

---

## Supported Languages

The initial version supports:

- Python
- Java
- C++

These languages were chosen because they are commonly used for technical interview preparation and are already familiar to many CIC members.

---

## Project Scope

CappyCode is intentionally focused on **algorithmic interview code**.

The first versions should work especially well with:

- arrays and strings;
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

The project does **not** need to translate arbitrary applications, frameworks, servers, GUIs, or large production codebases.

For the complete scope and non-goals, see [Project Scope](docs/PROJECT_SCOPE.md).

---

## Core Product Experience

The intended flow is:

```text
Choose language
      ↓
Write code
      ↓
Short debounce
      ↓
Translate solution
      ↓
View Python / Java / C++
      ↓
Read "What changed?" explanations
```

Translations should happen automatically after the user pauses typing instead of requiring a request on every keystroke.

The UI can remain intentionally simple during early development. Educational usefulness is more important than visual polish.

---

## Educational Explanations

CappyCode should explain meaningful differences when useful.

Examples:

<!-- prettier-ignore -->
| Concept | Python | Java | C++ |
|---|---|---|---|
| Hash map | `dict` | `HashMap<K, V>` | `unordered_map<K, V>` |
| Hash set | `set` | `HashSet<T>` | `unordered_set<T>` |
| Length | `len(nums)` | `nums.length` | `nums.size()` |
| Null value | `None` | `null` | `nullptr` / context-dependent |
| Indexed loop | `enumerate(nums)` | indexed `for` loop | indexed/range loop |

These explanations should stay short and beginner-friendly.

Cappy, the Coding Interview Club capybara mascot, can occasionally provide these educational notes without distracting from the code.

---

## Current Product Principles

1. **Beginner first** — explanations should be understandable to students early in their DSA journey.
2. **Preserve the algorithm** — translation must not silently change the solution strategy.
3. **Interview code first** — optimize for LeetCode-style solutions, not arbitrary software.
4. **No unnecessary complexity** — authentication, databases, profiles, and social features are outside the initial scope.
5. **Teach, do not only translate** — the comparison between languages is part of the product.
6. **Keep `main` healthy** — merged code should pass the project's relevant lint, typecheck, test, and build checks.

---

## Documentation

Project documentation lives in [`docs/`](docs/).

- [Project Scope](docs/PROJECT_SCOPE.md) — product goals, boundaries, and non-goals.
- [Feature Tracker](docs/FEATURES.md) — implementation checklist and product roadmap.
- [Git & Pull Request Conventions](docs/GIT_CONVENTIONS.md) — branch, commit, PR, and merge rules.
- [AI Development Guidelines](docs/AI_GUIDELINES.md) — context and guardrails for AI coding assistants.

---

## Suggested Initial Architecture

The planned POC uses a deterministic parser → IR → emitter pipeline:

```text
Browser (Next.js, React, TypeScript)
   ↓
Monaco Editor
   ↓
Source language (Python / Java / C++)
   ↓
Tree-sitter parser / language adapter
   ↓
CappyCode language-neutral IR
   ↓
Deterministic target-language emitters
   ↓
Python / Java / C++
```

The UI initially keeps editor state in local React state and uses a short debounce for automatic translation. The parser, IR, and emitters define the translation itself: the POC does **not** use AI or an LLM for runtime translation.

The initial version does not require authentication or a database.

---

## Development Workflow

Never develop directly on `main`.

Every logical change should use a short-lived branch such as:

```text
feat/editor-layout
feat/code-translation
fix/stale-translation-response
docs/update-local-setup
```

PR titles and commits follow Conventional Commit style:

```text
feat: add code editor
fix: prevent stale translations
docs: update local setup
```

See [Git & Pull Request Conventions](docs/GIT_CONVENTIONS.md) for the full workflow.

---

## Status

CappyCode is currently in early development.

See the [Feature Tracker](docs/FEATURES.md) for the current implementation checklist.

## Local Development

Use Node.js **24.11.0** and npm **11.6.2** for local development. The supported Node version is recorded in `.nvmrc` and `package.json`.

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Run the project checks before opening a pull request:

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```
