# Feature Tracker

This checklist tracks the product implementation for CappyCode, **a live solution showcase platform for CIC Intro sessions**. It describes the intended product scope; checked items indicate repository documentation or project foundations, not necessarily a completed end-to-end product.

## Foundation

- [x] Add project README, scope, feature tracker, Git conventions, and AI development guidelines
- [x] Establish the Next.js application, linting, type checking, formatting, and build commands
- [ ] Document local setup and environment configuration
- [ ] Add CI checks for the repository's lint, typecheck, test, format, and build commands

## Authentication and access

- [ ] Add Firebase Authentication for Officer Mode
- [ ] Configure one shared CIC officer account for the proof of concept
- [ ] Allow anonymous access to the public Member Mode
- [ ] Restrict session and problem management to authenticated officers with Firestore Security Rules
- [ ] Enforce Firestore Security Rules so draft session/problem metadata is officer-only and live/ended metadata is public
- [ ] Gate live anonymous Solution reads with the parent Problem's `answersVisible`; make fixed-language Solutions public for ended Sessions

## Firestore data and session lifecycle

- [ ] Use Firestore as canonical persistence for sessions, ordered problems, solutions, and answer visibility
- [ ] Model sessions with `draft`, `live`, and `ended` states
- [ ] Support session creation, editing, starting, and ending in Officer Mode
- [ ] Keep session history available from the officer dashboard
- [ ] Store problem-level `answersVisible` and keep legacy session fields ignored
- [ ] Keep problem metadata separate from solution documents; expose live/ended metadata publicly and keep draft metadata officer-only

## Problem and solution preparation

- [ ] Add multiple problems to a session
- [ ] Create, edit, and delete problems in Officer Mode
- [ ] Reorder problems in a session
- [ ] Store a problem title, description, examples, order, and `answersVisible`; member metadata reads are public for live and ended sessions
- [ ] Prepare Python, Java, and C++ solutions for each problem
- [ ] Store prepared static output for each language
- [ ] Add Monaco editors editable in Officer Mode and read-only in Member Mode
- [ ] Present Python, Java, and C++ together without source-language selection

## Live presentation

- [ ] Build an officer dashboard for session and presentation management
- [ ] Publish live sessions to the anonymous public view
- [ ] Add **Show Answers** and **Hide Answers** controls
- [ ] Update per-problem `answersVisible` in live member views in realtime
- [ ] Keep problem selection local and independent in each view
- [ ] Keep ended sessions in officer history and expose them in a public Past sessions archive
- [ ] Make every fixed-language Solution public for ended sessions without rewriting Problems

## Presentation UX and accessibility

- [ ] Keep problem text and examples readable during projection
- [ ] Make the three language panels easy to compare side by side
- [ ] Add responsive layouts for officer and member views
- [ ] Support keyboard-accessible controls and visible focus states
- [ ] Make editor content read-only to members
- [ ] Show clear session status and answer visibility state

## Testing and reliability

- [ ] Test Firestore Security Rules for anonymous and authenticated access
- [ ] Test session lifecycle, problem ordering, and legacy session-field compatibility
- [ ] Test **Show Answers** and **Hide Answers** behavior in member views
- [ ] Test realtime answer visibility and independent member problem selection
- [ ] Test the public past-session archive and ended Solution access
- [ ] Test Officer Mode editing and Member Mode read-only behavior
- [ ] Add an end-to-end officer-to-member presentation flow

## Documentation

- [x] Define live showcase product scope and non-goals
- [x] Document the officer and member experience, persistence, and answer access boundary
- [ ] Add implementation architecture notes as the Firebase design is implemented
- [ ] Add deployment instructions after hosting is selected

## Explicit product exclusions

CappyCode does not translate or generate code, use AI or coding models at runtime, parse source languages, compile or execute programs, run online judging, or use browser storage as canonical persistence. These are outside the live solution showcase product scope.
