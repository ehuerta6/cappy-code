// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  createBankProblem: vi.fn(),
  getBankProblem: vi.fn(),
  listOfficerBankProblems: vi.fn(),
  updateBankProblem: vi.fn(),
  updateBankPublication: vi.fn(),
  updateBankSolution: vi.fn(),
}));

vi.mock('client-only', () => ({}));
vi.mock('@/lib/firebase/problem-bank', () => api);
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

const record = {
  id: 'two-sum',
  title: 'Two Sum',
  description: 'Find the target pair.',
  constraints: '',
  exampleInput: '1 2',
  exampleOutput: '3',
  category: 'interview-style' as const,
  isPublished: false,
  isTemporarilyHidden: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  api.listOfficerBankProblems.mockResolvedValue([record]);
  api.getBankProblem.mockResolvedValue({
    problem: record,
    solutions: {
      python: { code: 'def two_sum(): pass' },
      java: { code: 'class Solution {}' },
      cpp: { code: 'class Solution {};' },
    },
  });
  api.updateBankProblem.mockResolvedValue(undefined);
  api.updateBankPublication.mockResolvedValue(undefined);
  api.updateBankSolution.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe('Officer Problem Bank publication', () => {
  it('shows the saved publication intent and preserves unsaved content edits', async () => {
    render(<OfficerProblemBank />);
    await screen.findByRole('button', { name: 'Two Sum' });
    await screen.findByLabelText('Problem title');

    expect(screen.getByText('Publication: Unpublished')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Problem title'), {
      target: { value: 'Two Sum, revised' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await screen.findByText('Publication: Published');
    expect(api.updateBankPublication).toHaveBeenCalledWith('two-sum', true);
    expect(screen.getByLabelText('Problem title')).toHaveProperty(
      'value',
      'Two Sum, revised',
    );
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('shows a retry after publication failure and retries the same intent', async () => {
    api.updateBankPublication
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    render(<OfficerProblemBank />);
    await screen.findByRole('button', { name: 'Two Sum' });
    await screen.findByLabelText('Problem title');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    const retry = await screen.findByRole('button', { name: 'Retry Publish' });
    expect(screen.getByRole('alert').textContent).toContain(
      'Publication update failed',
    );
    fireEvent.click(retry);

    await screen.findByText('Publication: Published');
    expect(api.updateBankPublication).toHaveBeenCalledTimes(2);
  });
});
