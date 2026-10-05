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
  getSolutionsForProblem: vi.fn(),
  updateSolution: vi.fn(),
}));
vi.mock('@/lib/firebase/problems', async (original) => ({
  ...(await original<typeof import('@/lib/firebase/problems')>()),
  ...api,
}));
vi.mock('client-only', () => ({}));
vi.mock('@/lib/firebase/solutions', () => ({
  getSolutionsForProblem: api.getSolutionsForProblem,
  updateSolution: api.updateSolution,
}));
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
const onProblemCountStateChange = vi.fn();
function start() {
  render(
    <OfficerProblems
      sessionId="session"
      onBusyChange={onBusyChange}
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
    },
  });
  api.updateProblem.mockResolvedValue(undefined);
  api.reorderProblems.mockResolvedValue(undefined);
  api.setAnswersVisible.mockResolvedValue(undefined);
  api.deleteProblem.mockResolvedValue(undefined);
  api.getSolutionsForProblem.mockResolvedValue({
    python: { code: 'python source', output: '' },
    java: { code: 'java source', output: '' },
    cpp: { code: 'cpp source', output: '' },
  });
  api.updateSolution.mockResolvedValue(undefined);
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
  fireEvent.click(screen.getByRole('button', { name: 'Problem actions' }));
}
describe('Officer Problem workspace', () => {
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
      (screen.getByLabelText('Description') as HTMLTextAreaElement).value,
    ).toBe('Compare letters');
    fireEvent.keyDown(secondTab, { key: 'Home' });
    expect(document.activeElement).toBe(firstTab);
    fireEvent.keyDown(firstTab, { key: 'End' });
    expect(document.activeElement).toBe(secondTab);
    expect(api.updateProblem).not.toHaveBeenCalled();
  });
  it('reveals answers only after confirmation and hides only the selected problem', async () => {
    await loaded();
    let confirm!: () => void;
    api.setAnswersVisible.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        confirm = resolve;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show Answers' }));
    expect(screen.getByText('Showing answers…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show Answers' })).toBeTruthy();
    confirm();
    expect(
      await screen.findByRole('button', { name: 'Hide Answers' }),
    ).toBeTruthy();
    expect(api.setAnswersVisible).toHaveBeenCalledExactlyOnceWith(
      'session',
      'first',
      true,
    );
    expect(api.updateSolution).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Anagram' }));
    expect(screen.getByRole('button', { name: 'Show Answers' })).toBeTruthy();
    expect(api.setAnswersVisible).toHaveBeenCalledTimes(1);
  });
  it('retains confirmed reveal state when a hide write fails', async () => {
    api.listProblems.mockResolvedValue([
      { ...first, problem: { ...first.problem, answersVisible: true } },
      second,
    ]);
    api.setAnswersVisible.mockRejectedValueOnce(new Error('offline'));
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Answers' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Hiding answers failed',
    );
    expect(screen.getByRole('button', { name: 'Hide Answers' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show Answers' })).toBeNull();
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
    expect(onProblemCountStateChange).toHaveBeenLastCalledWith({
      status: 'ready',
      count: 3,
    });
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
  it('saves all content on blur only after confirmation, preserving failure edits and retry', async () => {
    api.updateProblem.mockRejectedValueOnce(new Error('offline'));
    await loaded();
    const description = screen.getByLabelText(
      'Description',
    ) as HTMLTextAreaElement;
    fireEvent.change(description, { target: { value: 'New statement' } });
    expect(api.updateProblem).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('tab', { name: 'Anagram' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.blur(description);
    await screen.findByRole('alert');
    expect(description.value).toBe('New statement');
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry problem save' }));
    await screen.findByText('Problem saved ✓');
    expect(api.updateProblem).toHaveBeenLastCalledWith('session', 'first', {
      title: 'Two Sum',
      description: 'New statement',
      exampleInput: '1 2',
      exampleOutput: '3',
    });
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    for (const [label, value] of [
      ['Problem title', 'Renamed'],
      ['Example input', '4 5'],
      ['Example output', '9'],
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      fireEvent.blur(screen.getByLabelText(label));
      await waitFor(() =>
        expect(api.updateProblem).toHaveBeenLastCalledWith(
          'session',
          'first',
          expect.objectContaining({
            [label === 'Problem title'
              ? 'title'
              : label === 'Example input'
                ? 'exampleInput'
                : 'exampleOutput']: value,
          }),
        ),
      );
      await screen.findByText('Problem saved ✓');
    }
    expect(screen.getByRole('tab', { name: 'Renamed' })).toBeTruthy();
  });
  it('does not display saved before the backend confirms and blocks navigation', async () => {
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
    fireEvent.blur(screen.getByLabelText('Problem title'));
    expect(screen.getByText('Saving problem…')).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: 'Problem actions',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    resolve();
    expect(await screen.findByText('Problem saved ✓')).toBeTruthy();
  });
  it('clears a failed-save state when edits return to persisted content', async () => {
    api.updateProblem.mockRejectedValue(new Error('offline'));
    await loaded();
    const title = screen.getByLabelText('Problem title');
    fireEvent.change(title, { target: { value: 'Unsaved' } });
    fireEvent.blur(title);
    await screen.findByRole('alert');
    fireEvent.change(title, { target: { value: 'Two Sum' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Problem saved ✓')).toBeTruthy();
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
      screen.getByRole('button', { name: 'Problem actions' }),
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

  it('loads the selected Problem solutions and blocks tab changes until autosave confirms', async () => {
    const initialBusyChanges = onBusyChange.mock.calls.length;
    await loaded();
    const python = await screen.findByLabelText('Python Solution, editable');
    expect(python.getAttribute('data-path')).toBe(
      'officer/session/first/python',
    );
    expect(api.getSolutionsForProblem).toHaveBeenCalledWith('session', 'first');
    const javaOutput = screen.getByLabelText('Java prepared output');
    fireEvent.change(javaOutput, { target: { value: 'prepared output' } });
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    expect(
      (screen.getByRole('tab', { name: 'Anagram' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await waitFor(() =>
      expect(api.updateSolution).toHaveBeenCalledWith(
        'session',
        'first',
        'java',
        {
          code: 'java source',
          output: 'prepared output',
        },
      ),
    );
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole('tab', { name: 'Anagram' }));
    await screen.findByLabelText('Python Solution, editable');
    expect(api.getSolutionsForProblem).toHaveBeenLastCalledWith(
      'session',
      'second',
    );
    expect(onBusyChange.mock.calls.length).toBeGreaterThan(initialBusyChanges);
  });
});
