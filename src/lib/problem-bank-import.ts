import { createHash } from 'node:crypto';
import { approachTags, languages } from './domain';

export const importTarget = {
  projectId: 'cappycode-f133c',
  databaseId: '(default)',
} as const;

export type ImportLanguage = (typeof languages)[number];
export type ImportCategory =
  'custom' | 'interview-style' | 'competitive-programming';
export type ImportDifficulty = 'easy' | 'medium' | 'hard';

export interface ImportSolution {
  code: string;
  timeComplexity: string;
  timeComplexityReason: string;
  spaceComplexity: string;
  spaceComplexityReason: string;
}

export interface ImportApproach {
  id: string;
  name: string;
  tags: string[];
  order: number;
  solutions: Record<ImportLanguage, ImportSolution>;
}

export interface ImportOccurrence {
  branch: 'intro' | 'general' | 'icpc';
  session: string;
  week: string;
  sourceRef: string;
  sourceDeckUrl?: string;
  decision: 'canonical-match' | 'new-canonical';
  classification?: 'canonical' | 'duplicate';
}

export interface PlannedBackfill {
  sessionId: string;
  problemId: string;
  targetProblemId: string;
  snapshotChanged: boolean;
  sessionChanged: boolean;
}

export interface ImportProblem {
  id: string;
  identity: { source: string; identifier: string };
  title: string;
  description: string;
  constraints: string;
  exampleInput: string;
  exampleOutput: string;
  category: ImportCategory;
  difficulty: ImportDifficulty;
  difficultyProvenance: {
    source: string;
    reason: string;
    reviewed: boolean;
    proposed?: boolean;
    requiresHumanApproval?: boolean;
  };
  canonicalSourceUrl?: string;
  occurrences: ImportOccurrence[];
  approaches: ImportApproach[];
  review: { approved: boolean; warnings: string[] };
  createOrReconcile: 'CREATE' | 'RECONCILE' | 'UNCHANGED' | 'CONFLICT';
  provenanceBackfills: Array<{
    sessionId: string;
    problemId: string;
    exactMatchReason: string;
    expectedSnapshot: {
      title: string;
      description: string;
      exampleInput: string;
      exampleOutput: string;
      constraints: string;
    };
  }>;
}

export interface ImportManifest {
  formatVersion: 1;
  target: typeof importTarget;
  cutoff: string;
  problems: ImportProblem[];
  excludedOccurrences: Array<{
    branch: string;
    session: string;
    sourceRef: string;
    title: string;
    reason: string;
    kind?: 'instructional-example' | 'future-unpresented' | 'not-presented';
    inventory?: boolean;
  }>;
  pendingHistoricalReviews: Array<{
    sessionId: string;
    problemId: string;
    title: string;
    reason: string;
  }>;
  reviewedHistoricalSkips: Array<{
    sessionId: string;
    problemId: string;
    title: string;
    reason: string;
    status: 'reviewed-skip';
  }>;
  unresolvedOccurrences: Array<{
    branch: string;
    session: string;
    sourceRef: string;
    title: string;
    reason: string;
    classification: 'irreducibly-ambiguous';
  }>;
}

