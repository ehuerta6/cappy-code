// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listMemberSessions: vi.fn(),
  getMemberSession: vi.fn(),
  listMemberProblems: vi.fn(),
  getMemberSolutions: vi.fn(),
}));
const realtime = vi.hoisted(() => ({
  answersVisible: false,
}));

vi.mock('@/lib/firebase/member', () => api);
vi.mock('@/hooks/use-answer-visibility', async (original) => ({
  ...(await original<typeof import('@/hooks/use-answer-visibility')>()),
  useAnswersVisible: () => ({
    status: 'ready',
    value: realtime.answersVisible,
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

import MemberHome from './member-home';
import MemberSessionPage from './member-session-page';

const session = {
  id: 'intro',
  session: {
    title: 'Intro practice',
    date: '2026-10-04',
    status: 'live' as const,
  },
};
const problem = {
  id: 'arrays',
  problem: {
    title: 'Arrays',
    description: 'Find the pair.',
    exampleInput: '2 4',
    exampleOutput: '6',
    order: 0,
    answersVisible: false,
  },
};
const solutions = {
  python: { code: 'print(6)' },
  java: { code: 'class Main {}' },
  cpp: { code: 'int main() {}' },
};

beforeEach(() => {
  realtime.answersVisible = false;
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  api.listMemberSessions.mockResolvedValue([session]);
  api.getMemberSession.mockResolvedValue(session);
  api.listMemberProblems.mockResolvedValue([problem]);
  api.getMemberSolutions.mockResolvedValue(solutions);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('public member page integration', () => {
  it('shows discovered public Sessions with links to their read-only pages', async () => {
    render(<MemberHome />);
    const link = await screen.findByRole('link', { name: /Intro practice/ });
    expect(link.getAttribute('href')).toBe('/sessions/intro');
    expect(
      screen.queryByRole('button', { name: /create|delete|edit/i }),
    ).toBeNull();
  });

  it('does not request hidden Solutions and shows the hidden-answer state', async () => {
    render(<MemberSessionPage sessionId="intro" />);
    expect(await screen.findByText('Find the pair.')).toBeTruthy();
    expect(screen.getByText('Answers hidden')).toBeTruthy();
    expect(api.getMemberSolutions).not.toHaveBeenCalled();
  });

  it('requests revealed Solutions and renders all three editors read-only', async () => {
    realtime.answersVisible = true;
    api.listMemberProblems.mockResolvedValueOnce([
      { ...problem, problem: { ...problem.problem, answersVisible: true } },
    ]);
    render(<MemberSessionPage sessionId="intro" />);
    expect(
      await screen.findByLabelText('Python Solution, read-only'),
    ).toBeTruthy();
    expect(api.getMemberSolutions).toHaveBeenCalledExactlyOnceWith(
      'intro',
      'arrays',
    );
    expect(screen.getByLabelText('Java Solution, read-only')).toBeTruthy();
    expect(screen.getByLabelText('C++ Solution, read-only')).toBeTruthy();
  });

  it('keeps the public archive useful with no live session and lists past sessions', async () => {
    api.listMemberSessions.mockResolvedValueOnce([
      {
        id: 'past-session',
        session: { ...session.session, status: 'ended' },
      },
    ]);
    render(<MemberHome />);

    expect(await screen.findByText('No live session right now.')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /Intro practice/ }).getAttribute('href'),
    ).toBe('/sessions/past-session');
  });

  it('shows explicit empty states when there are no live or past sessions', async () => {
    api.listMemberSessions.mockResolvedValueOnce([]);
    render(<MemberHome />);

    expect(await screen.findByText('No live session right now.')).toBeTruthy();
    expect(screen.getByText('No past sessions yet.')).toBeTruthy();
  });

  it('loads ended-session Solutions regardless of answersVisible', async () => {
    api.getMemberSession.mockResolvedValueOnce({
      ...session,
      session: { ...session.session, status: 'ended' },
    });
    api.listMemberProblems.mockResolvedValueOnce([
      { ...problem, problem: { ...problem.problem, answersVisible: false } },
    ]);
    render(<MemberSessionPage sessionId="intro" />);

    expect(
      await screen.findByLabelText('Python Solution, read-only'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Java Solution, read-only')).toBeTruthy();
    expect(screen.getByLabelText('C++ Solution, read-only')).toBeTruthy();
    expect(screen.queryByText('Answers hidden')).toBeNull();
    expect(api.getMemberSolutions).toHaveBeenCalledExactlyOnceWith(
      'intro',
      'arrays',
    );
  });
});
