import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

const bankTitle = 'Contest Room Route';
const sessionTitle = 'Problem Bank Snapshot Session';
const originalStatement = 'Original statement remains in the Session snapshot.';
const updatedBankPython = 'BANK_PYTHON_UPDATED_AFTER_REUSE';

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
    await expect(officer).toHaveURL(/\/officer\/sessions\/[^/]+$/);
    await expect(
      officer.getByRole('region', { name: 'Session metadata' }),
    ).toBeVisible();
    await officer.getByRole('button', { name: 'Not Live' }).click();
    await officer.getByRole('button', { name: 'Back to Sessions' }).click();
    await expect(officer).toHaveURL('/officer');

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
      await officer
        .getByLabel('Language')
        .selectOption(['python', 'java', 'cpp'][index]);
      const editor = officer
        .getByRole('region', { name: language })
        .locator('.monaco-editor');
      await editor.click();
      await officer.keyboard.press('ControlOrMeta+A');
      await officer.keyboard.insertText(secrets[index]);
      await expect(editor.locator('.view-lines')).toContainText(secrets[index]);
      await officer.getByLabel('Time Complexity').fill('O(n)');
      await officer.getByLabel('Time explanation').fill(`${language} time.`);
      await officer.getByLabel('Space Complexity').fill('O(1)');
      await officer.getByLabel('Space explanation').fill(`${language} space.`);
    }
    await officer.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      officer.getByRole('button', { name: 'Save changes' }),
    ).toBeDisabled();
    await officer.goto('/officer');
    await officer.getByLabel('Branch for new session').selectOption('intro');
    await officer.getByRole('button', { name: '+ New session' }).click();
    await expect(officer).toHaveURL(/\/officer\/sessions\/[^/]+$/);
    await expect(
      officer.getByRole('region', { name: 'Session metadata' }),
    ).toBeVisible();
    await officer.getByLabel('Session title').fill(sessionTitle);
    await officer.getByLabel('Session date').fill('2026-10-21');
    await officer
      .getByRole('button', { name: 'Save Changes', exact: true })
      .click();
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
    const pythonEditor = officer
      .getByRole('region', { name: 'Python' })
      .locator('.monaco-editor');
    await pythonEditor.click();
    await officer.keyboard.press('ControlOrMeta+A');
    await officer.keyboard.insertText(updatedBankPython);
    await officer.getByRole('button', { name: 'Save changes' }).click();
    await expect(
      officer.getByRole('button', { name: 'Save changes' }),
    ).toBeDisabled();

    await officer.goto('/officer');
    await officer.getByRole('button', { name: sessionTitle }).click();
    await expect(officer).toHaveURL(/\/officer\/sessions\/[^/]+$/);
    await expect(
      officer.getByRole('region', { name: 'Session metadata' }),
    ).toBeVisible();
    await officer.getByRole('button', { name: 'Manage problems' }).click();
    await expect(officer.getByLabel('Description')).toHaveValue(
      originalStatement,
    );
    await expect(
      officer.getByRole('region', { name: 'Python' }).locator('.view-lines'),
    ).toContainText(secrets[0]);
    await expect(
      officer.getByRole('region', { name: 'Python' }).locator('.view-lines'),
    ).not.toContainText(updatedBankPython);

    await member.goto('/problem-bank');
    await expect(
      member.getByRole('heading', { name: 'Problem Bank' }),
    ).toBeVisible();
    await expect(member.getByText(/Used \d+ times?/)).toHaveCount(0);
    await member.getByRole('link', { name: bankTitle }).click();
    await expect(
      member.getByRole('heading', { name: 'Used in Sessions' }),
    ).toHaveCount(0);
    await expect(member.getByText(/Used \d+ times?/)).toHaveCount(0);
    await expect(
      member.getByText('Updated in the bank after reuse.'),
    ).toBeVisible();
    await expect(
      member.getByRole('group', { name: 'Approach: Primary Approach' }),
    ).toBeVisible();
    await expect(member.getByLabel('Language')).toHaveValue('python');
    await expect(
      member.getByRole('heading', { name: 'Python', level: 3 }),
    ).toBeVisible();
    const bankProblemId = new URL(member.url()).pathname.split('/').at(-1);
    for (const [index, language] of ['python', 'java', 'cpp'].entries()) {
      const response = await member.request.get(
        `http://127.0.0.1:8080/v1/projects/demo-cappycode-local/databases/(default)/documents/problemBank/${bankProblemId}/approaches/primary/solutions/${language}`,
      );
      const payload = (await response.json()) as {
        fields?: { code?: { stringValue?: string } };
      };
      expect(response.status()).toBe(200);
      expect(payload.fields?.code?.stringValue).toBe(
        language === 'python' ? updatedBankPython : secrets[index],
      );
    }
    await expect(member.getByText('Time: O(n)', { exact: true })).toBeVisible();
    await expect(
      member.getByText('Space: O(1)', { exact: true }),
    ).toBeVisible();
    await member.getByLabel('Language').selectOption('java');
    await expect(
      member.getByRole('heading', { name: 'Java', level: 3 }),
    ).toBeVisible();
    await expect(member.getByText('Java time.')).toBeVisible();
    await expect(member.getByText('Python time.')).toHaveCount(0);
    await member.getByLabel('Language').selectOption('cpp');
    await expect(
      member.getByRole('heading', { name: 'C++', level: 3 }),
    ).toBeVisible();
    await expect(member.getByText('C++ time.')).toBeVisible();

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
