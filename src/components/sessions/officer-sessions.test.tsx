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
  deleteSession: vi.fn(),
}));
vi.mock('@/lib/firebase/sessions', () => api);
import OfficerSessions from './officer-sessions';

const record = {
  id: 'session-id',
  session: {
    title: 'Arrays',
    date: '2026-10-08',
    status: 'draft',
    activeProblemId: null,
    createdAt: Timestamp.fromMillis(1000),
    updatedAt: Timestamp.fromMillis(1000),
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  api.listSessions.mockResolvedValue([record]);
  api.createSession.mockResolvedValue('new-session');
  api.updateSession.mockResolvedValue(undefined);
  api.deleteSession.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
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
      await screen.findByRole('button', { name: /Arrays.*2026-10-08.*draft/ }),
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
