# Project scope

## Product

CappyCode is a live solution showcase for Coding Interview Club (CIC) Intro,
General, and ICPC sessions. All three branches use one shared workflow. Officers
prepare content before a session; Members follow along through an anonymous,
read-only view.

The current product is a prepared-content presenter. It displays source code and
expected output entered by Officers. It does not generate, translate, compile,
or execute code, assess solutions, or accept submissions.

## Users and access

### Officers

Officers sign in with Firebase Authentication to prepare Session and Problem
content, manage the Problem Bank, and control live solution reveals. Officer
edits remain local until the relevant explicit **Save changes** action confirms
the write. Save states distinguish unsaved edits, saving, success, and errors;
failed edits remain available to retry. Production currently uses one shared
Officer account.

### Members

Members do not sign in. They can read live and ended Sessions and Problem Bank
entries that are not hidden by a live Session. They cannot edit content. In a
live Session, Problem descriptions and examples are public while
prepared Solutions stay protected until revealed. Ended Sessions form the
public archive, where their prepared Solutions are readable.

Firestore Security Rules enforce these permissions. Hiding a Solution in the
interface alone is not a security boundary.

## Shared Session → Problem → Solution workflow

Intro, General, and ICPC use the same data model and Officer and Member flows;
they are branch values, not separate applications. Each branch can have one
live Session at a time, so the three branches can present concurrently.

Officers create a draft Session, add and order Problems, prepare content, and
then make the Session live. A Session moves through `draft`, `live`, and
`ended`; ended Sessions are terminal. Officers can take a live Session offline
and return it to draft. Ending a Session makes it public in the archive without
changing each Problem's answer visibility value. A live Session can contain
multiple ordered Problems. Member Problem selection is independent and does not
change Session state.

Each Problem stores its title, description, constraints, shared example input
and expected output, order, and `answersVisible` state. Problem metadata is
separate from protected Solution documents. The example and expected output
appear once with the Problem statement; expected output is authored content,
not program execution output.

A Problem may have multiple named Solution Approaches. Each Approach can carry
DSA/algorithm tags and language-specific prepared code and complexity details.
Members select one Approach and one language at a time. Python, Java, and C++
are first-class supported languages. Monaco is the code presentation and
editing surface: Members see read-only code, while Officers edit prepared code.

For a live Session, **Show Answers** and **Hide Answers** update the selected
Problem's `answersVisible` value. Member views receive the change in realtime.
Rules permit anonymous reads of the fixed-language Solution documents only
while that value is true. Ended Session Solutions are public regardless of the
stored value; draft Session content remains Officer-only.

## Problem Bank

The Problem Bank stores reusable Problems separately from Session snapshots.
Problems are grouped as Custom, Interview-style, or Competitive Programming.
Officers can prepare their metadata, Approaches, language Solutions, and
complexity details. Public Bank discovery supports name search and filters for
CIC branch usage, difficulty, category, and DSA/algorithm tags. Search and
filtering operate on the loaded list. Bank detail uses the same Problem and
Solution workspace as Session content.

Bank entries are public unless currently used by a live Session. Legacy
publication fields do not control current Member visibility. A shared Bank
Problem stays hidden until its last live Session use ends. The visibility
marker and Firestore Rules enforce this behavior. Adding a Bank Problem to a
Session copies its content into a Session snapshot so later Bank edits do not
rewrite Session history.

## Current interface behavior

Member Session and Problem Bank details use a responsive Problem/Solution
workspace. The Problem statement and selected prepared Solution have distinct
columns on wider screens and stack on narrow screens. Only one read-only Monaco
editor is shown at a time; long lines wrap within its viewport and long files
scroll vertically. Problem links and metadata use concise labels. Bank search
and filters have a compact responsive toolbar, with one filter menu open at a
time. Tags use a consistent restrained color treatment, with text labels
retained.

Member and Officer screens share navigation, controls, status treatments, and
loading and error patterns. Officer Session history is disclosed when needed;
the workspace clarifies which edits each Save action persists. See [Design](../design.md)
for the detailed interface source of truth.

## Persistence and hosting

Firestore is the canonical persistence layer for Sessions, Problems, Solutions,
Bank records, and live answer visibility. Firebase Authentication protects
Officer Mode. The local Auth and Firestore Emulator Suite supports development
and tests using deterministic fixtures. Production uses the existing Firebase
project on the Spark plan; production web hosting runs on Vercel. Firestore
Security Rules deploy separately from the web application. Do not enable Blaze
or paid Firebase services.

## Product boundaries

- No public Member accounts, profiles, submissions, or member writes.
- No separate Intro, General, or ICPC applications or workflows.
- No runtime AI, LLM, code generation, translation, or explanation generation.
- No compilers, interpreters, execution, online judging, test runners, or
  sandboxing.
- No browser `localStorage` as canonical persistence; Firestore is authoritative.
- No Firebase App Hosting or paid Firebase services.

This scope describes implemented behavior and current product decisions. Future
work remains planned until it is implemented and verified; track it in [GitHub
Issues](https://github.com/ehuerta6/cappy-code/issues).
