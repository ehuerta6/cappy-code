import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  assertWriteAuthorization,
  buildImportPlan,
  classifyExisting,
  deterministicProblemId,
  importTarget,
  isImportPlanBlocked,
  isLeetCodeUrl,
  mergeBankProblemIds,
  missingBankFields,
  newBankDocument,
  provenanceBackfillPatch,
  runImportPlan,
  validateManifest,
  type ExistingProblemState,
  type ImportManifest,
  type ImportProblem,
} from './problem-bank-import';

const manifest = JSON.parse(
  readFileSync(
    new URL('../../data/problem-bank/fall-2026-manifest.json', import.meta.url),
    'utf8',
  ),
) as ImportManifest;

function existingState(problem: ImportProblem): ExistingProblemState {
  return {
    data: {
      title: problem.title,
      description: problem.description,
      constraints: problem.constraints,
      exampleInput: problem.exampleInput,
      exampleOutput: problem.exampleOutput,
      category: problem.category,
      difficulty: problem.difficulty,
      ...(isLeetCodeUrl(problem.canonicalSourceUrl)
        ? { leetcodeUrl: problem.canonicalSourceUrl }
        : {}),
      hiddenByLiveSessionId: null,
      approachesEnabled: true,
      approachTagSummary: [
        ...new Set(problem.approaches.flatMap(({ tags }) => tags)),
      ].sort((a, b) => a.localeCompare(b)),
    },
    approaches: Object.fromEntries(
      problem.approaches.map((approach) => [
        approach.id,
        {
          data: {
            name: approach.name,
            tags: approach.tags,
            order: approach.order,
          },
          solutions: Object.fromEntries(
            Object.entries(approach.solutions).map(([language, solution]) => [
              language,
              { ...solution },
            ]),
          ),
        },
      ]),
    ),
  };
}

describe('Problem Bank import manifest', () => {
  it('uses deterministic canonical IDs and maps repeated occurrences to one Problem', () => {
    const twoSum = manifest.problems.find(
      (problem) => problem.title === 'Two Sum',
    )!;
    expect(deterministicProblemId('leetcode', '1-two-sum')).toBe(twoSum.id);
    expect(twoSum.occurrences).toHaveLength(3);
    expect(new Set(twoSum.occurrences.map(() => twoSum.id))).toEqual(
      new Set([twoSum.id]),
    );
  });

  it('does not merge similarly named problems with different source identities', () => {
    expect(deterministicProblemId('codeforces', '363b-fence')).not.toBe(
      deterministicProblemId('codeforces', '474b-worms'),
    );
    expect(deterministicProblemId('cic', 'cappy-spring-line-return')).not.toBe(
      deterministicProblemId('cic', 'cappy-spring-line-partition'),
    );
  });

  it('rejects incomplete entries and unsupported approach tags', () => {
    const incomplete = structuredClone(manifest);
    incomplete.problems[0].title = ' ';
    expect(() => validateManifest(incomplete)).toThrow(/title/);

    const unsupported = structuredClone(manifest);
    unsupported.problems[0].approaches[0].tags.push('');
    expect(() => validateManifest(unsupported)).toThrow(/non-empty tag/);
  });

  it('does not include an unresolved difficulty in an executable plan', () => {
    const unreviewed = structuredClone(manifest);
    unreviewed.problems[0].difficultyProvenance.reviewed = false;
    expect(() => validateManifest(unreviewed)).toThrow(/difficultyProvenance/);
  });

  it('keeps future and unpresented content excluded from the executable Problems', () => {
    expect(
      manifest.excludedOccurrences.some((item) =>
        item.title.includes('Count and Say'),
      ),
    ).toBe(true);
    expect(
      manifest.problems.some((problem) => problem.title === 'Count and Say'),
    ).toBe(true);
    expect(
      manifest.excludedOccurrences.some((item) =>
        item.reason.includes('no presenter'),
      ),
    ).toBe(true);
    expect(manifest.reviewedHistoricalSkips).toHaveLength(1);
    expect(manifest.pendingHistoricalReviews).toHaveLength(0);
  });

  it('classifies every inventory occurrence exactly once and reports branch counts', () => {
    validateManifest(manifest);
    const plan = buildImportPlan(manifest, { problems: {}, sessions: {} });
    expect(plan.inventoryOccurrencesByBranch).toEqual({
      intro: 14,
      general: 27,
      icpc: 34,
    });
    expect(plan.occurrencesByBranch).toEqual({
      intro: 14,
      general: 20,
      icpc: 32,
    });
    expect(plan.unresolvedOccurrences).toBe(0);
    expect(plan.irreducibleAmbiguities).toHaveLength(6);
    expect(plan.reviewedHistoricalSkips).toBe(1);
    expect(plan.unresolvedHistoricalSnapshots).toBe(0);
  });
});

