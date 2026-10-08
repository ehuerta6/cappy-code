# Fall 2026 Problem Bank source inventory

**Cutoff:** October 8, 2026.  
**Status:** Inventory complete for the accessible requested sources. This is an
occurrence inventory, not the #131 canonical import manifest. It does not
deduplicate Problems, research approaches, assign difficulty, or authorize
production writes. Rows marked review required need a human decision during
manifest generation; the source material is recorded here so that work does
not need to rescan Drive.

## Final import model verified on main

- Problem category and difficulty remain Problem-level fields.
- DSA/algorithm tags live on Solution Approaches. The finalized supported
  `approachTags` are `Arrays`, `Hash Map`, `Two Pointers`, `Binary Search`,
  `Stack`, `Queue`, `Linked List`, `Tree`, `Graph`, `DFS`, `BFS`,
  `Dynamic Programming`, `Greedy`, `Backtracking`, `Union Find`, and
  `Shortest Path`. There is no `Heap / Priority Queue` tag; adding it is
  outside this blocker.
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
- #131 was updated to remove the unsupported Heap tag, specify both required
  provenance references, and make imported records unpublished until an
  Officer explicitly publishes reviewed entries.

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

Inspected `Intro CIC Sessions Calendar Fall 2026.xlsx`,
`CIC Intro Curicculum Fall 2026`, and the five requested decks. The calendar
contains presenter and Problem fields but no completion marker or deck-to-date
field. The curriculum's broad weekly topics do not identify these custom
prompts. Dates are included only where a deck prompt can be matched directly to
a calendar entry; otherwise the week/deck is the available provenance.

| Week | Source reference                 | Candidate title as shown in material           | Classification / note                                                                                      |
| ---- | -------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1    | `CIC intro Week 1`, slide 23     | Cappy Sum                                      | Clear Problem; no external identity shown. Calendar has an untitled Link on Sep 1, so no date is assigned. |
| 2    | `CIC intro Week 2`, slide 20     | Cappy's Secret Code                            | Clear prompt; repeated slide heading says “Make Sum Divisible by P.” Review title/source identity.         |
| 2    | `CIC intro Week 2`, slide 21     | Cappy's Sort Array By Parity                   | Clear prompt; same conflicting repeated heading.                                                           |
| 2    | `CIC intro Week 2`, slide 24     | Cappy's Snack Streak                           | Clear prompt; same conflicting repeated heading.                                                           |
| 2    | `CIC intro Week 2`, slide 27     | Cappy Stock                                    | Clear prompt; same conflicting repeated heading.                                                           |
| 2    | `CIC intro Week 2`, slide 30     | Cappy's Mirror Number                          | Clear prompt; same conflicting repeated heading.                                                           |
| 2    | `CIC intro Week 2`, slide 31     | Cappy Sort Colors                              | Clear prompt; same conflicting repeated heading.                                                           |
| 2    | `CIC intro Week 2`, slide 34     | Cappy Rotate Image                             | Clear prompt; same conflicting repeated heading.                                                           |
| 3    | `CIC intro Week 3`, slide 18     | Cappy's Baseball Game                          | Clear Problem; no matching calendar title.                                                                 |
| 3    | `CIC intro Week 3`, slides 19–20 | Cappy's Duplicate Snacks                       | Clear Problem; slide 19 is a solution before the full prompt on slide 20.                                  |
| 4    | `CIC intro Week 4`, slide 23     | Subarray with largest sum (“Practice Problem”) | Clear Problem; no external identity shown.                                                                 |
| 5    | `CIC Intro Week 5`, slides 24–25 | Cappy's Sub Array                              | Clear Problem; occurrence retained separately from Week 4.                                                 |
| 5    | `CIC Intro Week 5`, slides 26–27 | Reverse Linked List                            | Clear Problem; matches the Oct 6 calendar entry.                                                           |
| 5    | `CIC Intro Week 5`, slides 28–29 | Cappy and the Lost Expedition Code             | Clear Problem; title/source identity needs review.                                                         |

**Intro candidate count:** 14 occurrences across five decks. The Oct 6
calendar row also lists an unnamed custom hard Problem, which may correspond to
one of the custom Week 5 prompts; it is not counted as a separate occurrence
without a match. No occurrences were deduplicated.

Instructional pseudocode, syntax/arithmetic examples, algorithm explanations,
pattern lists, and solution-only slides without a distinct prompt were excluded.

## General

Inspected `CIC General Sessions Calendar Fall 2026.xlsx`, the `General Session
Slides` folder and its dated September/October folders. Sessions with a
presenter entry by the cutoff are treated as occurred. The Sep 23 and Oct 7
calendar rows have no presenter entries and are not counted as presented.

