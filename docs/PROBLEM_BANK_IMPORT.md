# Fall 2026 Problem Bank import

The review manifest is [`data/problem-bank/fall-2026-manifest.json`](../data/problem-bank/fall-2026-manifest.json). It maps inventory occurrences to canonical Problems, keeps unresolved candidates visible, and records every proposed Solution and historical reference. It does not authorize a production write.

Run the importer to validate the complete manifest and print a read-only plan:

```bash
npm run problem-bank:import
```

The command defaults to `cappycode-f133c` and Firestore `(default)`. It uses Google Application Default Credentials for reads; configure those outside the repository with the minimum Firestore read access needed. It does not use `.env.local`, a browser Firebase client, or checked-in credentials. The write path also checks any declared `GCLOUD_PROJECT` or `GOOGLE_CLOUD_PROJECT` value against the expected project.

New Bank records are unpublished and start with `hiddenByLiveSessionId: null`. Reconciliation only fills missing values. Differences from existing content are conflicts, and an existing record's publication and live-hiding fields are preserved. Each Problem hierarchy is applied in one Firestore transaction. A provenance transaction changes only the historical snapshot's `bankProblemId` and the parent Session's distinct `bankProblemIds` list.

Production import requires both `--write-production` and `--expected-project-id=cappycode-f133c`. The importer refuses the write path while any source occurrence or historical snapshot remains unresolved or any conflict exists. Gate 5A does not run that path.
