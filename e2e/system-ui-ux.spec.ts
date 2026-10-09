import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

test('shared navigation, responsive layout, and Officer dashboard hierarchy', async ({
  page,
}) => {
  execFileSync(process.execPath, ['scripts/reset-emulator.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sessions' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const introHistory = page.getByRole('region', {
    name: 'Intro session history',
  });
  const liveHeading = introHistory.getByRole('heading', { name: 'Live' });
  await expect(liveHeading).toBeVisible();
  const liveRow = page.getByRole('link', {
    name: /CIC Intro — Hash Maps & Arrays/,
  });
  await expect(liveRow).toBeVisible();
  await expect(liveRow).not.toContainText('Live');
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);

  await page.getByRole('link', { name: 'Problem Bank' }).click();
  await expect(
    page.getByRole('link', { name: 'Problem Bank' }),
  ).toHaveAttribute('aria-current', 'page');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.setViewportSize({ width: 320, height: 740 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);

  await page.goto('/officer');
  await page.getByLabel('Email').fill('cappy@gmail.com');
  await page.getByLabel('Password').fill('cappy123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Officer navigation' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Sessions', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  const past = page
    .getByRole('region', { name: 'Past Intro sessions' })
    .getByRole('heading', { name: 'Past' });
  await expect(past).toBeVisible();
  const historyDisclosure = page
    .getByRole('button', { name: /Show Problem details for/ })
    .first();
  await expect(historyDisclosure).toHaveAttribute('aria-expanded', 'false');
  await historyDisclosure.click();
  await expect(
    page.getByRole('region', { name: /Problem history for/ }).first(),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole('button', { name: /CIC Intro — Hash Maps & Arrays/ })
    .click();
  await expect(
    page.getByRole('region', { name: 'Session metadata' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save changes', exact: true }),
  ).toHaveCount(1);
});
