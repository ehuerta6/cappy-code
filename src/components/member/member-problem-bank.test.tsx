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
  getBankProblem: vi.fn(),
  listBankProblemApproachTags: vi.fn(),
  listMemberBankProblems: vi.fn(),
  listProblemUsageSummaries: vi.fn(),
}));

vi.mock('@/lib/firebase/problem-bank', () => api);
vi.mock('@/lib/firebase/problem-usage', () => ({
  listProblemUsageSummaries: api.listProblemUsageSummaries,
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
  api.listBankProblemApproachTags.mockResolvedValue({
    'two-sum': ['Arrays', 'Hash Map', 'Two Pointers'],
    'graph-search': ['Graph', 'DFS'],
    untagged: [],
  });
  api.listProblemUsageSummaries.mockResolvedValue(usage);
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
  it('keeps Problem results visible and retries secondary filter metadata independently', async () => {
    api.listBankProblemApproachTags.mockRejectedValueOnce(
      new Error('tag metadata unavailable'),
    );
    render(<MemberProblemBank />);

    expect(await screen.findByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(
      await screen.findByText(
        /DSA \/ algorithm filter details could not be loaded\./,
      ),
    ).toBeTruthy();
    expect(api.listProblemUsageSummaries).toHaveBeenCalledOnce();
    expect(api.listBankProblemApproachTags).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('DSA / algorithm'));
    fireEvent.click(screen.getByLabelText('Arrays'));
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Graph Search' })).toBeTruthy();
    expect(screen.queryByText('No Problems match these filters.')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Retry filter details' }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Graph Search' })).toBeNull(),
    );
    expect(api.listBankProblemApproachTags).toHaveBeenCalledTimes(2);
    expect(api.listMemberBankProblems).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
  });

  it('keeps branch-filter matches honest while tag and branch metadata is loading', async () => {
    let resolveTags!: (value: Record<string, string[]>) => void;
    let resolveUsage!: (value: typeof usage) => void;
    api.listBankProblemApproachTags.mockReturnValue(
      new Promise((resolve) => {
        resolveTags = resolve;
      }),
    );
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
        /Selected filters are not applied yet; showing Problems that match the available filters\./,
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Graph Search' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Untagged Problem' })).toBeTruthy();
    expect(screen.queryByText('No Problems match these filters.')).toBeNull();

    resolveTags({
      'two-sum': ['Arrays'],
      'graph-search': ['Graph'],
      untagged: [],
    });
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
      await screen.findByText(
        /CIC branch filter details could not be loaded\./,
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('CIC branch'));
    fireEvent.click(screen.getByLabelText('Intro'));

    expect(screen.getByRole('link', { name: 'Two Sum' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Graph Search' })).toBeTruthy();
    expect(
      screen.getByText(/Selected filters are not applied yet/),
    ).toBeTruthy();
    expect(screen.queryByText('No Problems match these filters.')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Retry filter details' }),
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

  it('shows compact difficulty and neutral tags without usage analytics, while filters keep working', async () => {
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
      expect(badge.className).toContain('bg-raised');
      expect(badge.className).toContain('border-border-soft');
      expect(badge.className).not.toMatch(/success|warning|danger/);
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
      expect(screen.getByText('Arrays').className).toContain('bg-raised');
      expect(screen.getByText('Find the pair.')).toBeTruthy();
      expect(screen.getByText('Prepared Solutions')).toBeTruthy();
      expect(screen.queryByText('Used in Sessions')).toBeNull();
      expect(screen.queryByText('Loading usage history…')).toBeNull();
      expect(api.listProblemUsageSummaries).not.toHaveBeenCalled();
    },
  );
});
