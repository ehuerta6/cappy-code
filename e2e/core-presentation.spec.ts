import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3000';
const sessionTitle = 'Playwright Core Lifecycle Session';
const problemTitle = 'Playwright Hidden Answers Problem';
const pythonSolution = 'PYTHON_E2E_SECRET = "python-answer-secret"';
const javaSolution = 'String answer = "java-answer-secret";';
const cppSolution = 'std::string answer = "cpp-answer-secret";';
const alternatePythonSolution =
  'PYTHON_E2E_ALTERNATE = "alternate-python-secret"';
const alternateJavaSolution = 'String alternate = "alternate-java-secret";';
const alternateCppSolution = 'std::string alternate = "alternate-cpp-secret";';
const correctedPythonSolution =
  'PYTHON_E2E_SECRET = "python-corrected-answer-secret"';

test('Officer prepares and presents a Session through its public lifecycle', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['scripts/reset-emulator.mjs'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  const officerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const officer = await officerContext.newPage();
  const member = await memberContext.newPage();

  try {
    await officer.goto('/officer');
    await officer.getByLabel('Email').fill('cappy@gmail.com');
    await officer.getByLabel('Password').fill('cappy123');
    await officer.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      officer.getByRole('heading', { name: 'Sessions', level: 1 }),
    ).toBeVisible();

    // The shared deterministic fixture has a Live Session. Return it to draft
    // so this flow can prove the globally unique live pointer from a clean state.
    await officer
      .getByRole('button', { name: /CIC Intro — Hash Maps & Arrays/ })
      .click();
    await officer.getByRole('button', { name: 'Not Live' }).click();
    await expect(officer.getByText('draft', { exact: true })).toBeVisible();
    await officer.getByRole('button', { name: 'Back to Sessions' }).click();

    await officer.getByLabel('Branch for new session').selectOption('general');
    await officer.getByRole('button', { name: '+ New session' }).click();
    await officer.getByLabel('Session title').fill(sessionTitle);
    await officer.getByLabel('Session date').fill('2026-10-20');
    await officer.getByLabel('Session branch').selectOption('general');
    await officer
      .getByRole('button', { name: 'Save Changes', exact: true })
      .click();
    await expect(officer.getByText('Saved ✓')).toBeVisible();
    const officerSessionURL = officer.url();
    await expect(officer).toHaveURL(/\/officer\/sessions\/[^/]+$/);
    await officer.reload();
    await expect(officer).toHaveURL(officerSessionURL);
    await expect(officer.getByLabel('Session title')).toHaveValue(sessionTitle);

    await officer.getByRole('button', { name: 'Manage problems' }).click();
    await officer.getByRole('button', { name: 'Add problem' }).click();

    await officer
      .getByRole('textbox', { name: 'Problem title' })
      .fill(problemTitle);
    await officer
      .getByLabel('Problem category')
      .selectOption('interview-style');
    await officer.getByLabel('Difficulty').selectOption('medium');
    await officer
      .getByRole('textbox', { name: 'Description' })
      .fill('Use a **map** to find the matching pair.');
    await officer
      .getByRole('textbox', { name: 'Constraints' })
      .fill('2 ≤ values.length ≤ 100,000');
    await officer
      .getByRole('textbox', { name: 'LeetCode link (optional)' })
      .fill('https://leetcode.com/problems/two-sum/');
    await officer
      .getByRole('textbox', { name: 'Example input' })
      .fill('values = [4, 8, 12], target = 12');
    await officer
      .getByRole('textbox', { name: 'Expected output' })
      .fill('[0, 1]');

    const solutionCode = [pythonSolution, javaSolution, cppSolution];
    for (let index = 0; index < solutionCode.length; index += 1) {
      const editor = officer
        .getByRole('region', {
          name: ['Python', 'Java', 'C++'][index],
        })
        .locator('.monaco-editor');
      await expect(editor).toBeVisible();
      await editor.click();
      await officer.keyboard.press('ControlOrMeta+A');
      await officer.keyboard.insertText(solutionCode[index]);
    }

    for (const [index, time, space] of [
      [0, 'O(n)', 'O(n)'],
      [1, 'O(n log n)', 'O(n)'],
      [2, 'O(n)', 'O(1)'],
    ] as const) {
      await officer.getByLabel('Time Complexity').nth(index).fill(time);
      await officer
        .getByLabel('Time explanation')
        .nth(index)
        .fill(`${['Python', 'Java', 'C++'][index]} time analysis.`);
      await officer.getByLabel('Space Complexity').nth(index).fill(space);
      await officer
        .getByLabel('Space explanation')
        .nth(index)
        .fill(`${['Python', 'Java', 'C++'][index]} space analysis.`);
    }
    await officer
      .getByRole('button', { name: 'Save Changes', exact: true })
      .click();
    await expect(officer.getByText('Saved ✓')).toBeVisible();
    await officer.getByRole('button', { name: 'Add Approach' }).click();
    await expect(
      officer.getByRole('button', { name: 'New Approach' }),
    ).toBeVisible();
    for (const [index, language] of ['Python', 'Java', 'C++'].entries()) {
      const editor = officer
        .getByRole('region', { name: language })
        .locator('.monaco-editor');
      await editor.click();
      await officer.keyboard.press('ControlOrMeta+A');
      await officer.keyboard.insertText(
        [alternatePythonSolution, alternateJavaSolution, alternateCppSolution][
          index
        ],
      );
    }
    await officer
      .getByRole('button', { name: 'Save Changes', exact: true })
      .click();
    await expect(officer.getByText('Saved ✓')).toBeVisible();
    await expect(
      officer.getByRole('button', { name: 'New Approach' }),
    ).toBeVisible();

    // Session-created reusable Bank copies stay unpublished until an Officer
    // explicitly publishes them.
    await officer.goto('/officer/problem-bank');
    await officer.getByRole('button', { name: problemTitle }).click();
    await expect(officer.getByText('Publication: Unpublished')).toBeVisible();
    await officer.getByRole('button', { name: 'Publish' }).click();
    await expect(officer.getByText('Publication: Published')).toBeVisible();
    await officer.goto('/officer');
    await officer
      .getByRole('button', { name: new RegExp(sessionTitle) })
      .click();
    await officer.getByRole('button', { name: 'Manage problems' }).click();
    await expect(
      officer.getByRole('button', { name: 'New Approach' }),
    ).toBeVisible();

    await member.goto('/');
    await expect(
      member.getByRole('heading', { name: 'Sessions' }),
    ).toBeVisible();
    await expect(
      member
        .getByRole('region', { name: 'General session history' })
        .getByText('No live session right now.'),
    ).toBeVisible();

    await member.goto('/problem-bank');
    const bankLink = member.getByRole('link', { name: problemTitle });
    await expect(bankLink).toBeVisible();
    await bankLink.click();
    await expect(
      member.getByRole('heading', { name: problemTitle }),
    ).toBeVisible();
    await expect(
      member.getByText('Use a map to find the matching pair.'),
    ).toBeVisible();
    await expect(
      member.getByText('2 ≤ values.length ≤ 100,000', { exact: true }),
    ).toBeVisible();
    await expect(
      member.getByText('values = [4, 8, 12], target = 12'),
    ).toBeVisible();
    await expect(member.getByText('[0, 1]', { exact: true })).toBeVisible();
    await expect(member.getByText(/medium/i)).toBeVisible();
    await expect(
      member.getByRole('link', { name: /LeetCode/ }),
    ).toHaveAttribute('href', 'https://leetcode.com/problems/two-sum/');
    await expect(member.getByText('python-answer-secret')).toBeVisible();
    await expect(member.getByText('java-answer-secret')).toBeVisible();
    await expect(member.getByText('cpp-answer-secret')).toBeVisible();
    await expect(
      member.getByRole('button', { name: 'New Approach' }),
    ).toHaveCount(0);
    await expect(member.getByText('Time: O(n)', { exact: true })).toHaveCount(
      2,
    );
    await expect(member.getByText('Time: O(n log n)')).toBeVisible();
    await expect(member.getByText('Space: O(n)', { exact: true })).toHaveCount(
      2,
    );
    await expect(member.getByText('Space: O(1)', { exact: true })).toHaveCount(
      1,
    );
    const bankProblemId = new URL(member.url()).pathname.split('/').at(-1);
    expect(bankProblemId).toBeTruthy();
    await member.goto('/');

    await officer.getByRole('button', { name: 'Go Live' }).click();
    await expect(officer.getByText('live', { exact: true })).toBeVisible();
    await officer.getByRole('link', { name: 'View as Member' }).click();
    await expect(officer).toHaveURL(/\/sessions\/[^/]+$/);
    await expect(
      officer.getByText('Waiting for the officer to reveal the solution…'),
    ).toBeVisible();
    await officer.goto(officerSessionURL);
    await officer.getByRole('button', { name: 'Manage problems' }).click();
    await expect(
      officer.getByText(
        'You can correct existing Problem and Solution content while live. Problems cannot be added, removed, or reordered.',
      ),
    ).toBeVisible();
    await expect(
      officer.getByRole('button', { name: 'Add problem' }),
    ).toBeDisabled();
    await expect(
      officer.getByRole('button', { name: 'Add from Problem Bank' }),
    ).toBeDisabled();
    await officer
      .getByRole('button', { name: `Manage ${problemTitle}` })
      .click();
    await expect(
      officer.getByRole('button', { name: 'Move later' }),
    ).toBeDisabled();
    await expect(
      officer.getByRole('button', { name: 'Delete problem' }),
    ).toBeDisabled();
    await officer.getByLabel('Problem title').fill('Corrected live Problem');
    await officer
      .getByLabel('Description')
      .fill('Corrected **live** description.');
    await officer.getByLabel('Constraints').fill('Corrected live constraints.');
    await officer.getByLabel('Example input').fill('values = [1, 2, 3]');
    await officer.getByLabel('Expected output').fill('6');
    await officer.getByLabel('Difficulty').selectOption('hard');
    await officer
      .getByLabel('LeetCode link (optional)')
      .fill('https://leetcode.com/problems/valid-anagram/');
    const pythonEditor = officer
      .getByRole('region', { name: 'Python' })
      .locator('.monaco-editor');
    await pythonEditor.click();
    await officer.keyboard.press('ControlOrMeta+A');
    await officer.keyboard.insertText(correctedPythonSolution);
    await expect(
      officer.getByRole('region', { name: 'Python' }).locator('.view-lines'),
    ).toContainText('python-corrected-answer-secret');
    await officer.getByLabel('Time Complexity').nth(0).fill('O(n log n)');
    await officer
      .getByRole('button', { name: 'Save Changes', exact: true })
      .click();
    await expect(officer.getByText('Saved ✓')).toBeVisible();
    await expect(
      officer.getByRole('region', { name: 'Python' }).locator('.view-lines'),
    ).toContainText('python-corrected-answer-secret');
    await member.goto('/');
    await member.getByRole('link', { name: sessionTitle }).click();
    await expect(member).toHaveURL(/\/sessions\/.*\/.*$/);
    await expect(
      member.getByRole('heading', { name: 'Corrected live Problem' }),
    ).toBeVisible();
    await expect(member.getByText('Corrected live description.')).toBeVisible();
    await expect(
      member.getByText('2 ≤ values.length ≤ 100,000', { exact: true }),
    ).toHaveCount(0);
    await expect(member.getByText('Corrected live constraints.')).toBeVisible();
    await expect(member.getByText('values = [1, 2, 3]')).toBeVisible();
    await expect(member.getByText('6', { exact: true })).toBeVisible();
    await expect(member.getByText(/hard/i)).toBeVisible();
    await expect(
      member.getByRole('link', { name: /LeetCode/ }),
    ).toHaveAttribute('href', 'https://leetcode.com/problems/valid-anagram/');
    await expect(
      member.getByText('Waiting for the officer to reveal the solution…'),
    ).toBeVisible();
    await expect(member.getByText(/answer-secret/)).toHaveCount(0);
    const liveUrlBackedProblem = member.url();
    await member.reload();
    await expect(member).toHaveURL(liveUrlBackedProblem);
    await expect(
      member.getByRole('heading', { name: 'Corrected live Problem' }),
    ).toBeVisible();
    await expect(member.getByText('Corrected live constraints.')).toBeVisible();
    await expect(member.getByText('values = [1, 2, 3]')).toBeVisible();
    await expect(member.getByText(/answer-secret/)).toHaveCount(0);
    await expect(
      member.getByText('Waiting for the officer to reveal the solution…'),
    ).toBeVisible();
    const sessionId = new URL(member.url()).pathname.split('/').at(-2);
    expect(sessionId).toBeTruthy();
    const liveSessionUrl = member.url();
    await member.goto('/problem-bank');
    await expect(member.getByRole('link', { name: problemTitle })).toHaveCount(
      0,
    );
    await member.goto(`/problem-bank/${bankProblemId}`);
    await expect(
      member.getByRole('heading', { name: 'Problem unavailable' }),
    ).toBeVisible();
    await member.goto(liveSessionUrl);
    await expect(
      member.getByText('Waiting for the officer to reveal the solution…'),
    ).toBeVisible();

    const problemListResponse = await fetch(
      `http://127.0.0.1:8080/v1/projects/demo-cappycode-local/databases/(default)/documents/sessions/${sessionId}/problems`,
    );
    const problemList = (await problemListResponse.json()) as {
      documents?: Array<{ name: string }>;
    };
    const problemId = problemList.documents?.[0]?.name.split('/').at(-1);
    expect(problemId).toBeTruthy();
    const protectedRead = await fetch(
      `http://127.0.0.1:8080/v1/projects/demo-cappycode-local/databases/(default)/documents/sessions/${sessionId}/problems/${problemId}/solutions/python`,
    );
    const protectedBody = await protectedRead.text();
    expect(protectedRead.status).toBe(403);
    expect(protectedBody).not.toContain('python-answer-secret');

    await officer.getByRole('button', { name: 'Show answers' }).click();
    await expect(
      member.getByText('python-corrected-answer-secret'),
    ).toBeVisible();
    await expect(member.getByText('java-answer-secret')).toBeVisible();
    await expect(member.getByText('cpp-answer-secret')).toBeVisible();
    await expect(member.getByText('Time: O(n)', { exact: true })).toHaveCount(
      1,
    );
    await expect(member.getByText('Space: O(n)', { exact: true })).toHaveCount(
      2,
    );
    await expect(member.getByText('Time: O(n log n)')).toHaveCount(2);
    await expect(member.getByText('Space: O(1)')).toBeVisible();
    await expect(member.getByText('Python time analysis.')).toBeVisible();
    await expect(member.getByText('Java time analysis.')).toBeVisible();
    await expect(member.getByText('C++ time analysis.')).toBeVisible();
    await expect(member.getByText('Python space analysis.')).toBeVisible();
    await expect(member.getByText('Java space analysis.')).toBeVisible();
    await expect(member.getByText('C++ space analysis.')).toBeVisible();
    await expect(
      member.getByRole('button', { name: 'New Approach' }),
    ).toBeVisible();
    await member.getByRole('button', { name: 'New Approach' }).click();
    await expect(member.getByText('alternate-python-secret')).toBeVisible();
    await expect(member.getByText('alternate-java-secret')).toBeVisible();
    await expect(member.getByText('alternate-cpp-secret')).toBeVisible();
    await member.getByRole('button', { name: 'Primary Approach' }).click();
    const revealedLiveUrl = member.url();
    await member.reload();
    await expect(member).toHaveURL(revealedLiveUrl);
    await expect(
      member.getByText('python-corrected-answer-secret'),
    ).toBeVisible();
    await expect(member.getByText('Time: O(n log n)')).toHaveCount(2);
    await officer.getByRole('button', { name: 'Hide answers' }).click();
    await expect(
      member.getByText('Waiting for the officer to reveal the solution…'),
    ).toBeVisible();
    await expect(member.getByText(/answer-secret/)).toHaveCount(0);

    await officer.getByRole('button', { name: 'Not Live' }).click();
    await expect(
      member.getByRole('heading', { name: 'Session unavailable' }),
    ).toBeVisible();
    await member.getByRole('link', { name: 'CappyCode home' }).click();
    await expect(member).toHaveURL(`${baseURL}/`);
    await expect(
      member
        .getByRole('region', { name: 'General session history' })
        .getByText('No live session right now.'),
    ).toBeVisible();
    await member.goto('/problem-bank');
    await expect(
      member.getByRole('link', { name: problemTitle }),
    ).toBeVisible();
    await member.goto('/');

    await officer.getByRole('button', { name: 'Go Live' }).click();
    await member.goto('/');
    await member.getByRole('link', { name: sessionTitle }).click();
    await expect(member).toHaveURL(/\/sessions\/.*\/.*$/);
    await expect(
      member.getByRole('heading', { name: 'Corrected live Problem' }),
    ).toBeVisible();
    officer.once('dialog', (dialog) => dialog.accept());
    await officer.getByRole('button', { name: 'End Session' }).click();
    await expect(member.getByText('Ended', { exact: true })).toBeVisible();
    await expect(
      member.getByText('python-corrected-answer-secret'),
    ).toBeVisible();

    await expect(
      officer.getByText(
        'You can correct existing Problem and Solution content. Ended Sessions cannot be structurally changed or reopened.',
      ),
    ).toBeVisible();
    await expect(officer.getByRole('button', { name: 'Go Live' })).toHaveCount(
      0,
    );
    await officer.getByLabel('Problem title').fill('Corrected ended Problem');
    await officer
      .getByRole('button', { name: 'Save Changes', exact: true })
      .click();
    await expect(officer.getByText('Saved ✓')).toBeVisible();
    await expect(officer.getByText('ended', { exact: true })).toBeVisible();
    await expect(officer.getByRole('button', { name: 'Go Live' })).toHaveCount(
      0,
    );
    await member.reload();
    await expect(
      member.getByRole('heading', { name: 'Corrected ended Problem' }),
    ).toBeVisible();
    await expect(
      member.getByText('python-corrected-answer-secret'),
    ).toBeVisible();

    const endedURL = member.url();
    await member.goto('/problem-bank');
    await expect(
      member.getByRole('link', { name: problemTitle }),
    ).toBeVisible();
    await member.goto(endedURL);
    await member.reload();
    await expect(member.getByText('Ended', { exact: true })).toBeVisible();
    await expect(member.getByText('cpp-answer-secret')).toBeVisible();
    await member.goto('/');
    await expect(
      member
        .getByRole('region', { name: 'General session history' })
        .getByRole('heading', { name: 'Past' }),
    ).toBeVisible();
    await expect(
      member.getByRole('link', { name: sessionTitle }),
    ).toBeVisible();
    await member.goto(endedURL);
    await expect(member.getByText('Ended', { exact: true })).toBeVisible();
    await officer.getByRole('link', { name: 'View as Member' }).click();
    await expect(officer).toHaveURL(/\/sessions\/[^/]+$/);
    await expect(
      officer.getByText('python-corrected-answer-secret'),
    ).toBeVisible();
  } finally {
    await officerContext.close();
    await memberContext.close();
  }
});
