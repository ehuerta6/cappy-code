// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { api, push } = vi.hoisted(() => ({
  push: vi.fn(),
  api: {
    createBankProblem: vi.fn(),
    listOfficerBankProblems: vi.fn(),
    listProblemUsageSummaries: vi.fn(),
    getBankProblem: vi.fn(),
    listBankProblemApproachTags: vi.fn(),
  },
}));

vi.mock('client-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/firebase/problem-bank', () => api);
vi.mock('@/lib/firebase/problem-usage', () => ({
  listProblemUsageSummaries: api.listProblemUsageSummaries,
}));

import OfficerProblemBank from './officer-problem-bank';

const records = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    description: '',
    constraints: '',
    exampleInput: '',
    exampleOutput: '',
    category: 'interview-style' as const,
    difficulty: 'easy' as const,
    isTemporarilyHidden: false,
    approachTagSummary: ['Arrays', 'Hash Map'],
  },
  {
    id: 'grid-count',
    title: 'Count Grid Regions',
    description: '',
    constraints: '',
    exampleInput: '',
    exampleOutput: '',
    category: 'competitive-programming' as const,
    difficulty: 'hard' as const,
    isTemporarilyHidden: false,
    approachTagSummary: ['BFS', 'Graph'],
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  api.listOfficerBankProblems.mockResolvedValue(records);
  api.listProblemUsageSummaries.mockResolvedValue({
    'two-sum': { count: 0, lastUsed: null, branches: [], history: [] },
    'grid-count': { count: 1, lastUsed: null, branches: ['icpc'], history: [] },
  });
  api.createBankProblem.mockResolvedValue(records[0]);
});

afterEach(() => cleanup());

describe('Officer Problem Bank discovery', () => {
  it('uses shared search, filters, categories, and metadata without loading Solutions', async () => {
    render(<OfficerProblemBank />);
    expect(await screen.findByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Competitive Programming' }),
    ).toBeTruthy();
    expect(screen.getByText('Hash Map')).toBeTruthy();
    expect(screen.queryByText(/Used 0 times/)).toBeNull();
    expect(api.getBankProblem).not.toHaveBeenCalled();
    expect(api.listBankProblemApproachTags).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(api.listProblemUsageSummaries).toHaveBeenCalledTimes(1),
    );
  });

  it('combines name search with filters and links a Problem to its editor route', async () => {
    render(<OfficerProblemBank />);
    const twoSum = await screen.findByRole('link', { name: 'Two Sum' });
    expect(twoSum.getAttribute('href')).toBe('/officer/problem-bank/two-sum');

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search Problems' }),
      {
        target: { value: '  GRID ' },
      },
    );
    expect(
      screen.getByRole('link', { name: 'Count Grid Regions' }),
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Two Sum' })).toBeNull();
  });

  it('creates a Bank Problem and navigates to its editor', async () => {
    render(<OfficerProblemBank />);
    await screen.findByRole('link', { name: 'Two Sum' });
    fireEvent.click(screen.getByRole('button', { name: '+ New Problem' }));

    await waitFor(() => {
      expect(api.createBankProblem).toHaveBeenCalledOnce();
      expect(push).toHaveBeenCalledWith('/officer/problem-bank/two-sum');
    });
  });

  it('shows a clear empty result for search and filters', async () => {
    render(<OfficerProblemBank />);
    await screen.findByRole('link', { name: 'Two Sum' });
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search Problems' }),
      {
        target: { value: 'missing problem' },
      },
    );
    expect(screen.getByRole('status').textContent).toContain(
      'No Problems match these filters.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
  });
});
