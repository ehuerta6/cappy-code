import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number);
    if (!channels || channels.length !== 3)
      throw new Error(`Invalid color: ${color}`);
    const [red, green, blue] = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function resetEmulators() {
  execFileSync(process.execPath, ['scripts/reset-emulator.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
}

test('Members can browse live, ended, and bank content without selection fallback', async ({
  page,
}, testInfo) => {
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
  const liveStatus = page.getByText('Live', { exact: true });
  const liveColors = await liveStatus.evaluate((element) => ({
    foreground: getComputedStyle(element).color,
    background: getComputedStyle(element).backgroundColor,
  }));
  expect(
    contrastRatio(liveColors.foreground, liveColors.background),
  ).toBeGreaterThanOrEqual(4.5);
  const themeToggle = page.getByRole('button', { name: 'Toggle color theme' });
  if ((await page.locator('html').getAttribute('data-theme')) !== 'light') {
    await themeToggle.click();
  }
  const lightLiveColors = await liveStatus.evaluate((element) => ({
    foreground: getComputedStyle(element).color,
    background: getComputedStyle(element).backgroundColor,
  }));
  expect(
    contrastRatio(lightLiveColors.foreground, lightLiveColors.background),
  ).toBeGreaterThanOrEqual(4.5);
  await themeToggle.click();
  const darkLiveColors = await liveStatus.evaluate((element) => ({
    foreground: getComputedStyle(element).color,
    background: getComputedStyle(element).backgroundColor,
  }));
  expect(
    contrastRatio(darkLiveColors.foreground, darkLiveColors.background),
  ).toBeGreaterThanOrEqual(4.5);
  await themeToggle.click();
  const firstTab = page.getByRole('tab', { name: 'Two Sum' });
  await expect(firstTab).toHaveAttribute(
    'aria-controls',
    'problem-panel-two-sum',
  );
  await firstTab.focus();
  await firstTab.press('ArrowRight');
  await expect(page).toHaveURL(
    /\/sessions\/live-hash-maps\/custom-frequency-map$/,
  );
  const selectedTab = page.getByRole('tab', {
    name: 'Custom: First Repeated Workshop ID',
  });
  await expect(selectedTab).toBeFocused();
  await expect(selectedTab).toHaveAttribute(
    'aria-controls',
    'problem-panel-custom-frequency-map',
  );
  await expect(page.getByRole('tabpanel')).toHaveAttribute(
    'aria-labelledby',
    'problem-tab-custom-frequency-map',
  );
  await selectedTab.press('Tab');
  await expect(page.getByRole('tabpanel')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(selectedTab).toBeFocused();
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
  await page.setViewportSize({ width: 1440, height: 384 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  const problemRegion = page.getByRole('region', {
    name: 'Problem',
    exact: true,
  });
  const solutionsRegion = page
    .getByRole('heading', { name: 'Solutions' })
    .locator('xpath=..');
  await expect
    .poll(() =>
      Promise.all([
        problemRegion.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
        solutionsRegion.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
      ]),
    )
    .toEqual([true, true]);
  await page.screenshot({
    path: testInfo.outputPath('member-session-wide-low-height.png'),
    fullPage: true,
  });
  await problemRegion.focus();
  await page.keyboard.press('PageDown');
  await expect
    .poll(() => problemRegion.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await page.setViewportSize({ width: 683, height: 384 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await expect(
    page.getByRole('region', { name: 'Python' }).locator('.view-lines'),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('member-session-reduced-height.png'),
    fullPage: true,
  });
  await problemRegion.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(problemRegion).toBeFocused();
  await expect
    .poll(() =>
      problemRegion.evaluate(
        (element) => getComputedStyle(element).outlineWidth,
      ),
    )
    .toBe('2px');
  const languageSelect = page.getByLabel('Language');
  await languageSelect.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(languageSelect).toBeFocused();
  await expect
    .poll(() =>
      languageSelect.evaluate(
        (element) => getComputedStyle(element).outlineWidth,
      ),
    )
    .toBe('2px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() =>
      page
        .locator('.bg-monaco')
        .first()
        .evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).transitionDuration),
        ),
    )
    .toBeLessThan(0.001);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('member-session-narrow.png'),
    fullPage: true,
  });
  await themeToggle.click();
  const firstThemeBackground = await page
    .locator('.bg-monaco')
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await themeToggle.click();
  const secondThemeBackground = await page
    .locator('.bg-monaco')
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(secondThemeBackground).not.toBe(firstThemeBackground);
  await page.setViewportSize({ width: 1440, height: 900 });

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
  await page.goto('/sessions/ended-icpc-practice/contest-room-route');
  const sessionExamples = page.locator(
    '#problem-panel-contest-room-route [aria-labelledby="examples-contest-room-route"]',
  );
  await expect(
    sessionExamples.getByRole('heading', { name: 'Examples' }),
  ).toBeVisible();
  await expect(
    sessionExamples.getByRole('heading', { name: 'Input' }),
  ).toBeVisible();
  await expect(
    sessionExamples.getByRole('heading', { name: 'Expected output' }),
  ).toBeVisible();
  await expect(sessionExamples.locator('pre code').first()).toHaveText(
    'doors = [[0, 1], [1, 3], [2, 4]], start = 0, end = 3',
  );
  const sessionExampleStyle = await sessionExamples
    .locator('pre')
    .first()
    .getAttribute('class');
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
  await page.getByRole('link', { name: 'Contest Room Route' }).click();
  const bankExamples = page.locator(
    '[aria-labelledby="examples-bank-cp-room-route"]',
  );
  await expect(
    bankExamples.getByRole('heading', { name: 'Examples' }),
  ).toBeVisible();
  await expect(
    bankExamples.getByRole('heading', { name: 'Input' }),
  ).toBeVisible();
  await expect(
    bankExamples.getByRole('heading', { name: 'Expected output' }),
  ).toBeVisible();
  await expect(bankExamples.locator('pre code').first()).toHaveText(
    'doors = [[0,1],[1,3],[2,4]], start = 0, end = 3',
  );
  await expect(bankExamples.locator('pre').first()).toHaveClass(
    sessionExampleStyle!,
  );
  await page.goto('/problem-bank');
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
