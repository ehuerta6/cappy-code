// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
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
    python: { code: '', output: '' },
    java: { code: '', output: '' },
    cpp: { code: '', output: '' },
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
      expect.stringContaining('End “Arrays”'),
    );
    expect(api.transitionSession).toHaveBeenCalledWith('session-id', 'ended');
    await screen.findByText('ended');
    expect(screen.getByLabelText('Session title')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'End Session' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Go Live' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Session title'), {
      target: { value: 'Edited archive' },
    });
    fireEvent.blur(screen.getByLabelText('Session title'));
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

  it('commits metadata on blur and waits for confirmation before showing Saved', async () => {
    let resolve!: () => void;
    api.updateSession.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    await openEditor();
    const title = screen.getByLabelText('Session title');
    fireEvent.change(title, { target: { value: 'Hashing' } });
    expect(api.updateSession).not.toHaveBeenCalled();
    fireEvent.blur(title);
    expect(screen.getByRole('status').textContent).toBe('Saving…');
    expect(api.updateSession).toHaveBeenCalledWith('session-id', {
      title: 'Hashing',
      date: '2026-10-08',
    });
    resolve();
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Saved ✓'),
    );
    fireEvent.change(screen.getByLabelText('Session date'), {
      target: { value: '2026-10-09' },
    });
    fireEvent.blur(screen.getByLabelText('Session date'));
    await waitFor(() =>
      expect(api.updateSession).toHaveBeenLastCalledWith('session-id', {
        title: 'Hashing',
        date: '2026-10-09',
      }),
    );
  });

  it('preserves failed edits and retries the same metadata', async () => {
    api.updateSession
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    await openEditor();
    const title = screen.getByLabelText('Session title') as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Unsaved Hashing' } });
    fireEvent.blur(title);
    await screen.findByRole('alert');
    expect(title.value).toBe('Unsaved Hashing');
    expect(
      (
        screen.getByRole('button', {
          name: 'Back to Sessions',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Saved ✓'),
    );
    expect(api.updateSession).toHaveBeenCalledTimes(2);
  });

  it('blocks invalid metadata without writing', async () => {
    await openEditor();
    fireEvent.change(screen.getByLabelText('Session title'), {
      target: { value: ' ' },
    });
    fireEvent.blur(screen.getByLabelText('Session title'));
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
    fireEvent.blur(title);
    await screen.findByRole('alert');
    expect(
      (
        screen.getByRole('button', {
          name: 'Back to session',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry problem save' }));
    await screen.findByText('Saved ✓');
    fireEvent.click(screen.getByRole('button', { name: 'Back to session' }));
    expect(screen.getByLabelText('Session title')).toBeTruthy();
    expect(api.updateSession).not.toHaveBeenCalled();
  });

  it('keeps the Session workspace open until the selected Problem solution saves', async () => {
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
    fireEvent.change(screen.getByLabelText('C++ prepared output'), {
      target: { value: 'static output' },
    });
    expect((backButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(backButton);
    expect(screen.getByLabelText('Session problems')).toBeTruthy();
    await waitFor(() =>
      expect(api.updateSolution).toHaveBeenCalledWith(
        'session-id',
        'problem',
        'cpp',
        {
          code: '',
          output: 'static output',
        },
      ),
    );
    await waitFor(() =>
      expect((backButton as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(backButton);
    expect(screen.getByLabelText('Session title')).toBeTruthy();
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

    fireEvent.change(screen.getByLabelText('C++ prepared output'), {
      target: { value: 'changed output' },
    });
    await waitFor(() =>
      expect(api.updateSolution).toHaveBeenCalledWith(
        'session-id',
        'problem',
        'cpp',
        { code: '', output: 'changed output' },
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

    fireEvent.click(screen.getByRole('button', { name: 'Retry C++ save' }));
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
