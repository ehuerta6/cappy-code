# Feature Tracker

This file tracks the product implementation at a high level.

It is intentionally focused on logical features rather than individual commits.

## Foundation

- [ ] Initialize the Next.js web application with React and TypeScript
- [ ] Add project linting
- [ ] Add type checking
- [ ] Add formatting configuration
- [ ] Add production build command
- [ ] Document local development setup
- [ ] Add basic GitHub Actions CI checks

## Editor Experience

- [ ] Add Monaco as the main code editor
- [ ] Add Python syntax support
- [ ] Add Java syntax support
- [ ] Add C++ syntax support
- [ ] Add source-language selector
- [ ] Add translated-language tabs
- [ ] Preserve editor content while switching translated views
- [ ] Add a clear/reset action

## Translation

- [ ] Define the language-neutral CappyCode IR
- [ ] Add the IR type system
- [ ] Add the Python parser / adapter
- [ ] Add the Java parser / adapter
- [ ] Add the C++ parser / adapter
- [ ] Add the Python emitter
- [ ] Add the Java emitter
- [ ] Add the C++ emitter
- [ ] Add the translation service that connects parsers, IR, and emitters
- [ ] Add the translation API endpoint
- [ ] Return structured translation results
- [ ] Preserve the original algorithm
- [ ] Preserve expected time complexity
- [ ] Preserve expected space complexity

## Automatic Translation

- [ ] Add debounce after typing
- [ ] Prevent requests on every keystroke
- [ ] Show translation loading state
- [ ] Cancel or ignore stale translation responses
- [ ] Avoid translating empty input
- [ ] Handle incomplete code gracefully
- [ ] Add manual retry when translation fails

## Educational Explanations

- [ ] Add "What changed?" section
- [ ] Explain equivalent data structures
- [ ] Explain important syntax differences
- [ ] Explain relevant type differences
- [ ] Keep explanations beginner-friendly
- [ ] Avoid explanations that are unrelated to the student's solution
- [ ] Add optional Cappy educational notes

## Error Handling

- [ ] Handle translation service errors
- [ ] Handle unsupported or non-interview-style input
- [ ] Show useful user-facing error messages
- [ ] Prevent stale errors from replacing newer results

## Safety and Reliability

- [ ] Add reasonable request limits
- [ ] Validate API input
- [ ] Limit maximum code size
- [ ] Avoid rendering untrusted HTML from generated output
- [ ] Add basic observability/logging without storing unnecessary user code

## Accessibility and UX

- [ ] Keyboard-accessible language controls
- [ ] Clear loading indicators
- [ ] Clear error states
- [ ] Responsive layout
- [ ] Readable code font and sizing
- [ ] Basic mobile behavior

## Testing

- [ ] Set up Vitest
- [ ] Unit tests for translation request logic
- [ ] Tests for debounce behavior
- [ ] Tests for stale-response handling
- [ ] Tests for language-selection behavior
- [ ] API validation tests
- [ ] Basic end-to-end translation flow test

## Documentation

- [x] Add project README
- [x] Add project scope
- [x] Add feature tracker
- [x] Add Git and PR conventions
- [x] Add AI development guidelines
- [ ] Add local setup instructions after stack selection
- [ ] Add architecture notes after initial implementation
- [ ] Add deployment instructions after hosting is selected

## Future Ideas

These are intentionally not part of the initial scope.

- [ ] Side-by-side three-language comparison mode
- [ ] Highlight corresponding lines or concepts
- [ ] Shareable solution links
- [ ] Optional example problems
- [ ] Complexity explanation
- [ ] Translation history
- [ ] More languages

Future items should only be promoted into active development if they support the project's educational goal.
