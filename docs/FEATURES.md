# Feature Tracker

This file tracks the product implementation at a high level. It reflects the intended officer-focused CIC Intro solution showcase.

## Showcase Experience

- [ ] Add prepared problem tabs
- [ ] Add Python, Java, and C++ Monaco editors side by side
- [ ] Add one source-language selector for each translation
- [ ] Keep all three language panes available for comparison
- [ ] Add a clear/reset action for the active problem
- [ ] Add a presentation-friendly responsive layout

## Translation

- [ ] Add an explicit Translate action
- [ ] Send the selected source language and source code to `POST /api/translate`
- [ ] Call a coding model from the server-side endpoint
- [ ] Keep model credentials in server-side configuration
- [ ] Return structured Python, Java, and C++ translations
- [ ] Return concise “What changed?” explanations
- [ ] Preserve the intended algorithm and behavior when possible
- [ ] Show a translation loading state
- [ ] Handle invalid input, model errors, and incomplete code with useful messages
- [ ] Avoid starting translation on edits, tab changes, or typing pauses

## Session Persistence and Privacy

- [ ] Optionally persist the current session in browser `localStorage`
- [ ] Restore the local session on the same browser and device
- [ ] Keep session persistence independent of accounts and server storage
- [ ] Avoid storing unnecessary user code on a server

## Educational Explanations

- [ ] Explain meaningful syntax and type differences
- [ ] Explain equivalent collection and standard-library choices
- [ ] Keep explanations relevant to the selected solution
- [ ] Write explanations for CIC Intro students viewing the presentation
- [ ] Add optional Cappy educational notes without distracting from code

## Safety and Reliability

- [ ] Validate translation API input
- [ ] Limit maximum code size and request volume
- [ ] Keep model credentials out of client-side code
- [ ] Render generated code as untrusted text
- [ ] Handle model and API errors without losing the officer's session

## Accessibility and UX

- [ ] Make problem tabs and language selection keyboard accessible
- [ ] Provide clear loading and error states
- [ ] Keep code readable when projected
- [ ] Support a usable layout on smaller screens

## Testing

- [ ] Set up or maintain unit tests for request validation and result parsing
- [ ] Test source-language selection
- [ ] Test explicit translation flow
- [ ] Test API error handling
- [ ] Test optional browser-local session persistence
- [ ] Add an end-to-end showcase flow test

## Documentation

- [x] Add project README
- [x] Add project scope
- [x] Add feature tracker
- [x] Add Git and PR conventions
- [x] Add AI development guidelines
- [ ] Add local setup instructions after stack selection
- [ ] Add implementation notes as features are built
- [ ] Add deployment instructions after hosting is selected

## Future Ideas

These are not part of the initial scope unless they directly improve an officer-led session:

- [ ] Highlight corresponding code lines or concepts across languages
- [ ] Shareable showcase sessions
- [ ] Translation history
- [ ] Additional programming languages

Future items should only be promoted into active development if they support the officer-led educational goal.