| Session | Source deck     | Candidate Problems (source wording)                                                                                                   | Count / classification                                                                                                                                                                                                                                |
| ------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sep 1   | `09/01/26 Tues` | Cappy's Valid Anagram; Cappy Spring Line (return-to-origin prompt); Cappy Spring Line (linked-list partition prompt)                  | 3. Clear prompts; the repeated Spring Line title conflicts with the Sep 1 calendar's “Split Linked List in Parts” entry.                                                                                                                              |
| Sep 8   | `09/08/26 Tues` | Cappy's Two Sum; daily hotter-temperature waits; unnamed integer-array prompt (example output `[1, 2, 1, 2, 1, 2]`)                   | 3. First two are clear; unnamed prompt needs review. Calendar also says “i forgot which one i did” and “Leetcode 436”; neither is safely matched to a deck prompt.                                                                                    |
| Sep 9   | `09/09/26 Wed`  | Cappy's Two Sum; maximum trees visible along a path; Cappy and the Capybara Ponds (minimum travel energy with limited free crossings) | 3. Clear prompts; the calendar's “own” entry may refer to the custom ponds Problem but does not establish the match.                                                                                                                                  |
| Sep 15  | `09/15/26 tues` | Fruit Into Baskets (`totalFruit` solution slide); Rectangle Overlap; Cappy's Snack Streak; Capybara Tree Peek                         | 4. Rectangle Overlap, Snack Streak, and Tree Peek have prompts. Fruit Into Baskets appears as a solution without its prompt; review required. Calendar lists Fruit Into Baskets but that does not resolve whether Snack Streak is a separate Problem. |
| Sep 22  | `09/22 tues`    | Add Two Numbers (reverse-order digit lists); Minimum Cappy Coins Needed                                                               | 2. Both have prompts; the latter's displayed examples do not agree with the listed coin values/outputs. Calendar separately lists Leetcode 1928, which is not identified in this deck.                                                                |
| Sep 23  | `09/23 wed`     | Count and Say                                                                                                                         | 0 presented. Deck is stored, but the calendar has no presenter; retain as unconfirmed/unpresented material.                                                                                                                                           |
| Sep 29  | `09/29/26 tues` | Cappy's Favorite Numbers (happy-number process); Cappy Roman Numbers                                                                  | 2. Clear prompts; Roman Numbers matches the calendar entry Integer to Roman.                                                                                                                                                                          |
| Sep 30  | `09/30/26 wed`  | Cappy and the Gates of the Riverbank (balanced parentheses); Count and Say; Validate Binary Search Tree example slides                | 3. First two have prompts. BST is represented only by example/tree-logic slides and the calendar link; review required.                                                                                                                               |
| Oct 6   | `10/06/26 Tues` | Chill Cappy Number; Cappy and the Fruit Basket (longest substring without repeats); Minimum Cappy Coins Needed                        | 3. Clear prompts. Fruit Basket and Chill Cappy Number align with the calendar's Longest Substring and Ugly Number entries only by problem shape; title identity should be reviewed.                                                                   |

**General presented deck count:** 23 occurrences, including review-required
rows. **Calendar-only review candidates:** 3 (`i forgot which one i did`,
Leetcode 436 on Sep 8, and Leetcode 1928 on Sep 22). The Sep 9 “own” entry is
listed above as a possible match and is not double-counted. Sep 1's second
calendar value says only “Link,” without a title or prompt, so it is not
counted. **General candidate total:** 26 source occurrences/review candidates.

Later General calendar sessions and stored decks after Oct 8 are future and
excluded. The dated Oct 13–28 decks in the October folder are excluded. The
Oct 7 row has no presenter and is not treated as a completed session.

## ICPC

Inspected `ICPC Sessions Calendar Fall 2026.xlsx`, `ICPC_Fall_Study_Plan.docx`,
the `ICPC` folder, and all seven requested week decks that were present:
Week 1, Week 1.5, Week 2, Week 3, the Greedy deck filed as Week 5, the
Min-Heaps/Dijkstra deck filed as Week 5, and the Binary Search deck filed as
Week 6. The calendar has presenters on Sep 2, Sep 9, Sep 14, Sep 21, Sep 23,
Sep 28, Sep 30, and Oct 5. Week labels and dates are not consistent across the
calendar, study plan, and deck names; where the mapping is not explicit, the
deck/week is preserved and the date is marked for review.

