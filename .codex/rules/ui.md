# UI

General rules for product UI and UX.

Use `impeccable` for dedicated design, critique, or polish work.

## Behavior before styling

When interaction, navigation, hierarchy, or state behavior is unclear, resolve those decisions before polishing visuals.

Do not use styling to hide an unresolved product interaction.

## Hierarchy

Make clear:

- what matters first;
- what the primary action is;
- which information is secondary;
- what belongs together.

Prefer layout, spacing, typography, and alignment before decoration.

## States

Handle relevant real states intentionally:

- loading;
- empty;
- selected;
- disabled;
- unavailable;
- success;
- error;
- partial data;
- long content;
- overflow;
- permission restrictions.

Do not ship fake controls or dead interactions that imply unsupported behavior.

## Accessibility

Prefer semantic HTML and native controls.

Support:

- keyboard interaction;
- visible focus;
- labels;
- useful error messages;
- logical heading structure;
- sufficient contrast;
- usable touch targets;
- information that does not depend on color alone.

## Responsive behavior

Smaller screens should remain usable.

Decide intentionally what:

- wraps;
- stacks;
- scrolls;
- collapses;
- remains visible;
- changes priority.

Do not simply shrink a desktop layout until it technically fits.

## Consistency

Reuse established:

- components;
- tokens;
- spacing;
- terminology;
- interaction patterns.

Do not introduce a new visual system for a small isolated task without a product reason.

## Scope

Refinement should preserve the current identity and behavior outside the requested scope.

A redesign should only happen when explicitly requested or clearly required by the task.
