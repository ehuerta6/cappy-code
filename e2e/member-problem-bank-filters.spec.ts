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
  await expect(
    page.getByRole('group', { name: 'Contest Room Route classification' }),
  ).toContainText('Graph');
  await expect(
    page.getByRole('heading', { name: 'Competitive Programming' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Custom', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Interview-style', exact: true }),
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
    page.getByRole('heading', { name: 'Interview-style', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Custom', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Count Grid Regions' }),
  ).toHaveCount(0);
  await search.fill('');
  await search.fill('no matching problem');
  await expect(page.getByRole('status')).toContainText(
    'No Problems match these filters.',
  );
  await expect(
    page.getByRole('button', { name: 'Clear filters' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Competitive Programming' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(
    page.getByRole('link', { name: 'Contest Room Route' }),
  ).toBeVisible();
  await search.fill('');
  for (const width of [390, 900, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const columns = await page
      .locator('.mt-6.grid.min-w-0.gap-7')
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
    expect(columns.split(' ').length).toBe(
      width >= 1280 ? 3 : width >= 640 ? 2 : 1,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'DSA / algorithm' }).click();
  await page.getByLabel('Graph', { exact: true }).check();
  await expect(
    page.getByRole('link', { name: 'Contest Room Route' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Longest Unique Substring' }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Clear all (1)' }).click();
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
  for (const name of [
    'CIC branch',
    'Difficulty',
    'Category',
    'DSA / algorithm',
  ]) {
    const trigger = page.getByRole('button', { name });
    await trigger.click();
    const panel = page.getByRole('group', { name: `${name} options` });
    const box = await panel.boundingBox();
    expect(box, `${name} panel should be measurable`).not.toBeNull();
    expect(box!.x, `${name} panel left edge`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${name} panel right edge`).toBeLessThanOrEqual(
      390,
    );
    if (name === 'DSA / algorithm')
      expect(box!.height).toBeLessThanOrEqual(844 * 0.7);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  await page.getByRole('button', { name: 'DSA / algorithm' }).click();
  await page.screenshot({
    path: testInfo.outputPath('member-bank-mobile-dark.png'),
    fullPage: true,
  });
  await page.close();
});
