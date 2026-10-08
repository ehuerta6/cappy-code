# Fall 2026 Problem Bank source inventory

**Cutoff:** October 8, 2026.  
**Status:** Partial. This is an occurrence inventory, not the #131 canonical
import manifest. It does not deduplicate Problems, research approaches, assign
difficulty, or authorize writes.

## Final import model verified on main

- Problem category and difficulty remain Problem-level fields.
- DSA/algorithm tags live on Solution Approaches. The finalized supported
  `approachTags` are `Arrays`, `Hash Map`, `Two Pointers`,
  `Binary Search`, `Stack`, `Queue`, `Linked List`, `Tree`,
  `Graph`, `DFS`, `BFS`, `Dynamic Programming`, `Greedy`,
  `Backtracking`, `Union Find`, and `Shortest Path`. There is no
  `Heap / Priority Queue` tag; adding it is outside this blocker.
- Branch usage is derived from Session history. No Problem-level branch,
  filter, usage-counter, or analytics field should be imported.
- #118 reads `bankProblemId` from each Session Problem snapshot, then obtains
  branch, date, title, and status from the Session. It counts at most one
  occurrence per Session. Member history excludes draft Sessions; Officer
  history includes them. Exact verified historical matches therefore need
  `bankProblemId` on the Session Problem snapshot and the corresponding
  distinct ID in the parent Session's `bankProblemIds` list. The latter
  remains the existing Rules/lifecycle reference. There are no counters.
- #121 separates publication intent (`isPublished`) from temporary
  live-session hiding (`hiddenByLiveSessionId`). New reusable Bank records
  start with `isPublished: false`; importing must not publish them. Live
  hiding is temporary and does not change that intent.
- #131 was updated to remove the unsupported Heap tag, specify the required
  provenance references, and make new imports unpublished until an Officer
  explicitly publishes reviewed entries.

## Production target verified

