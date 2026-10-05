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
  python: { code: 'python source', output: 'python output' },
  java: { code: 'java source', output: 'java output' },
  cpp: { code: 'cpp source', output: '' },
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

async function openOfficer(onPendingChange = vi.fn()) {
  const view = render(
    <OfficerSolutions
      sessionId="s"
      problemId="p"
      onPendingChange={onPendingChange}
    />,
  );
  await screen.findByLabelText('Python Solution, editable');
  return view;
}
async function autosave() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(750);
  });
}

describe('solution workspace', () => {
  it('renders all three read-only languages and static output without fetching or execution controls', () => {
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
    expect(screen.getByText('python output').tagName).toBe('PRE');
    expect(screen.getByText('No prepared output')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(persistence.load).not.toHaveBeenCalled();
  });
  it('edits and saves source and prepared output independently after a pause', async () => {
    const onPending = vi.fn();
    await openOfficer(onPending);
    vi.useFakeTimers();
    const editor = screen.getByLabelText(
      'Java Solution, editable',
    ) as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(false);
    fireEvent.change(editor, { target: { value: 'new java' } });
    fireEvent.change(screen.getByLabelText('Java prepared output'), {
      target: { value: 'new output' },
    });
    expect(onPending).toHaveBeenLastCalledWith(true);
    expect(persistence.save).not.toHaveBeenCalled();
    await autosave();
    expect(persistence.save).toHaveBeenCalledExactlyOnceWith('s', 'p', 'java', {
      code: 'new java',
      output: 'new output',
    });
    expect(onPending).toHaveBeenLastCalledWith(false);
  });
  it('retains failed edits and retries only when explicitly requested', async () => {
    await openOfficer();
    vi.useFakeTimers();
    persistence.save.mockRejectedValueOnce(new Error('offline'));
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'unsaved python' },
    });
    await autosave();
    expect(
      (
        screen.getByLabelText(
          'Python Solution, editable',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('unsaved python');
    expect(screen.getByRole('alert').textContent).toContain(
      'Python changes could not be saved',
    );
    await autosave();
    expect(persistence.save).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Retry Python save' }),
      );
    });
    expect(persistence.save).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('keeps newer edits made during an outstanding write and saves them next', async () => {
    const onPending = vi.fn();
    await openOfficer(onPending);
    vi.useFakeTimers();
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
    await autosave();
    fireEvent.change(screen.getByLabelText('C++ Solution, editable'), {
      target: { value: 'second' },
    });
    await act(async () => {
      resolve();
    });
    expect(onPending).toHaveBeenLastCalledWith(true);
    expect(
      (screen.getByLabelText('C++ Solution, editable') as HTMLTextAreaElement)
        .value,
    ).toBe('second');
    await autosave();
    expect(persistence.save).toHaveBeenLastCalledWith('s', 'p', 'cpp', {
      code: 'second',
      output: '',
    });
    expect(onPending).toHaveBeenLastCalledWith(false);
  });
  it('locks code and output during a parent operation', async () => {
    render(<OfficerSolutions sessionId="s" problemId="p" disabled />);
    const editor = (await screen.findByLabelText(
      'Python Solution, temporarily read-only',
    )) as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(true);
    expect(
      (screen.getByLabelText('Python prepared output') as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);
  });
  it('keeps a failed dirty save blocking until the officer restores confirmed content', async () => {
    const pending = vi.fn();
    await openOfficer(pending);
    vi.useFakeTimers();
    persistence.save.mockRejectedValueOnce(new Error('offline'));
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'failed change' },
    });
    await autosave();
    expect(pending).toHaveBeenLastCalledWith(true);
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'python source' },
    });
    expect(
      screen.queryByRole('button', { name: 'Retry Python save' }),
    ).toBeNull();
    expect(pending).toHaveBeenLastCalledWith(false);
  });
  it('shows confirmed content if a pending write fails after the officer restores it', async () => {
    const pending = vi.fn();
    await openOfficer(pending);
    vi.useFakeTimers();
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
    await autosave();
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'python source' },
    });
    await act(async () => {
      reject(new Error('offline'));
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
      first({ ...solutions, python: { code: 'stale', output: '' } });
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