| Source / date evidence                                       | Candidate Problems                                                                                                                                                                       | Count / classification                                                                                                                                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ICPC Week 1 .pptx`, calendar week of Aug 31 / Sep 2         | Longest subarray with sum ≤ K (slide “New Problem”); CSES 1661, CSES 1662, CSES 1141 (Problems slide)                                                                                    | 4. The generic sliding-window prompt is a clear statement but may be a teaching exercise; review before importing. Calendar Aug 31 has no presenter; Sep 2 lists Coco, so exact date mapping is not asserted. |
| `ICPC Week 1.5.pptx`, modified Sep 2                         | Codeforces 363B, 474B, 433B (practice list)                                                                                                                                              | 3. Deck text calls itself “UTEP ICPC Week 2”; retain filename and record title mismatch.                                                                                                                      |
| `ICPC Week 2.pptx`, modified Sep 9                           | LeetCode 303 (warm-up); CSES Range XOR; CSES Sliding Window XOR; Codeforces 1872E Data Structures Fan; Subarray Sum Equals K / LeetCode 560                                              | 5. First four are warm-up/practice prompts. Subarray Sum Equals K is a named explanatory slide without a full prompt; review required. Sliding Window XOR also appears in the Sep 9 calendar.                 |
| `ICPC Week 3 - BFS DFS Stacks Queues.pptx`, Sep 14           | LeetCode Valid Parentheses (warm-up); Codeforces 115A Party; 500A New Year Transportation; 1020B Badge                                                                                   | 4. Sep 14 has presenters; Sep 16 is blank.                                                                                                                                                                    |
| `ICPC_Week_5 - Greedy.pptx`, created Sep 22, modified Sep 28 | Codeforces A. Dragons; Boats to Save People; Codeforces C. Woodcutters                                                                                                                   | 3. The U.S. Coin Change deck example is instructional, not counted. Deck label and calendar/study-plan week require mapping review.                                                                           |
| `ICPC_Week5_MinHeaps_Dijkstra.pptx`, created/modified Sep 30 | LeetCode Last Stone Weight (warm-up); CSES 1671 Shortest Routes I; Codeforces 229B Planets; 20C Dijkstra?; CSES 1195 Flight Discount                                                     | 5. Topic/date conflict: deck is Dijkstra and named Week 5, while the study plan assigns Dijkstra to Sep 23 and Binary Search/DSU to Sep 28–30.                                                                |
| `ICPC Week 6` Binary Search deck, Oct 5                      | LeetCode Search Insert Position (warm-up); CSES 1620 Factory Machines; Codeforces 474B Worms; AtCoder ABC146 C Buy an Integer; CSES 1085 Array Division; Codeforces 1324D Pair of Topics | 6. The Factory Machines prompt is a worked example and should be reviewed before import. Calendar Oct 5 has a presenter.                                                                                      |

**ICPC presented-deck candidate count:** 30 (including three review-required
worked/explanatory prompts noted above). Week 5 DSU material was not present in
the accessible `ICPC` folder. The `ICPC_Week6_Dynamic_Programming.pptx` deck is
stored and contains four practice problems (LC 746, CSES 1633, 1634, and 1158),
but the Oct 7 calendar row has no presenter; it is excluded as
unconfirmed/unpresented. No later ICPC material was counted.

## Totals and exclusions

| Branch  | Candidate occurrences / review candidates |
| ------- | ----------------------------------------: |
| Intro   |                                        14 |
| General |                                        26 |
| ICPC    |                                        29 |

Counts are occurrence counts before canonicalization. They include clearly
stated custom Problems and named practice prompts, plus explicitly identified
review-required rows. They exclude pseudocode, syntax demonstrations, tiny
examples, algorithm walkthroughs without a prompt, and solution-only slides
unless the calendar independently records a candidate. Do not convert these
counts directly into canonical Bank records.

Future/unpresented exclusions: General Oct 7 and Oct 13 onward; Intro meetings
after Oct 8; ICPC Oct 7 DP deck and post-cutoff curriculum. Intro deck dates and
the ICPC week/date/topic mismatches are explicit review items. The unmatched
General calendar candidates are retained above as review candidates rather
than guessed to correspond to a deck prompt.

## Completion status

The requested source folders, calendars, study plan, and decks were accessible
and systematically reviewed. Candidate occurrences, ambiguous matches,
unpresented material, and source disagreements are recorded above. The
production target and finalized #116–#121 model are verified. #131 can begin
manifest generation from this inventory without rescanning Drive; its operator
must resolve the listed review rows while building the canonical manifest.
Lane A therefore resolves #134's blocker. It does not implement #131, publish
Bank content, or authorize production writes.
