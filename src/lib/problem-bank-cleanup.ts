export const bankCleanupTarget = {
  projectId: 'cappycode-f133c',
  databaseId: '(default)',
} as const;

export type BankCleanupRecord = {
  id: string;
  data: Record<string, unknown>;
};

export function planBankPublicationCleanup(records: BankCleanupRecord[]) {
  return records.flatMap(({ id, data }) => {
    const fields = (['isPublished', 'isPublic'] as const).filter((field) =>
      Object.hasOwn(data, field),
    );
    return fields.length ? [{ id, fields }] : [];
  });
}

export function assertBankCleanupWriteAuthorization(
  writeProduction: boolean,
  expectedProjectId: string | undefined,
) {
  if (!writeProduction) return;
  if (expectedProjectId !== bankCleanupTarget.projectId)
    throw new Error(
      `Production cleanup requires --expected-project-id=${bankCleanupTarget.projectId}.`,
    );
}