describe('Problem Bank import planning safety', () => {
  it('dry run invokes no write operation', async () => {
    const plan = buildImportPlan(manifest, { problems: {}, sessions: {} });
    const apply = vi.fn(async () => 'written');
    await expect(
      runImportPlan(plan, { writeProduction: false, apply }),
    ).resolves.toEqual({ applied: false });
    expect(apply).not.toHaveBeenCalled();
  });

  it('requires the explicit production flag and exact expected project', () => {
    expect(() => assertWriteAuthorization(false, undefined)).not.toThrow();
    expect(() => assertWriteAuthorization(true, undefined)).toThrow(
      /expected-project-id/,
    );
    expect(() => assertWriteAuthorization(true, 'wrong-project')).toThrow(
      /expected-project-id/,
    );
    expect(() =>
      assertWriteAuthorization(true, importTarget.projectId),
    ).not.toThrow();
  });

  it('classifies an exact existing canonical match as unchanged on rerun', () => {
    const problem = manifest.problems[1];
    const existing = existingState(problem);
    expect(classifyExisting(problem, existing)).toBe('UNCHANGED');
    expect(classifyExisting(problem, existing)).toBe('UNCHANGED');
  });

  it('fills missing parts of an exact canonical match without recreating it', () => {
    const problem = manifest.problems[1];
    const existing = existingState(problem);
    delete existing.approaches[problem.approaches[0].id];
    expect(classifyExisting(problem, existing)).toBe('RECONCILE');
  });

  it('surfaces officer edits as conflicts instead of overwriting them', () => {
    const problem = manifest.problems[1];
    const existing = existingState(problem);
    existing.data.description = 'Officer-authored replacement';
    expect(classifyExisting(problem, existing)).toBe('CONFLICT');
  });

  it('plans a strong URL match under a different Bank ID without creating a duplicate', () => {
    const problem = manifest.problems.find(
      (entry) => entry.title === 'Two Sum',
    )!;
    const existing = existingState(problem);
    const plan = buildImportPlan(manifest, {
      problems: { 'production-random-id': existing },
      identityMatches: { [problem.id]: 'production-random-id' },
      sessions: {},
    });
    const planned = plan.problems.find(
      (entry) => entry.problemId === problem.id,
    )!;
    expect(planned.targetProblemId).toBe('production-random-id');
    expect(planned.status).toBe('UNCHANGED');
    expect(plan.counts.CREATE).toBe(manifest.problems.length - 1);
    expect(plan.counts.CONFLICT).toBe(0);
  });

  it('keeps non-LeetCode source URLs in the manifest and out of leetcodeUrl', () => {
    const problem = structuredClone(manifest.problems[1]);
    problem.identity = { source: 'codeforces', identifier: '363b-fence' };
    problem.id = deterministicProblemId('codeforces', '363b-fence');
    problem.canonicalSourceUrl =
      'https://codeforces.com/problemset/problem/363/B';
    expect(newBankDocument(problem)).not.toHaveProperty('leetcodeUrl');
    expect(missingBankFields(problem, {})).not.toHaveProperty('leetcodeUrl');
    expect(isLeetCodeUrl(problem.canonicalSourceUrl)).toBe(false);
    expect(classifyExisting(problem, existingState(problem))).toBe('UNCHANGED');
  });

  it('reconciles an exact non-LeetCode identity to its existing Bank ID', () => {
    const problem = structuredClone(
      manifest.problems.find(
        (entry) => entry.identity.identifier === '363b-fence',
      )!,
    );
    const existingId = 'existing-codeforces-bank-id';
    const plan = buildImportPlan(manifest, {
      problems: { [existingId]: existingState(problem) },
      identityMatches: { [problem.id]: existingId },
      sessions: {},
    });
    const entry = plan.problems.find((item) => item.problemId === problem.id)!;
    expect(entry.targetProblemId).toBe(existingId);
    expect(entry.status).toBe('UNCHANGED');
    expect(plan.counts.CREATE).toBe(manifest.problems.length - 1);
  });

  it('does not match similar titles without a strong canonical identity', () => {
    const problem = manifest.problems.find(
      (entry) => entry.title === 'Two Sum',
    )!;
    const similar = existingState(problem);
    similar.data.title = 'Two Sum Variant';
    similar.data.leetcodeUrl = undefined;
    const plan = buildImportPlan(manifest, {
      problems: { 'random-bank-id': similar },
      identityConflicts: {
        [problem.id]: 'Exact title exists without verifiable identity.',
      },
      sessions: {},
    });
    expect(
      plan.problems.find((entry) => entry.problemId === problem.id)?.status,
    ).toBe('CONFLICT');
  });

  it('uses the matched Bank ID in historical backfill plans', () => {
    const problem = structuredClone(
      manifest.problems.find((entry) => entry.title === 'Two Sum')!,
    );
    problem.provenanceBackfills = [
      {
        sessionId: 's1',
        problemId: 'p1',
        exactMatchReason: 'Exact snapshot match.',
        expectedSnapshot: {
          title: 'Two Sum',
          description: problem.description,
          exampleInput: problem.exampleInput,
          exampleOutput: problem.exampleOutput,
          constraints: problem.constraints,
        },
      },
    ];
    const plan = buildImportPlan(
      { ...manifest, problems: [problem] },
      {
        problems: { 'existing-random-id': existingState(problem) },
        identityMatches: { [problem.id]: 'existing-random-id' },
        sessions: {
          s1: {
            data: { bankProblemIds: [] },
            problems: {
              p1: {
                title: 'Two Sum',
                description: problem.description,
                exampleInput: problem.exampleInput,
                exampleOutput: problem.exampleOutput,
                constraints: problem.constraints,
              },
            },
          },
        },
      },
    );
    expect(plan.problems[0].targetProblemId).toBe('existing-random-id');
    expect(plan.problems[0].backfills[0].targetProblemId).toBe(
      'existing-random-id',
    );
  });

  it('creates records without publication state and ignores legacy publication differences', () => {
    const problem = manifest.problems[1];
    expect(newBankDocument(problem)).toMatchObject({
      hiddenByLiveSessionId: null,
    });
    expect(newBankDocument(problem)).not.toHaveProperty('isPublished');
    expect(newBankDocument(problem)).not.toHaveProperty('isPublic');
    const legacy = existingState(problem);
    legacy.data.isPublished = false;
    legacy.data.isPublic = true;
    expect(classifyExisting(problem, legacy)).toBe('UNCHANGED');
    const update = missingBankFields(problem, existingState(problem).data);
    expect(update).not.toHaveProperty('isPublished');
    expect(update).not.toHaveProperty('hiddenByLiveSessionId');
  });

  it('backfills only the two provenance references and deduplicates parent IDs', () => {
    const patch = provenanceBackfillPatch(
      'bank-one',
      { title: 'Original snapshot' },
      ['existing', 'bank-one'],
    );
    expect(patch.snapshotPatch).toEqual({ bankProblemId: 'bank-one' });
    expect(patch.sessionPatch).toEqual({});
    expect(mergeBankProblemIds(['existing'], ['bank-one', 'bank-one'])).toEqual(
      ['existing', 'bank-one'],
    );
    expect(
      mergeBankProblemIds(
        ['existing', 'existing', 'bank-one', 'bank-one'],
        ['bank-one'],
      ),
    ).toEqual(['existing', 'existing', 'bank-one']);
    expect(
      provenanceBackfillPatch('bank-one', { bankProblemId: 'bank-one' }, [
        'existing',
      ]).sessionPatch,
    ).toEqual({
      bankProblemIds: ['existing', 'bank-one'],
    });
  });

  it('reports reviewed historical skips without blocking and keeps pending reviews blocking', () => {
    const reviewed = buildImportPlan(
      { ...manifest, unresolvedOccurrences: [] },
      { problems: {}, sessions: {} },
    );
    expect(reviewed.reviewedHistoricalSkips).toBe(1);
    expect(reviewed.unresolvedHistoricalSnapshots).toBe(0);
    expect(isImportPlanBlocked(reviewed)).toBe(false);
    const ambiguityPlan = buildImportPlan(manifest, {
      problems: {},
      sessions: {},
    });
    expect(ambiguityPlan.irreducibleAmbiguities).toHaveLength(6);
    expect(isImportPlanBlocked(ambiguityPlan)).toBe(false);
    expect(
      reviewed.problems
        .flatMap((problem) => problem.backfills)
        .some(
          (entry) =>
            entry.sessionId === '51HKVOkGH7YVes7XcoSP' &&
            entry.problemId === 'MjFosCiVslNCIX1VgTn6',
        ),
    ).toBe(false);

    const pendingManifest = {
      ...manifest,
      unresolvedOccurrences: [],
      pendingHistoricalReviews: [
        {
          sessionId: 's1',
          problemId: 'p1',
          title: 'Old prompt',
          reason: 'The snapshot is still under review.',
        },
      ],
    };
    const pending = buildImportPlan(pendingManifest, {
      problems: {},
      sessions: {},
    });
    expect(pending.unresolvedHistoricalSnapshots).toBe(1);
    expect(isImportPlanBlocked(pending)).toBe(true);
  });

  it('blocks pending difficulty approvals and allows all human-reviewed proposals', () => {
    const pendingManifest = structuredClone(manifest);
    pendingManifest.problems[0].difficultyProvenance.requiresHumanApproval = true;
    const pending = buildImportPlan(pendingManifest, {
      problems: {},
      sessions: {},
    });
    expect(pending.pendingDifficultyApprovals).toHaveLength(1);
    expect(isImportPlanBlocked(pending)).toBe(true);

    const reviewed = buildImportPlan(manifest, { problems: {}, sessions: {} });
    expect(reviewed.pendingDifficultyApprovals).toHaveLength(0);
    expect(
      manifest.problems.filter(
        (problem) => problem.difficultyProvenance.proposed,
      ),
    ).toHaveLength(27);
    expect(
      manifest.problems
        .filter((problem) => problem.difficultyProvenance.proposed)
        .every(
          (problem) =>
            problem.difficultyProvenance.humanReviewed === true &&
            !problem.difficultyProvenance.requiresHumanApproval,
        ),
    ).toBe(true);
    expect(isImportPlanBlocked(reviewed)).toBe(false);
  });

  it('surfaces the current production Two Sum record as a conflict', () => {
    const problem = manifest.problems.find(
      (entry) => entry.title === 'Two Sum',
    )!;
    const existing = existingState(problem);
    existing.data.title = 'TWO SUM';
    existing.data.description = 'EWQEWQEW';
    const plan = buildImportPlan(manifest, {
      problems: { [problem.id]: existing },
      sessions: {},
    });
    expect(plan.counts.CONFLICT).toBe(1);
    expect(plan.conflicts).toContain('Two Sum');
    expect(isImportPlanBlocked(plan)).toBe(true);
  });
});
