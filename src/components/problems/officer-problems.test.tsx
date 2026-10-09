// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  createProblem: vi.fn(),
  listProblems: vi.fn(),
  updateProblem: vi.fn(),
  reorderProblems: vi.fn(),
  setAnswersVisible: vi.fn(),
  deleteProblem: vi.fn(),
  duplicateProblem: vi.fn(),
  getSolutionsForProblem: vi.fn(),
  updateSolution: vi.fn(),
  getApproaches: vi.fn(),
}));
const bankApi = vi.hoisted(() => ({
  addBankProblemToSession: vi.fn(),
  listOfficerBankProblems: vi.fn(),
  materializeSessionProblemInBank: vi.fn(),
}));
vi.mock('@/lib/firebase/problems', async (original) => ({
  ...(await original<typeof import('@/lib/firebase/problems')>()),
  ...api,
}));
vi.mock('client-only', () => ({}));
vi.mock('@/lib/firebase/solutions', () => ({
  getSolutionsForProblem: api.getSolutionsForProblem,
  updateSolution: api.updateSolution,
  getApproaches: api.getApproaches,
  createApproach: vi.fn(),
  deleteApproach: vi.fn(),
  reorderApproaches: vi.fn(),
  saveApproach: vi.fn(),
}));
vi.mock('@/lib/firebase/problem-bank', () => bankApi);
vi.mock('@monaco-editor/react', () => ({
  default: ({
    value,
    path,
    options,
    onChange,
  }: {
    value: string;
    path: string;
    options: { readOnly: boolean; ariaLabel: string };
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label={options.ariaLabel}
      data-path={path}
      readOnly={options.readOnly}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
import OfficerProblems from './officer-problems';
const first = {
  id: 'first',
  problem: {
    title: 'Two Sum',
    description: 'Find pair',
    exampleInput: '1 2',
    exampleOutput: '3',
    constraints: '',
    order: 0,
    answersVisible: false,
  },
};
const second = {
  id: 'second',
  problem: {
    ...first.problem,
    title: 'Anagram',
    description: 'Compare letters',
    order: 1,
  },
};
const onBusyChange = vi.fn();
const onSaveStateChange = vi.fn();
const onProblemCountStateChange = vi.fn();
function start(sessionStatus: 'draft' | 'live' | 'ended' = 'draft') {
  render(
    <OfficerProblems
      sessionId="session"
      sessionStatus={sessionStatus}
      onBusyChange={onBusyChange}
      onSaveStateChange={onSaveStateChange}
      onProblemCountStateChange={onProblemCountStateChange}
    />,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  api.listProblems.mockResolvedValue([first, second]);
  api.createProblem.mockResolvedValue({
    id: 'new',
    problem: {
      ...first.problem,
      title: 'Untitled Problem',
      description: '',
      exampleInput: '',
      exampleOutput: '',
      order: 2,
      bankProblemId: 'reserved-bank',
      bankOrigin: 'session',
      bankCopyPending: true,
    },
  });
  api.updateProblem.mockResolvedValue(undefined);
  api.reorderProblems.mockResolvedValue(undefined);
  api.setAnswersVisible.mockResolvedValue(undefined);
  api.deleteProblem.mockResolvedValue(undefined);
  api.duplicateProblem.mockResolvedValue({
    id: 'duplicate',
    problem: {
      ...first.problem,
      title: 'Two Sum Copy',
      order: 1,
      answersVisible: false,
    },
  });
  api.getSolutionsForProblem.mockResolvedValue({
    python: { code: 'python source' },
    java: { code: 'java source' },
    cpp: { code: 'cpp source' },
  });
  api.getApproaches.mockResolvedValue([
    {
      id: 'primary',
      name: 'Primary Approach',
      tags: [],
      order: 0,
      solutions: {
        python: { code: 'python source' },
        java: { code: 'java source' },
        cpp: { code: 'cpp source' },
      },
    },
  ]);
  api.updateSolution.mockResolvedValue(undefined);
  bankApi.addBankProblemToSession.mockResolvedValue({
    id: 'bank-copy',
    problem: first.problem,
  });
  bankApi.listOfficerBankProblems.mockResolvedValue([
    { id: 'bank-source', title: 'Two Sum', category: 'interview-style' },
  ]);
  bankApi.materializeSessionProblemInBank.mockResolvedValue({
    bankProblemId: 'reserved-bank',
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function loaded() {
  start();
  await screen.findByRole('tab', { name: 'Two Sum' });
}
function actions() {
  fireEvent.click(screen.getByRole('button', { name: 'Manage Two Sum' }));
}
describe('Officer Problem workspace', () => {
  it('keeps Problem editing in the Problem column and Solution editing in Solutions', async () => {
    await loaded();

    const problemColumn = screen.getByRole('region', { name: 'Problem' });
    const solutionsColumn = screen.getByRole('region', { name: 'Solutions' });

    expect(
      within(problemColumn).getByRole('tablist', { name: 'Problems' }),
    ).toBeTruthy();
    expect(
      within(problemColumn).getByRole('textbox', { name: 'Problem title' }),
    ).toBeTruthy();
    expect(
      within(problemColumn).getByRole('combobox', {
        name: 'Problem category',
      }),
    ).toBeTruthy();
    expect(
      within(problemColumn).queryByLabelText('Python Solution, editable'),
    ).toBeNull();

    expect(
      await within(solutionsColumn).findByLabelText(
        'Python Solution, editable',
      ),
    ).toBeTruthy();
    expect(
      within(solutionsColumn).getAllByRole('heading', { name: 'Solutions' }),
    ).toHaveLength(1);
    expect(
      within(solutionsColumn).queryByLabelText('Problem title'),
    ).toBeNull();
  });

  it('duplicates a saved draft Problem from its actions and selects the adjacent copy', async () => {
    await loaded();
    actions();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate problem' }));

    expect(api.duplicateProblem).toHaveBeenCalledWith('session', 'first');
    expect(
      (await screen.findByRole('tab', { name: 'Two Sum Copy' })).getAttribute(
        'aria-selected',
      ),
    ).toBe('true');
  });

  it('keeps the list unchanged and reports a failed Problem duplicate', async () => {
    await loaded();
    api.duplicateProblem.mockRejectedValue(new Error('offline'));
    actions();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate problem' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Duplicating problem failed.',
    );
    expect(screen.queryByRole('tab', { name: 'Two Sum Copy' })).toBeNull();
  });

  it('does not expose structural duplication in live Sessions', async () => {
    start('live');
    await screen.findByRole('tab', { name: 'Two Sum' });
    actions();

    expect(
      (
        screen.getByRole('button', {
          name: 'Duplicate problem',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate problem' }));
    expect(api.duplicateProblem).not.toHaveBeenCalled();
  });

  it('blocks opening Problem actions while the selected editor is unsaved', async () => {
    await loaded();
    const title = screen.getByRole('textbox', { name: 'Problem title' });
    fireEvent.change(title, { target: { value: 'Unsaved Two Sum' } });

    expect(
      (
        screen.getByRole('button', {
          name: 'Manage Two Sum',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText(/Unsaved changes\. Save or revert/)).toBeTruthy();
    expect(api.duplicateProblem).not.toHaveBeenCalled();
  });

  it('materializes a direct-created Bank copy after the explicit metadata and Solution saves', async () => {
    const pendingProblem = {
      ...first,
      problem: {
        ...first.problem,
        title: 'Untitled Problem',
        bankProblemId: 'reserved-bank',
        bankOrigin: 'session' as const,
        bankCopyPending: true,
      },
    };
    api.listProblems.mockResolvedValue([pendingProblem]);
    api.getApproaches.mockResolvedValueOnce([
      {
        id: 'primary',
        name: 'Primary Approach',
        tags: [],
        order: 0,
        solutions: {
          python: { code: '' },
          java: { code: '' },
          cpp: { code: '' },
        },
      },
    ]);
    start();
    await screen.findByRole('tab', { name: 'Untitled Problem' });
    fireEvent.change(screen.getByLabelText('Problem title'), {
      target: { value: 'Prepared Two Sum' },
    });
    fireEvent.change(screen.getByLabelText(/Description \(optional\)/), {
      target: { value: 'Find the target pair.' },
    });
    fireEvent.change(
      await screen.findByLabelText('Python Solution, editable'),
      {
        target: { value: 'python prepared' },
      },
    );
    fireEvent.change(screen.getByLabelText('Language'), {
      target: { value: 'java' },
    });
    fireEvent.change(screen.getByLabelText('Java Solution, editable'), {
      target: { value: 'java prepared' },
    });
    fireEvent.change(screen.getByLabelText('Language'), {
      target: { value: 'cpp' },
    });
    fireEvent.change(screen.getByLabelText('C++ Solution, editable'), {
      target: { value: 'cpp prepared' },
    });
    fireEvent.change(screen.getAllByLabelText('Time Complexity')[0], {
      target: { value: 'O(n)' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Problem and Solution changes' }),
    );

    await waitFor(() =>
      expect(bankApi.materializeSessionProblemInBank).toHaveBeenCalledWith(
        'session',
        'first',
      ),
    );
    const materializeOrder =
      bankApi.materializeSessionProblemInBank.mock.invocationCallOrder[0];
    expect(api.updateProblem.mock.invocationCallOrder[0]).toBeLessThan(
      materializeOrder,
    );
    for (const language of ['python', 'java', 'cpp']) {
      const saveIndex = api.updateSolution.mock.calls.findIndex(
        ([, , savedLanguage]) => savedLanguage === language,
      );
      expect(saveIndex).toBeGreaterThanOrEqual(0);
      const save = api.updateSolution.mock.calls[saveIndex];
      expect(save[0]).toBe('session');
      expect(save[1]).toBe('first');
      expect(save[3].code).toBe(`${language} prepared`);
      expect(
        api.updateSolution.mock.invocationCallOrder[saveIndex],
      ).toBeLessThan(materializeOrder);
    }
    expect(api.updateProblem.mock.calls[0][2]).toEqual({
      title: 'Prepared Two Sum',
      description: 'Find the target pair.',
    });
    expect(screen.queryByText(/Save a titled Problem/)).toBeNull();
  });

  it('surfaces a failed Bank materialization and retries the same copy', async () => {
    api.listProblems.mockResolvedValue([
      {
        ...first,
        problem: {
          ...first.problem,
          title: 'Untitled Problem',
          bankProblemId: 'reserved-bank',
          bankOrigin: 'session',
          bankCopyPending: true,
        },
      },
    ]);
    bankApi.materializeSessionProblemInBank
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ bankProblemId: 'reserved-bank' });
    start();
    await screen.findByRole('tab', { name: 'Untitled Problem' });
    fireEvent.change(screen.getByLabelText('Problem title'), {
      target: { value: 'Prepared Two Sum' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Problem and Solution changes' }),
    );
    expect(
      await screen.findByText(
        'Reusable Bank copy could not be created. Your Session content is saved; retry to create the copy.',
      ),
    ).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(bankApi.materializeSessionProblemInBank).toHaveBeenCalledTimes(2),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Save a titled Problem/)).toBeNull();
  });

  it('keeps the Session list unchanged when adding a Bank copy fails', async () => {
    await loaded();
    fireEvent.click(
      screen.getByRole('button', { name: 'Add from Problem Bank' }),
    );
    bankApi.addBankProblemToSession.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Add to Session' }),
    );
    expect(
      await screen.findByText(
        'Adding Problem from bank failed. Check your connection and try again.',
      ),
    ).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('distinguishes loading, failed reads with retry and empty state', async () => {
    api.listProblems
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([]);
    start();
    expect(screen.getByRole('status').textContent).toBe('Loading problems…');
    await screen.findByRole('alert');
    expect(screen.queryByText('No problems yet')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading problems' }),
    );
    expect(await screen.findByText('No problems yet')).toBeTruthy();
    expect(
      screen.getByText('Add the first problem to this session.'),
    ).toBeTruthy();
  });
  it('selects Problems locally by click and keyboard', async () => {
    await loaded();
    const firstTab = screen.getByRole('tab', { name: 'Two Sum' });
    const secondTab = screen.getByRole('tab', { name: 'Anagram' });
    expect(firstTab.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(secondTab);
    expect(firstTab.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(secondTab);
    expect(secondTab.getAttribute('aria-selected')).toBe('true');
    expect(
      (screen.getByLabelText(/Description \(optional\)/) as HTMLTextAreaElement)
        .value,
    ).toBe('Compare letters');
    fireEvent.keyDown(secondTab, { key: 'Home' });
    expect(document.activeElement).toBe(firstTab);
    fireEvent.keyDown(firstTab, { key: 'End' });
    expect(document.activeElement).toBe(secondTab);
    expect(api.updateProblem).not.toHaveBeenCalled();
  });
  it('shows per-Problem missing-content guidance in the Officer preparation view', async () => {
    api.getApproaches.mockResolvedValue([
      {
        id: 'primary',
        name: 'Hash Map',
        tags: [],
        order: 0,
        solutions: {
          python: { code: 'python source' },
          java: { code: 'java source' },
          cpp: { code: '' },
        },
      },
    ]);
    await loaded();
    expect(await screen.findAllByText('Needs prep')).toHaveLength(2);
    expect(await screen.findByText('Hash Map: C++ not prepared')).toBeTruthy();
  });
  it('reveals answers only after confirmation and hides only the selected problem', async () => {
    start('live');
    await screen.findByRole('tab', { name: 'Two Sum' });
    let confirm!: () => void;
    api.setAnswersVisible.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        confirm = resolve;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show answers' }));
    expect(screen.getByText('Showing answers…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show answers' })).toBeTruthy();
    confirm();
    expect(
      await screen.findByRole('button', { name: 'Hide answers' }),
    ).toBeTruthy();
    expect(api.setAnswersVisible).toHaveBeenCalledExactlyOnceWith(
      'session',
      'first',
      true,
    );
    expect(api.updateSolution).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Anagram' }));
    expect(screen.getByRole('button', { name: 'Show answers' })).toBeTruthy();
    expect(api.setAnswersVisible).toHaveBeenCalledTimes(1);
  });
  it('retains confirmed reveal state when a hide write fails', async () => {
    api.listProblems.mockResolvedValue([
      { ...first, problem: { ...first.problem, answersVisible: true } },
      second,
    ]);
    api.setAnswersVisible.mockRejectedValueOnce(new Error('offline'));
    start('live');
    await screen.findByRole('tab', { name: 'Two Sum' });
    fireEvent.click(screen.getByRole('button', { name: 'Hide answers' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Hiding answers failed',
    );
    expect(screen.getByRole('button', { name: 'Hide answers' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show answers' })).toBeNull();
  });
  it('shows ended solutions without answer visibility controls', async () => {
    start('ended');
    await screen.findByRole('tab', { name: 'Two Sum' });
    expect(
      screen.getByText('Solutions are public in ended sessions.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show answers' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide answers' })).toBeNull();
  });
  it.each(['live', 'ended'] as const)(
    'keeps %s Problem content editable and blocks structural operations',
    async (status) => {
      start(status);
      await screen.findByRole('tab', { name: 'Two Sum' });
      expect(
        (screen.getByLabelText('Problem title') as HTMLInputElement).disabled,
      ).toBe(false);
      expect(
        (
          screen.getByRole('button', {
            name: 'Add problem',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(
        (
          screen.getByRole('button', {
            name: 'Add from Problem Bank',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      actions();
      expect(
        (
          screen.getByRole('button', {
            name: 'Move later',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(
        (
          screen.getByRole('button', {
            name: 'Delete problem',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    },
  );
  it('does not materialize a pending Bank copy while correcting an ended Session', async () => {
    api.listProblems.mockResolvedValue([
      {
        ...first,
        problem: {
          ...first.problem,
          bankProblemId: 'reserved-bank',
          bankOrigin: 'session',
          bankCopyPending: true,
        },
      },
    ]);
    start('ended');
    await screen.findByRole('tab', { name: 'Two Sum' });
    fireEvent.change(screen.getByLabelText('Problem title'), {
      target: { value: 'Corrected past title' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Problem and Solution changes' }),
    );
    await waitFor(() =>
      expect(api.updateProblem).toHaveBeenCalledWith('session', 'first', {
        title: 'Corrected past title',
      }),
    );
    expect(bankApi.materializeSessionProblemInBank).not.toHaveBeenCalled();
  });
  it('creates and selects confirmed metadata while creation is visibly pending', async () => {
    let resolve!: (record: typeof first) => void;
    api.createProblem.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Add problem' }));
    expect(screen.getByText('Creating problem…')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Untitled Problem' })).toBeNull();
    resolve({
      ...first,
      id: 'new',
      problem: { ...first.problem, title: 'Untitled Problem' },
    });
    expect(
      (
        await screen.findByRole('tab', { name: 'Untitled Problem' })
      ).getAttribute('aria-selected'),
    ).toBe('true');
    expect(api.createProblem).toHaveBeenCalledWith('session');
    expect(api.listProblems).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(onProblemCountStateChange).toHaveBeenLastCalledWith({
        status: 'ready',
        count: 3,
      }),
    );
  });
  it('keeps failed creation empty with a recoverable error', async () => {
    api.listProblems.mockResolvedValue([]);
    api.createProblem.mockRejectedValue(new Error('offline'));
    start();
    await screen.findByText('No problems yet');
    fireEvent.click(screen.getByRole('button', { name: '+ Add problem' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Creating problem failed',
    );
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
  it('keeps Problem edits local until Save changes and retries failed metadata', async () => {
    api.updateProblem.mockRejectedValueOnce(new Error('offline'));
    await loaded();
    const description = screen.getByLabelText(
      /Description \(optional\)/,
    ) as HTMLTextAreaElement;
    const markdownSource = 'New **statement**\n\n- first line';
    fireEvent.change(description, { target: { value: markdownSource } });
    fireEvent.change(screen.getByLabelText('Problem title'), {
      target: { value: 'Renamed' },
    });
    fireEvent.change(
      screen.getByLabelText('Example input (optional) (Markdown supported)'),
      {
        target: { value: '`4 5`' },
      },
    );
    fireEvent.change(
      screen.getByLabelText('Expected output (optional) (Markdown supported)'),
      {
        target: { value: '**9**' },
      },
    );
    fireEvent.change(screen.getByLabelText('Constraints (optional)'), {
      target: { value: '1 ≤ n ≤ 100\nValues are distinct.' },
    });
    fireEvent.change(screen.getByLabelText('Problem link (optional)'), {
      target: { value: 'https://leetcode.com/problems/two-sum/' },
    });
    expect(api.updateProblem).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('tab', { name: 'Anagram' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.blur(description);
    expect(api.updateProblem).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Problem and Solution changes' }),
    );
    await screen.findByRole('alert');
    expect(description.value).toBe(markdownSource);
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    expect(onSaveStateChange).toHaveBeenLastCalledWith(null);
    expect(api.updateProblem).toHaveBeenLastCalledWith('session', 'first', {
      title: 'Renamed',
      description: markdownSource,
      exampleInput: '`4 5`',
      exampleOutput: '**9**',
      constraints: '1 ≤ n ≤ 100\nValues are distinct.',
      leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
    });
    expect(api.updateProblem).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('tab', { name: 'Renamed' })).toBeTruthy();
  });
  it('keeps difficulty changes local until the shared Save changes action', async () => {
    await loaded();
    const difficulty = screen.getByLabelText('Difficulty') as HTMLSelectElement;
    expect(difficulty.value).toBe('');
    fireEvent.change(difficulty, { target: { value: 'medium' } });
    expect(difficulty.value).toBe('medium');
    expect(api.updateProblem).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Problem and Solution changes' }),
    );
    await waitFor(() =>
      expect(api.updateProblem).toHaveBeenCalledExactlyOnceWith(
        'session',
        'first',
        { difficulty: 'medium' },
      ),
    );
  });
  it('rejects an invalid LeetCode URL before saving and preserves the entered value', async () => {
    await loaded();
    const input = screen.getByLabelText(
      'Problem link (optional)',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: 'http://example.com/not-a-problem' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Problem and Solution changes' }),
    );
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Enter a valid HTTPS LeetCode Problem URL.',
    );
    expect(input.value).toBe('http://example.com/not-a-problem');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(api.updateProblem).not.toHaveBeenCalled();
  });
  it('keeps aggregate save state pending until the backend confirms and blocks navigation', async () => {
    let resolve!: () => void;
    api.updateProblem.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    await loaded();
    fireEvent.change(screen.getByLabelText('Problem title'), {
      target: { value: 'New title' },
    });
    expect(api.updateProblem).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Problem and Solution changes' }),
    );
    await waitFor(() =>
      expect(onSaveStateChange.mock.calls.at(-1)?.[0]).toMatchObject({
        dirty: true,
        saving: true,
      }),
    );
    expect(screen.queryByText('Problem saved ✓')).toBeNull();
    expect(
      (
        screen.getByRole('button', {
          name: 'Manage Two Sum',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    resolve();
    await waitFor(() =>
      expect(onSaveStateChange).toHaveBeenLastCalledWith(null),
    );
  });
  it('returns to clean state when Problem edits are reverted without a write', async () => {
    await loaded();
    const title = screen.getByLabelText('Problem title');
    fireEvent.change(title, { target: { value: 'Unsaved' } });
    fireEvent.change(title, { target: { value: 'Two Sum' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(api.updateProblem).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(onSaveStateChange).toHaveBeenLastCalledWith(null),
    );
  });
  it('uses compact actions to rename, reorder after confirmation and recover from reorder failure', async () => {
    await loaded();
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
    actions();
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Problem title'));
    actions();
    fireEvent.click(screen.getByRole('button', { name: 'Move later' }));
    await waitFor(() =>
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'Anagram',
        'Two Sum',
      ]),
    );
    expect(api.reorderProblems).toHaveBeenCalledWith('session', [
      'second',
      'first',
    ]);
    api.reorderProblems.mockRejectedValue(new Error('offline'));
    actions();
    fireEvent.click(screen.getByRole('button', { name: 'Move earlier' }));
    await screen.findByRole('alert');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Anagram',
      'Two Sum',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Reload problems' }));
    await waitFor(() => expect(api.listProblems).toHaveBeenCalledTimes(2));
  });
  it('requires named delete confirmation, restores focus, retains failed deletion and deletes final problem to empty', async () => {
    api.listProblems.mockResolvedValue([first]);
    api.deleteProblem.mockRejectedValueOnce(new Error('offline'));
    await loaded();
    actions();
    fireEvent.click(screen.getByRole('button', { name: 'Delete problem' }));
    const confirmation = screen.getByRole('group', {
      name: 'Confirm problem deletion',
    });
    expect(confirmation.textContent).toContain('Two Sum');
    expect(document.activeElement).toBe(
      within(confirmation).getByRole('button', { name: 'Cancel' }),
    );
    expect(api.deleteProblem).not.toHaveBeenCalled();
    fireEvent.keyDown(confirmation, { key: 'Escape' });
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Manage Two Sum' }),
    );
    actions();
    fireEvent.click(screen.getByRole('button', { name: 'Delete problem' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm delete problem' }),
    );
    await screen.findByRole('alert');
    expect(screen.getByRole('tab', { name: 'Two Sum' })).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm delete problem' }),
    );
    expect(await screen.findByText('No problems yet')).toBeTruthy();
    expect(api.deleteProblem).toHaveBeenLastCalledWith('session', 'first');
  });

  it('saves the shared Problem example and language source together on explicit save', async () => {
    const initialBusyChanges = onBusyChange.mock.calls.length;
    await loaded();
    const python = await screen.findByLabelText('Python Solution, editable');
    expect(python.getAttribute('data-path')).toBe(
      'officer/session/first/python',
    );
    expect(api.getApproaches).toHaveBeenCalledWith(
      'sessions/session/problems/first',
    );
    fireEvent.change(
      screen.getByLabelText('Expected output (optional) (Markdown supported)'),
      {
        target: { value: 'shared expected result' },
      },
    );
    fireEvent.change(screen.getByLabelText('Language'), {
      target: { value: 'cpp' },
    });
    fireEvent.change(screen.getByLabelText('C++ Solution, editable'), {
      target: { value: 'updated C++ source' },
    });
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    expect(
      (screen.getByRole('tab', { name: 'Anagram' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(api.updateSolution).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Problem and Solution changes' }),
    );
    await waitFor(() =>
      expect(api.updateSolution).toHaveBeenCalledWith(
        'session',
        'first',
        'cpp',
        {
          code: 'updated C++ source',
        },
        'primary',
      ),
    );
    expect(api.updateProblem).toHaveBeenCalledWith('session', 'first', {
      exampleOutput: 'shared expected result',
    });
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole('tab', { name: 'Anagram' }));
    await screen.findByLabelText('Python Solution, editable');
    expect(api.getApproaches).toHaveBeenLastCalledWith(
      'sessions/session/problems/second',
    );
    expect(onBusyChange.mock.calls.length).toBeGreaterThan(initialBusyChanges);
  });
});
