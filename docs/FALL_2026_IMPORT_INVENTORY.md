# Fall 2026 Problem Bank source inventory

**Cutoff:** October 8, 2026.  
**Status:** Source review and canonical classification are recorded in the
#131 manifest. The original #134 inventory counted 74 candidates. Manifest
review found one additional full Network Delay Time prompt in the Sep 9 deck,
so the corrected total is 75. Six General calendar/custom items remain
irreducibly ambiguous for the evidence-based reasons in the manifest. No
production write is authorized.

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
- Problem Bank content is public by default and is hidden only while used by
  the active live Session. Imports preserve temporary hiding on existing Bank
  records and do not store publication intent.
- #131 was updated to remove the unsupported Heap tag and specify both required
  provenance references.

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
| 2    | `CIC intro Week 2`, slide 20     | Cappy's Secret Code                            | Clear prompt for LeetCode Valid Palindrome; repeated slide heading is stale.                               |
| 2    | `CIC intro Week 2`, slide 21     | Cappy's Sort Array By Parity                   | Clear prompt for LeetCode Sort Array By Parity; repeated slide heading is stale.                           |
| 2    | `CIC intro Week 2`, slide 24     | Cappy's Snack Streak                           | Clear prompt for LeetCode 3; kept separate from General Sep 15 Fruit Into Baskets (LeetCode 904).          |
| 2    | `CIC intro Week 2`, slide 27     | Cappy Stock                                    | Clear prompt for LeetCode Best Time to Buy and Sell Stock.                                                 |
| 2    | `CIC intro Week 2`, slide 30     | Cappy's Mirror Number                          | Clear prompt for LeetCode Palindrome Number.                                                               |
| 2    | `CIC intro Week 2`, slide 31     | Cappy Sort Colors                              | Clear prompt for LeetCode Sort Colors.                                                                     |
| 2    | `CIC intro Week 2`, slide 34     | Cappy Rotate Image                             | Clear prompt for LeetCode Rotate Image.                                                                    |
| 3    | `CIC intro Week 3`, slide 18     | Cappy's Baseball Game                          | Clear Problem; no matching calendar title.                                                                 |
| 3    | `CIC intro Week 3`, slides 19–20 | Cappy's Duplicate Snacks                       | Clear Problem; slide 19 is a solution before the full prompt on slide 20.                                  |
| 4    | `CIC intro Week 4`, slide 23     | Subarray with largest sum (“Practice Problem”) | Clear Problem; no external identity shown.                                                                 |
| 5    | `CIC Intro Week 5`, slides 24–25 | Cappy's Sub Array                              | Clear Problem; occurrence retained separately from Week 4.                                                 |
| 5    | `CIC Intro Week 5`, slides 26–27 | Reverse Linked List                            | Clear Problem; matches the Oct 6 calendar entry.                                                           |
| 5    | `CIC Intro Week 5`, slides 28–29 | Cappy and the Lost Expedition Code             | Clear Problem; title/source identity needs review.                                                         |

**Intro candidate count:** 14 occurrences across five decks. The Oct 6
calendar row also lists an unnamed custom hard Problem, which may correspond to
one of the custom Week 5 prompts; it is not counted as a separate occurrence
without a match. The manifest deduplicates the repeated Maximum Subarray and
records each Intro occurrence.

Instructional pseudocode, syntax/arithmetic examples, algorithm explanations,
pattern lists, and solution-only slides without a distinct prompt were excluded.

## General

Inspected `CIC General Sessions Calendar Fall 2026.xlsx`, the `General Session
Slides` folder and its dated September/October folders. Sessions with a
presenter entry by the cutoff are treated as occurred. The Sep 23 and Oct 7
calendar rows have no presenter entries and are not counted as presented.

