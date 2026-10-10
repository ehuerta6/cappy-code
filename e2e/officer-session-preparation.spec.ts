import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

test('Officers can find Bank Problems while preparing a Session at desktop and narrow widths', async ({
  page,
}, testInfo) => {
  execFileSync(process.execPath, ['scripts/reset-emulator.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/officer');
  await page.getByLabel('Email').fill('cappy@gmail.com');
  await page.getByLabel('Password').fill('cappy123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();

  await page.getByLabel('Branch for new session').selectOption('intro');
  await page.getByRole('button', { name: '+ New session' }).click();
  await expect(
    page.getByRole('region', { name: 'Session metadata' }),
  ).toBeVisible();
  await page.getByLabel('Session title').fill('Issue 171 preparation check');
  await page.getByLabel('Session date').fill('2026-10-21');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved ✓', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Manage problems' }).click();
  await page.getByRole('button', { name: 'Add from Problem Bank' }).click();

  const picker = page.getByRole('region', { name: 'Choose a bank Problem' });
  const search = page.getByRole('searchbox', {
    name: 'Search Problem Bank by name',
  });
  await expect(search).toBeVisible();
  await expect(
    picker.getByText('Contest Room Route', { exact: true }),
  ).toBeVisible();
  await expect(
    picker.getByText('Competitive Programming').first(),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('officer-session-preparation-desktop.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(search).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('officer-session-preparation-narrow.png'),
    fullPage: true,
  });

  await search.fill('no matching Problem');
  await expect(picker.getByRole('status')).toHaveText(
    'No Problems match that name.',
  );
  await expect(
    picker.getByRole('button', { name: 'Add Contest Room Route to Session' }),
  ).toHaveCount(0);
  await search.fill('contest room');
  await expect(
    picker.getByRole('button', { name: 'Add Contest Room Route to Session' }),
  ).toBeVisible();
});