Vercel's `cappycode` project has a READY Production deployment built from
`main` at `484656a02a79abcf13d620f2095090a37bca3dc0`. Its Production
environment sets `NEXT_PUBLIC_FIREBASE_PROJECT_ID=cappycode-f133c` and
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`. The deployed client calls
`getFirestore(getFirebaseApp())`, which uses the default database. Firebase
project metadata confirms the active project `cappycode-f133c` has the native
Firestore database `(default)`. The deployed app and intended #131 target
therefore match: **`cappycode-f133c` / `(default)`**.

Verification used Vercel Production deployment/environment metadata,
Firebase project/database metadata, and the checked-in client initialization.
No secret environment values were recorded. **No production writes occurred.**

## Intro

Inspected the Intro Sessions calendar, the Fall 2026 Intro curriculum, and all
five requested decks: `CIC intro Week 1`, `CIC intro Week 2`,
`CIC intro Week 3`, `CIC intro Week 4`, and `CIC Intro Week 5`.
The calendar lists two meetings per week, but does not say which meeting a
deck belongs to or mark a meeting complete. The Week 5 deck was created on
October 6 while the calendar's Week 5 entries are September 29 and October 1;
the mapping needs human review. Dates below are therefore not assigned.

| Week | Source reference | Candidate title as shown in material           | Classification / note                                                                                                                |
| ---- | ---------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Slide 23         | Cappy Sum                                      | Clear Problem; no external identity shown.                                                                                           |
| 2    | Slide 20         | Cappy's Secret Code                            | Clear Problem; repeated slide heading says “Make Sum Divisible by P,” which conflicts with the prompt. Review title/source identity. |
| 2    | Slide 21         | Cappy's Sort Array By Parity                   | Clear Problem; same conflicting repeated slide heading.                                                                              |
| 2    | Slide 24         | Cappy's Snack Streak                           | Clear Problem; same conflicting repeated slide heading.                                                                              |
| 2    | Slide 27         | Cappy Stock                                    | Clear Problem; same conflicting repeated slide heading.                                                                              |
| 2    | Slide 30         | Cappy's Mirror Number                          | Clear Problem; same conflicting repeated slide heading.                                                                              |
| 2    | Slide 31         | Cappy Sort Colors                              | Clear Problem; same conflicting repeated slide heading.                                                                              |
| 2    | Slide 34         | Cappy Rotate Image                             | Clear Problem; same conflicting repeated slide heading.                                                                              |
| 3    | Slide 18         | Cappy's Baseball Game                          | Clear Problem.                                                                                                                       |
| 3    | Slides 19–20     | Cappy's Duplicate Snacks                       | Clear Problem; slide 19 is a solution before the full prompt on slide 20.                                                            |
| 4    | Slide 23         | Subarray with largest sum (“Practice Problem”) | Clear Problem; no external identity shown.                                                                                           |
| 5    | Slides 24–25     | Cappy's Sub Array                              | Clear Problem; appears again after Week 4. Occurrences intentionally remain separate.                                                |
| 5    | Slides 26–27     | Reverse Linked List                            | Clear Problem.                                                                                                                       |
| 5    | Slides 28–29     | Cappy and the Lost Expedition Code             | Clear Problem; title/source identity needs review.                                                                                   |

**Intro candidate count:** 14 occurrences across the five decks. The count is
by deck prompt, before canonicalization. These decks contain no slide-level
presentation date; the calendar does not establish a deck-to-date mapping.
Presentation status by the cutoff therefore still needs confirmation.

Instructional material excluded from the Problem count includes pseudocode,
syntax/arithmetic examples, general algorithm/data-structure explanations,
pattern lists, and solution-only slides that do not add a distinct prompt.

## General

Inspected `CIC General Sessions Calendar Fall 2026.xlsx` and the only two
General session decks returned by Drive search and folder inspection:
`09/01/26 Tues` and `09/15/26 tues`.

### Slide-backed candidates

| Session date | Source / slide            | Candidate title as shown    | Classification / note                                                                                                                               |
| ------------ | ------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sep 1        | `09/01/26 Tues`, slide 32 | Cappy's Valid Anagram       | Clear Problem.                                                                                                                                      |
| Sep 1        | `09/01/26 Tues`, slide 34 | Cappy Spring Line           | Clear Problem; prompt asks whether moves return to origin.                                                                                          |
| Sep 1        | `09/01/26 Tues`, slide 36 | Cappy Spring Line           | Clear Problem; this title is reused for a linked-list partition prompt. Calendar calls out Split Linked List in Parts; title conflict needs review. |
| Sep 15       | `09/15/26 tues`, slide 29 | Solution using `totalFruit` | Review required; the calendar lists Fruit Into Baskets, but this slide has no Problem statement/title.                                              |
| Sep 15       | `09/15/26 tues`, slide 32 | Rectangle Overlap           | Clear Problem.                                                                                                                                      |
| Sep 15       | `09/15/26 tues`, slide 34 | Cappy's Snack Streak        | Clear Problem; the calendar separately lists Fruit Into Baskets. Do not resolve whether this is the same Problem here.                              |
| Sep 15       | `09/15/26 tues`, slide 35 | Capybara Tree Peek          | Clear Problem; no matching title appears in the calendar row.                                                                                       |

**Slide-backed count:** 7 occurrences.

### Calendar-only candidates without a located matching deck

The calendar lists these non-empty Problem entries, but matching completed
materials were not found in the connected Drive:

| Session date | Calendar entry                                                | Classification / note                                  |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------------ |
| Sep 8        | Daily Temperatures (submission link present)                  | Candidate; review the corresponding deck/material.     |
| Sep 8        | “i forgot which one i did”                                    | Review required; identity unknown.                     |
| Sep 8        | “Leetcode 436”                                                | Review required; calendar gives a number, not a title. |
| Sep 9        | “own”                                                         | Review required; no Problem identity.                  |
| Sep 22       | “Leetcode 1928”                                               | Review required; calendar gives a number, not a title. |
| Sep 29       | Integer to Roman                                              | Candidate; review the corresponding deck/material.     |
| Sep 30       | Validate Binary Search Tree (link present)                    | Candidate; review the corresponding deck/material.     |
| Sep 30       | Valid Parentheses (link present)                              | Candidate; review the corresponding deck/material.     |
| Oct 6        | Longest Substring Without Repeating Characters (link present) | Candidate; review the corresponding deck/material.     |
| Oct 6        | Ugly Number                                                   | Candidate; review the corresponding deck/material.     |

**Calendar-only count:** 10 candidate entries. The two Sep 1 calendar values
shown only as “Link” are not counted as Problems because they have no title or
problem statement. Empty calendar cells are also excluded.

The calendar identifies September sessions and October 6 material, but does
not have a completion/status field. Its October 7 row is blank; no corresponding
deck or evidence that a session occurred was located, so no Problem occurrence
is counted for October 7. No General deck/material was found for Sep 8, Sep 9,
Sep 22, Sep 29, Sep 30, or Oct 6.

**General candidate count:** 17 records (7 slide-backed plus 10 calendar-only).
This is a source-occurrence count, not a canonical Problem count.

## ICPC

The required Week 1, Week 1.5, and Weeks 2–6 materials were not returned by
connected Drive searches for `ICPC`, `ICPC Week 1`, `ICPC Week 2`,
`ICPC Week 5`, or `ICPC Sessions`; the `ICPC Sessions` folder search
returned no folder, and an inventory of accessible native Slides returned no
ICPC deck. No ICPC content was inspected, so its candidate count is
**undetermined**, not zero. The required ICPC inventory remains incomplete.

## Future / unpresented material excluded

- General calendar sessions dated October 13 onward are after the cutoff.
- Intro calendar meetings dated October 13 onward are after the cutoff.
- The October 7 General calendar row has no presenters, Problem entries, or
  located materials and is not treated as presented.
- No ICPC materials were accessible to classify as presented or future.
- No Problems were inferred from syntax demonstrations, pseudocode, code
  walkthroughs, pattern/catalog slides, or solution-only slides without a
  corresponding prompt.

## Completion status

The available source evidence is recorded above, but the requested complete
inventory is **not yet complete**: the remaining General decks/materials and
all required ICPC week sources are unavailable in the connected Drive, and
Intro deck presentation dates are not established by its calendar. Until those
sources and the Intro date mapping are resolved, Lane A does not satisfy #134's
completion gate and #131 is **not unblocked**. This partial inventory does not
authorize #131 manifest generation or production writes.
