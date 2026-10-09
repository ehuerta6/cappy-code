---
name: grill-me
description: Stress-test a feature, plan, architecture decision, or product idea until the important decisions are explicit and shared.
metadata:
  inspired_by: mattpocock/skills grilling
---

# Grill me

Use this skill when an idea is still ambiguous enough that implementation would require guessing.

The goal is shared understanding, not implementation.

## Process

1. Read the existing conversation, project instructions, specs, issues, and relevant code before asking questions.
2. Separate facts from decisions.
3. Research facts yourself when they can be discovered from the repository, documentation, tools, or other available sources.
4. Build a decision tree:
   - start with decisions that do not depend on unresolved decisions;
   - resolve those first;
   - use their answers to expose the next decisions.
5. Ask questions in rounds instead of one at a time.
6. For every question:
   - explain what decision is being made;
   - give concrete options when useful;
   - recommend an option and explain why;
   - leave the final decision to the user.
7. Recompute the unresolved decision frontier after every round.
8. During design discussions, sharpen domain language where it affects behavior:
   - identify ambiguous or overloaded terms and ask what each means in this project;
   - distinguish concepts, entities, relationships, invariants, and state transitions when those distinctions matter;
   - check proposed behavior against established decisions and relevant existing code, and surface contradictions;
   - use concrete edge cases to test domain boundaries.
9. When terminology has been resolved and will recur, consider proposing a project-specific `GLOSSARY.md` containing domain terms and their meanings only. Do not include implementation details, use it as a scratchpad, or create one automatically.
10. When a decision is important, non-obvious, and likely to matter later, consider recording it with the existing `templates/DECISION.md`. Skip routine or easily reversible choices. Do not create a record automatically.
11. If a concrete uncertainty is best answered by trying alternatives, the optional `prototype` workflow may be used before `to-spec`. Keep grilling focused on the unresolved question; do not turn it into implementation or document generation.

## Rules

- Do not ask the user for facts you can inspect yourself.
- Do not invent requirements.
- Do not expand the feature while clarifying it.
- Do not turn every detail into a decision.
- Do not implement the result unless explicitly asked.
- Preserve established project terminology, while calling out conflicts or ambiguity.
- Explicit project decisions override generic recommendations.
- Documents are optional aids to preserve resolved domain language and durable decisions, not required outputs of a grilling session.

## Completion

The session is complete when:

- goals are clear;
- non-goals are clear;
- important behavior is decided;
- meaningful edge cases are addressed;
- technical constraints that affect the feature are known;
- no important implementation decision depends on an unanswered product question.

The result should be ready for `to-spec`.
