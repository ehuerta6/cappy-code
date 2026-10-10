// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render as renderBase,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getBankProblem: vi.fn(),
  listMemberBankProblems: vi.fn(),
  listProblemUsageSummaries: vi.fn(),
  listDsaTags: vi.fn(),
}));
const tagCatalog = vi.hoisted(() => [
  { id: 'arrays', label: 'Arrays', family: 'data', order: 0, active: true },
  { id: 'hash-map', label: 'Hash Map', family: 'data', order: 1, active: true },
  {
    id: 'two-pointers',
    label: 'Two Pointers',
    family: 'data',
    order: 2,
    active: true,
  },
  { id: 'graph', label: 'Graph', family: 'graph', order: 3, active: true },
  { id: 'dfs', label: 'DFS', family: 'search', order: 4, active: true },
]);

vi.mock('@/lib/firebase/problem-bank', () => api);
vi.mock('@/lib/firebase/problem-usage', () => ({
  listProblemUsageSummaries: api.listProblemUsageSummaries,
}));
vi.mock('@/lib/firebase/dsa-tags', () => ({
  listDsaTags: api.listDsaTags,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href as string} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/components/app-header', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
}));
vi.mock('@/components/member/problem-markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock('@/components/solutions/member-solution-viewer', () => ({
  default: () => <div>Prepared solution content</div>,
}));

import {
  MemberBankProblemPage,
  MemberProblemBank,
} from './member-problem-bank';
import { DsaTagCatalogProvider } from '@/components/problems/dsa-tag-catalog-provider';

function render(ui: React.ReactElement) {
  return renderBase(<DsaTagCatalogProvider>{ui}</DsaTagCatalogProvider>);
}

const problems = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    description: 'Find the pair.',
    constraints: '',
    exampleInput: '1 2',
    exampleOutput: '3',
    category: 'interview-style' as const,
    difficulty: 'easy' as const,
    leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
    approachTagSummary: ['Arrays', 'Hash Map', 'Two Pointers'],
    isTemporarilyHidden: false,
  },
  {
    id: 'graph-search',
    title: 'Graph Search',
    description: 'Visit each node.',
    constraints: '',
    exampleInput: 'A B',
    exampleOutput: 'A B',
    category: 'competitive-programming' as const,
    difficulty: 'hard' as const,
    approachTagSummary: ['Graph', 'DFS'],
    isTemporarilyHidden: false,
  },
  {
    id: 'untagged',
    title: 'Untagged Problem',
    description: 'An unclassified problem.',
    constraints: '',
    exampleInput: '',
    exampleOutput: '',
    category: 'custom' as const,
    approachTagSummary: [],
    isTemporarilyHidden: false,
  },
];

const usage = {
  'two-sum': {
    count: 2,
    lastUsed: {
      sessionId: 'past',
      title: 'Past Intro Session',
      branch: 'intro' as const,
      date: '2026-10-01',
      relativeDate: '8 days ago',
      status: 'ended' as const,
      href: '/sessions/past',
    },
    branches: ['intro'] as const,
    history: [],
  },
  'graph-search': {
    count: 1,
    lastUsed: null,
    branches: ['icpc'] as const,
    history: [],
  },
};

const solutions = {
  python: { code: 'print(3)' },
  java: { code: 'class Main {}' },
  cpp: { code: 'int main() {}' },
};

beforeEach(() => {
  vi.resetAllMocks();
  api.listMemberBankProblems.mockResolvedValue(problems);
  api.listProblemUsageSummaries.mockResolvedValue(usage);
  api.listDsaTags.mockResolvedValue(tagCatalog);
  api.getBankProblem.mockResolvedValue({
    problem: problems[0],
    solutions,
    approaches: [
      {
        id: 'primary',
        name: 'Primary Approach',
        tags: ['Arrays', 'Hash Map', 'Two Pointers'],
        order: 0,
        solutions,
      },
    ],
  });
});

afterEach(() => cleanup());