| Session | Source deck     | Candidate Problems (source wording)                                                                                                                       | Count / classification                                                                                                                                                                              |
| ------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sep 1   | `09/01/26 Tues` | Cappy's Valid Anagram; Cappy Spring Line (return-to-origin prompt); Cappy Spring Line (linked-list partition prompt)                                      | 3. Clear prompts; the repeated Spring Line title conflicts with the Sep 1 calendar's “Split Linked List in Parts” entry.                                                                            |
| Sep 8   | `09/08/26 Tues` | Cappy's Two Sum; daily hotter-temperature waits; unnamed integer-array prompt (example output `[1, 2, 1, 2, 1, 2]`)                                       | 3 deck prompts map to Two Sum, Daily Temperatures, and Maximum Length of Valid Subsequence I. Two calendar-only rows remain irreducibly ambiguous.                                                  |
| Sep 9   | `09/09/26 Wed`  | Cappy's Two Sum; maximum trees visible along a path; Cappy and the Capybara Ponds (minimum travel energy with limited free crossings); Network Delay Time | 4. The first three custom/canonical prompts and the full Network Delay Time prompt are represented in the manifest. The calendar's “own” entry is not used to infer identity.                       |
| Sep 15  | `09/15/26 tues` | Fruit Into Baskets (`totalFruit` solution slide); Rectangle Overlap; Cappy's Snack Streak; Capybara Tree Peek                                             | Rectangle Overlap, Snack Streak (LeetCode 904), and Tree Peek are canonical prompts. Fruit Into Baskets is a solution-only artifact; it does not replace Intro Week 2's distinct LeetCode 3 prompt. |
| Sep 22  | `09/22 tues`    | Add Two Numbers (reverse-order digit lists); Minimum Cappy Coins Needed                                                                                   | Add Two Numbers is canonical. Minimum Cappy Coins remains irreducibly ambiguous because examples conflict with denominations; Oct 6 repeats it. Calendar LeetCode 1928 is a separate ambiguity.     |
| Sep 23  | `09/23 wed`     | Count and Say                                                                                                                                             | 0 presented. Deck is stored, but the calendar has no presenter; retain as unconfirmed/unpresented material.                                                                                         |
| Sep 29  | `09/29/26 tues` | Cappy's Favorite Numbers (happy-number process); Cappy Roman Numbers                                                                                      | 2. Clear prompts; Roman Numbers matches the calendar entry Integer to Roman.                                                                                                                        |
| Sep 30  | `09/30/26 wed`  | Cappy and the Gates of the Riverbank (balanced parentheses); Count and Say; Sleepy Capybara Pyramid (BST validation)                                      | Three presented prompts. The custom balanced-brackets prompt is preserved; Count and Say maps to LeetCode 38; the full BST prompt maps to LeetCode 98.                                              |
| Oct 6   | `10/06/26 Tues` | Chill Cappy Number; Cappy and the Fruit Basket (longest substring without repeats); Minimum Cappy Coins Needed                                            | Chill Cappy Number maps to LeetCode 263. Fruit Basket duplicates Intro Week 2's LeetCode 3. Minimum Cappy Coins remains irreducibly ambiguous because its examples conflict with the Sep 22 deck.   |

**General presented deck count:** 24 occurrences. **Calendar-only candidates:**
3 (`i forgot which one i did`, LeetCode 436 on Sep 8, and LeetCode 1928 on Sep
22). The Sep 9 “own” entry is not counted without a source match. Sep 1's
second calendar value says only “Link,” without a title or prompt, so it is not
counted. **Corrected General candidate total:** 27 occurrences.

Later General calendar sessions and stored decks after Oct 8 are future and
excluded. The dated Oct 13–28 decks in the October folder are excluded. The
Oct 7 row has no presenter and is not treated as a completed session.

## ICPC

Inspected `ICPC Sessions Calendar Fall 2026.xlsx`, `ICPC_Fall_Study_Plan.docx`,
the `ICPC` folder, and all eight in-scope decks that were present: Week 1,
Week 1.5, Week 2, Week 3, Week 4 Multi-Source BFS/Tree Diameter, the Greedy
deck filed as Week 5, the Min-Heaps/Dijkstra deck filed as Week 5, and the
Binary Search deck filed as Week 6. The calendar has presenters on Sep 2, Sep
9, Sep 14, Sep 21, Sep 23, Sep 28, Sep 30, and Oct 5. Week labels and dates
are not consistent across the calendar, study plan, and deck names; where the
mapping is not explicit, the deck/week is preserved and the date is marked for
review.

