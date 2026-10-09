# Fall 2026 Problem Bank import

The review manifest is [`data/problem-bank/fall-2026-manifest.json`](../data/problem-bank/fall-2026-manifest.json). It maps classified occurrences to canonical Problems, records exclusions and irreducible ambiguities, and includes source deck references, approaches, solutions, and historical decisions. It does not authorize a production write.

Run the importer to validate the complete manifest and print a read-only plan:

```bash
npm run problem-bank:import -- --manifest=data/problem-bank/fall-2026-manifest.json
```

The command defaults to `cappycode-f133c` and Firestore `(default)`. It uses Google Application Default Credentials for reads; configure those outside the repository with the minimum Firestore read access needed. It does not use `.env.local`, a browser Firebase client, or checked-in credentials. The write path also checks any declared `GCLOUD_PROJECT` or `GOOGLE_CLOUD_PROJECT` value against the expected project.

The production Bank model currently supports `leetcodeUrl`, not a generic external source field. `canonicalSourceUrl` is manifest provenance; only a valid LeetCode Problem URL is written or compared as `leetcodeUrl`. Codeforces, CSES, AtCoder, and contest archive URLs remain in the manifest and are not persisted in Firestore.

New Bank records are unpublished and start with `hiddenByLiveSessionId: null`. Reconciliation only fills missing values. Differences from existing content are conflicts, and an existing record's publication and live-hiding fields are preserved. Strong identity matches under another Bank document ID reconcile that existing record and use its ID for historical references. Each Problem hierarchy is applied in one Firestore transaction. A provenance transaction changes only the historical snapshot's `bankProblemId` and the parent Session's distinct `bankProblemIds` list. A reviewed historical skip remains visible and causes no mutation; only a pending historical decision blocks the plan.

Production import requires both `--write-production` and `--expected-project-id=cappycode-f133c`. The importer refuses the write path while any conflict or pending historical snapshot exists. Explicitly irreducible source ambiguities and proposed difficulty normalizations are printed for human review. Gate 5A does not run the write path.
