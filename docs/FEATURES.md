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
- [ ] Enforce Firestore Security Rules so draft session/problem metadata is officer-only and member reads follow session publication rules
- [ ] Require the parent problem's `answersVisible` to permit anonymous reads of its solution documents

## Firestore data and session lifecycle

- [ ] Use Firestore as canonical persistence for sessions, ordered problems, solutions, and presentation state
- [ ] Model sessions with `draft`, `live`, and `ended` states
- [ ] Support session creation, editing, starting, and ending in Officer Mode
- [ ] Keep session history available from the officer dashboard
- [ ] Store session-level `activeProblemId` and problem-level `answersVisible`
- [ ] Keep problem metadata separate from protected solution documents; expose metadata only when session status/publication rules permit member access

## Problem and solution preparation

- [ ] Add multiple problems to a session
- [ ] Create, edit, and delete problems in Officer Mode
- [ ] Reorder problems in a session
- [ ] Store a problem title, description, examples, order, and `answersVisible`; member reads of metadata depend on session publication status
- [ ] Prepare Python, Java, and C++ solutions for each problem
- [ ] Store prepared static output for each language
- [ ] Add Monaco editors editable in Officer Mode and read-only in Member Mode
- [ ] Present Python, Java, and C++ together without source-language selection

## Live presentation

- [ ] Build an officer dashboard for session and presentation management
- [ ] Publish live sessions to the anonymous public view
- [ ] Add **Show Answers** and **Hide Answers** controls
- [ ] Synchronize session `activeProblemId` and per-problem `answersVisible` to eligible member views in realtime
- [ ] Add member-side **Follow Presenter** behavior using the session's `activeProblemId`
- [ ] Keep ended sessions in session history

## Presentation UX and accessibility

- [ ] Keep problem text and examples readable during projection
- [ ] Make the three language panels easy to compare side by side
- [ ] Add responsive layouts for officer and member views
- [ ] Support keyboard-accessible controls and visible focus states
- [ ] Make editor content read-only to members
- [ ] Show clear session status and answer visibility state

## Testing and reliability

- [ ] Test Firestore Security Rules for anonymous and authenticated access
- [ ] Test session lifecycle, problem ordering, and `activeProblemId` updates
- [ ] Test **Show Answers** and **Hide Answers** behavior in member views
- [ ] Test realtime presentation updates and **Follow Presenter**
- [ ] Test Officer Mode editing and Member Mode read-only behavior
- [ ] Add an end-to-end officer-to-member presentation flow

## Documentation

- [x] Define live showcase product scope and non-goals
- [x] Document the officer and member experience, persistence, and answer access boundary
- [ ] Add implementation architecture notes as the Firebase design is implemented
- [ ] Add deployment instructions after hosting is selected

## Explicit product exclusions

CappyCode does not translate or generate code, use AI or coding models at runtime, parse source languages, compile or execute programs, run online judging, or use browser storage as canonical persistence. These are outside the live solution showcase product scope.
