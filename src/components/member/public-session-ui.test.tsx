// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProblemSolutions } from '@/lib/firebase/solutions';
import { ThemeProvider } from '@/components/theme-provider';
import {
  PublicSessionDiscovery,
  PublicSessionView,
  type PublicProblem,
  type PublicSessionSummary,
} from './public-session-ui';

const presentation = vi.hoisted(() => ({
  answersVisible: false,
  visibilityStatus: 'ready' as 'ready' | 'error' | 'loading',
}));
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => navigation }));

vi.mock('@/hooks/use-answer-visibility', async (original) => ({
  ...(await original<typeof import('@/hooks/use-answer-visibility')>()),
  useAnswersVisible: () => ({
    status: presentation.visibilityStatus,
    value: presentation.answersVisible,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href as string} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@monaco-editor/react', () => ({
  default: ({
    value,
    options,
    theme,
  }: {
    value: string;
    options: { readOnly: boolean; ariaLabel: string };
    theme: string;
  }) => (
    <textarea
      aria-label={options.ariaLabel}
      readOnly={options.readOnly}
      data-editor-theme={theme}
      value={value}
    />
  ),
}));

beforeEach(() => {
  presentation.answersVisible = false;
  presentation.visibilityStatus = 'ready';
  navigation.push.mockClear();
  navigation.replace.mockClear();
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

const liveSession: PublicSessionSummary = {
  id: 'live-session',
  branch: 'intro',
  title: 'Intro practice',
  date: '2026-10-04',
  status: 'live',
};
const problems: PublicProblem[] = [
  {
    id: 'later',
    title: 'Second problem',
    description: 'Second description',
    exampleInput: 'second input',
    exampleOutput: 'second output',
    constraints: '',
    order: 1,
    answersVisible: false,
  },
  {
    id: 'first',
    title: 'First problem',
    description: 'First description',
    exampleInput: 'first input',
    exampleOutput: 'first output',
    constraints: '1 ≤ nums.length ≤ 10⁴\n-10⁹ ≤ nums[i] ≤ 10⁹',
    order: 0,
    answersVisible: false,
    leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
    difficulty: 'medium',
  },
];
const solutions: ProblemSolutions = {
  python: { code: 'print("hello")' },
  java: { code: 'class Main {}' },
  cpp: { code: 'int main() {}' },
};

function viewState(
  loadRevealedSolutions: (problemId: string) => Promise<ProblemSolutions>,
  records: PublicProblem[] = problems,
) {
  return {
    status: 'ready' as const,
    session: liveSession,
    problems: { status: 'ready' as const, records },
    loadRevealedSolutions,
  };
}

describe('public member UI scaffold', () => {
  it('lists only live and ended sessions and offers no account or write controls', () => {
    render(
      <PublicSessionDiscovery
        state={{
          status: 'ready',
          sessions: [
            liveSession,
            {
              ...liveSession,
              id: 'past',
              title: 'Past practice',
              status: 'ended',
            },
            {
              ...liveSession,
              id: 'draft',
              title: 'Private draft',
              status: 'draft',
            } as unknown as PublicSessionSummary,
          ],
        }}
      />,
    );
    const liveSessionLink = screen.getByRole('link', {
      name: /Intro practice/,
    });
    expect(liveSessionLink.getAttribute('href')).toBe('/sessions/live-session');
    expect(liveSessionLink.textContent).not.toContain('Live');
    expect(
      screen.getByRole('link', { name: /Past practice/ }).getAttribute('href'),
    ).toBe('/sessions/past');
    expect(screen.getByRole('heading', { name: 'Intro' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'General' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ICPC' })).toBeTruthy();
    expect(
      within(
        screen.getByRole('region', { name: 'Intro session history' }),
      ).getByRole('heading', { name: 'Live' }),
    ).toBeTruthy();
    expect(
      within(
        screen.getByRole('region', { name: 'Intro session history' }),
      ).getByRole('heading', { name: 'Past' }),
    ).toBeTruthy();
    expect(screen.queryByText('Private draft')).toBeNull();
    expect(screen.getByRole('link', { name: 'Officer login' })).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Sessions' })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      screen
        .getByRole('link', { name: 'Problem Bank' })
        .getAttribute('aria-current'),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Toggle color theme' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByLabelText(/Password|Email/)).toBeNull();
  });

  it('groups public Sessions by branch, keeps Past newest-first, and bounds each branch history independently', () => {
    const sessions: PublicSessionSummary[] = [
      { ...liveSession, id: 'intro-live' },
      { ...liveSession, status: 'ended', id: 'intro-old', date: '2026-09-01' },
      { ...liveSession, status: 'ended', id: 'intro-new', date: '2026-10-01' },
      {
        ...liveSession,
        branch: 'general',
        id: 'general-live',
      },
      {
        ...liveSession,
        branch: 'general',
        status: 'ended',
        id: 'general-past',
      },
      { ...liveSession, branch: 'icpc', id: 'icpc-live' },
      { ...liveSession, branch: 'icpc', status: 'ended', id: 'icpc-past' },
    ];
    const { container } = render(
      <PublicSessionDiscovery state={{ status: 'ready', sessions }} />,
    );
    const intro = screen.getByRole('region', { name: 'Intro session history' });
    expect(
      Array.from(within(intro).getAllByRole('link')).map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual([
      '/sessions/intro-live',
      '/sessions/intro-new',
      '/sessions/intro-old',
    ]);
    expect(
      container.querySelector('a[href="/sessions/general-past"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('a[href="/sessions/general-live"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('a[href="/sessions/icpc-live"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('a[href="/sessions/icpc-past"]'),
    ).toBeTruthy();
    const regions = screen.getAllByRole('region', { name: /session history$/ });
    expect(regions).toHaveLength(3);
    for (const region of regions) {
      expect(region.getAttribute('tabindex')).toBe('0');
      expect(region.className).toContain('md:overflow-y-auto');
      expect(region.className).toContain('md:max-h-');
      expect(region.className).toContain('md:overscroll-contain');
    }
    expect(container.querySelector('main')?.className).not.toContain(
      'overflow-y-auto',
    );
  });

  it('shows loading, empty, and retryable discovery states', () => {
    const retry = vi.fn();
    const { rerender } = render(
      <PublicSessionDiscovery state={{ status: 'loading' }} />,
    );
    expect(screen.getByRole('status').textContent).toBe('Loading sessions…');
    rerender(<PublicSessionDiscovery state={{ status: 'empty' }} />);
    expect(screen.getAllByText('No live session right now.')).toHaveLength(3);
    expect(screen.getAllByText('No past sessions yet.')).toHaveLength(3);
    rerender(
      <PublicSessionDiscovery state={{ status: 'error', onRetry: retry }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry sessions' }));
    expect(
      screen.getByRole('button', { name: 'Retry sessions' }).className,
    ).toContain('ui-button');
    expect(retry).toHaveBeenCalledOnce();
  });

  it('uses shared focusable buttons for Member recovery controls', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('temporary failure'));
    const failedProblemState = {
      ...viewState(load),
      problems: {
        status: 'error' as const,
        errorKind: 'connection' as const,
        onRetry: vi.fn(),
      },
    };
    const { rerender } = render(
      <PublicSessionView state={failedProblemState} />,
    );
    const retryProblems = screen.getByRole('button', {
      name: 'Retry problems',
    });
    expect(retryProblems.className).toContain('ui-button');
    retryProblems.focus();
    expect(document.activeElement).toBe(retryProblems);

    presentation.visibilityStatus = 'error';
    rerender(<PublicSessionView state={viewState(load)} />);
    const retrySync = screen.getByRole('button', { name: 'Retry sync' });
    expect(retrySync.className).toContain('ui-button');
    expect(screen.queryByLabelText('Python Solution, read-only')).toBeNull();

    presentation.visibilityStatus = 'ready';
    presentation.answersVisible = true;
    rerender(
      <PublicSessionView
        state={viewState(load, [{ ...problems[1], answersVisible: true }])}
      />,
    );
    const retrySolutions = await screen.findByRole('button', {
      name: 'Retry solutions',
    });
    expect(retrySolutions.className).toContain('ui-button');
  });

  it('opens a permitted session and routes ordered problem tabs', async () => {
    const load = vi.fn().mockResolvedValue(solutions);
    const { container, rerender } = render(
      <PublicSessionView state={viewState(load)} />,
    );
    expect(
      screen.getByRole('heading', { name: 'Intro practice' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Officer login' })).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'First problem',
      'Second problem',
    ]);
    expect(tabs[0].getAttribute('aria-controls')).toBe('problem-panel-first');
    expect(tabs[1].getAttribute('aria-controls')).toBeNull();
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(
      'problem-tab-first',
    );
    expect(screen.getByText('First description')).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
    expect(screen.getByText('first input')).toBeTruthy();
    expect(screen.getByText('first output')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Constraints' })).toBeTruthy();
    expect(screen.getByText(/1 ≤ nums.length/)).toBeTruthy();
    const problemContent = screen.getByRole('region', {
      name: 'Problem content',
    });
    const problemText = problemContent.textContent ?? '';
    expect(problemText.indexOf('First description')).toBeLessThan(
      problemText.indexOf('Constraints'),
    );
    expect(problemText.indexOf('Constraints')).toBeLessThan(
      problemText.indexOf('Examples'),
    );
    expect(
      within(problemContent).getAllByRole('heading', { name: 'Examples' }),
    ).toHaveLength(1);
    expect(
      within(problemContent).getByRole('heading', { name: 'Examples' }).tagName,
    ).toBe('H3');
    expect(
      within(problemContent).getByRole('heading', { name: 'Input' }).tagName,
    ).toBe('H4');
    expect(
      within(problemContent).getByRole('heading', { name: 'Input' }),
    ).toBeTruthy();
    expect(
      within(problemContent).getByRole('heading', {
        name: 'Expected output',
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Output' })).toBeNull();
    expect(container.textContent!.indexOf('Constraints')).toBeLessThan(
      container.textContent!.indexOf('Solutions'),
    );
    expect(screen.getAllByText('Expected output')).toHaveLength(1);
    expect(screen.queryByText('hello')).toBeNull();
    expect(screen.queryByText('java output')).toBeNull();
    const leetcodeLink = screen.getByRole('link', {
      name: 'Problem link ↗',
    });
    expect(leetcodeLink.getAttribute('href')).toBe(
      'https://leetcode.com/problems/two-sum/',
    );
    expect(leetcodeLink.getAttribute('target')).toBe('_blank');
    expect(leetcodeLink.getAttribute('rel')).toBe('noopener noreferrer');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'First problem' }), {
      key: 'ArrowRight',
    });
    expect(navigation.push).toHaveBeenCalledWith(
      '/sessions/live-session/later',
    );
    rerender(
      <PublicSessionView
        state={{ ...viewState(load), selectedProblemId: 'later' }}
      />,
    );
    expect(
      screen
        .getByRole('tab', { name: 'Second problem' })
        .getAttribute('aria-controls'),
    ).toBe('problem-panel-later');
    expect(
      screen
        .getByRole('tab', { name: 'First problem' })
        .getAttribute('aria-controls'),
    ).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('tab', { name: 'Second problem' }),
      ),
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Second problem' }), {
      key: 'ArrowLeft',
    });
    expect(navigation.push).toHaveBeenLastCalledWith(
      '/sessions/live-session/first',
    );
    rerender(
      <PublicSessionView
        state={{ ...viewState(load), selectedProblemId: 'first' }}
      />,
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('tab', { name: 'First problem' }),
      ),
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: 'First problem' }), {
      key: 'End',
    });
    expect(navigation.push).toHaveBeenLastCalledWith(
      '/sessions/live-session/later',
    );
    rerender(
      <PublicSessionView
        state={{ ...viewState(load), selectedProblemId: 'later' }}
      />,
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('tab', { name: 'Second problem' }),
      ),
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Second problem' }), {
      key: 'Home',
    });
    expect(navigation.push).toHaveBeenLastCalledWith(
      '/sessions/live-session/first',
    );
    rerender(
      <PublicSessionView
        state={{ ...viewState(load), selectedProblemId: 'first' }}
      />,
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('tab', { name: 'First problem' }),
      ),
    );
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /edit|save|delete|show answers/i }),
    ).toBeNull();
  });

  it('renders Markdown in descriptions while keeping examples and constraints literal', () => {
    const load = vi.fn().mockResolvedValue(solutions);
    const markdownProblem: PublicProblem = {
      ...problems[0],
      description:
        'Use **bold**, *italic*, and `nums`.\n\n- first item\n- second item\n\n[Reference](https://example.com)',
      exampleInput: '```html\n<script>alert(1)</script>\n```\n**literal**',
      exampleOutput: '1. first\n2. second\n<tag> & value',
      constraints: '**This remains literal text.**',
    };
    const { container } = render(
      <PublicSessionView state={viewState(load, [markdownProblem])} />,
    );

    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
    expect(screen.getByText('nums').tagName).toBe('CODE');
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual(['first item', 'second item']);
    const reference = screen.getByRole('link', { name: 'Reference' });
    expect(reference.getAttribute('target')).toBe('_blank');
    expect(reference.getAttribute('rel')).toBe('noopener noreferrer');
    const examples = Array.from(container.querySelectorAll('pre'));
    expect(examples.map((example) => example.textContent)).toEqual([
      '```html\n<script>alert(1)</script>\n```\n**literal**',
      '1. first\n2. second\n<tag> & value',
    ]);
    expect(container.querySelector('pre script')).toBeNull();
    expect(container.querySelector('pre strong')).toBeNull();
    expect(screen.getByText('**This remains literal text.**')).toBeTruthy();
  });

  it('does not execute raw HTML or unsafe Markdown links', () => {
    const load = vi.fn().mockResolvedValue(solutions);
    const unsafeProblem: PublicProblem = {
      ...problems[0],
      description:
        '<script>window.markdownExecuted = true</script><img src=x onerror="window.markdownExecuted = true"> [unsafe](javascript:alert(1))',
    };
    const { container } = render(
      <PublicSessionView state={viewState(load, [unsafeProblem])} />,
    );

    expect(container.querySelector('.problem-markdown script')).toBeNull();
    expect(
      container.querySelector(
        '.problem-markdown [onclick], .problem-markdown img',
      ),
    ).toBeNull();
    expect(window).not.toHaveProperty('markdownExecuted');
    expect(screen.queryByRole('link', { name: 'unsafe' })).toBeNull();
  });

  it('renders the hidden state without requesting solution documents', () => {
    const load = vi.fn().mockResolvedValue(solutions);
    const { container } = render(<PublicSessionView state={viewState(load)} />);
    expect(screen.getByText('first input')).toBeTruthy();
    expect(screen.getByText('first output')).toBeTruthy();
    expect(screen.getAllByText('Expected output')).toHaveLength(1);
    expect(container.textContent!.indexOf('Expected output')).toBeLessThan(
      container.textContent!.indexOf('Solutions'),
    );
    expect(screen.getByText('Answers hidden')).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
    expect(
      screen.getByText('Waiting for the officer to reveal the solution…'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Python Solution, read-only')).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('loads revealed solutions into one selected read-only editor', async () => {
    presentation.answersVisible = true;
    const load = vi.fn().mockResolvedValue(solutions);
    render(
      <PublicSessionView
        state={viewState(load, [{ ...problems[1], answersVisible: true }])}
      />,
    );
    expect(
      await screen.findByLabelText('Python Solution, read-only'),
    ).toBeTruthy();
    expect(load).toHaveBeenCalledExactlyOnceWith('first');
    expect(
      (
        screen.getByLabelText(
          'Python Solution, read-only',
        ) as HTMLTextAreaElement
      ).readOnly,
    ).toBe(true);
    expect(screen.queryByLabelText('Java Solution, read-only')).toBeNull();
    expect(screen.queryByLabelText('C++ Solution, read-only')).toBeNull();
    expect((screen.getByLabelText('Language') as HTMLSelectElement).value).toBe(
      'python',
    );
    fireEvent.change(screen.getByLabelText('Language'), {
      target: { value: 'java' },
    });
    expect(
      await screen.findByLabelText('Java Solution, read-only'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Python Solution, read-only')).toBeNull();
    expect(screen.getAllByText('Expected output')).toHaveLength(1);
    expect(screen.queryByText('hello')).toBeNull();
    expect(screen.queryByText('java output')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /run|translate|submit/i }),
    ).toBeNull();
  });

  it('switches theme independently of hidden and revealed answer state', async () => {
    const load = vi.fn().mockResolvedValue(solutions);
    const records = [{ ...problems[1], answersVisible: false }];
    const view = render(
      <ThemeProvider>
        <PublicSessionView state={viewState(load, records)} />
      </ThemeProvider>,
    );
    const themeToggle = await screen.findByRole('button', {
      name: 'Toggle color theme',
    });
    expect(themeToggle.getAttribute('aria-pressed')).toBe('false');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByText('Answers hidden')).toBeTruthy();
    expect(screen.queryByLabelText('Python Solution, read-only')).toBeNull();
    expect(load).not.toHaveBeenCalled();

    fireEvent.click(themeToggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(themeToggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Answers hidden')).toBeTruthy();
    expect(load).not.toHaveBeenCalled();

    presentation.answersVisible = true;
    view.rerender(
      <ThemeProvider>
        <PublicSessionView state={viewState(load, records)} />
      </ThemeProvider>,
    );
    const darkPython = await screen.findByLabelText(
      'Python Solution, read-only',
    );
    expect(darkPython.getAttribute('data-editor-theme')).toBe('cappy-dark');
    expect(screen.queryByLabelText('Java Solution, read-only')).toBeNull();
    expect(screen.queryByLabelText('C++ Solution, read-only')).toBeNull();
    expect(load).toHaveBeenCalledExactlyOnceWith('first');

    fireEvent.click(themeToggle);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(themeToggle.getAttribute('aria-pressed')).toBe('false');
    expect(
      screen
        .getByLabelText('Python Solution, read-only')
        .getAttribute('data-editor-theme'),
    ).toBe('cappy-light');

    presentation.answersVisible = false;
    view.rerender(
      <ThemeProvider>
        <PublicSessionView state={viewState(load, records)} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Answers hidden')).toBeTruthy();
    expect(screen.queryByLabelText('Python Solution, read-only')).toBeNull();
    fireEvent.click(themeToggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByText('Answers hidden')).toBeTruthy();
  });

  it('handles a permission race safely and retries without exposing error details', async () => {
    presentation.answersVisible = true;
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('permission-denied raw detail'));
    render(
      <PublicSessionView
        state={viewState(load, [{ ...problems[1], answersVisible: true }])}
      />,
    );
    const retry = await screen.findByRole('button', {
      name: 'Retry solutions',
    });
    expect(screen.getByText('Solutions could not be loaded.')).toBeTruthy();
    expect(screen.queryByText(/permission-denied/)).toBeNull();
    expect(screen.queryByLabelText('Python Solution, read-only')).toBeNull();
    load.mockResolvedValueOnce(solutions);
    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.getByLabelText('Python Solution, read-only')).toBeTruthy(),
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('loads ended-session Solutions even when answersVisible is false', async () => {
    const ended = { ...liveSession, status: 'ended' as const };
    const load = vi.fn().mockResolvedValue(solutions);
    render(
      <PublicSessionView
        state={{
          ...viewState(load, [{ ...problems[1], answersVisible: false }]),
          session: ended,
        }}
      />,
    );
    expect(
      await screen.findByLabelText('Python Solution, read-only'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Java Solution, read-only')).toBeNull();
    expect(screen.queryByLabelText('C++ Solution, read-only')).toBeNull();
    expect(screen.queryByText('Answers hidden')).toBeNull();
    expect(screen.queryByText(/Waiting for the officer/)).toBeNull();
    expect(load).toHaveBeenCalledExactlyOnceWith('first');
  });

  it('keeps draft and unavailable sessions indistinguishable to members', () => {
    render(<PublicSessionView state={{ status: 'unavailable' }} />);
    expect(
      screen.getByRole('heading', { name: 'Session unavailable' }),
    ).toBeTruthy();
    expect(
      screen.getByText('This session is unavailable or cannot be viewed.'),
    ).toBeTruthy();
    expect(screen.queryByText(/draft/i)).toBeNull();
  });
});