describe('Member Problem Bank metadata', () => {
  it('recovers from a DSA catalog failure and restores filters and browsing', async () => {
    const user = userEvent.setup();
    let rejectCatalog!: (reason: Error) => void;
    api.listDsaTags.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectCatalog = reject;
      }),
    );
    api.listDsaTags.mockResolvedValueOnce(tagCatalog);
    render(<MemberProblemBank />);

    expect(await screen.findByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.getByText('Loading DSA tag catalog…')).toBeTruthy();
    rejectCatalog(new Error('Catalog service unavailable'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('DSA tag filters could not be loaded.');
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
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Arrays'));
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Graph Search' })).toBeNull();
    expect(api.listDsaTags).toHaveBeenCalledTimes(2);
  });

  it('renders DSA metadata with the initial Problem results without Approach reads', async () => {
    render(<MemberProblemBank />);

    expect(await screen.findByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.getByText('Arrays')).toBeTruthy();
    expect(api.listProblemUsageSummaries).toHaveBeenCalledOnce();
    expect(api.listMemberBankProblems).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('DSA / algorithm'));
    fireEvent.click(screen.getByLabelText('Arrays'));
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Graph Search' })).toBeNull();
    expect(screen.queryByText('No filters active.')).toBeNull();
  });

  it('shows one reset action when filters return no Problems and omits empty categories', async () => {
    render(<MemberProblemBank />);

    expect(await screen.findByRole('link', { name: 'Two Sum' })).toBeTruthy();
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search Problems' }),
      {
        target: { value: 'two' },
      },
    );
    expect(
      screen.getByRole('heading', { name: 'Interview-style' }),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Custom' })).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Competitive Programming' }),
    ).toBeNull();
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search Problems' }),
      {
        target: { value: 'no matching problem' },
      },
    );

    expect(screen.getByRole('status').textContent).toContain(
      'No Problems match these filters.',
    );
    expect(
      screen.getAllByRole('button', { name: 'Clear filters' }),
    ).toHaveLength(1);
    expect(screen.queryByText('No Problems in this category.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Custom' })).toBeTruthy();
  });

  it('keeps branch-filter matches honest while tag and branch metadata is loading', async () => {
    let resolveUsage!: (value: typeof usage) => void;
    api.listProblemUsageSummaries.mockReturnValue(
      new Promise((resolve) => {
        resolveUsage = resolve;
      }),
    );
    render(<MemberProblemBank />);

    expect(await screen.findByRole('link', { name: 'Two Sum' })).toBeTruthy();
    fireEvent.click(screen.getByText('CIC branch'));
    fireEvent.click(screen.getByLabelText('Intro'));
    fireEvent.click(screen.getByText('DSA / algorithm'));
    fireEvent.click(screen.getByLabelText('Arrays'));

    expect(
      screen.getByText(
        /CIC branch filters are still loading; the selected branch filter is not applied yet\./,
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Graph Search' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Untagged Problem' })).toBeNull();
    expect(screen.queryByText('No Problems match these filters.')).toBeNull();
    resolveUsage(usage);
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Graph Search' })).toBeNull(),
    );
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Untagged Problem' })).toBeNull();
  });

  it('does not report zero branch matches when branch metadata fails', async () => {
    api.listProblemUsageSummaries.mockRejectedValueOnce(
      new Error('branch metadata unavailable'),
    );
    render(<MemberProblemBank />);

    expect(
      await screen.findByText(/CIC branch filters could not be loaded\./),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('CIC branch'));
    fireEvent.click(screen.getByLabelText('Intro'));

    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Graph Search' })).toBeTruthy();
    expect(
      screen.getByText(/CIC branch filters could not be loaded\./),
    ).toBeTruthy();
    expect(screen.queryByText('No Problems match these filters.')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Retry branch filters' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Graph Search' })).toBeNull(),
    );
    expect(api.listMemberBankProblems).toHaveBeenCalledOnce();
  });

  it('does not render the previous Bank Problem while a new detail URL loads', async () => {
    let resolveNext:
      | ((value: Awaited<ReturnType<typeof api.getBankProblem>>) => void)
      | undefined;
    api.getBankProblem
      .mockResolvedValueOnce({
        problem: problems[0],
        solutions,
        approaches: [
          {
            id: 'primary',
            name: 'Primary Approach',
            tags: [],
            order: 0,
            solutions,
          },
        ],
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveNext = resolve;
        }),
      );
    const view = render(<MemberBankProblemPage problemId="two-sum" />);
    expect(
      await screen.findByRole('heading', { name: 'Two Sum' }),
    ).toBeTruthy();

    view.rerender(<MemberBankProblemPage problemId="graph-search" />);
    expect(screen.queryByText('Find the pair.')).toBeNull();
    expect(screen.getByText('Loading Problem…')).toBeTruthy();

    resolveNext?.({ problem: problems[1], solutions, approaches: [] });
    expect(
      await screen.findByRole('heading', { name: 'Graph Search' }),
    ).toBeTruthy();
  });

  it('keeps a live-session Bank Problem unavailable to Members', async () => {
    api.getBankProblem.mockRejectedValueOnce({ code: 'permission-denied' });
    render(<MemberBankProblemPage problemId="hidden-during-live-session" />);

    expect(await screen.findByText('Problem unavailable')).toBeTruthy();
    expect(
      screen.getByText(
        'This Problem is unavailable or is being used by the live Session.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/permission-denied/)).toBeNull();
  });

  it('shows compact difficulty and consistently tinted tags without usage analytics', async () => {
    render(<MemberProblemBank />);

    expect(await screen.findByRole('link', { name: 'Two Sum' })).toBeTruthy();
    const easyBadge = screen
      .getByRole('group', { name: 'Two Sum classification' })
      .querySelector('span');
    const hardBadge = screen
      .getByRole('group', { name: 'Graph Search classification' })
      .querySelector('span');
    expect(easyBadge?.textContent).toBe('Easy');
    expect(easyBadge?.className).toContain('border-success');
    expect(hardBadge?.textContent).toBe('Hard');
    expect(hardBadge?.className).toContain('border-danger');
    await waitFor(() =>
      expect(
        screen.getAllByRole('group', { name: 'DSA / algorithm tags' }),
      ).toHaveLength(2),
    );
    const tags = screen.getAllByRole('group', { name: 'DSA / algorithm tags' });
    expect(tags[0].className).toContain('flex-wrap');
    for (const tag of ['Arrays', 'Hash Map', 'Two Pointers']) {
      const badge = [...tags[0].querySelectorAll('span')].find(
        (element) => element.textContent === tag,
      );
      expect(badge).toBeTruthy();
      if (!badge) throw new Error(`Missing ${tag} tag badge`);
      expect(badge.dataset.tagFamily).toBeTruthy();
      expect(badge.className).toContain('bg-[var(--tag-');
    }
    expect(screen.queryByText('Used 2 times')).toBeNull();
    expect(screen.queryByText('Past Intro Session')).toBeNull();
    expect(
      screen.queryByText(/Last used|Used in Sessions|Session history/),
    ).toBeNull();
    expect(api.listProblemUsageSummaries).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByText('CIC branch'));
    fireEvent.click(screen.getByLabelText('Intro'));
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Graph Search' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Untagged Problem' })).toBeNull();

    fireEvent.click(screen.getByText('DSA / algorithm'));
    fireEvent.click(screen.getByLabelText('Arrays'));
    fireEvent.click(screen.getByLabelText('Hash Map'));
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Graph Search' })).toBeNull();
  });

  it('renders no difficulty badge for Problems without difficulty', async () => {
    render(<MemberProblemBank />);
    await screen.findByRole('link', { name: 'Untagged Problem' });

    const row = screen.getByRole('group', {
      name: 'Untagged Problem classification',
    });
    expect(row.textContent).toBe('');
  });

  it('combines trimmed Problem name search with other filters and clears both locally', async () => {
    render(<MemberProblemBank />);
    await screen.findByRole('link', { name: 'Two Sum' });
    const search = screen.getByRole('searchbox', { name: 'Search Problems' });
    fireEvent.change(search, { target: { value: '  sum  ' } });
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Graph Search' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Difficulty' }));
    fireEvent.click(screen.getByLabelText('Hard'));
    expect(screen.getByText('No Problems match these filters.')).toBeTruthy();
    expect(api.listMemberBankProblems).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: /Clear all/ }));
    expect((search as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Graph Search' })).toBeTruthy();
    expect(api.listMemberBankProblems).toHaveBeenCalledOnce();
  });

  it.each([
    ['easy', 'Easy', 'border-success'],
    ['medium', 'Medium', 'border-warning'],
    ['hard', 'Hard', 'border-danger'],
  ] as const)(
    'renders %s difficulty with its semantic treatment on detail',
    async (difficulty, label, treatment) => {
      api.getBankProblem.mockResolvedValueOnce({
        problem: { ...problems[0], difficulty },
        solutions,
        approaches: [
          {
            id: 'primary',
            name: 'Primary Approach',
            tags: ['Arrays', 'Hash Map', 'Two Pointers'],
            order: 0,
            solutions,
          },
        ],
      });
      render(<MemberBankProblemPage problemId="two-sum" />);

      const badge = await screen.findByText(label);
      expect(badge.className).toContain(treatment);
      expect(badge.className).toContain('text-ink');
      expect(screen.getByText('Arrays').dataset.tagFamily).toBe('data');
      expect(screen.getByText('Find the pair.')).toBeTruthy();
      expect(screen.getByText('Prepared Solutions')).toBeTruthy();
      const problemLink = screen.getByRole('link', {
        name: 'Problem link ↗',
      });
      expect(problemLink.getAttribute('href')).toBe(
        'https://leetcode.com/problems/two-sum/',
      );
      expect(problemLink.getAttribute('target')).toBe('_blank');
      expect(problemLink.getAttribute('rel')).toBe('noopener noreferrer');
      expect(screen.queryByText('Used in Sessions')).toBeNull();
      expect(screen.queryByText('Loading usage history…')).toBeNull();
      expect(api.listProblemUsageSummaries).not.toHaveBeenCalled();
    },
  );
});
