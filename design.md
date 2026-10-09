# CappyCode presentation design

This is CappyCode's presentation and design reference. For broader context, see
[Project Scope](docs/PROJECT_SCOPE.md). Newer explicit project decisions and
accepted Issues or specifications take precedence over older documentation.
This document describes the presentation model and gives future UI work a
consistent direction; it is not an implementation plan or a changelog.

## How to read this document

- **Current** describes behavior present in the Member or Officer UI and
  supported by its components and tests.
- **Direction** records the accepted product and design constraints contributors
  should follow when building or changing UI.
- **Optional** marks a possible refinement only. It is not a requirement unless
  adopted in a product decision or Issue.

Current behavior is evidence, not authority over a newer explicit product
decision. When implementation and an accepted decision disagree, resolve the
discrepancy in its owning Issue; do not silently turn an incidental detail into
a design rule.

## Product and presentation model — Direction

CappyCode is one application with two permission modes. Members are anonymous
and read-only. Officers authenticate to prepare content and manage presentation.
Member presentation is the canonical content hierarchy; Officer Mode extends
that same hierarchy with editing, saving, and management controls.

Intro, General, and ICPC Sessions use the same **Session → Problem → Approach →
Solution** model. Branch identifies and organizes a Session; it does not select a
separate product or UI. Python, Java, and C++ are first-class supported
languages. Monaco is the code presentation and editing surface where appropriate.

Design for desktop and classroom projection first, while keeping smaller screens
usable. Code and Problem content carry the visual weight; controls support the
presentation. Use a clean, calm, minimal visual language with neutral surfaces
and a restrained blue accent. Avoid gradients, neon, excessive cards, heavy
navigation, gamification, and decorative SaaS styling.

## Session and Problem workspace

### Current

- At desktop widths (1100px and above), the selected Problem is in the left
  column and its Solutions workspace is in the right column. Both columns have
  contained vertical scrolling; the shell fits the available viewport below the
  application header. At smaller widths, the columns stack with Problem first.
- Problem selection is local to the view. Member Session routes identify the
  selected Problem; the Problem tabs remain keyboard-operable and can scroll
  horizontally for long titles. There is no page-level horizontal overflow from
  the workspace.
- The Member view keeps Problem content visible while live answers are hidden.
  It does not request Approach or Solution data until the selected Problem is
  revealed. A visibility-sync failure is shown as unavailable; it does not leave
  stale protected content on screen. Ended Sessions load their prepared
  Solutions immediately.
- Once available, a Member selects one Approach and one Language and sees exactly
  one read-only Monaco editor at a time. The selected Solution's complexity
  information is presented with it. The code is selectable and copyable.
- Officer Mode keeps the same Problem/selected Solution hierarchy. Its editor is
  editable and the workspace adds explicit saving, Approach management,
  reveal and lifecycle controls, plus readiness and management information.
  These controls extend the Member hierarchy rather than replacing it.

### Direction

Keep the Problem as the left-side reading context and the selected Solution as
the right-side focus on wide screens. Stack Problem before Solution on narrow
screens, contain long content within its own column where useful, and prevent
page-level horizontal overflow. Keep the core hierarchy consistent between
modes; give Officer controls clear labels and visible save outcomes.

Use semantic headings, readable Problem prose, and compact, labeled examples
and constraints. Keep Solution controls close to the selected Solution. Do not
turn the workspace into a permanent three-language editor grid.

## Member and Officer controls — Current and Direction

### Member

Members can browse public Sessions and the Problem Bank without signing in.
Live Problems remain readable before reveal. For a live Problem with answers
hidden, show a concise “Answers hidden” state and retain the Problem content. On
reveal, load only that Problem's prepared Approaches and Solutions. If the
visibility state cannot be synchronized, explain that state and offer retry;
never imply the Solution is available. Ended Sessions expose prepared Solutions
without a reveal gate.

The Member Solution view offers Approach and Language selection, followed by
one read-only, selectable Monaco editor and its complexity summary. A missing
Approach or unprepared language has an explicit empty state. Prepared Solution
documents contain code and complexity information; there is no prepared
Solution Output or execution surface.

Problem Bank details use the same Member Approach and Language selection model.
The public header links to Problem Bank and Officer login; Session and Problem
Bank views provide return navigation where applicable. Keep discovery and return
paths clear without adding heavy or persistent navigation.

### Officer

Officers work in the same content hierarchy and can edit Solutions in Monaco.
They explicitly save edits and receive visible unsaved, saving, saved, or
retryable failure feedback. Keep failed edits available for retry and prevent
navigation or structural actions from silently discarding pending work.

Officers can manage Approaches (create, edit, delete, and reorder where the
Session lifecycle permits), select a Language, and manage Session lifecycle,
answer visibility, and preparation readiness. Put high-value presentation
controls within reach without obscuring code or crowding the workspace.

