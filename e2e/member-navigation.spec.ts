import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

function resetEmulators() {
  execFileSync(process.execPath, ['scripts/reset-emulator.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
}

test('Members can browse live, ended, and bank content without selection fallback', async ({
  page,
}) => {
  resetEmulators();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
  const introHistory = page.getByRole('region', {
    name: 'Intro session history',
  });
  const generalHistory = page.getByRole('region', {
    name: 'General session history',
  });
  const icpcHistory = page.getByRole('region', {
    name: 'ICPC session history',
  });
  await expect(introHistory.getByRole('link')).toHaveCount(11);
  await expect(generalHistory.getByRole('link')).toHaveCount(4);
  await expect(icpcHistory.getByRole('link')).toHaveCount(4);
  await expect(
    generalHistory.getByRole('link', { name: /Graph Algorithms Live/ }),
  ).toBeVisible();
  await expect(
    icpcHistory.getByRole('link', { name: /Contest Patterns Live/ }),
  ).toBeVisible();
  const historyCounts = [
    await introHistory.getByRole('link').count(),
    await generalHistory.getByRole('link').count(),
    await icpcHistory.getByRole('link').count(),
  ];

  await introHistory.getByRole('link', { name: /Hash Maps & Arrays/ }).click();
  await expect(page).toHaveURL(/\/sessions\/live-hash-maps\/two-sum$/);
  await expect(page.getByRole('heading', { name: 'Two Sum' })).toBeVisible();
  await page
    .getByRole('tab', { name: 'Custom: First Repeated Workshop ID' })
    .click();
  await expect(page).toHaveURL(
    /\/sessions\/live-hash-maps\/custom-frequency-map$/,
  );
  await expect(
    page.getByRole('heading', { name: 'Custom: First Repeated Workshop ID' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Valid Anagram' }).click();
  await expect(page).toHaveURL(/\/sessions\/live-hash-maps\/valid-anagram$/);
  await expect(
    page.getByRole('heading', { name: 'Valid Anagram' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Valid Anagram' }),
  ).toBeVisible();

  await page.goto('/sessions/ended-general-practice');
  await expect(page).toHaveURL(
    /\/sessions\/ended-general-practice\/campus-islands$/,
  );
  await expect(
    page.getByRole('heading', { name: 'CIC General — Graph Algorithms' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Campus Pair Sum' }).click();
  await expect(page).toHaveURL(
    /\/sessions\/ended-general-practice\/campus-pair-sum$/,
  );
  await expect(
    page.getByRole('heading', { name: 'Campus Pair Sum' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Campus Pair Sum' }),
  ).toBeVisible();

  await page.goto('/sessions/ended-intro-review');
  await expect(page).toHaveURL(
    /\/sessions\/ended-intro-review\/review-two-sum$/,
  );
  await page
    .getByRole('tab', { name: 'Custom: Workshop Check-in Counts' })
    .click();
  await expect(page).toHaveURL(
    /\/sessions\/ended-intro-review\/review-custom-check-in$/,
  );

  await page.goto('/sessions/ended-icpc-practice/contest-schedule-count');
  await expect(
    page.getByRole('heading', { name: 'Contest Schedule Count' }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    /\/sessions\/ended-icpc-practice\/contest-schedule-count$/,
  );
  await page.getByRole('link', { name: 'CappyCode home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
  await page.goto('/sessions/live-hash-maps/does-not-exist');
  await expect(
    page.getByRole('heading', { name: 'Problem unavailable' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Two Sum' })).toHaveCount(0);
  await page.goto('/sessions/not-a-session');
  await expect(
    page.getByRole('heading', { name: 'Session unavailable' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Two Sum' })).toHaveCount(0);

  await page.goto('/problem-bank');
  await expect(
    page.getByRole('heading', { name: 'Custom', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Interview-style', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Competitive Programming', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'First Repeated Workshop ID' }),
  ).toHaveCount(0);
  const visibleBankTitles = await page
    .locator('main a[href^="/problem-bank/"]')
    .allTextContents();
  expect(visibleBankTitles.length).toBeGreaterThanOrEqual(5);
  await expect(
    page
      .getByRole('heading', { name: 'Custom', exact: true })
      .locator('xpath=..')
      .getByRole('link'),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole('heading', { name: 'Interview-style', exact: true })
      .locator('xpath=..')
      .getByRole('link'),
  ).toHaveCount(2);
  await expect(
    page
      .getByRole('heading', { name: 'Competitive Programming', exact: true })
      .locator('xpath=..')
      .getByRole('link'),
  ).toHaveCount(2);
  await page.getByRole('link', { name: 'Longest Unique Substring' }).click();
  await expect(
    page.getByRole('region', { name: 'Python' }).locator('.view-lines'),
  ).toContainText('def longest_unique');
  await page.getByLabel('Language').selectOption('java');
  await expect(
    page.getByRole('region', { name: 'Java' }).locator('.view-lines'),
  ).toContainText('int longestUnique');
  await page.getByLabel('Language').selectOption('cpp');
  await expect(
    page.getByRole('region', { name: 'C++' }).locator('.view-lines'),
  ).toContainText('int longestUnique');

  resetEmulators();
  await page.goto('/');
  await expect(introHistory.getByRole('link')).toHaveCount(historyCounts[0]);
  await expect(generalHistory.getByRole('link')).toHaveCount(historyCounts[1]);
  await expect(icpcHistory.getByRole('link')).toHaveCount(historyCounts[2]);
  await page.goto('/problem-bank');
  await expect(
    page.getByRole('link', { name: 'Longest Unique Substring' }),
  ).toBeVisible();
  expect(
    await page.locator('main a[href^="/problem-bank/"]').allTextContents(),
  ).toEqual(visibleBankTitles);
  const officerLogin = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'cappy@gmail.com',
        password: 'cappy123',
        returnSecureToken: true,
      }),
    },
  );
  expect(officerLogin.ok).toBe(true);
});

test('Officers can still browse a bank Problem hidden from Members while live', async ({
  page,
}) => {
  resetEmulators();
  await page.goto('/officer');
  await page.getByLabel('Email').fill('cappy@gmail.com');
  await page.getByLabel('Password').fill('cappy123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Problem Bank' }).click();
  await expect(
    page.getByText('First Repeated Workshop ID', { exact: true }),
  ).toBeVisible();
});
