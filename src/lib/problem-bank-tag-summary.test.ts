import { describe, expect, it } from 'vitest';
import {
  assertBankApproachTagSummaryWriteAuthorization,
  bankApproachTagSummaryTarget,
  normalizeBankApproachTagSummary,
  planBankApproachTagSummaryBackfill,
} from './problem-bank-tag-summary';

describe('Bank approach tag summary compatibility', () => {
  it('normalizes supported tags from legacy Approach documents', () => {
    expect(
      normalizeBankApproachTagSummary([
        { tags: ['Hash Map', 'Arrays'] },
        { tags: ['Arrays', 'Unsupported tag'] },
        { tags: null },
      ]),
    ).toEqual(['Arrays', 'Hash Map']);
  });

  it('plans summaries only for parents missing the denormalized field', () => {
    expect(
      planBankApproachTagSummaryBackfill([
        {
          id: 'legacy',
          data: { title: 'Legacy problem' },
          approaches: [{ tags: ['Graph'] }],
        },
        {
          id: 'current',
          data: { approachTagSummary: [] },
          approaches: [{ tags: ['Arrays'] }],
        },
        { id: 'untagged', data: {}, approaches: [] },
      ]),
    ).toEqual([
      { id: 'legacy', approachTagSummary: ['Graph'] },
      { id: 'untagged', approachTagSummary: [] },
    ]);
  });

  it('requires the expected production project before an explicit write', () => {
    expect(() =>
      assertBankApproachTagSummaryWriteAuthorization(false, undefined),
    ).not.toThrow();
    expect(() =>
      assertBankApproachTagSummaryWriteAuthorization(true, undefined),
    ).toThrow(
      `--expected-project-id=${bankApproachTagSummaryTarget.projectId}`,
    );
    expect(() =>
      assertBankApproachTagSummaryWriteAuthorization(true, 'wrong-project'),
    ).toThrow(
      `--expected-project-id=${bankApproachTagSummaryTarget.projectId}`,
    );
    expect(() =>
      assertBankApproachTagSummaryWriteAuthorization(
        true,
        bankApproachTagSummaryTarget.projectId,
      ),
    ).not.toThrow();
  });
});