## Problem Bank — Current and Direction

### Current

The Member Bank is public, except that a Bank Problem used by any live Session
is temporarily hidden. It remains hidden until the last live Session using it
stops. Members can organize and filter by category and branch, and see
difficulty badges and neutral DSA/algorithm tags. They do not see usage counts,
history, or planning metadata.

The Officer Bank uses the same visual vocabulary and adds management, usage,
and history information. Neither view uses publication-state controls.

### Direction

Use compact category organization and filters, readable Problem names, and
metadata that serves the current user's task. Keep tags neutral, compact, and
naturally wrapping; do not assign random or rainbow colors. Difficulty is
supplemental to its visible text label: Easy uses restrained green, Medium
restrained amber, and Hard restrained red.

## Visual tokens — Direction

Preserve the established light and dark theme direction. Use neutral surfaces,
subtle borders, and a restrained blue accent. Both themes use the same hierarchy
and spacing. Keep essential text and controls sufficiently contrasted; muted
colors and subtle borders are not suitable as the only signal for essential
content.

| Role              | Dark      | Light     |
| ----------------- | --------- | --------- |
| App background    | `#0F1318` | `#F6F8FA` |
| Primary surface   | `#151A20` | `#FFFFFF` |
| Raised surface    | `#1A2028` | `#F1F4F7` |
| Monaco background | `#12171D` | `#FAFBFC` |
| Hover surface     | `#202731` | `#E8EDF3` |
| Border subtle     | `#28313B` | `#DCE2E8` |
| Border strong     | `#35404C` | `#B8C2CC` |
| Primary text      | `#E6EBF0` | `#18212B` |
| Secondary text    | `#A0AAB5` | `#65717D` |
| Muted text        | `#707B87` | `#8A949E` |
| Accent            | `#4D8DFF` | `#2563EB` |
| Accent hover      | `#69A0FF` | `#1D4ED8` |

Use primary text for content and secondary text for supporting labels. Reserve
muted text for nonessential information. Pair status colors with text or a
meaningful icon. Provide a visible 2px focus outline with offset; selected
Problems also need a semantic selected state and a visible accent treatment.

## Typography, spacing, and shell — Direction

Use system sans-serif for interface text and a system monospace stack for code.
Keep the established hierarchy:

| Use                      | Size / line height | Weight  |
| ------------------------ | ------------------ | ------- |
| Session title            | 28px / 36px        | 600     |
| Problem title            | 24px / 32px        | 600     |
| Section heading          | 18px / 26px        | 600     |
| Body / description       | 16px / 26px        | 400     |
| Controls / useful labels | 15px / 22px        | 400–600 |
| Supporting metadata      | 14px / 20px        | 400     |
| Monaco                   | 15px / 23px        | 400     |

Use the **4, 8, 12, 16, 24, 32, 48px** spacing rhythm. Page gutters are about
24–32px on desktop and 16px on mobile. The content shell is about 1440px wide
and the header about 56px tall. Prefer whitespace and thin rules over extra
containers. Use compact control radii and avoid pill-shaped containers except
for small status badges.

## Monaco — Current and Direction

Member code is read-only; Officer code is editable. Keep code selectable and
copyable, use meaningful language and permission labels, omit the minimap, and
do not force wrapping unless a specific content need justifies it. Preserve
intentional keyboard escape/focus behavior. Show one selected Language editor at
a time, rather than a permanent three-language grid.

Monaco uses the matching theme background and primary foreground. Keep cursor,
selection, syntax, and line numbers legible in both themes. Content sizing and
scrolling should let people read long code without shrinking the type; avoid
page-level horizontal overflow.

## Accessibility and responsive use — Direction

- Use semantic headings and landmarks, keyboard-operable controls, visible
  focus, and explicit labels. Do not use color as the only status or selection
  signal.
- Meet WCAG AA text contrast (4.5:1 for normal text and 3:1 for large text and
  necessary control indicators). Keep the interface usable at 200% zoom.
- Use touch targets around 44px on mobile where appropriate. Keep smaller
  screens usable by stacking the workspace and allowing content to reflow.
- Make contained scrolling regions keyboard reachable and distinguishable.
  Choose Monaco focus and Escape behavior intentionally; do not trap keyboard
  focus in the editor.
- Respect reduced-motion preferences. Keep loading, empty, unavailable,
  disabled, success, and error states understandable without color alone.

## Scope and optional refinements

Do not add runtime AI, code translation, code execution, compilers or
interpreters, online judging, submissions, or `localStorage` as canonical
persistence without an explicit product decision. Firestore remains canonical
persistence, Firebase Authentication protects Officer Mode, and Firestore
Security Rules enforce access to protected content.

There are no additional optional refinements adopted by this document. Future
ideas should be labeled optional in their proposal and should not be treated as
requirements until an Issue or explicit product decision accepts them.
