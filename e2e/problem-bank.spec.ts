import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

const bankTitle = 'Contest Room Route';
const sessionTitle = 'Problem Bank Snapshot Session';
const originalStatement = 'Original statement remains in the Session snapshot.';

test('Officer edits and reuses a bank Problem as an independent Session snapshot', async ({
  browser,
}) => {
  execFileSync(process.execPath, ['scripts/reset-emulator.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  const context = await browser.newContext();
  const officer = await context.newPage();
  const member = await context.newPage();

  try {
    await officer.goto('/officer');
    await officer.getByLabel('Email').fill('cappy@gmail.com');
    await officer.getByLabel('Password').fill('cappy123');
    await officer.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      officer.getByRole('heading', { name: 'Sessions' }),
    ).toBeVisible();
    await officer
      .getByRole('button', { name: /CIC Intro — Hash Maps & Arrays/ })
      .click();
    await officer.getByRole('button', { name: 'Not Live' }).click();
    await officer.getByRole('button', { name: 'Back to Sessions' }).click();

    await officer.getByRole('link', { name: 'Problem Bank' }).click();
    await officer.getByRole('button', { name: bankTitle }).click();
    await expect(officer.getByLabel('Problem title')).toHaveValue(bankTitle);
    await officer
      .getByLabel('Description (Markdown supported)')
      .fill(originalStatement);
    await officer.getByLabel('Constraints').fill('1 ≤ n ≤ 200,000');
    await officer.getByLabel('Example input').fill('4 8 12');
    await officer.getByLabel('Expected output').fill('12');
    const secrets = [
      'BANK_PYTHON_SOLUTION',
      'BANK_JAVA_SOLUTION',
      'BANK_CPP_SOLUTION',
    ];
    for (const [index, language] of ['Python', 'Java', 'C++'].entries()) {
      const editor = officer
        .getByRole('region', { name: language })
        .locator('.monaco-editor');
      await editor.click();
      await officer.keyboard.press('ControlOrMeta+A');
      await officer.keyboard.insertText(secrets[index]);
      await expect(editor.locator('.view-lines')).toContainText(secrets[index]);
      await officer.getByLabel('Time Complexity').nth(index).fill('O(n)');
      await officer
        .getByLabel('Time explanation')
        .nth(index)
        .fill(`${language} time.`);
      await officer.getByLabel('Space Complexity').nth(index).fill('O(1)');
      await officer
        .getByLabel('Space explanation')
        .nth(index)
        .fill(`${language} space.`);
    }
    await officer.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      officer.getByRole('button', { name: 'Save changes' }),
    ).toBeDisabled();

    await officer.goto('/officer');
    await officer.getByLabel('Branch for new session').selectOption('general');
    await officer.getByRole('button', { name: '+ New session' }).click();
    await officer.getByLabel('Session title').fill(sessionTitle);
    await officer.getByLabel('Session date').fill('2026-10-21');
    await officer.getByRole('button', { name: 'Save changes' }).click();
    await officer.getByRole('button', { name: 'Manage problems' }).click();
    await officer
      .getByRole('button', { name: 'Add from Problem Bank' })
      .click();
    await officer
      .getByRole('listitem')
      .filter({ hasText: bankTitle })
      .getByRole('button', { name: 'Add to Session' })
      .click();
    await expect(officer.getByLabel('Problem title')).toHaveValue(bankTitle);
    await expect(officer.getByLabel('Problem category')).toHaveValue(
      'competitive-programming',
    );

    await officer.goto('/officer/problem-bank');
    await expect(officer.getByRole('button', { name: bankTitle })).toHaveCount(
      1,
    );
    await officer.getByRole('button', { name: bankTitle }).click();
    await expect(officer.getByLabel('Problem title')).toHaveValue(bankTitle);
    await officer
      .getByLabel('Description (Markdown supported)')
      .fill('Updated in the bank after reuse.');
    await officer.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      officer.getByRole('button', { name: 'Save changes' }),
    ).toBeDisabled();

    await officer.goto('/officer');
    await officer.getByRole('button', { name: sessionTitle }).click();
    await officer.getByRole('button', { name: 'Manage problems' }).click();
    await expect(officer.getByLabel('Description')).toHaveValue(
      originalStatement,
    );

    await member.goto('/problem-bank');
    await member.getByRole('link', { name: bankTitle }).click();
    await expect(
      member.getByText('Updated in the bank after reuse.'),
    ).toBeVisible();
    for (const language of ['Python', 'Java', 'C++'])
      await expect(
        member.getByRole('heading', { name: language, level: 3 }),
      ).toBeVisible();
    const bankProblemId = new URL(member.url()).pathname.split('/').at(-1);
    for (const [index, language] of ['python', 'java', 'cpp'].entries()) {
      const response = await member.request.get(
        `http://127.0.0.1:8080/v1/projects/demo-cappycode-local/databases/(default)/documents/problemBank/${bankProblemId}/solutions/${language}`,
      );
      const payload = (await response.json()) as {
        fields?: { code?: { stringValue?: string } };
      };
      expect(response.status()).toBe(200);
      expect(payload.fields?.code?.stringValue).toBe(secrets[index]);
    }
    await expect(member.getByText('Time: O(n)', { exact: true })).toHaveCount(
      3,
    );
    await expect(member.getByText('Space: O(1)', { exact: true })).toHaveCount(
      3,
    );

    await officer.getByRole('button', { name: 'Go Live' }).click();
    await member.goto('/problem-bank');
    await expect(member.getByRole('link', { name: bankTitle })).toHaveCount(0);
    await member.goto('/');
    await member.getByRole('link', { name: sessionTitle }).click();
    await expect(member).toHaveURL(/\/sessions\/.*\/.*$/);
    await expect(member.getByText('Answers hidden')).toBeVisible();
    for (const token of [
      'bank python solution',
      'bank java solution',
      'bank cpp solution',
    ])
      await expect(member.getByText(token)).toHaveCount(0);
    await officer.getByRole('button', { name: 'Not Live' }).click();
    await member.goto('/problem-bank');
    await expect(member.getByRole('link', { name: bankTitle })).toBeVisible();
  } finally {
    await context.close();
  }
});
