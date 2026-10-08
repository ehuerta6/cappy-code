import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  assertWriteAuthorization,
  buildImportPlan,
  classifyExisting,
  deterministicProblemId,
  importTarget,
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
      leetcodeUrl: problem.sourceUrl,
      isPublished: true,
      hiddenByLiveSessionId: null,
      approachesEnabled: true,
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
    expect(twoSum.occurrences).toHaveLength(2);
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
    unsupported.problems[0].approaches[0].tags.push('Heap / Priority Queue');
    expect(() => validateManifest(unsupported)).toThrow(/unsupported tag/);
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
    ).toBe(false);
    expect(manifest.unresolvedHistoricalSnapshots).toHaveLength(1);
  });

  it('classifies every inventory occurrence exactly once and reports branch counts', () => {
    validateManifest(manifest);
    const plan = buildImportPlan(manifest, { problems: {}, sessions: {} });
    expect(plan.inventoryOccurrencesByBranch).toEqual({
      intro: 14,
      general: 26,
      icpc: 34,
    });
    expect(plan.occurrencesByBranch).toEqual({ intro: 8, general: 3, icpc: 0 });
    expect(plan.unresolvedOccurrences).toBe(63);
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

  it('creates new records unpublished and preserves existing publication intent', () => {
    const problem = manifest.problems[1];
    expect(newBankDocument(problem)).toMatchObject({
      isPublished: false,
      hiddenByLiveSessionId: null,
    });
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
  });
});
