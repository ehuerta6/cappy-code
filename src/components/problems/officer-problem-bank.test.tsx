// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { api, push } = vi.hoisted(() => ({
  push: vi.fn(),
  api: {
    createBankProblem: vi.fn(),
    listOfficerBankProblems: vi.fn(),
    listProblemUsageSummaries: vi.fn(),
    getBankProblem: vi.fn(),
    listBankProblemApproachTags: vi.fn(),
    listDsaTags: vi.fn(),
  },
}));

vi.mock('client-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/firebase/problem-bank', () => api);
vi.mock('@/lib/firebase/problem-usage', () => ({
  listProblemUsageSummaries: api.listProblemUsageSummaries,
}));
vi.mock('@/lib/firebase/dsa-tags', () => ({ listDsaTags: api.listDsaTags }));

import OfficerProblemBank from './officer-problem-bank';
import { DsaTagCatalogProvider } from './dsa-tag-catalog-provider';

function renderBank() {
  return render(
    <DsaTagCatalogProvider>
      <OfficerProblemBank />
    </DsaTagCatalogProvider>,
  );
}

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
  api.listDsaTags.mockResolvedValue([
    { id: 'arrays', label: 'Arrays', family: 'data', order: 0, active: true },
    {
      id: 'hash-map',
      label: 'Hash Map',
      family: 'data',
      order: 1,
      active: true,
    },
    { id: 'bfs', label: 'BFS', family: 'search', order: 2, active: true },
    { id: 'graph', label: 'Graph', family: 'graph', order: 3, active: true },
  ]);
});

afterEach(() => cleanup());

describe('Officer Problem Bank discovery', () => {
  it('uses shared search, filters, categories, and metadata without loading Solutions', async () => {
    renderBank();
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
    renderBank();
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
    renderBank();
    await screen.findByRole('link', { name: 'Two Sum' });
    fireEvent.click(screen.getByRole('button', { name: '+ New Problem' }));

    await waitFor(() => {
      expect(api.createBankProblem).toHaveBeenCalledOnce();
      expect(push).toHaveBeenCalledWith('/officer/problem-bank/two-sum');
    });
  });

  it('shows a clear empty result for search and filters', async () => {
    renderBank();
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

  it('recovers from a DSA catalog failure and restores Officer filters and browsing', async () => {
    const user = userEvent.setup();
    let rejectCatalog!: (reason: Error) => void;
    api.listDsaTags.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectCatalog = reject;
      }),
    );
    api.listDsaTags.mockResolvedValueOnce([
      {
        id: 'arrays',
        label: 'Arrays',
        family: 'data',
        order: 0,
        active: true,
      },
      {
        id: 'hash-map',
        label: 'Hash Map',
        family: 'data',
        order: 1,
        active: true,
      },
      { id: 'bfs', label: 'BFS', family: 'search', order: 2, active: true },
      {
        id: 'graph',
        label: 'Graph',
        family: 'graph',
        order: 3,
        active: true,
      },
    ]);
    renderBank();

    expect(await screen.findByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.getByText('Loading DSA tag catalog…')).toBeTruthy();
    rejectCatalog(new Error('Catalog service unavailable'));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'DSA tag filters could not be loaded.',
    );
    expect(screen.queryByText('Loading DSA tag catalog…')).toBeNull();
    expect(
      screen.getByRole('searchbox', { name: 'Search Problems' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Difficulty' }));
    fireEvent.click(screen.getByLabelText('Easy'));

    await user.tab();
    while (
      document.activeElement !==
      screen.getByRole('button', { name: 'Retry loading tags' })
    ) {
      await user.tab();
    }
    await user.keyboard('{Enter}');

    await screen.findByRole('button', { name: /DSA \/ algorithm/ });
    fireEvent.click(screen.getByRole('button', { name: 'Difficulty (1)' }));
    expect((screen.getByLabelText('Easy') as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: /DSA \/ algorithm/ }));
    expect(await screen.findByLabelText('Arrays')).toBeTruthy();
    expect(
      screen.queryByRole('link', { name: 'Count Grid Regions' }),
    ).toBeNull();
    fireEvent.click(screen.getByLabelText('Arrays'));
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(
      screen.queryByRole('link', { name: 'Count Grid Regions' }),
    ).toBeNull();
    expect(api.listDsaTags).toHaveBeenCalledTimes(2);
  });
});