export function deterministicProblemId(source: string, identifier: string) {
  const seed = `${source.trim().toLowerCase()}\n${identifier.trim().toLowerCase()}`;
  const slug = identifier
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const hash = createHash('sha256').update(seed).digest('hex').slice(0, 10);
  return `cappy-${slug || 'problem'}-${hash}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateManifest(
  value: unknown,
): asserts value is ImportManifest {
  if (!isObject(value) || value.formatVersion !== 1)
    throw new Error('Manifest formatVersion must be 1.');
  if (
    !isObject(value.target) ||
    value.target.projectId !== importTarget.projectId ||
    value.target.databaseId !== importTarget.databaseId
  )
    throw new Error('Manifest target must be cappycode-f133c / (default).');
  if (!Array.isArray(value.problems))
    throw new Error('Manifest problems must be an array.');
  if (!Array.isArray(value.excludedOccurrences))
    throw new Error('Manifest excludedOccurrences must be an array.');
  if (!Array.isArray(value.unresolvedOccurrences))
    throw new Error('Manifest unresolvedOccurrences must be an array.');
  if (!Array.isArray(value.pendingHistoricalReviews))
    throw new Error('Manifest pendingHistoricalReviews must be an array.');
  if (!Array.isArray(value.reviewedHistoricalSkips))
    throw new Error('Manifest reviewedHistoricalSkips must be an array.');
  for (const [index, entry] of value.reviewedHistoricalSkips.entries()) {
    if (
      !isObject(entry) ||
      entry.status !== 'reviewed-skip' ||
      !nonempty(entry.reason) ||
      !nonempty(entry.sessionId) ||
      !nonempty(entry.problemId) ||
      !nonempty(entry.title)
    )
      throw new Error(`reviewedHistoricalSkips[${index}] is incomplete.`);
  }
  for (const [index, entry] of value.pendingHistoricalReviews.entries()) {
    if (
      !isObject(entry) ||
      !nonempty(entry.reason) ||
      !nonempty(entry.sessionId) ||
      !nonempty(entry.problemId) ||
      !nonempty(entry.title)
    )
      throw new Error(`pendingHistoricalReviews[${index}] is incomplete.`);
  }

  const ids = new Set<string>();
  const occurrenceKeys = new Set<string>();
  const addOccurrenceKey = (entry: Record<string, unknown>, path: string) => {
    const fields = ['branch', 'session', 'sourceRef', 'title'];
    if (fields.some((field) => !nonempty(entry[field])))
      throw new Error(
        `${path} must identify a branch, Session, source reference, and title.`,
      );
    if (!['intro', 'general', 'icpc'].includes(String(entry.branch)))
      throw new Error(`${path}.branch is invalid.`);
    const key = fields
      .map((field) => String(entry[field]).trim().toLowerCase())
      .join('\n');
    if (occurrenceKeys.has(key))
      throw new Error(`${path} is duplicated or classified more than once.`);
    occurrenceKeys.add(key);
  };
  for (const [index, raw] of value.problems.entries()) {
    const path = `problems[${index}]`;
    if (!isObject(raw)) throw new Error(`${path} must be an object.`);
    const problem = raw as unknown as ImportProblem;
    if (
      !isObject(problem.identity) ||
      !nonempty(problem.identity.source) ||
      !nonempty(problem.identity.identifier)
    )
      throw new Error(`${path}.identity.source and identifier are required.`);
    const expectedId = deterministicProblemId(
      problem.identity?.source,
      problem.identity?.identifier,
    );
    if (problem.id !== expectedId)
      throw new Error(`${path}.id is not deterministic for its identity.`);
    if (ids.has(problem.id)) throw new Error(`${path}.id is duplicated.`);
    ids.add(problem.id);
    for (const field of [
      'title',
      'description',
      'constraints',
      'exampleInput',
      'exampleOutput',
    ] as const) {
      if (!nonempty(problem[field]))
        throw new Error(`${path}.${field} must be meaningful text.`);
    }
    if (
      !['custom', 'interview-style', 'competitive-programming'].includes(
        problem.category,
      )
    )
      throw new Error(`${path}.category is invalid.`);
    if (!['easy', 'medium', 'hard'].includes(problem.difficulty))
      throw new Error(`${path}.difficulty is invalid.`);
    if (
      !isObject(problem.difficultyProvenance) ||
      !nonempty(problem.difficultyProvenance.source) ||
      !nonempty(problem.difficultyProvenance.reason) ||
      problem.difficultyProvenance.reviewed !== true
    )
      throw new Error(
        `${path}.difficultyProvenance must be reviewed and explained.`,
      );
    if (
      problem.canonicalSourceUrl !== undefined &&
      (!nonempty(problem.canonicalSourceUrl) ||
        !/^https:\/\//i.test(problem.canonicalSourceUrl) ||
        !URL.canParse(problem.canonicalSourceUrl))
    )
      throw new Error(`${path}.canonicalSourceUrl must be a valid HTTPS URL.`);
    if (!Array.isArray(problem.occurrences) || problem.occurrences.length === 0)
      throw new Error(
        `${path}.occurrences must contain at least one CIC occurrence.`,
      );
    for (const [occurrenceIndex, occurrence] of problem.occurrences.entries()) {
      if (!['canonical', 'duplicate'].includes(occurrence.classification ?? ''))
        throw new Error(
          `${path}.occurrences[${occurrenceIndex}] needs a canonical or duplicate classification.`,
        );
      if (
        occurrence.sourceDeckUrl !== undefined &&
        (!URL.canParse(occurrence.sourceDeckUrl) ||
          !/^https:\/\//i.test(occurrence.sourceDeckUrl))
      )
        throw new Error(
          `${path}.occurrences[${occurrenceIndex}].sourceDeckUrl must be HTTPS.`,
        );
      addOccurrenceKey(
        { ...occurrence, title: problem.title },
        `${path}.occurrences[${occurrenceIndex}]`,
      );
    }
    if (!Array.isArray(problem.approaches) || problem.approaches.length === 0)
      throw new Error(`${path}.approaches must contain at least one Approach.`);
    if (problem.approaches.length > 100)
      throw new Error(
        `${path}.approaches exceeds the safe per-Problem transaction limit.`,
      );
    if (!isObject(problem.review) || !Array.isArray(problem.review.warnings))
      throw new Error(`${path}.review is invalid.`);
    if (problem.review.approved !== true || problem.review.warnings.length > 0)
      throw new Error(`${path} has unresolved review warnings.`);
    if (!Array.isArray(problem.provenanceBackfills))
      throw new Error(`${path}.provenanceBackfills must be an array.`);

    const approachIds = new Set<string>();
    const orders = new Set<number>();
    for (const [approachIndex, approach] of problem.approaches.entries()) {
      const approachPath = `${path}.approaches[${approachIndex}]`;
      if (!isObject(approach)) throw new Error(`${approachPath} is invalid.`);
      if (!nonempty(approach.id) || approachIds.has(approach.id))
        throw new Error(`${approachPath}.id must be nonempty and unique.`);
      approachIds.add(approach.id);
      if (!nonempty(approach.name))
        throw new Error(`${approachPath}.name is required.`);
      if (
        !Number.isInteger(approach.order) ||
        approach.order < 0 ||
        orders.has(approach.order)
      )
        throw new Error(
          `${approachPath}.order must be a unique nonnegative integer.`,
        );
      orders.add(approach.order);
      if (
        !Array.isArray(approach.tags) ||
        approach.tags.some((tag) => !approachTags.includes(tag as never))
      )
        throw new Error(`${approachPath}.tags contains an unsupported tag.`);
      for (const language of languages) {
        const solution = approach.solutions?.[language];
        if (!isObject(solution))
          throw new Error(`${approachPath}.solutions.${language} is required.`);
        for (const field of [
          'code',
          'timeComplexity',
          'timeComplexityReason',
          'spaceComplexity',
          'spaceComplexityReason',
        ]) {
          if (!nonempty(solution[field]))
            throw new Error(
              `${approachPath}.solutions.${language}.${field} is required.`,
            );
        }
      }
    }
  }
  for (const [index, entry] of value.unresolvedOccurrences.entries()) {
    if (
      !isObject(entry) ||
      entry.classification !== 'irreducibly-ambiguous' ||
      !nonempty(entry.reason)
    )
      throw new Error(
        `unresolvedOccurrences[${index}] must be explicitly irreducibly ambiguous with an evidence-based reason.`,
      );
    addOccurrenceKey(
      entry as Record<string, unknown>,
      `unresolvedOccurrences[${index}]`,
    );
  }
  for (const [index, entry] of value.excludedOccurrences.entries())
    addOccurrenceKey(
      entry as Record<string, unknown>,
      `excludedOccurrences[${index}]`,
    );
}

export interface ExistingProblemState {
  data: Record<string, unknown>;
  approaches: Record<
    string,
    {
      data: Record<string, unknown>;
      solutions: Record<string, Record<string, unknown>>;
    }
  >;
}

export type PlanStatus = 'CREATE' | 'RECONCILE' | 'UNCHANGED' | 'CONFLICT';

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function classifyExisting(
  problem: ImportProblem,
  existing?: ExistingProblemState,
): PlanStatus {
  if (!existing) return 'CREATE';
  const fields = [
    'title',
    'description',
    'constraints',
    'exampleInput',
    'exampleOutput',
    'category',
    'difficulty',
    'leetcodeUrl',
  ] as const;
  const desired: Record<string, unknown> = { ...problem };
  let changes = false;
  for (const field of fields) {
    const expected =
      field === 'leetcodeUrl'
        ? isLeetCodeUrl(problem.canonicalSourceUrl)
          ? problem.canonicalSourceUrl
          : undefined
        : desired[field];
    const actual = existing.data[field];
    if (actual === undefined || actual === '') {
      if (expected !== undefined && expected !== '') changes = true;
    } else if (!same(actual, expected)) {
      return 'CONFLICT';
    }
  }
  for (const approach of problem.approaches) {
    const saved = existing.approaches[approach.id];
    if (!saved) {
      changes = true;
      continue;
    }
    for (const field of ['name', 'tags', 'order'] as const) {
      const actual = saved.data[field];
      const expected = approach[field];
      if (actual === undefined) changes = true;
      else if (!same(actual, expected)) return 'CONFLICT';
    }
    for (const language of languages) {
      const savedSolution = saved.solutions[language];
      if (!savedSolution) {
        changes = true;
        continue;
      }
      for (const field of [
        'code',
        'timeComplexity',
        'timeComplexityReason',
        'spaceComplexity',
        'spaceComplexityReason',
      ] as const) {
        const actual = savedSolution[field];
        const expected = approach.solutions[language][field];
        if (actual === undefined || actual === '') changes = true;
        else if (!same(actual, expected)) return 'CONFLICT';
      }
    }
  }
  return changes ? 'RECONCILE' : 'UNCHANGED';
}

export function newBankDocument(problem: ImportProblem) {
  return {
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
    isPublished: false,
    hiddenByLiveSessionId: null,
    approachesEnabled: true,
  };
}

export function missingBankFields(
  problem: ImportProblem,
  existing: Record<string, unknown>,
) {
  const expected: Record<string, unknown> = {
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
  };
  const missing = Object.fromEntries(
    Object.entries(expected).filter(
      ([key]) => existing[key] === undefined || existing[key] === '',
    ),
  );
  return missing;
}

export function missingSolutionFields(
  expected: ImportSolution,
  existing: Record<string, unknown>,
) {
  return Object.fromEntries(
    Object.entries(expected).filter(
      ([key, value]) =>
        existing[key] === undefined || (existing[key] === '' && value !== ''),
    ),
  );
}

export function mergeBankProblemIds(existing: unknown, additions: string[]) {
  if (
    existing !== undefined &&
    (!Array.isArray(existing) ||
      existing.some((value) => typeof value !== 'string'))
  )
    throw new Error(
      'Session bankProblemIds must be an array of strings before provenance backfill.',
    );
  const prior = (existing ?? []) as string[];
  const targets = new Set(additions);
  const seenTargets = new Set<string>();
  const result = prior.filter((id) => {
    if (!targets.has(id)) return true;
    if (seenTargets.has(id)) return false;
    seenTargets.add(id);
    return true;
  });
  for (const id of targets) {
    if (!seenTargets.has(id)) result.push(id);
  }
  return result;
}

export function provenanceBackfillPatch(
  bankProblemId: string,
  existingSnapshot: Record<string, unknown>,
  existingSessionIds: unknown,
) {
  const snapshotPatch =
    existingSnapshot.bankProblemId === bankProblemId ? {} : { bankProblemId };
  const sessionIds = mergeBankProblemIds(existingSessionIds, [bankProblemId]);
  const currentIds = Array.isArray(existingSessionIds)
    ? existingSessionIds.filter(
        (value): value is string => typeof value === 'string',
      )
    : [];
  const sessionPatch =
    currentIds.length === sessionIds.length &&
    currentIds.every((value, index) => value === sessionIds[index])
      ? {}
      : { bankProblemIds: sessionIds };
  return { snapshotPatch, sessionPatch };
}

export function assertWriteAuthorization(
  writeProduction: boolean,
  expectedProject: string | undefined,
) {
  if (writeProduction && expectedProject !== importTarget.projectId)
    throw new Error(
      `Refusing production write: pass --expected-project-id=${importTarget.projectId}.`,
    );
}

export async function runImportPlan<T>(
  plan: ImportPlan,
  options: {
    writeProduction: boolean;
    apply: (plan: ImportPlan) => Promise<T>;
  },
) {
  if (!options.writeProduction) return { applied: false as const };
  return { applied: true as const, result: await options.apply(plan) };
}

export function isImportPlanBlocked(plan: ImportPlan) {
  return plan.conflicts.length > 0 || plan.unresolvedHistoricalSnapshots > 0;
}

export interface LiveState {
  problems: Record<string, ExistingProblemState>;
  identityMatches?: Record<string, string>;
  identityConflicts?: Record<string, string>;
  sessions: Record<
    string,
    {
      data: Record<string, unknown>;
      problems: Record<string, Record<string, unknown>>;
    }
  >;
}

export interface PlannedProblem {
  problemId: string;
  targetProblemId: string;
  title: string;
  status: PlanStatus;
  occurrences: number;
  backfills: PlannedBackfill[];
}

export interface ImportPlan {
  target: typeof importTarget;
  canonicalProblems: number;
  counts: Record<PlanStatus, number>;
  provenanceBackfillSnapshots: number;
  provenanceBackfillSessions: number;
  conflicts: string[];
  unresolvedOccurrences: number;
  irreducibleAmbiguities: Array<{ title: string; reason: string }>;
  unresolvedHistoricalSnapshots: number;
  reviewedHistoricalSkips: number;
  pendingDifficultyApprovals: Array<{
    title: string;
    difficulty: ImportDifficulty;
    reason: string;
  }>;
  problems: PlannedProblem[];
  occurrencesByBranch: Record<'intro' | 'general' | 'icpc', number>;
  inventoryOccurrencesByBranch: Record<'intro' | 'general' | 'icpc', number>;
}

export function buildImportPlan(
  manifest: ImportManifest,
  state: LiveState,
): ImportPlan {
  validateManifest(manifest);
  const historicalConflicts: string[] = [];
  const problems = manifest.problems.map((problem) => {
    const targetProblemId = state.identityMatches?.[problem.id] ?? problem.id;
    const status = state.identityConflicts?.[problem.id]
      ? 'CONFLICT'
      : classifyExisting(problem, state.problems[targetProblemId]);
    const backfills: PlannedBackfill[] = [];
    for (const entry of problem.provenanceBackfills) {
      const session = state.sessions[entry.sessionId];
      const snapshot = session?.problems[entry.problemId];
      if (!session || !snapshot) {
        historicalConflicts.push(
          `${problem.title}: missing historical snapshot ${entry.sessionId}/${entry.problemId}`,
        );
        continue;
      }
      const expected = entry.expectedSnapshot;
      const exact = Object.entries(expected).every(
        ([key, value]) => snapshot[key] === value,
      );
      if (!exact) {
        historicalConflicts.push(
          `${problem.title}: historical content changed at ${entry.sessionId}/${entry.problemId}`,
        );
        continue;
      }
      const linked = snapshot.bankProblemId;
      if (linked !== undefined && linked !== targetProblemId) {
        historicalConflicts.push(
          `${problem.title}: conflicting historical reference at ${entry.sessionId}/${entry.problemId}`,
        );
        continue;
      }
      const parentIds = session.data.bankProblemIds;
      if (
        parentIds !== undefined &&
        (!Array.isArray(parentIds) ||
          parentIds.some((id) => typeof id !== 'string'))
      ) {
        historicalConflicts.push(
          `${problem.title}: malformed Session bankProblemIds at ${entry.sessionId}`,
        );
        continue;
      }
      const sessionIds = Array.isArray(parentIds) ? parentIds : [];
      const targetOccurrences = sessionIds.filter(
        (id) => id === targetProblemId,
      ).length;
      const sessionChanged =
        linked !== targetProblemId || targetOccurrences !== 1;
      if (sessionChanged)
        backfills.push({
          sessionId: entry.sessionId,
          problemId: entry.problemId,
          targetProblemId,
          snapshotChanged: linked !== targetProblemId,
          sessionChanged: targetOccurrences !== 1,
        });
    }
    return {
      problemId: problem.id,
      targetProblemId,
      title: problem.title,
      status,
      occurrences: problem.occurrences.length,
      backfills,
    };
  });
  const counts = { CREATE: 0, RECONCILE: 0, UNCHANGED: 0, CONFLICT: 0 };
  for (const problem of problems) counts[problem.status] += 1;
  const backfillSessions = new Set(
    problems.flatMap((problem) =>
      problem.backfills.map((entry) => entry.sessionId),
    ),
  );
  return {
    target: importTarget,
    canonicalProblems: problems.length,
    counts,
    provenanceBackfillSnapshots: problems.reduce(
      (sum, problem) =>
        sum + problem.backfills.filter((entry) => entry.snapshotChanged).length,
      0,
    ),
    provenanceBackfillSessions: backfillSessions.size,
    conflicts: [
      ...problems
        .filter((problem) => problem.status === 'CONFLICT')
        .map((problem) => problem.title),
      ...historicalConflicts,
    ],
    unresolvedOccurrences: 0,
    irreducibleAmbiguities: manifest.unresolvedOccurrences.map((entry) => ({
      title: entry.title,
      reason: entry.reason,
    })),
    unresolvedHistoricalSnapshots: manifest.pendingHistoricalReviews.length,
    reviewedHistoricalSkips: manifest.reviewedHistoricalSkips.length,
    pendingDifficultyApprovals: manifest.problems
      .filter((problem) => problem.difficultyProvenance.requiresHumanApproval)
      .map((problem) => ({
        title: problem.title,
        difficulty: problem.difficulty,
        reason: problem.difficultyProvenance.reason,
      })),
    problems,
    occurrencesByBranch: manifest.problems.reduce(
      (counts, problem) => {
        for (const occurrence of problem.occurrences)
          counts[occurrence.branch] += 1;
        return counts;
      },
      { intro: 0, general: 0, icpc: 0 },
    ),
    inventoryOccurrencesByBranch: [
      ...manifest.problems.flatMap((problem) => problem.occurrences),
      ...manifest.unresolvedOccurrences,
      ...manifest.excludedOccurrences.filter(
        (item) => item.inventory !== false,
      ),
    ].reduce(
      (counts, occurrence) => {
        counts[occurrence.branch as 'intro' | 'general' | 'icpc'] += 1;
        return counts;
      },
      { intro: 0, general: 0, icpc: 0 },
    ),
  };
}

export function printPlan(plan: ImportPlan, writeEnabled = false) {
  return [
    `Target: ${plan.target.projectId} / ${plan.target.databaseId}`,
    `Canonical Problems: ${plan.canonicalProblems}`,
    `OCCURRENCES: ${Object.values(plan.occurrencesByBranch).reduce((sum, count) => sum + count, 0)} (Intro ${plan.occurrencesByBranch.intro}, General ${plan.occurrencesByBranch.general}, ICPC ${plan.occurrencesByBranch.icpc})`,
    `INVENTORY OCCURRENCES: ${Object.values(plan.inventoryOccurrencesByBranch).reduce((sum, count) => sum + count, 0)} (Intro ${plan.inventoryOccurrencesByBranch.intro}, General ${plan.inventoryOccurrencesByBranch.general}, ICPC ${plan.inventoryOccurrencesByBranch.icpc})`,
    `CREATE: ${plan.counts.CREATE}`,
    `RECONCILE: ${plan.counts.RECONCILE}`,
    `UNCHANGED: ${plan.counts.UNCHANGED}`,
    `PROVENANCE BACKFILLS: ${plan.provenanceBackfillSnapshots} snapshots across ${plan.provenanceBackfillSessions} Sessions`,
    `REVIEWED HISTORICAL SKIPS: ${plan.reviewedHistoricalSkips}`,
    `CONFLICTS: ${plan.conflicts.length}`,
    `PENDING UNRESOLVED SOURCE ITEMS: ${plan.unresolvedOccurrences}`,
    `IRREDUCIBLY AMBIGUOUS SOURCE ITEMS: ${plan.irreducibleAmbiguities.length}`,
    ...plan.irreducibleAmbiguities.map(
      (entry) => `  ${entry.title}: ${entry.reason}`,
    ),
    `PENDING DIFFICULTY APPROVALS: ${plan.pendingDifficultyApprovals.length}`,
    ...plan.pendingDifficultyApprovals.map(
      (entry) =>
        `  ${entry.title}: proposed ${entry.difficulty} — ${entry.reason}`,
    ),
    `PENDING HISTORICAL REVIEWS: ${plan.unresolvedHistoricalSnapshots}`,
    `PRODUCTION WRITES: ${writeEnabled ? 'ENABLED' : 'DISABLED'}`,
  ].join('\n');
}

export function isLeetCodeUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'leetcode.com' ||
        url.hostname === 'www.leetcode.com') &&
      /^\/problems\/[a-z0-9-]+\/?$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}
