import { describe, expect, it } from 'vitest';
import {
  assertBankCleanupWriteAuthorization,
  bankCleanupTarget,
  planBankPublicationCleanup,
} from './problem-bank-cleanup';

describe('Problem Bank publication cleanup', () => {
  it('dry-run identifies only obsolete fields and leaves record data untouched', () => {
    const records = [
      {
        id: 'legacy',
        data: {
          title: 'Two Sum',
          isPublished: false,
          isPublic: true,
          hiddenByLiveSessionId: 'live-session',
        },
      },
      { id: 'clean', data: { title: 'Already clean' } },
    ];
    const before = structuredClone(records);
    expect(planBankPublicationCleanup(records)).toEqual([
      { id: 'legacy', fields: ['isPublished', 'isPublic'] },
    ]);
    expect(records).toEqual(before);
  });

  it('requires explicit production authorization for the exact project', () => {
    expect(() =>
      assertBankCleanupWriteAuthorization(false, undefined),
    ).not.toThrow();
    expect(() => assertBankCleanupWriteAuthorization(true, undefined)).toThrow(
      /expected-project-id/,
    );
    expect(() => assertBankCleanupWriteAuthorization(true, 'wrong')).toThrow(
      /expected-project-id/,
    );
    expect(() =>
      assertBankCleanupWriteAuthorization(true, bankCleanupTarget.projectId),
    ).not.toThrow();
  });
});
