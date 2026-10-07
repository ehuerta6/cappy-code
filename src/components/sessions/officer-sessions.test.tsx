// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  createSession: vi.fn(),
  listSessions: vi.fn(),
  updateSession: vi.fn(),
  transitionSession: vi.fn(),
  deleteSession: vi.fn(),
  listProblems: vi.fn(),
  updateProblem: vi.fn(),
  getSolutionsForProblem: vi.fn(),
  updateSolution: vi.fn(),
}));
vi.mock('@/lib/firebase/sessions', () => api);
vi.mock('@/lib/firebase/problems', async (original) => ({
  ...(await original<typeof import('@/lib/firebase/problems')>()),
  listProblems: api.listProblems,
  updateProblem: api.updateProblem,
}));
vi.mock('@/lib/firebase/solutions', () => ({
  getSolutionsForProblem: api.getSolutionsForProblem,
  updateSolution: api.updateSolution,
}));
vi.mock('client-only', () => ({}));
vi.mock('@monaco-editor/react', () => ({
  default: ({
    options,
    value,
    onChange,
  }: {
    options: { readOnly: boolean; ariaLabel: string };
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label={options.ariaLabel}
      value={value}
      readOnly={options.readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
import OfficerSessions from './officer-sessions';

const record = {
  id: 'session-id',
  problemCount: 1,
  session: {
    title: 'Arrays',
    date: '2026-10-08',
    status: 'draft',
    createdAt: Timestamp.fromMillis(1000),
    updatedAt: Timestamp.fromMillis(1000),
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  api.listSessions.mockResolvedValue([record]);
  api.listProblems.mockResolvedValue([]);
  api.updateProblem.mockResolvedValue(undefined);
  api.getSolutionsForProblem.mockResolvedValue({
    python: { code: '' },
    java: { code: '' },
    cpp: { code: '' },
  });
  api.updateSolution.mockResolvedValue(undefined);
  api.createSession.mockResolvedValue('new-session');
  api.updateSession.mockResolvedValue(undefined);
  api.transitionSession.mockResolvedValue(undefined);
  api.deleteSession.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openEditor() {
  render(<OfficerSessions />);
  fireEvent.click(await screen.findByRole('button', { name: /Arrays/ }));
}

describe('Officer Sessions surface', () => {
  it('shows loading until Firestore responds, then lists persisted metadata', async () => {
    let resolve!: (records: (typeof record)[]) => void;
    api.listSessions.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<OfficerSessions />);
    expect(screen.getByRole('status').textContent).toBe('Loading sessions…');
    resolve([record]);
    expect(
      await screen.findByRole('button', {
        name: /Oct 8.*Arrays.*1 Problem.*draft/,
      }),
    ).toBeTruthy();
  });

  it('distinguishes load failure from an empty collection and allows retry', async () => {
    api.listSessions
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([]);
    render(<OfficerSessions />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('No Sessions yet')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading sessions' }),
    );
    expect(await screen.findByText('No Sessions yet')).toBeTruthy();
  });

  it('creates a direct draft and opens its persisted editor without demo problems', async () => {
    api.listSessions.mockResolvedValueOnce([]).mockResolvedValue([
      {
        ...record,
        id: 'new-session',
        session: { ...record.session, title: 'Untitled Session' },
      },
    ]);
    render(<OfficerSessions />);
    await screen.findByText('No Sessions yet');
    fireEvent.click(screen.getByRole('button', { name: '+ New session' }));
    expect(
      await screen.findByRole('heading', { name: 'Untitled Session' }),
    ).toBeTruthy();
    expect(api.createSession).toHaveBeenCalledWith({
      title: 'Untitled Session',
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('shows create errors without adding a fake row', async () => {
    api.listSessions.mockResolvedValue([]);
    api.createSession.mockRejectedValue(new Error('denied'));
    render(<OfficerSessions />);
    await screen.findByText('No Sessions yet');
    fireEvent.click(screen.getByRole('button', { name: '+ New session' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'could not be created',
    );
    expect(
      screen.queryByRole('heading', { name: 'Untitled Session' }),
    ).toBeNull();
  });

  it('groups persisted sessions and keeps past history newest first', async () => {
    api.listSessions.mockResolvedValue([
      { ...record, session: { ...record.session, date: '2025-01-01' } },
      {
        ...record,
        id: 'live-id',
        session: { ...record.session, status: 'live', date: '2026-01-01' },
      },
      {
        ...record,
        id: 'older-ended',
        session: { ...record.session, status: 'ended', date: '2027-09-01' },
      },
      {
        ...record,
        id: 'newer-ended',
        session: { ...record.session, status: 'ended', date: '2027-10-01' },
      },
    ]);
    render(<OfficerSessions />);
    await screen.findByRole('heading', { name: 'Past' });
    expect(screen.getByRole('heading', { name: 'Live' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeTruthy();
    expect(
      screen
        .getByRole('region', { name: 'Upcoming' })
        .querySelector('time')
        ?.getAttribute('datetime'),
    ).toBe('2025-01-01');
    expect(
      screen
        .getByRole('region', { name: 'Live' })
        .querySelector('time')
        ?.getAttribute('datetime'),
    ).toBe('2026-01-01');
    const pastRows = screen
      .getByRole('region', { name: 'Past' })
      .querySelectorAll('button');
    expect(pastRows[0].textContent).toContain('Oct 1');
    expect(pastRows[1].textContent).toContain('Sep 1');
    expect(pastRows[0].textContent).toContain('1 Problem');
    expect(
      await within(screen.getByRole('region', { name: 'Past' })).findAllByText(
        'No Problems recorded.',
      ),
    ).toHaveLength(2);
  });

  it('shows ended-session Problem summaries directly under Past in order and keeps row navigation', async () => {
    const draft = {
      ...record,
      id: 'draft-session',
      session: { ...record.session, status: 'draft' as const },
    };
    const live = {
      ...record,
      id: 'live-session',
      session: { ...record.session, status: 'live' as const },
    };
    const older = {
      ...record,
      id: 'older-session',
      session: {
        ...record.session,
        title: 'Strings',
        date: '2026-10-01',
        status: 'ended' as const,
      },
    };
    const newer = {
      ...record,
      id: 'newer-session',
      problemCount: 2,
      session: {
        ...record.session,
        title: 'Arrays & Hashing',
        date: '2026-10-04',
        status: 'ended' as const,
      },
    };
    api.listSessions.mockResolvedValue([draft, live, older, newer]);
    api.listProblems.mockImplementation(async (sessionId: string) =>
      sessionId === 'newer-session'
        ? [
            {
              id: 'two-sum',
              problem: {
                title: 'Two Sum',
                description: 'Given an array of integers, find two values.',
                exampleInput: '',
                exampleOutput: '',
                constraints: '',
                order: 0,
                answersVisible: false,
                leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
              },
            },
            {
              id: 'custom-prefix',
              problem: {
                title: 'Custom Prefix Exercise',
                description: 'Write a function that finds a shared prefix.',
                exampleInput: '',
                exampleOutput: '',
                constraints: '1 ≤ n ≤ 100',
                order: 1,
                answersVisible: false,
              },
            },
          ]
        : [
            {
              id: 'valid-anagram',
              problem: {
                title: 'Valid Anagram',
                description: 'Determine whether two strings are anagrams.',
                exampleInput: '',
                exampleOutput: '',
                constraints: '',
                order: 0,
                answersVisible: false,
                leetcodeUrl: 'https://leetcode.com/problems/valid-anagram/',
              },
            },
          ],
    );

    render(<OfficerSessions />);
    const past = await screen.findByRole('region', { name: 'Past' });
    const newerHistory = await within(past).findByRole('region', {
      name: 'Problem history for Arrays & Hashing',
    });
    await within(newerHistory).findByText('Custom Prefix Exercise');
    expect(
      Array.from(newerHistory.querySelectorAll('ol > li h3')).map(
        (heading) => heading.textContent,
      ),
    ).toEqual(['Two Sum', 'Custom Prefix Exercise']);
    expect(
      within(newerHistory).getByText(
        'Given an array of integers, find two values.',
      ),
    ).toBeTruthy();
    expect(within(newerHistory).getByText('1 ≤ n ≤ 100')).toBeTruthy();
    expect(
      within(newerHistory)
        .getByRole('link', {
          name: 'https://leetcode.com/problems/two-sum/',
        })
        .getAttribute('href'),
    ).toBe('https://leetcode.com/problems/two-sum/');
    expect(
      within(newerHistory).getByText('No LeetCode link provided'),
    ).toBeTruthy();
    const olderHistory = within(past).getByRole('region', {
      name: 'Problem history for Strings',
    });
    expect(within(olderHistory).getByText('Valid Anagram')).toBeTruthy();
    expect(
      within(olderHistory).getByRole('link', {
        name: 'https://leetcode.com/problems/valid-anagram/',
      }),
    ).toBeTruthy();
    expect(
      within(past)
        .getAllByRole('button')
        .map((button) => button.textContent?.match(/Oct \d/)?.[0]),
    ).toEqual(['Oct 4', 'Oct 1']);
    expect(
      api.listProblems.mock.calls.map(([sessionId]) => sessionId).sort(),
    ).toEqual(['newer-session', 'older-session']);
    expect(screen.queryByLabelText('Session title')).toBeNull();

    fireEvent.click(
      within(past).getByRole('button', { name: /Oct 4.*Arrays & Hashing/ }),
    );
    expect(await screen.findByLabelText('Session title')).toBeTruthy();
  });

  it('shows per-session loading, empty and recoverable failure states without breaking other Past entries', async () => {
    const failed = {
      ...record,
      id: 'failed-history',
      session: {
        ...record.session,
        title: 'Unavailable history',
        status: 'ended' as const,
      },
    };
    const empty = {
      ...record,
      id: 'empty-history',
      session: {
        ...record.session,
        title: 'Empty history',
        date: '2026-10-07',
        status: 'ended' as const,
      },
    };
    let resolveHistory!: (problems: never[]) => void;
    let failedAttempts = 0;
    api.listSessions.mockResolvedValue([failed, empty]);
    api.listProblems.mockImplementation((sessionId: string) => {
      if (sessionId === 'empty-history') return Promise.resolve([]);
      failedAttempts += 1;
      if (failedAttempts === 1) return Promise.reject(new Error('offline'));
      return new Promise((resolve) => {
        resolveHistory = resolve;
      });
    });

    render(<OfficerSessions />);
    const past = await screen.findByRole('region', { name: 'Past' });
    const failedHistory = within(past).getByRole('region', {
      name: 'Problem history for Unavailable history',
    });
    expect(
      await within(failedHistory).findByText(
        'Problem history could not be loaded.',
      ),
    ).toBeTruthy();
    expect(within(past).getByText('No Problems recorded.')).toBeTruthy();
    expect(
      within(past).getByRole('button', { name: /Unavailable history/ }),
    ).toBeTruthy();
    expect(
      within(past).getByRole('button', { name: /Empty history/ }),
    ).toBeTruthy();

    fireEvent.click(
      within(failedHistory).getByRole('button', {
        name: 'Retry Problem history',
      }),
    );
    expect(await within(failedHistory).findByRole('status')).toBeTruthy();
    resolveHistory([]);
    expect(
      await within(failedHistory).findByText('No Problems recorded.'),
    ).toBeTruthy();
  });

  it('starts a draft session with pending and error states and keeps empty sessions disabled', async () => {
    api.listSessions.mockResolvedValueOnce([{ ...record, problemCount: 0 }]);
    await openEditor();
    expect(
      (screen.getByRole('button', { name: 'Go Live' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText('Add a Problem before going live.')).toBeTruthy();

    api.listSessions.mockResolvedValueOnce([record]);
    cleanup();
    await openEditor();
    let resolve!: () => void;
    api.transitionSession.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go Live' }));
    fireEvent.click(screen.getByRole('button', { name: 'Starting…' }));
    expect(api.transitionSession).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Starting…' })).toBeTruthy();
    resolve();
    await screen.findByText('live');
    expect(api.transitionSession).toHaveBeenCalledWith('session-id', 'live');
  });

  it('keeps Go Live visible while the Problem count loads or is unavailable', async () => {
    api.listSessions.mockResolvedValueOnce([{ ...record, problemCount: null }]);
    await openEditor();
    const unavailableButton = screen.getByRole('button', { name: 'Go Live' });
    expect(unavailableButton).toBeTruthy();
    expect((unavailableButton as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(
        'Problem count unavailable. Open Manage problems to retry.',
      ),
    ).toBeTruthy();

    cleanup();
    let resolveProblems!: (problems: never[]) => void;
    api.listProblems.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProblems = resolve;
      }),
    );
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Manage problems' }));
    const loadingButton = screen.getByRole('button', { name: 'Go Live' });
    expect((loadingButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Checking Problems…')).toBeTruthy();
    resolveProblems([]);
  });

  it('keeps the current status and offers retry after a lifecycle write fails', async () => {
    api.transitionSession.mockRejectedValueOnce(new Error('offline'));
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Go Live' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'status could not be changed',
    );
    expect(screen.getByText('draft')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go Live' })).toBeTruthy();
  });

  it('explains when another Session is already live', async () => {
    api.transitionSession.mockRejectedValueOnce(
      new Error(
        'Another Session is already live. Set it to Not Live or end it before starting this one.',
      ),
    );
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Go Live' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Another Session is already live. Set it to Not Live or end it before starting this one.',
    );
  });

  it('returns a live Session to draft without confirmation and keeps the content manager available', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    api.listSessions.mockResolvedValueOnce([
      { ...record, session: { ...record.session, status: 'live' } },
    ]);
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Not Live' }));
    expect(api.transitionSession).toHaveBeenCalledWith('session-id', 'draft');
    await waitFor(() => expect(screen.getByText('draft')).toBeTruthy());
    expect(
      screen.getByRole('button', { name: 'Manage problems' }),
    ).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('confirms ending a live session and leaves the session editable in history', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.listSessions
      .mockResolvedValueOnce([
        { ...record, session: { ...record.session, status: 'live' } },
      ])
      .mockResolvedValueOnce([
        {
          ...record,
          session: { ...record.session, status: 'ended' },
        },
      ]);
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'End Session' }));
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining(
        "End “Arrays”? It will move to Past, and all prepared Python, Java, and C++ Solutions will become public regardless of each Problem's answer visibility.",
      ),
    );
    expect(api.transitionSession).toHaveBeenCalledWith('session-id', 'ended');
    await screen.findByText('ended');
    expect(screen.getByLabelText('Session title')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'End Session' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Go Live' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Session title'), {
      target: { value: 'Edited archive' },
    });
    expect(api.updateSession).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByLabelText('Session title'));
    expect(api.updateSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(api.updateSession).toHaveBeenCalledWith('session-id', {
        title: 'Edited archive',
        date: '2026-10-08',
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Saved ✓'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back to Sessions' }));
    expect(await screen.findByRole('heading', { name: 'Past' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Oct 8.*Arrays.*1 Problem.*ended/ }),
    ).toBeTruthy();
  });

  it('does not report successful creation as failed when the subsequent read fails', async () => {
    api.listSessions
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('offline'));
    render(<OfficerSessions />);
    await screen.findByText('No Sessions yet');
    fireEvent.click(screen.getByRole('button', { name: '+ New session' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'could not be loaded',
    );
    expect(screen.queryByText(/could not be created/)).toBeNull();
    expect(api.createSession).toHaveBeenCalledTimes(1);
  });

  it('saves Session metadata only on request and waits for backend confirmation', async () => {
    let resolve!: () => void;
    api.updateSession.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    await openEditor();
    const title = screen.getByLabelText('Session title');
    fireEvent.change(title, { target: { value: 'Hashing' } });
    fireEvent.change(screen.getByLabelText('Session date'), {
      target: { value: '2026-10-09' },
    });
    expect(api.updateSession).not.toHaveBeenCalled();
    fireEvent.blur(title);
    expect(api.updateSession).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('Unsaved changes');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('status').textContent).toBe('Saving…');
    expect(api.updateSession).toHaveBeenCalledWith('session-id', {
      title: 'Hashing',
      date: '2026-10-09',
    });
    resolve();
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Saved ✓'),
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Save changes',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('preserves failed edits and retries the same metadata', async () => {
    api.updateSession
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    await openEditor();
    const title = screen.getByLabelText('Session title') as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Unsaved Hashing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('alert');
    expect(title.value).toBe('Unsaved Hashing');
    expect(
      (
        screen.getByRole('button', {
          name: 'Back to Sessions',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Saved ✓'),
    );
    expect(api.updateSession).toHaveBeenCalledTimes(2);
  });

  it('clears a failed save when metadata returns to confirmed content', async () => {
    api.updateSession.mockRejectedValueOnce(new Error('offline'));
    await openEditor();
    const title = screen.getByLabelText('Session title') as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Unsaved Hashing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('alert');
    expect(api.updateSession).toHaveBeenCalledTimes(1);

    fireEvent.change(title, { target: { value: 'Arrays' } });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Saved ✓');
    expect(
      (
        screen.getByRole('button', {
          name: 'Save changes',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(api.updateSession).toHaveBeenCalledTimes(1);
  });

  it('blocks invalid metadata without writing', async () => {
    await openEditor();
    fireEvent.change(screen.getByLabelText('Session title'), {
      target: { value: ' ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter a session title.')).toBeTruthy();
    expect(api.updateSession).not.toHaveBeenCalled();
  });

  it('opens only the selected session workspace and protects unsaved problem edits before leaving', async () => {
    api.listProblems.mockResolvedValue([
      {
        id: 'problem',
        problem: {
          title: 'Two Sum',
          description: '',
          exampleInput: '',
          exampleOutput: '',
          order: 0,
          answersVisible: false,
        },
      },
    ]);
    api.updateProblem.mockRejectedValueOnce(new Error('offline'));
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Manage problems' }));
    await screen.findByRole('tab', { name: 'Two Sum' });
    expect(api.listProblems).toHaveBeenCalledWith('session-id');
    const title = screen.getByLabelText('Problem title');
    fireEvent.change(title, { target: { value: 'Unsaved problem' } });
    expect(
      (
        screen.getByRole('button', {
          name: 'Back to session',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(api.updateProblem).not.toHaveBeenCalled();
    fireEvent.blur(title);
    expect(api.updateProblem).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('alert');
    expect(
      (
        screen.getByRole('button', {
          name: 'Back to session',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Saved ✓');
    fireEvent.click(screen.getByRole('button', { name: 'Back to session' }));
    expect(screen.getByLabelText('Session title')).toBeTruthy();
    expect(api.updateSession).not.toHaveBeenCalled();
  });

  it('keeps the Session workspace open until the selected Problem source saves', async () => {
    api.listProblems.mockResolvedValue([
      {
        id: 'problem',
        problem: {
          title: 'Two Sum',
          description: 'Find a pair',
          exampleInput: '1 2',
          exampleOutput: '3',
          order: 0,
          answersVisible: false,
        },
      },
    ]);
    render(<OfficerSessions />);
    fireEvent.click(await screen.findByRole('button', { name: /Arrays/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage problems' }));
    await screen.findByLabelText('Python Solution, editable');
    const backButton = screen.getByRole('button', { name: 'Back to session' });
    fireEvent.change(screen.getByLabelText('C++ Solution, editable'), {
      target: { value: 'static source' },
    });
    expect((backButton as HTMLButtonElement).disabled).toBe(true);
    expect(api.updateSolution).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    fireEvent.click(backButton);
    expect(screen.getByLabelText('Session problems')).toBeTruthy();
    await waitFor(() =>
      expect(api.updateSolution).toHaveBeenCalledWith(
        'session-id',
        'problem',
        'cpp',
        {
          code: 'static source',
        },
      ),
    );
    await waitFor(() =>
      expect((backButton as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(backButton);
    expect(screen.getByLabelText('Session title')).toBeTruthy();
  });

  it('saves dirty Problem content together and retries only the failed language', async () => {
    api.listProblems.mockResolvedValue([
      {
        id: 'problem',
        problem: {
          title: 'Two Sum',
          description: 'Find a pair',
          exampleInput: '1 2',
          exampleOutput: '3',
          order: 0,
          answersVisible: false,
        },
      },
    ]);
    let failJava = true;
    api.updateSolution.mockImplementation(
      async (_sessionId: string, _problemId: string, language: string) => {
        if (language === 'java' && failJava) {
          failJava = false;
          throw new Error('offline');
        }
      },
    );
    render(<OfficerSessions />);
    fireEvent.click(await screen.findByRole('button', { name: /Arrays/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage problems' }));
    await screen.findByLabelText('Python Solution, editable');

    fireEvent.change(screen.getByLabelText('Problem title'), {
      target: { value: 'Renamed problem' },
    });
    fireEvent.change(screen.getByLabelText('Python Solution, editable'), {
      target: { value: 'new python' },
    });
    fireEvent.change(screen.getByLabelText('Java Solution, editable'), {
      target: { value: 'new java source' },
    });
    expect(api.updateProblem).not.toHaveBeenCalled();
    expect(api.updateSolution).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText(/Java Solution could not be saved/);
    expect(api.updateProblem).toHaveBeenCalledOnce();
    expect(api.updateProblem).toHaveBeenCalledWith('session-id', 'problem', {
      title: 'Renamed problem',
    });
    expect(api.updateSolution.mock.calls.map((call) => call[2])).toEqual([
      'python',
      'java',
    ]);
    expect(
      (
        screen.getByRole('button', {
          name: 'Back to session',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(api.updateSolution).toHaveBeenCalledTimes(3));
    expect(api.updateSolution.mock.calls[2]).toEqual([
      'session-id',
      'problem',
      'java',
      { code: 'new java source' },
    ]);
    expect(api.updateProblem).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Back to session',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
  });

  it('keeps navigation and destructive actions blocked after a dirty Solution save fails until retry succeeds', async () => {
    api.listProblems.mockResolvedValue([
      {
        id: 'problem',
        problem: {
          title: 'Two Sum',
          description: 'Find a pair',
          exampleInput: '1 2',
          exampleOutput: '3',
          order: 0,
          answersVisible: false,
        },
      },
      {
        id: 'second-problem',
        problem: {
          title: 'Anagram',
          description: 'Compare letters',
          exampleInput: 'listen',
          exampleOutput: 'true',
          order: 1,
          answersVisible: false,
        },
      },
    ]);
    api.updateSolution.mockRejectedValueOnce(new Error('offline'));
    render(<OfficerSessions />);
    fireEvent.click(await screen.findByRole('button', { name: /Arrays/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage problems' }));
    await screen.findByLabelText('Python Solution, editable');

    fireEvent.click(screen.getByRole('button', { name: 'Manage Two Sum' }));
    const deleteProblem = screen.getByRole('button', {
      name: 'Delete problem',
    });
    expect((deleteProblem as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(screen.getByLabelText('C++ Solution, editable'), {
      target: { value: 'changed source' },
    });
    expect(api.updateSolution).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(api.updateSolution).toHaveBeenCalledWith(
        'session-id',
        'problem',
        'cpp',
        { code: 'changed source' },
      ),
    );
    await screen.findByRole('alert');

    expect(
      (
        screen.getByRole('button', {
          name: 'Back to session',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Go Live' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('tab', { name: 'Anagram' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect((deleteProblem as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Delete session' })).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(api.updateSolution).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Back to session',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(
      (screen.getByRole('button', { name: 'Go Live' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (screen.getByRole('tab', { name: 'Anagram' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect((deleteProblem as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Back to session' }));
    expect(screen.getByRole('button', { name: 'Delete session' })).toBeTruthy();
  });

  it('requires confirmation, retains the record on delete failure and allows retry', async () => {
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    api.deleteSession
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Arrays'));
    expect(api.deleteSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'could not be deleted',
    );
    api.listSessions.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    expect(await screen.findByText('No Sessions yet')).toBeTruthy();
    expect(api.deleteSession).toHaveBeenLastCalledWith('session-id');
  });
});
