// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  createBankProblem: vi.fn(),
  deleteBankProblem: vi.fn(),
  getBankProblem: vi.fn(),
  listBankProblemApproachTags: vi.fn(),
  listOfficerBankProblems: vi.fn(),
  listProblemUsageSummaries: vi.fn(),
  updateBankProblem: vi.fn(),
  updateBankSolution: vi.fn(),
  updateBankApproach: vi.fn(),
}));

vi.mock('client-only', () => ({}));
vi.mock('@/lib/firebase/problem-bank', () => api);
vi.mock('@/lib/firebase/problem-usage', () => ({
  listProblemUsageSummaries: api.listProblemUsageSummaries,
}));
vi.mock('@/lib/firebase/solutions', () => ({
  createApproach: vi.fn(),
  deleteApproach: vi.fn(),
  reorderApproaches: vi.fn(),
}));
vi.mock('@/lib/firebase/paths', async (original) => ({
  ...(await original<typeof import('@/lib/firebase/paths')>()),
  bankProblemPath: (id: string) => `problemBank/${id}`,
}));
vi.mock('@monaco-editor/react', () => ({
  default: ({
    value,
    options,
    onChange,
  }: {
    value: string;
    options: { readOnly: boolean; ariaLabel: string };
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label={options.ariaLabel}
      readOnly={options.readOnly}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

import OfficerProblemBank from './officer-problem-bank';
import { createApproach } from '@/lib/firebase/solutions';

const record = {
  id: 'two-sum',
  title: 'Two Sum',
  description: 'Find the target pair.',
  constraints: '',
  exampleInput: '1 2',
  exampleOutput: '3',
  category: 'interview-style' as const,
  isTemporarilyHidden: false,
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
  api.listOfficerBankProblems.mockResolvedValue([record]);
  api.listBankProblemApproachTags.mockResolvedValue({
    'two-sum': ['Arrays', 'Hash Map', 'Two Pointers'],
  });
  api.listProblemUsageSummaries.mockResolvedValue({
    'two-sum': {
      count: 2,
      lastUsed: null,
      branches: ['intro'],
      history: [
        {
          sessionId: 'past-intro',
          title: 'Past Intro Session',
          branch: 'intro',
          date: '2026-10-01',
          relativeDate: '8 days ago',
          status: 'ended',
          href: '/sessions/past-intro',
        },
      ],
    },
  });
  api.getBankProblem.mockResolvedValue({
    problem: record,
    approaches: [
      {
        id: 'primary',
        name: 'Primary Approach',
        tags: [],
        order: 0,
        solutions: {
          python: { code: 'def two_sum(): pass' },
          java: { code: 'class Solution {}' },
          cpp: { code: 'class Solution {};' },
        },
      },
    ],
    solutions: {
      python: { code: 'def two_sum(): pass' },
      java: { code: 'class Solution {}' },
      cpp: { code: 'class Solution {};' },
    },
  });
  api.updateBankProblem.mockResolvedValue(undefined);
  api.updateBankSolution.mockResolvedValue(undefined);
  api.updateBankApproach.mockResolvedValue(undefined);
  api.deleteBankProblem.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe('Officer Problem Bank', () => {
  it('uses one selected Language editor and the shared classification badges', async () => {
    render(<OfficerProblemBank />);
    await screen.findByLabelText('Python Solution, editable');
    expect(screen.getAllByLabelText(/Solution, editable/)).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Language'), {
      target: { value: 'java' },
    });
    expect(
      await screen.findByLabelText('Java Solution, editable'),
    ).toBeTruthy();
    expect(screen.getAllByLabelText(/Solution, editable/)).toHaveLength(1);
  });

  it('confirms deletion, then removes the row only after persistence succeeds', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deletion = deferred<void>();
    api.deleteBankProblem.mockReturnValueOnce(deletion.promise);
    render(<OfficerProblemBank />);
    await screen.findByLabelText('Problem title');
    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === 'P' &&
          (element.textContent?.includes('Used 2 times') ?? false),
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Used in Sessions' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Past Intro Session' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Problem' }));

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('Existing Session copies and their history'),
    );
    expect(api.deleteBankProblem).toHaveBeenCalledWith('two-sum');
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Two Sum' })).toBeTruthy();
    deletion.resolve();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Two Sum' })).toBeNull(),
    );
    confirm.mockRestore();
  });

  it('keeps Bank data visible on failure and offers a retry', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.deleteBankProblem
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    render(<OfficerProblemBank />);
    await screen.findByLabelText('Problem title');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Problem' }));

    const retry = await screen.findByRole('button', { name: 'Retry delete' });
    expect(screen.getByRole('button', { name: 'Two Sum' })).toBeTruthy();
    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Two Sum' })).toBeNull(),
    );
    expect(api.deleteBankProblem).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });

  it('disables and guards deletion when the Bank editor is dirty', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<OfficerProblemBank />);
    await screen.findByLabelText('Problem title');
    fireEvent.change(screen.getByLabelText('Problem title'), {
      target: { value: 'Unsaved title' },
    });

    expect(
      (
        screen.getByRole('button', {
          name: 'Delete Problem',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Problem' }));
    expect(api.deleteBankProblem).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('filters tag and branch results without reloading and presents a clearable empty state', async () => {
    render(<OfficerProblemBank />);
    await screen.findByRole('button', { name: 'Two Sum' });
    fireEvent.click(screen.getByText('DSA / algorithm'));
    fireEvent.click(screen.getByLabelText('Two Pointers'));
    expect(screen.getByRole('button', { name: 'Two Sum' })).toBeTruthy();
    expect(api.listOfficerBankProblems).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByText('CIC branch'));
    fireEvent.click(screen.getByLabelText('ICPC'));
    expect(
      await screen.findByText(/No Problems match these filters/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('button', { name: 'Two Sum' })).toBeTruthy();
  });

  it('preserves dirty active Approach edits until Save and switches only after persistence', async () => {
    const primary = {
      id: 'primary',
      name: 'Primary Approach',
      tags: [],
      order: 0,
      solutions: {
        python: { code: 'primary python' },
        java: { code: 'primary java' },
        cpp: { code: 'primary cpp' },
      },
    };
    const alternate = {
      id: 'alternate',
      name: 'Alternate Approach',
      tags: [],
      order: 1,
      solutions: {
        python: { code: 'alternate python' },
        java: { code: 'alternate java' },
        cpp: { code: 'alternate cpp' },
      },
    };
    api.getBankProblem.mockResolvedValueOnce({
      problem: record,
      approaches: [primary, alternate],
      solutions: primary.solutions,
    });
    const saveSolution = deferred<void>();
    api.updateBankSolution.mockReturnValueOnce(saveSolution.promise);
    render(<OfficerProblemBank />);
    await screen.findByLabelText('Python Solution, editable');
    const alternateButton = screen.getByRole('button', {
      name: 'Alternate Approach',
    });
    fireEvent.change(screen.getByLabelText('Approach name'), {
      target: { value: 'Edited Primary' },
    });
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'edited primary python' },
    });
    for (const button of [
      alternateButton,
      screen.getByRole('button', { name: 'Add Approach' }),
      screen.getByRole('button', { name: 'Delete Approach' }),
      screen.getByRole('button', { name: 'Move Approach earlier' }),
      screen.getByRole('button', { name: 'Move Approach later' }),
    ])
      expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(alternateButton);
    expect(
      (
        screen.getByLabelText(
          'Python Solution, editable',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('edited primary python');

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateBankSolution).toHaveBeenCalledOnce());
    expect(api.updateBankApproach).not.toHaveBeenCalled();
    saveSolution.resolve();
    await waitFor(() => expect(api.updateBankApproach).toHaveBeenCalledOnce());
    expect(api.updateBankApproach).toHaveBeenCalledWith(
      'two-sum',
      expect.objectContaining({
        id: 'primary',
        name: 'Edited Primary',
        solutions: expect.objectContaining({
          python: { code: 'edited primary python' },
        }),
      }),
    );
    await waitFor(() =>
      expect((alternateButton as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(alternateButton);
    expect(
      (
        screen.getByLabelText(
          'Python Solution, editable',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('alternate python');
  });

  it('keeps changes dirty and reports structural failures without changing the approach list', async () => {
    vi.mocked(createApproach).mockRejectedValueOnce(new Error('offline'));
    render(<OfficerProblemBank />);
    await screen.findByLabelText('Python Solution, editable');
    fireEvent.click(screen.getByRole('button', { name: 'Add Approach' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Approach could not be added. Retry.',
    );
    expect(screen.queryByRole('button', { name: 'New Approach' })).toBeNull();
    expect(
      (
        screen.getByLabelText(
          'Python Solution, editable',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('def two_sum(): pass');
  });

  it('has no publication controls and saves only edited content', async () => {
    render(<OfficerProblemBank />);
    await screen.findByRole('button', { name: 'Two Sum' });
    await screen.findByLabelText('Problem title');

    expect(screen.queryByRole('button', { name: /publish/i })).toBeNull();
    expect(screen.queryByText(/Published|Unpublished/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Problem title'), {
      target: { value: 'Two Sum, revised' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(api.updateBankProblem).toHaveBeenCalledWith(
        'two-sum',
        expect.objectContaining({ title: 'Two Sum, revised' }),
      ),
    );
    expect(screen.getByLabelText('Problem title')).toHaveProperty(
      'value',
      'Two Sum, revised',
    );
    expect(api).not.toHaveProperty('updateBankPublication');
  });
});
