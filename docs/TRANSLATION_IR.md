# CappyCode Translation IR

CappyCode's intermediate representation (IR) is the neutral, typed shape shared between a source parser and a target emitter. A parser recognizes supported interview code and records its meaning in the IR. An emitter turns that meaning into target-language code. This keeps translation deterministic while allowing each emitter to choose idiomatic syntax and collection APIs.

The TypeScript node definitions live in `src/lib/translation/ir.ts`; parser and emitter contracts live in `contracts.ts`. The `fixtures/` directory contains representative algorithms built directly as IR values.

## Supported POC model

The IR covers programs, classes with methods, functions, typed parameters, variables, assignments, conditionals, collection iteration, counted and while loops, returns, and expression statements. Expressions include integer, boolean, and string literals; arrays, maps, and sets; variables; binary and unary operators; named calls; indexing; and common collection operations.

Types are language-neutral: integer, boolean, string, void, unknown, arrays, maps, and sets. Collection types retain their element, key, and value types. The `unknown` type allows a parser to preserve an unannotated value when it cannot infer a more specific type from the supported subset.

Collection operations such as length, membership, add, remove, append, and get are represented by semantic operation names. The IR does not encode spelling such as `len`, `containsKey`, `push_back`, or `HashMap`.

## Boundaries

This is a small contract for the syntax subset in [Project Scope](PROJECT_SCOPE.md#initial-poc-supported-syntax), not a general compiler IR. It does not represent arbitrary expressions, exceptions, imports, generics, inheritance, pointers, memory layout, templates, async code, or multi-file projects. It contains no Python-, Java-, or C++-specific tokens or syntax trees. Source-language identifiers supplied as program names remain names; source spellings and parser details belong in language adapters.

The IR records structure and declared or inferred neutral types, not source formatting, comments, or target formatting preferences. Emitters choose syntax and standard-library equivalents. Parser implementations, language adapters, emitters, and the translation API are separate follow-up work.

## Parser and emitter contracts

Each parser identifies its source language and returns either a `Program` or diagnostics. A parser should reject unsupported constructs with useful locations when available, rather than silently inventing IR. Each emitter identifies its target language and accepts a `Program`, returning emitted code. Both contracts use the same neutral `SourceLanguage` tag for routing; that tag selects an implementation and is not embedded in the program IR.
