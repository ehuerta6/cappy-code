import { approachTags } from './domain';
import { problemApproachTags } from './problem-bank-filters';

export const bankApproachTagSummaryTarget = {
  projectId: 'cappycode-f133c',
  databaseId: '(default)',
} as const;

export function normalizeBankApproachTagSummary(
  approaches: Array<{ tags?: unknown }>,
): string[] {
  const supported = new Set<string>(approachTags);
  return problemApproachTags(
    approaches.map(({ tags }) => ({
      tags: Array.isArray(tags)
        ? tags.filter(
            (tag): tag is string =>
              typeof tag === 'string' && supported.has(tag),
          )
        : [],
    })),
  );
}

export function planBankApproachTagSummaryBackfill(
  records: Array<{
    id: string;
    data: Record<string, unknown>;
    approaches: Array<{ tags?: unknown }>;
  }>,
) {
  return records.flatMap(({ id, data, approaches }) =>
    Array.isArray(data.approachTagSummary)
      ? []
      : [
          {
            id,
            approachTagSummary: normalizeBankApproachTagSummary(approaches),
          },
        ],
  );
}

export function assertBankApproachTagSummaryWriteAuthorization(
  writeProduction: boolean,
  expectedProjectId: string | undefined,
) {
  if (
    writeProduction &&
    expectedProjectId !== bankApproachTagSummaryTarget.projectId
  )
    throw new Error(
      `Production backfill requires --expected-project-id=${bankApproachTagSummaryTarget.projectId}.`,
    );
}
