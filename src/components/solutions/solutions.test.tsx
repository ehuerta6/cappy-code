// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProblemSolutions } from '@/lib/firebase/solutions';

const persistence = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/firebase/solutions', () => ({
  getSolutionsForProblem: persistence.load,
  updateSolution: persistence.save,
}));
vi.mock('@monaco-editor/react', () => ({
  default: ({
    language,
    value,
    onChange,
    options,
    path,
  }: {
    language: string;
    value: string;
    onChange: (value: string) => void;
    options: { readOnly: boolean; ariaLabel: string };
    path: string;
  }) => (
    <textarea
      aria-label={options.ariaLabel}
      readOnly={options.readOnly}
      data-language={language}
      data-path={path}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
import OfficerSolutions from './officer-solutions';
import SolutionWorkspace from './solution-workspace';

const solutions: ProblemSolutions = {
  python: { code: 'python source' },
  java: { code: 'java source' },
  cpp: { code: 'cpp source' },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  persistence.load.mockResolvedValue(solutions);
  persistence.save.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function openOfficer(
  onPendingChange = vi.fn(),
  onSaveStateChange = vi.fn(),
) {
  const view = render(
    <OfficerSolutions
      sessionId="s"
      problemId="p"
      onPendingChange={onPendingChange}
      onSaveStateChange={onSaveStateChange}
    />,
  );
  await screen.findByLabelText('Python Solution, editable');
  return view;
}

describe('solution workspace', () => {
  it('renders all three read-only source panels without output or execution controls', () => {
    render(<SolutionWorkspace solutions={solutions} modelPath="member/s/p" />);
    for (const [language, name] of [
      ['python', 'Python'],
      ['java', 'Java'],
      ['cpp', 'C++'],
    ]) {
      const editor = screen.getByLabelText(
        `${name} Solution, read-only`,
      ) as HTMLTextAreaElement;
      expect(editor.readOnly).toBe(true);
      expect(editor.dataset.language).toBe(language);
      expect(editor.dataset.path).toBe(`member/s/p/${language}`);
    }
    expect(screen.queryByText('python output')).toBeNull();
    expect(screen.queryByText('Output')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(persistence.load).not.toHaveBeenCalled();
  });
  it('keeps source local until the reported save action runs', async () => {
    const onPending = vi.fn();
    const saveState = vi.fn();
    await openOfficer(onPending, saveState);
    const editor = screen.getByLabelText(
      'Java Solution, editable',
    ) as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(false);
    fireEvent.change(editor, { target: { value: 'new java' } });
    expect(screen.queryByLabelText('Java prepared output')).toBeNull();
    expect(onPending).toHaveBeenLastCalledWith(true);
    expect(persistence.save).not.toHaveBeenCalled();
    expect(saveState.mock.calls.at(-1)?.[0]).toMatchObject({ dirty: true });
    await act(async () => saveState.mock.calls.at(-1)?.[0].save());
    expect(persistence.save).toHaveBeenCalledExactlyOnceWith('s', 'p', 'java', {
      code: 'new java',
    });
    expect(onPending).toHaveBeenLastCalledWith(false);
  });
  it('edits and explicitly saves complexity with its language Solution', async () => {
    const saveState = vi.fn();
    await openOfficer(vi.fn(), saveState);
    fireEvent.change(screen.getAllByLabelText('Time Complexity')[0], {
      target: { value: 'O(n)' },
    });
    fireEvent.change(screen.getAllByLabelText('Time explanation')[0], {
      target: { value: 'One pass through the list.' },
    });
    fireEvent.change(screen.getAllByLabelText('Space Complexity')[0], {
      target: { value: 'O(1)' },
    });
    fireEvent.change(screen.getAllByLabelText('Space explanation')[0], {
      target: { value: 'Only a fixed number of variables are stored.' },
    });
    expect(persistence.save).not.toHaveBeenCalled();
    await act(async () => saveState.mock.calls.at(-1)?.[0].save());
    expect(persistence.save).toHaveBeenCalledExactlyOnceWith(
      's',
      'p',
      'python',
      {
        code: 'python source',
        timeComplexity: 'O(n)',
        timeComplexityReason: 'One pass through the list.',
        spaceComplexity: 'O(1)',
        spaceComplexityReason: 'Only a fixed number of variables are stored.',
      },
    );
  });
  it('shows optional analysis outside the read-only Monaco editor', () => {
    render(
      <SolutionWorkspace
        solutions={{
          ...solutions,
          python: {
            ...solutions.python,
            timeComplexity: 'O(n)',
            timeComplexityReason: 'One pass through the list.',
            spaceComplexity: 'O(1)',
          },
        }}
        modelPath="member/s/p"
      />,
    );
    expect(screen.getByText('Time: O(n)')).toBeTruthy();
    expect(screen.getByText('One pass through the list.')).toBeTruthy();
    expect(screen.getByText('Space: O(1)')).toBeTruthy();
    expect(
      (
        screen.getByLabelText(
          'Python Solution, read-only',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('python source');
    expect(screen.queryByText('Time: undefined')).toBeNull();
  });
  it('retains failed edits and retries only when explicitly requested', async () => {
    const saveState = vi.fn();
    await openOfficer(vi.fn(), saveState);
    persistence.save.mockRejectedValueOnce(new Error('offline'));
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'unsaved python' },
    });
    expect(persistence.save).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 750));
    expect(persistence.save).not.toHaveBeenCalled();
    await act(async () => saveState.mock.calls.at(-1)?.[0].save());
    expect(
      (
        screen.getByLabelText(
          'Python Solution, editable',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('unsaved python');
    expect(saveState.mock.calls.at(-1)?.[0].error).toContain(
      'Python Solution could not be saved',
    );
    expect(persistence.save).toHaveBeenCalledTimes(1);
    await act(async () => saveState.mock.calls.at(-1)?.[0].save());
    expect(persistence.save).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('returns to a clean state when all edits are reverted without writing', async () => {
    const onPending = vi.fn();
    const saveState = vi.fn();
    await openOfficer(onPending, saveState);
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'temporary edit' },
    });
    expect(onPending).toHaveBeenLastCalledWith(true);
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'python source' },
    });
    await waitFor(() => expect(onPending).toHaveBeenLastCalledWith(false));
    expect(persistence.save).not.toHaveBeenCalled();
    expect(saveState.mock.calls.at(-1)?.[0]).toBeNull();
  });
  it('keeps newer edits made during an outstanding write and saves them next', async () => {
    const onPending = vi.fn();
    const saveState = vi.fn();
    await openOfficer(onPending, saveState);
    let resolve: () => void = () => {};
    persistence.save.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    fireEvent.change(screen.getByLabelText('C++ Solution, editable'), {
      target: { value: 'first' },
    });
    let firstSave!: Promise<void>;
    act(() => {
      firstSave = saveState.mock.calls.at(-1)?.[0].save();
    });
    fireEvent.change(screen.getByLabelText('C++ Solution, editable'), {
      target: { value: 'second' },
    });
    await act(async () => {
      resolve();
      await firstSave;
    });
    expect(onPending).toHaveBeenLastCalledWith(true);
    expect(
      (screen.getByLabelText('C++ Solution, editable') as HTMLTextAreaElement)
        .value,
    ).toBe('second');
    await act(async () => saveState.mock.calls.at(-1)?.[0].save());
    expect(persistence.save).toHaveBeenLastCalledWith('s', 'p', 'cpp', {
      code: 'second',
    });
    expect(onPending).toHaveBeenLastCalledWith(false);
  });
  it('locks code during a parent operation', async () => {
    render(<OfficerSolutions sessionId="s" problemId="p" disabled />);
    const editor = (await screen.findByLabelText(
      'Python Solution, temporarily read-only',
    )) as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(true);
    expect(screen.queryByLabelText('Python prepared output')).toBeNull();
  });
  it('keeps a failed dirty save blocking until the officer restores confirmed content', async () => {
    const pending = vi.fn();
    const saveState = vi.fn();
    await openOfficer(pending, saveState);
    persistence.save.mockRejectedValueOnce(new Error('offline'));
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'failed change' },
    });
    await act(async () => saveState.mock.calls.at(-1)?.[0].save());
    expect(pending).toHaveBeenLastCalledWith(true);
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'python source' },
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(pending).toHaveBeenLastCalledWith(false);
  });
  it('shows confirmed content if a pending write fails after the officer restores it', async () => {
    const pending = vi.fn();
    const saveState = vi.fn();
    await openOfficer(pending, saveState);
    let reject: (error: Error) => void = () => {};
    persistence.save.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, failed) => {
          reject = failed;
        }),
    );
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'pending change' },
    });
    let pendingSave!: Promise<void>;
    act(() => {
      pendingSave = saveState.mock.calls.at(-1)?.[0].save();
    });
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'python source' },
    });
    await act(async () => {
      reject(new Error('offline'));
      await pendingSave;
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(pending).toHaveBeenLastCalledWith(false);
  });
  it('loads the selected Problem and discards an obsolete fetch result', async () => {
    let first: (value: ProblemSolutions) => void = () => {};
    persistence.load.mockImplementationOnce(
      () =>
        new Promise<ProblemSolutions>((resolve) => {
          first = resolve;
        }),
    );
    const view = render(<OfficerSolutions sessionId="s" problemId="first" />);
    expect(screen.getByText('Loading solutions…')).toBeTruthy();
    view.rerender(<OfficerSolutions sessionId="s" problemId="second" />);
    await screen.findByLabelText('Python Solution, editable');
    await act(async () => {
      first({ ...solutions, python: { code: 'stale' } });
    });
    expect(
      (
        screen.getByLabelText(
          'Python Solution, editable',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('python source');
    expect(persistence.load).toHaveBeenLastCalledWith('s', 'second');
  });
  it('shows load error and a working retry without mounting blank editors', async () => {
    persistence.load.mockRejectedValueOnce(new Error('offline'));
    render(<OfficerSolutions sessionId="s" problemId="p" />);
    await screen.findByRole('button', { name: 'Retry solutions' });
    expect(screen.queryByLabelText('Python Solution, editable')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry solutions' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Python Solution, editable')).toBeTruthy(),
    );
  });
});