| Source / date evidence                                              | Candidate Problems                                                                                                                                                                       | Count / classification                                                                                                                                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ICPC Week 1 .pptx`, calendar week of Aug 31 / Sep 2                | Longest subarray with sum ≤ K (slide “New Problem”); CSES 1661, CSES 1662, CSES 1141 (Problems slide)                                                                                    | Four canonical prompts, including the distinct CIC sliding-window Problem. Calendar Aug 31 has no presenter; Sep 2 lists Coco, so deck/week provenance is retained. |
| `ICPC Week 1.5.pptx`, modified Sep 2                                | Codeforces 363B, 474B, 433B (practice list)                                                                                                                                              | 3. Deck text calls itself “UTEP ICPC Week 2”; retain filename and record title mismatch.                                                                            |
| `ICPC Week 2.pptx`, modified Sep 9                                  | LeetCode 303 (warm-up); CSES Range XOR; CSES Sliding Window XOR; Codeforces 1872E Data Structures Fan; Subarray Sum Equals K / LeetCode 560                                              | Four warm-up/practice prompts are canonical. LeetCode 560 is excluded as an explanatory comparison without an assigned prompt.                                      |
| `ICPC Week 3 - BFS DFS Stacks Queues.pptx`, Sep 14                  | LeetCode Valid Parentheses (warm-up); Codeforces 115A Party; 500A New Year Transportation; 1020B Badge                                                                                   | 4. Sep 14 has presenters; Sep 16 is blank.                                                                                                                          |
| `ICPC_Week_4_-_Multi-Source_BFS_Tree_Diameter.pptx`, created Sep 21 | LeetCode Number of Islands (warm-up); 2172M Distance to Port; 977E Cyclic Components; Elevated Rails (SCUSA 2024)                                                                        | 4. Sep 21 has presenters. The study plan assigns these topics to Week 3, while this deck is labeled Week 4.                                                         |
| `ICPC_Week_5 - Greedy.pptx`, created Sep 22, modified Sep 28        | Codeforces A. Dragons; Boats to Save People; Codeforces C. Woodcutters                                                                                                                   | 3. The U.S. Coin Change deck example is instructional, not counted. Deck label and calendar/study-plan week require mapping review.                                 |
| `ICPC_Week5_MinHeaps_Dijkstra.pptx`, created/modified Sep 30        | LeetCode Last Stone Weight (warm-up); CSES 1671 Shortest Routes I; Codeforces 229B Planets; 20C Dijkstra?; CSES 1195 Flight Discount                                                     | 5. Topic/date conflict: deck is Dijkstra and named Week 5, while the study plan assigns Dijkstra to Sep 23 and Binary Search/DSU to Sep 28–30.                      |
| `ICPC Week 6` Binary Search deck, Oct 5                             | LeetCode Search Insert Position (warm-up); CSES 1620 Factory Machines; Codeforces 474B Worms; AtCoder ABC146 C Buy an Integer; CSES 1085 Array Division; Codeforces 1324D Pair of Topics | Five canonical practice prompts. Factory Machines is excluded as the worked binary-search example, absent from the final practice list.                             |

**ICPC presented-deck candidate count:** 34. The Week 1 sliding-window item is
treated as a distinct custom Problem because the deck explicitly labels it
“New Problem.” Elevated Rails is identified from the official regional
statement. LeetCode 560 and Factory Machines are excluded as instructional
material. Week 5 DSU material was not present in
the accessible `ICPC` folder. The `ICPC_Week6_Dynamic_Programming.pptx` deck is
stored and contains four practice problems (LC 746, CSES 1633, 1634, and 1158),
but the Oct 7 calendar row has no presenter; it is excluded as
unconfirmed/unpresented. No later ICPC material was counted.

## Totals and exclusions

| Branch  | Candidate occurrences / review candidates |
| ------- | ----------------------------------------: |
| Intro   |                                        14 |
| General |                                        27 |
| ICPC    |                                        34 |

Counts are occurrence counts before canonicalization. They include clearly
stated custom Problems and named practice prompts, plus the calendar-only
items whose ambiguity is recorded in the manifest. They exclude pseudocode,
syntax demonstrations, tiny
examples, algorithm walkthroughs without a prompt, and solution-only slides
unless the calendar independently records a candidate. Do not convert these
counts directly into canonical Bank records.

Future/unpresented exclusions include General Oct 7 and Oct 13 onward, Intro
meetings after Oct 8, and the ICPC Oct 7 DP deck. The six General ambiguities
are the unnamed forgotten candidate, calendar-only LeetCode 436 and 1928, two
contradictory Minimum Cappy Coins appearances, and the contradictory Lamp
example. Their evidence-based reasons are in the manifest.

## Canonical classification status

The review manifest records 66 canonical occurrences across Intro (14),
General (20), and ICPC (32), including duplicate mappings. It has six
irreducibly ambiguous General candidates, three inventory exclusions that are
teaching or solution artifacts, and future/unpresented exclusions separated
from the 75 occurrence total. Canonical identities, approaches, language
solutions, difficulty provenance, and the known reviewed historical skip are
in [`fall-2026-manifest.json`](../data/problem-bank/fall-2026-manifest.json).
Gate 5A dry-run and difficulty proposals remain subject to the final report.
