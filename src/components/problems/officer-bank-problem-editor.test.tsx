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

const { api, push, createApproach, deleteApproach, reorderApproaches } =
  vi.hoisted(() => ({
    push: vi.fn(),
    createApproach: vi.fn(),
    deleteApproach: vi.fn(),
    reorderApproaches: vi.fn(),
    api: {
      getBankProblem: vi.fn(),
      listProblemUsageSummaries: vi.fn(),
      updateBankProblem: vi.fn(),
      updateBankSolution: vi.fn(),
      updateBankApproach: vi.fn(),
      deleteBankProblem: vi.fn(),
    },
  }));

vi.mock('client-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/firebase/problem-bank', () => api);
vi.mock('@/lib/firebase/problem-usage', () => ({
  listProblemUsageSummaries: api.listProblemUsageSummaries,
}));
vi.mock('@/lib/firebase/solutions', () => ({
  createApproach,
  deleteApproach,
  reorderApproaches,
}));
vi.mock('@monaco-editor/react', () => ({
  default: ({
    value,
    options,
    onChange,
  }: {
    value: string;
    options: { ariaLabel: string };
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label={options.ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

import OfficerBankProblemEditor from './officer-bank-problem-editor';

const problem = {
  id: 'two-sum',
  title: 'Two Sum',
  description: 'Find a pair.',
  constraints: 'At most 100 values.',
  exampleInput: '[2, 7]',
  exampleOutput: '9',
  category: 'interview-style' as const,
  difficulty: 'easy' as const,
  isTemporarilyHidden: false,
  approachTagSummary: ['Arrays'],
};
const approach = {
  id: 'primary',
  name: 'Primary Approach',
  tags: ['Arrays'],
  order: 0,
  solutions: {
    python: { code: 'def two_sum(): pass', timeComplexity: 'O(n)' },
    java: { code: 'class Solution {}' },
    cpp: { code: 'class Solution {};' },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  api.getBankProblem.mockResolvedValue({
    problem,
    approaches: [approach],
    solutions: approach.solutions,
  });
  api.listProblemUsageSummaries.mockResolvedValue({
    'two-sum': { count: 0, lastUsed: null, branches: [], history: [] },
  });
  api.updateBankProblem.mockResolvedValue(undefined);
  api.updateBankSolution.mockResolvedValue(undefined);
  api.updateBankApproach.mockResolvedValue(undefined);
  api.deleteBankProblem.mockResolvedValue(undefined);
  createApproach.mockResolvedValue({
    id: 'new',
    name: 'New Approach',
    tags: [],
    order: 1,
    solutions: approach.solutions,
  });
  deleteApproach.mockResolvedValue(undefined);
  reorderApproaches.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe('Officer Problem editor', () => {
  it('loads the Problem from its direct route id and keeps the editor visible while history loads', async () => {
    const usage = deferred<Record<string, never>>();
    api.listProblemUsageSummaries.mockReturnValue(usage.promise);
    render(<OfficerBankProblemEditor problemId="two-sum" />);

    expect(await screen.findByLabelText('Title')).toBeTruthy();
    expect(api.getBankProblem).toHaveBeenCalledWith('two-sum', true);
    expect(screen.getByText('Loading usage history…')).toBeTruthy();
  });

  it('shows one workspace save action and retains edits when a save fails', async () => {
    api.updateBankProblem.mockRejectedValueOnce(new Error('offline'));
    render(<OfficerBankProblemEditor problemId="two-sum" />);
    const title = await screen.findByLabelText('Title');
    fireEvent.change(title, { target: { value: 'Two Sum Updated' } });
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(
      screen.getAllByRole('button', { name: 'Save changes' }),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByRole('button', { name: 'Retry save' }),
    ).toBeTruthy();
    expect((title as HTMLInputElement).value).toBe('Two Sum Updated');
    expect(screen.getByText(/Save failed/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
    await waitFor(() => expect(screen.getByText('Saved ✓')).toBeTruthy());
    expect(api.updateBankProblem).toHaveBeenCalledTimes(2);
  });

  it('protects a dirty editor when following the Problem Bank link', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<OfficerBankProblemEditor problemId="two-sum" />);
    fireEvent.change(await screen.findByLabelText('Title'), {
      target: { value: 'Unsaved title' },
    });
    fireEvent.click(screen.getByRole('link', { name: '← Problem Bank' }));
    expect(confirm).toHaveBeenCalledWith(
      'Leave this Problem editor and discard unsaved changes?',
    );
    expect(
      ((await screen.findByLabelText('Title')) as HTMLInputElement).value,
    ).toBe('Unsaved title');
    confirm.mockRestore();
  });

  it('keeps language selection and approach management available in the workspace', async () => {
    render(<OfficerBankProblemEditor problemId="two-sum" />);
    await screen.findByLabelText('Python Solution, editable');
    fireEvent.change(screen.getByLabelText('Language'), {
      target: { value: 'cpp' },
    });
    expect(await screen.findByLabelText('C++ Solution, editable')).toBeTruthy();
    fireEvent.click(screen.getByText('Manage approaches'));
    expect(screen.getByLabelText('Approach name')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Move Approach earlier' }),
    ).toBeNull();
  });

  it('confirms deletion and preserves Session snapshot semantics', async () => {
    render(<OfficerBankProblemEditor problemId="two-sum" />);
    await screen.findByLabelText('Title');
    fireEvent.click(screen.getByText('More'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Problem' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain(
      'Existing Session copies and their history will remain unchanged',
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Delete Problem' }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/officer/problem-bank'),
    );
  });
});
