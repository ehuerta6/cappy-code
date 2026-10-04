// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProblemSolutions } from '@/lib/firebase/solutions';
import {
  PublicSessionDiscovery,
  PublicSessionView,
  type PublicProblem,
  type PublicSessionSummary,
} from './public-session-ui';

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
  }: {
    value: string;
    options: { readOnly: boolean; ariaLabel: string };
  }) => (
    <textarea
      aria-label={options.ariaLabel}
      readOnly={options.readOnly}
      value={value}
    />
  ),
}));

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const liveSession: PublicSessionSummary = {
  id: 'live-session',
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
    order: 1,
    answersVisible: false,
  },
  {
    id: 'first',
    title: 'First problem',
    description: 'First description',
    exampleInput: 'first input',
    exampleOutput: 'first output',
    order: 0,
    answersVisible: false,
  },
];
const solutions: ProblemSolutions = {
  python: { code: 'print("hello")', output: 'hello' },
  java: { code: 'class Main {}', output: 'java output' },
  cpp: { code: 'int main() {}', output: '' },
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
    expect(
      screen.getByRole('link', { name: /Intro practice/ }).getAttribute('href'),
    ).toBe('/sessions/live-session');
    expect(
      screen.getByRole('link', { name: /Past practice/ }).getAttribute('href'),
    ).toBe('/sessions/past');
    expect(screen.queryByText('Private draft')).toBeNull();
    expect(screen.getByRole('link', { name: 'Officer Login' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByLabelText(/Password|Email/)).toBeNull();
  });

  it('shows loading, empty, and retryable discovery states', () => {
    const retry = vi.fn();
    const { rerender } = render(
      <PublicSessionDiscovery state={{ status: 'loading' }} />,
    );
    expect(screen.getByRole('status').textContent).toBe('Loading sessions…');
    rerender(<PublicSessionDiscovery state={{ status: 'empty' }} />);
    expect(screen.getByText('No public sessions are available.')).toBeTruthy();
    rerender(
      <PublicSessionDiscovery state={{ status: 'error', onRetry: retry }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry sessions' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('opens a permitted session and navigates ordered problem tabs locally', () => {
    const load = vi.fn().mockResolvedValue(solutions);
    render(<PublicSessionView state={viewState(load)} />);
    expect(
      screen.getByRole('heading', { name: 'Intro practice' }),
    ).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'First problem',
      'Second problem',
    ]);
    expect(screen.getByText('First description')).toBeTruthy();
    expect(screen.getByText('first input')).toBeTruthy();
    expect(screen.getByText('first output')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Second problem' }));
    expect(screen.getByText('Second description')).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /edit|save|delete|show answers/i }),
    ).toBeNull();
  });

  it('renders the hidden state without requesting solution documents', () => {
    const load = vi.fn().mockResolvedValue(solutions);
    render(<PublicSessionView state={viewState(load)} />);
    expect(screen.getByText('Answers hidden')).toBeTruthy();
    expect(
      screen.getByText('Waiting for the officer to reveal the solution…'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Python Solution, read-only')).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('loads revealed solutions into the existing read-only workspace', async () => {
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
    expect(screen.getByText('hello').tagName).toBe('PRE');
    expect(
      screen.queryByRole('button', { name: /run|translate|submit/i }),
    ).toBeNull();
  });

  it('handles a permission race safely and retries without exposing error details', async () => {
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

  it('uses a non-promissory hidden state for ended sessions', () => {
    const ended = { ...liveSession, status: 'ended' as const };
    render(
      <PublicSessionView state={{ ...viewState(vi.fn()), session: ended }} />,
    );
    expect(
      screen.getByText('Answers are hidden for this Problem.'),
    ).toBeTruthy();
    expect(screen.queryByText(/Waiting for the officer/)).toBeNull();
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
