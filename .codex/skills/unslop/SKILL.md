---
name: unslop
description: Audit and clean technical writing so it becomes concrete, concise, credible, and free of formulaic AI prose without changing supported facts.
metadata:
  adapted_from:
    - cursor/plugins pstack unslop
    - theclaymethod/unslop
---

# Unslop

Improve technical prose by removing vague, formulaic, inflated, or synthetic-sounding writing.

Use this for:

- README files;
- documentation;
- GitHub Issues;
- pull requests;
- technical explanations;
- UI copy;
- project descriptions;
- engineering notes.

Use `humanizer` when the main goal is matching a person's voice.

Use `unslop` when the main goal is improving information density and technical writing quality.

## Modes

### Audit

Identify problems without rewriting the text.

Report:

- the problematic passage;
- the pattern;
- why it weakens the writing;
- whether the problem is definite or context-dependent.

### Cleanup

Rewrite the text while preserving supported meaning.

Default to cleanup when the user asks to fix, polish, improve, or de-slop technical prose.

## What to detect

### Vague claims

Examples:

- unnamed experts or reports;
- "best practices" with no source;
- vague associations;
- claims of scale or importance without evidence.

Name the source when one exists.

Otherwise remove or narrow the claim.

### Inflated language

Remove language that makes ordinary work sound historic, revolutionary, pivotal, transformative, or exceptional without evidence.

State what happened.

### Empty technical language

Replace abstract language with the real mechanism.

Weak:

`The architecture provides a robust and scalable foundation.`

Better:

`The API and worker can scale independently.`

When a sentence could be pasted into an unrelated project unchanged, inspect whether it communicates anything specific.

### Formulaic AI structures

Watch for:

- "not just X, but Y";
- fake objections;
- dramatic one-line conclusions;
- forced triads;
- repeated paragraph structures;
- generic intro and conclusion paragraphs;
- unnecessary recap;
- artificial aphorisms.

Keep them only when they carry real information.

### Filler

Remove phrases whose deletion changes nothing.

Prefer:

- `use` over `utilize`;
- `help` over `facilitate`;
- `if` over `in the event that`;
- direct statements over "it is important to note that."

Do not replace established technical terminology merely because it is formal.

### Weak technical claims

Prefer observable mechanisms, constraints, or results over feelings.

Weak:

`The system makes database work seamless.`

Better:

`Migrations run automatically before integration tests.`

### Dense writing

Split sentences when multiple unrelated ideas are packed together.

Do not over-compress into fragments, arrows, or shorthand that makes the reader reconstruct the sentence.

### Formatting slop

Review:

- excessive bold;
- label-colon lists that restate themselves;
- decorative emoji;
- unnecessary title case;
- punctuation used as visual decoration rather than syntax.

Respect the artifact's existing style when it is intentional.

## Process

1. Read the complete artifact before editing.
2. Identify the intended reader and purpose.
3. Mark concrete writing problems.
4. Rewrite around the actual information.
5. Preserve facts, technical terminology, and constraints.
6. Read the result again for surviving formulaic patterns.
7. Remove any new unsupported claims introduced during rewriting.

## Rules

- Do not treat individual words as universally banned.
- Context decides whether a pattern is actually a problem.
- Preserve technical accuracy over stylistic smoothness.
- Do not manufacture metrics or evidence.
- Do not make everything shorter when detail is useful.
- Prefer concrete language over impressive-sounding language.
- Reuse established domain terminology rather than cycling through synonyms.
- Do not add marketing language to technical artifacts.

## Completion

Cleanup is complete when:

- every sentence contributes useful information;
- claims are concrete or appropriately qualified;
- formulaic AI patterns no longer dominate the writing;
- technical meaning is preserved;
- unsupported claims were not introduced.
