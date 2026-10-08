// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listMemberSessions: vi.fn(),
  getMemberSession: vi.fn(),
  listMemberProblems: vi.fn(),
  getMemberSolutions: vi.fn(),
  getMemberApproaches: vi.fn(),
  subscribeToMemberSessions: vi.fn(),
  memberReadFailureKind: vi.fn((error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'permission-denied'
      ? 'permission'
      : 'connection',
  ),
}));
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const realtime = vi.hoisted(() => ({
  answersVisible: false,
}));

vi.mock('@/lib/firebase/member', () => api);
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
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
import type { MemberSessionRecord } from '@/lib/firebase/member';

const session = {
  id: 'intro',
  session: {
    branch: 'intro' as const,
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
  api.getMemberApproaches.mockImplementation(async (...args: unknown[]) => [
    {
      id: 'primary',
      name: 'Primary Approach',
      tags: [],
      order: 0,
      solutions: await api.getMemberSolutions(...args),
    },
  ]);
  api.subscribeToMemberSessions.mockImplementation(
    (onValue: (records: MemberSessionRecord[]) => void) => {
      queueMicrotask(() => onValue([session]));
      return vi.fn();
    },
  );
  navigation.replace.mockReset();
  navigation.push.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('public member page integration', () => {
  it('keeps Session discovery available while a Session is live', async () => {
    render(<MemberHome />);
    expect(
      await screen.findByRole('link', { name: /Intro practice/ }),
    ).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /create|delete|edit/i }),
    ).toBeNull();
  });

  it('shows a distinct recoverable permission state for Session reads', async () => {
    api.subscribeToMemberSessions.mockImplementationOnce(
      (
        _onValue: (records: MemberSessionRecord[]) => void,
        onError: (error: Error) => void,
      ) => {
        queueMicrotask(() =>
          onError(
            Object.assign(new Error('private Firebase detail'), {
              code: 'permission-denied',
            }),
          ),
        );
        return vi.fn();
      },
    );
    render(<MemberSessionPage sessionId="intro" />);
    expect(
      await screen.findByText(
        'You do not have permission to view this Session.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/private Firebase detail/)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Retry session updates' }),
    ).toBeTruthy();
  });

  it('does not request hidden Solutions and shows the hidden-answer state', async () => {
    render(<MemberSessionPage sessionId="intro" />);
    expect(await screen.findByText('Find the pair.')).toBeTruthy();
    expect(screen.getByText('Answers hidden')).toBeTruthy();
    expect(api.getMemberSolutions).not.toHaveBeenCalled();
  });

  it('keeps a direct ended Session open while another Session is live', async () => {
    const ended = {
      id: 'past-session',
      session: { ...session.session, status: 'ended' as const },
    };
    api.subscribeToMemberSessions.mockImplementationOnce(
      (onValue: (records: MemberSessionRecord[]) => void) => {
        queueMicrotask(() => onValue([session, ended]));
        return vi.fn();
      },
    );
    render(<MemberSessionPage sessionId="past-session" />);
    expect(await screen.findByText('Find the pair.')).toBeTruthy();
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(
        '/sessions/past-session/arrays',
      ),
    );
  });

  it('shows an unavailable state for a Problem ID outside the Session', async () => {
    render(<MemberSessionPage sessionId="intro" problemId="missing-problem" />);
    expect(await screen.findByText('Problem unavailable')).toBeTruthy();
    expect(screen.queryByText('Find the pair.')).toBeNull();
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
    api.subscribeToMemberSessions.mockImplementationOnce(
      (onValue: (records: MemberSessionRecord[]) => void) => {
        queueMicrotask(() =>
          onValue([
            {
              id: 'past-session',
              session: { ...session.session, status: 'ended' },
            },
          ]),
        );
        return vi.fn();
      },
    );
    render(<MemberHome />);

    expect(
      await screen.findAllByText('No live session right now.'),
    ).toHaveLength(3);
    expect(
      screen.getByRole('link', { name: /Intro practice/ }).getAttribute('href'),
    ).toBe('/sessions/past-session');
  });

  it('shows explicit empty states when there are no live or past sessions', async () => {
    api.subscribeToMemberSessions.mockImplementationOnce(
      (onValue: (records: MemberSessionRecord[]) => void) => {
        queueMicrotask(() => onValue([]));
        return vi.fn();
      },
    );
    render(<MemberHome />);

    expect(
      await screen.findAllByText('No live session right now.'),
    ).toHaveLength(3);
    expect(await screen.findAllByText('No past sessions yet.')).toHaveLength(3);
  });

  it('loads ended-session Solutions regardless of answersVisible', async () => {
    api.subscribeToMemberSessions.mockImplementationOnce(
      (onValue: (records: MemberSessionRecord[]) => void) => {
        queueMicrotask(() =>
          onValue([
            { ...session, session: { ...session.session, status: 'ended' } },
          ]),
        );
        return vi.fn();
      },
    );
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
