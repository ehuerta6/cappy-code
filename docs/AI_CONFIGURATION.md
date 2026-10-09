# AI Configuration Adoption

Use this manual process when reviewing or updating CappyCode's adopted reusable configuration against the canonical [`ehuerta6/ai-setup`](https://github.com/ehuerta6/ai-setup) repository.

1. Read CappyCode's `AGENTS.md`, relevant product and architecture docs, Git conventions, and current `.codex` files.
2. Obtain the latest canonical `main` source. Use a local checkout if available; otherwise fetch files through the connected GitHub repository tools. A temporary clone is also suitable when network access permits.
3. Record the canonical commit or file revisions used for the comparison. Read canonical `AGENTS.md`, `README.md`, `WORKFLOWS.md`, and `registry.yaml`, then inspect counterparts for each relevant local skill, rule, agent, and template.
4. Compare behavior and instructions, not only metadata. Use project-audit for drift and duplication; use ai-config-builder in Adopt mode to classify artifacts as `ADD`, `KEEP EXISTING`, `REPLACE`, or `SKIP`.
5. Preserve CappyCode product decisions and `docs/GIT_CONVENTIONS.md`. Adopt only changes that materially improve this project. Preserve required source attribution and license notices for adapted material.
6. Verify changed references, review the full diff, and run applicable repository checks. Report the canonical revision, classifications, modifications, skipped artifacts, and verification results.

Do not edit the canonical repository or copy its registry statuses into CappyCode. Registry adoption status remains controlled by explicit project decisions and usage evidence. Do not add synchronization automation unless repeated manual comparisons show a concrete need.
