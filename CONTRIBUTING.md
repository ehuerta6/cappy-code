# Contributing

Thanks for helping improve CappyCode. Keep contributions focused on the live
solution showcase described in the [project scope](docs/PROJECT_SCOPE.md).

## Before you start

- Check the [open issues](https://github.com/ehuerta6/cappy-code/issues) and
  pull requests for existing work on the same change.
- For a new feature or behavior change, open an Issue first. Describe the
  problem, who it affects, the expected behavior, and how completion can be
  recognized. Keep proposals within the project's documented scope.
- For a small correction, such as a typo, link, or clearly broken behavior, you
  can open a pull request directly and explain the problem in it.
- Ask an Issue's author or maintainer before taking over substantial work that
  is already in progress.

## Prepare a change

1. Fork the repository or use a repository branch if you have write access.
2. Start a short-lived branch from the latest `main`. Use a prefix such as
   `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, or `ci/` and a short
   description. Follow [Git & Pull Request Conventions](docs/GIT_CONVENTIONS.md)
   for branch names, Conventional Commit messages, and merge practices.
3. Install the supported Node.js and npm versions and start the local Firebase
   emulators as described in [Local development](README.md#local-development)
   and [Firebase emulator setup](docs/FIREBASE.md#local-emulator-development).
4. Make the smallest change that meets the agreed Issue. Keep Firestore Rules
   as the authorization boundary for protected data, and preserve anonymous,
   read-only Member access.

## Open a pull request

- Use the repository's pull request template and link the related Issue with
  `Closes #<issue-number>`.
- Explain the problem, summarize the change, and list the checks you actually
  ran with their results. Include screenshots for visible UI changes when they
  help reviewers assess them.
- Call out Firestore Security Rules changes explicitly. Rules deploy separately
  from the application; a pull request does not deploy either one.
- Keep the pull request focused and respond to review feedback with follow-up
  commits.

Pull requests are reviewed before they are merged. Do not merge your own change
unless a maintainer has explicitly asked you to do so.
