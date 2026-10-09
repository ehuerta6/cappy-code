import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

test('Member Problem Bank search and filters adapt across themes and widths', async ({
  browser,
}, testInfo) => {
  execFileSync(process.execPath, ['scripts/reset-emulator.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  await page.goto('/problem-bank');
  await expect(
    page.getByRole('heading', { name: 'Problem Bank' }),
  ).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Search Problems' });
  await expect(
    page.getByRole('link', { name: 'Contest Room Route' }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('member-bank-desktop-light.png'),
    fullPage: true,
  });

  await search.fill('  CONTEST  ');
  await expect(
    page.getByRole('link', { name: 'Contest Room Route' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Count Grid Regions' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Difficulty' }).click();
  const difficultyPanel = page.getByRole('group', {
    name: 'Difficulty options',
  });
  await expect(difficultyPanel).toBeVisible();
  await page.getByRole('button', { name: 'Category' }).click();
  await expect(difficultyPanel).toHaveCount(0);
  const categoryPanel = page.getByRole('group', { name: 'Category options' });
  await expect(categoryPanel).toBeVisible();
  const categoryBox = await categoryPanel.boundingBox();
  expect(categoryBox).not.toBeNull();
  expect(categoryBox!.x).toBeGreaterThanOrEqual(0);
  expect(categoryBox!.x + categoryBox!.width).toBeLessThanOrEqual(1440);
  await page.screenshot({
    path: testInfo.outputPath('member-bank-filter-open-light.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(categoryPanel).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Category' })).toBeFocused();

  await search.fill('');
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: testInfo.outputPath('member-bank-desktop-dark.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'DSA / algorithm' }).click();
  const tagPanel = page.getByRole('group', { name: 'DSA / algorithm options' });
  const tagBox = await tagPanel.boundingBox();
  expect(tagBox).not.toBeNull();
  expect(tagBox!.x).toBeGreaterThanOrEqual(0);
  expect(tagBox!.x + tagBox!.width).toBeLessThanOrEqual(390);
  expect(tagBox!.height).toBeLessThanOrEqual(844 * 0.7);
  await page.screenshot({
    path: testInfo.outputPath('member-bank-mobile-dark.png'),
    fullPage: true,
  });
  await page.close();
});
