// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const member = vi.hoisted(() => ({
  getMemberSession: vi.fn(),
  listMemberProblems: vi.fn(),
  getMemberSolutions: vi.fn(),
}));
const listeners = vi.hoisted(() => ({
  subscribeToAnswersVisible: vi.fn(),
  answers: [] as Array<{
    sessionId: string;
    problemId: string;
    onValue: (visible: boolean) => void;
    onError: (error: Error) => void;
    unsubscribe: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('@/lib/firebase/member', () => member);
vi.mock('@/lib/firebase/answer-visibility', () => ({
  subscribeToAnswersVisible: listeners.subscribeToAnswersVisible,
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

import MemberSessionPage from './member-session-page';

const session = {
  id: 'session',
  session: {
    title: 'Intro practice',
    date: '2026-10-04',
    status: 'live' as const,
  },
};
const problems = [
  {
    id: 'first',
    problem: {
      title: 'First problem',
      description: 'First description',
      exampleInput: 'one',
      exampleOutput: 'one output',
      order: 0,
      answersVisible: false,
    },
  },
  {
    id: 'second',
    problem: {
      title: 'Second problem',
      description: 'Second description',
      exampleInput: 'two',
      exampleOutput: 'two output',
      order: 1,
      answersVisible: false,
    },
  },
];
const solutions = {
  python: { code: 'python source', output: 'python output' },
  java: { code: 'java source', output: 'java output' },
  cpp: { code: 'cpp source', output: 'cpp output' },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  listeners.answers.length = 0;
  member.getMemberSession.mockResolvedValue(session);
  member.listMemberProblems.mockResolvedValue(problems);
  member.getMemberSolutions.mockResolvedValue(solutions);
  listeners.subscribeToAnswersVisible.mockImplementation(
    (
      sessionId: string,
      problemId: string,
      onValue: (visible: boolean) => void,
      onError: (error: Error) => void,
    ) => {
      const unsubscribe = vi.fn();
      listeners.answers.push({
        sessionId,
        problemId,
        onValue,
        onError,
        unsubscribe,
      });
      return unsubscribe;
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openSession() {
  render(<MemberSessionPage sessionId="session" />);
  await screen.findByText('First description');
  await waitFor(() => expect(listeners.answers).toHaveLength(1));
}

describe('Member answer visibility realtime', () => {
  it('loads Solutions only after realtime reveal and removes them after Hide Answers', async () => {
    await openSession();
    expect(member.getMemberSolutions).not.toHaveBeenCalled();
    act(() => listeners.answers[0].onValue(false));
    expect(screen.getByText('Answers hidden')).toBeTruthy();
    expect(member.getMemberSolutions).not.toHaveBeenCalled();

    act(() => listeners.answers[0].onValue(true));
    expect(
      await screen.findByLabelText('Python Solution, read-only'),
    ).toBeTruthy();
    expect(member.getMemberSolutions).toHaveBeenCalledExactlyOnceWith(
      'session',
      'first',
    );
    expect(screen.getByLabelText('Java Solution, read-only')).toBeTruthy();
    expect(screen.getByLabelText('C++ Solution, read-only')).toBeTruthy();

    act(() => listeners.answers[0].onValue(false));
    expect(await screen.findByText('Answers hidden')).toBeTruthy();
    expect(screen.queryByLabelText('Python Solution, read-only')).toBeNull();
    expect(screen.queryByLabelText('Java Solution, read-only')).toBeNull();
    expect(screen.queryByLabelText('C++ Solution, read-only')).toBeNull();
    expect(screen.queryByText('python source')).toBeNull();
  });

  it('cleans up reveal listeners when selection changes and ignores their late callbacks', async () => {
    await openSession();
    const oldListener = listeners.answers[0];
    fireEvent.click(screen.getByRole('tab', { name: 'Second problem' }));
    await waitFor(() => expect(listeners.answers).toHaveLength(2));
    expect(oldListener.unsubscribe).toHaveBeenCalledOnce();
    act(() => oldListener.onValue(true));
    expect(member.getMemberSolutions).not.toHaveBeenCalled();
    expect(screen.getByText('Second description')).toBeTruthy();
  });

  it('loads ended-session Solutions without an answer-visibility listener or gate', async () => {
    member.getMemberSession.mockResolvedValueOnce({
      ...session,
      session: { ...session.session, status: 'ended' },
    });
    render(<MemberSessionPage sessionId="session" />);

    expect(
      await screen.findByLabelText('Python Solution, read-only'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Java Solution, read-only')).toBeTruthy();
    expect(screen.getByLabelText('C++ Solution, read-only')).toBeTruthy();
    expect(screen.queryByText('Answers hidden')).toBeNull();
    expect(
      screen.queryByText('Waiting for the officer to reveal the solution…'),
    ).toBeNull();
    expect(member.getMemberSolutions).toHaveBeenCalledExactlyOnceWith(
      'session',
      'first',
    );
    expect(listeners.subscribeToAnswersVisible).not.toHaveBeenCalled();
  });

  it('fails closed on listener errors without showing raw Firebase details', async () => {
    await openSession();
    act(() => listeners.answers[0].onValue(true));
    expect(
      await screen.findByLabelText('Python Solution, read-only'),
    ).toBeTruthy();
    act(() =>
      listeners.answers[0].onError(
        new Error('permission-denied secret detail'),
      ),
    );
    expect(
      await screen.findByText('Answer visibility could not be synchronized.'),
    ).toBeTruthy();
    expect(screen.queryByText(/permission-denied/)).toBeNull();
    expect(screen.queryByLabelText('Python Solution, read-only')).toBeNull();
    expect(member.getMemberSolutions).toHaveBeenCalledOnce();
  });

  it('unsubscribes the Problem listener on unmount', async () => {
    const { unmount } = render(<MemberSessionPage sessionId="session" />);
    await screen.findByText('First description');
    await waitFor(() => expect(listeners.answers).toHaveLength(1));
    unmount();
    expect(listeners.answers[0].unsubscribe).toHaveBeenCalledOnce();
  });
});
