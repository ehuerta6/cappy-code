import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/officer');
  await page.getByLabel('Email').fill('cappy@gmail.com');
  await page.getByLabel('Password').fill('cappy123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
}

test('Officer Problem Bank shares Member discovery and opens a route-based editor', async ({
  page,
}, testInfo) => {
  execFileSync(process.execPath, ['scripts/reset-emulator.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  if ((await page.locator('html').getAttribute('data-theme')) !== 'light') {
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  }
  await page.getByRole('link', { name: 'Problem Bank' }).click();
  await expect(page).toHaveURL('/officer/problem-bank');
  await expect(
    page.getByRole('heading', { name: 'Problem Bank' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '+ New Problem' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Contest Room Route' }),
  ).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Contest Room Route classification' }),
  ).toContainText('Graph');
  await expect(page.getByLabel('Title')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('officer-bank-desktop.png'),
    fullPage: true,
  });

  const search = page.getByRole('searchbox', { name: 'Search Problems' });
  await search.fill('  GRID ');
  await expect(
    page.getByRole('link', { name: 'Count Grid Regions' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Contest Room Route' }),
  ).toHaveCount(0);
  await search.fill('');
  await page.getByRole('button', { name: 'Difficulty' }).click();
  await page.getByLabel('Easy', { exact: true }).check();
  await expect(
    page.getByRole('link', { name: 'Search a Sorted List' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Contest Room Route' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: /Clear all/ }).click();
  await expect(
    page.getByRole('link', { name: 'Contest Room Route' }),
  ).toBeVisible();
  await search.fill('no such problem');
  await expect(page.getByRole('status')).toContainText(
    'No Problems match these filters.',
  );
  await expect(
    page.getByRole('button', { name: 'Clear filters' }),
  ).toBeVisible();
  await search.fill('');

  const theme = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    theme === 'dark' ? 'light' : 'dark',
  );
  await page.screenshot({
    path: testInfo.outputPath('officer-bank-other-theme.png'),
    fullPage: true,
  });

  await page.getByRole('link', { name: 'Contest Room Route' }).click();
  await expect(page).toHaveURL(/\/officer\/problem-bank\/bank-cp-room-route$/);
  await expect(
    page.getByRole('heading', { name: 'Problem', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Solution', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save changes' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('region', { name: 'Python' }).locator('.view-lines'),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('officer-problem-editor-desktop.png'),
    fullPage: true,
  });

  const problemPane = await page
    .getByRole('region', { name: 'Problem' })
    .boundingBox();
  const solutionPane = await page
    .getByRole('region', { name: 'Solution' })
    .boundingBox();
  expect(problemPane).not.toBeNull();
  expect(solutionPane).not.toBeNull();
  expect(solutionPane!.x).toBeGreaterThan(problemPane!.x);
  expect(Math.abs(solutionPane!.y - problemPane!.y)).toBeLessThan(8);

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(
    'Contest Room Route',
  );
  await page
    .getByRole('textbox', { name: 'Title' })
    .fill('Contest Room Route Updated');
  await expect(
    page.getByText('Unsaved changes', { exact: true }),
  ).toBeVisible();
  const leavePrompt = page.waitForEvent('dialog');
  await page.goBack();
  const leaveDialog = await leavePrompt;
  expect(leaveDialog.message()).toContain('discard unsaved changes');
  await leaveDialog.dismiss();
  await expect(page).toHaveURL(/\/officer\/problem-bank\/bank-cp-room-route$/);
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(
    'Contest Room Route Updated',
  );
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved ✓', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save changes' }),
  ).toBeDisabled();

  await page.setViewportSize({ width: 1024, height: 768 });
  const stackedProblem = await page
    .getByRole('region', { name: 'Problem' })
    .boundingBox();
  const stackedSolution = await page
    .getByRole('region', { name: 'Solution' })
    .boundingBox();
  expect(stackedProblem).not.toBeNull();
  expect(stackedSolution).not.toBeNull();
  expect(stackedSolution!.y).toBeGreaterThanOrEqual(
    stackedProblem!.y + stackedProblem!.height - 1,
  );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await page.screenshot({
    path: testInfo.outputPath('officer-problem-editor-mobile.png'),
    fullPage: true,
  });

  await page.getByText('Manage approaches').click();
  const manage = page
    .locator('details')
    .filter({ has: page.getByText('Manage approaches') });
  const manageBox = await manage.boundingBox();
  expect(manageBox).not.toBeNull();
  expect(manageBox!.x).toBeGreaterThanOrEqual(0);
  expect(manageBox!.x + manageBox!.width).toBeLessThanOrEqual(390);
  await expect(page.getByLabel('Approach name')).toBeVisible();
  await expect(
    page.getByRole('searchbox', { name: 'Search tags' }),
  ).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search tags' }).fill('Hash Map');
  await page.getByRole('button', { name: 'Hash Map', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Remove Hash Map' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Manage DSA tags' }).click();
  const catalogPanel = page.getByRole('dialog', { name: 'DSA tag catalog' });
  await expect(catalogPanel).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Close DSA tag catalog' }),
  ).toBeFocused();
  const catalogBox = await catalogPanel.boundingBox();
  expect(catalogBox).not.toBeNull();
  expect(catalogBox!.x + catalogBox!.width).toBeLessThanOrEqual(390);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('officer-dsa-tag-catalog-mobile.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Manage DSA tags' }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Remove Hash Map' }).click();
  await page.getByText('Manage approaches').click();
  const saveButton = page.getByRole('button', { name: 'Save changes' });
  if (await saveButton.isEnabled()) await saveButton.click();
  await expect(page.getByText('Saved ✓', { exact: true })).toBeVisible();

  await page.getByText('More').click();
  await page.getByRole('button', { name: 'Delete Problem' }).click();
  const deleteDialog = page.getByRole('alertdialog');
  await expect(deleteDialog).toContainText(
    'Existing Session copies and their history will remain unchanged',
  );
  await deleteDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/officer\/problem-bank\/bank-cp-room-route$/);

  await page.goBack();
  await expect(page).toHaveURL('/officer/problem-bank');
});

test('creating a Bank Problem opens its dedicated editor route', async ({
  page,
}) => {
  execFileSync(process.execPath, ['scripts/reset-emulator.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  await signIn(page);
  await page.getByRole('link', { name: 'Problem Bank' }).click();
  await page.getByRole('button', { name: '+ New Problem' }).click();
  await expect(page).toHaveURL(/\/officer\/problem-bank\/[^/]+$/);
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(
    'Untitled Problem',
  );
  await expect(
    page.getByRole('heading', { name: 'Problem', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Solution' })).toBeVisible();
});
