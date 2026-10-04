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
  getRevealedMemberSolutions: vi.fn(),
}));
const listeners = vi.hoisted(() => ({
  subscribeToActiveProblem: vi.fn(),
  subscribeToAnswersVisible: vi.fn(),
  active: [] as Array<{
    sessionId: string;
    onValue: (problemId: string | null) => void;
    onError: (error: Error) => void;
    unsubscribe: ReturnType<typeof vi.fn>;
  }>,
  answers: [] as Array<{
    sessionId: string;
    problemId: string;
    onValue: (visible: boolean) => void;
    onError: (error: Error) => void;
    unsubscribe: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('@/lib/firebase/member', () => member);
vi.mock('@/lib/firebase/presentation', () => ({
  subscribeToActiveProblem: listeners.subscribeToActiveProblem,
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
    activeProblemId: 'second',
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
  listeners.active.length = 0;
  listeners.answers.length = 0;
  member.getMemberSession.mockResolvedValue(session);
  member.listMemberProblems.mockResolvedValue(problems);
  member.getRevealedMemberSolutions.mockResolvedValue(solutions);
  listeners.subscribeToActiveProblem.mockImplementation(
    (
      sessionId: string,
      onValue: (problemId: string | null) => void,
      onError: (error: Error) => void,
    ) => {
      const unsubscribe = vi.fn();
      listeners.active.push({ sessionId, onValue, onError, unsubscribe });
      return unsubscribe;
    },
  );
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
  await screen.findByText('Second description');
  await waitFor(() => expect(listeners.active).toHaveLength(1));
  await waitFor(() => expect(listeners.answers).toHaveLength(1));
}

describe('Member realtime presentation', () => {
  it('starts on the active Problem with Follow Presenter enabled and follows live changes', async () => {
    await openSession();
    const follow = screen.getByRole('checkbox', { name: 'Follow presenter' });
    expect((follow as HTMLInputElement).checked).toBe(true);

    act(() => listeners.active[0].onValue('first'));
    expect(await screen.findByText('First description')).toBeTruthy();
    act(() => listeners.active[0].onValue('second'));
    expect(await screen.findByText('Second description')).toBeTruthy();
  });

  it('turns following off on manual navigation and jumps to the current presenter when re-enabled', async () => {
    await openSession();
    act(() => listeners.active[0].onValue('second'));

    fireEvent.click(screen.getByRole('tab', { name: 'First problem' }));
    const follow = screen.getByRole('checkbox', { name: 'Follow presenter' });
    expect((follow as HTMLInputElement).checked).toBe(false);
    act(() => listeners.active[0].onValue('second'));
    expect(screen.getByText('First description')).toBeTruthy();

    fireEvent.click(follow);
    expect((follow as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Second description')).toBeTruthy();
  });

  it('uses a local initial fallback but gracefully clears selection for a later null or unavailable pointer', async () => {
    member.getMemberSession.mockResolvedValueOnce({
      ...session,
      session: { ...session.session, activeProblemId: null },
    });
    render(<MemberSessionPage sessionId="session" />);
    expect(await screen.findByText('First description')).toBeTruthy();
    await waitFor(() => expect(listeners.active).toHaveLength(1));
    act(() => listeners.active[0].onValue('second'));
    act(() => listeners.active[0].onValue(null));
    expect(
      await screen.findByText('The presenter has not selected a Problem.'),
    ).toBeTruthy();

    act(() => listeners.active[0].onValue('missing-problem'));
    expect(
      await screen.findByText(
        'The presenter’s Problem is not available in this session.',
      ),
    ).toBeTruthy();
  });

  it('loads Solutions only after realtime reveal and removes them after Hide Answers', async () => {
    await openSession();
    expect(member.getRevealedMemberSolutions).not.toHaveBeenCalled();
    act(() => listeners.answers[0].onValue(false));
    expect(screen.getByText('Answers hidden')).toBeTruthy();
    expect(member.getRevealedMemberSolutions).not.toHaveBeenCalled();

    act(() => listeners.answers[0].onValue(true));
    expect(
      await screen.findByLabelText('Python Solution, read-only'),
    ).toBeTruthy();
    expect(member.getRevealedMemberSolutions).toHaveBeenCalledExactlyOnceWith(
      'session',
      'second',
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
    fireEvent.click(screen.getByRole('tab', { name: 'First problem' }));
    await waitFor(() => expect(listeners.answers).toHaveLength(2));
    expect(oldListener.unsubscribe).toHaveBeenCalledOnce();
    act(() => oldListener.onValue(true));
    expect(member.getRevealedMemberSolutions).not.toHaveBeenCalled();
    expect(screen.getByText('First description')).toBeTruthy();
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
    expect(member.getRevealedMemberSolutions).toHaveBeenCalledOnce();

    act(() =>
      listeners.active[0].onError(new Error('private listener detail')),
    );
    expect(screen.getByText('Presenter updates are unavailable.')).toBeTruthy();
    expect(screen.queryByText(/private listener detail/)).toBeNull();
  });

  it('unsubscribes Session and Problem listeners on unmount', async () => {
    const { unmount } = render(<MemberSessionPage sessionId="session" />);
    await screen.findByText('Second description');
    await waitFor(() => expect(listeners.active).toHaveLength(1));
    await waitFor(() => expect(listeners.answers).toHaveLength(1));
    unmount();
    expect(listeners.active[0].unsubscribe).toHaveBeenCalledOnce();
    expect(listeners.answers[0].unsubscribe).toHaveBeenCalledOnce();
  });
});
