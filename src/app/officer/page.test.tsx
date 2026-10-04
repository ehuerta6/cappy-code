// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firebase = vi.hoisted(() => ({
  observer: undefined as undefined | ((user: User | null) => void),
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  listSessions: vi.fn(),
}));
vi.mock('client-only', () => ({}));
vi.mock('@/lib/firebase/auth', () => ({ getOfficerAuth: () => ({}) }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: firebase.onAuthStateChanged,
  signOut: firebase.signOut,
  signInWithEmailAndPassword: vi.fn(),
}));
vi.mock('@/lib/firebase/sessions', () => ({
  listSessions: firebase.listSessions,
  createSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
}));
vi.mock('@monaco-editor/react', () => ({
  default: ({ options }: { options: { readOnly: boolean } }) => (
    <div
      aria-label={options.readOnly ? 'Read-only editor' : 'Editable editor'}
    />
  ),
}));

import OfficerLayout from './layout';
import OfficerPage from './page';
import MemberPage from '../page';

beforeEach(() => {
  vi.resetAllMocks();
  firebase.observer = undefined;
  firebase.onAuthStateChanged.mockImplementation((_auth, callback) => {
    firebase.observer = callback;
    return vi.fn();
  });
  firebase.listSessions.mockResolvedValue([]);
  firebase.signOut.mockResolvedValue(undefined);
});
afterEach(cleanup);

function reportUser(user: User | null) {
  act(() => firebase.observer?.(user));
}

function renderOfficer() {
  return render(
    <OfficerLayout>
      <OfficerPage />
    </OfficerLayout>,
  );
}

describe('Officer Session route integration', () => {
  it.each([null, { uid: 'anonymous', isAnonymous: true } as User])(
    'keeps Session controls and reads behind the existing gate (%s)',
    (identity) => {
      renderOfficer();
      expect(
        screen.queryByRole('button', { name: '+ New session' }),
      ).toBeNull();
      expect(firebase.listSessions).not.toHaveBeenCalled();
      reportUser(identity);
      expect(screen.getByLabelText('Password')).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: '+ New session' }),
      ).toBeNull();
      expect(firebase.listSessions).not.toHaveBeenCalled();
    },
  );

  it('mounts Session management after authentication and removes it on sign-out', async () => {
    renderOfficer();
    reportUser({ uid: 'officer', isAnonymous: false } as User);
    expect(await screen.findByText('No Sessions yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ New session' })).toBeTruthy();
    expect(firebase.onAuthStateChanged).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.queryByRole('button', { name: '+ New session' })).toBeNull();
    reportUser(null);
    expect(await screen.findByLabelText('Password')).toBeTruthy();
    expect(firebase.signOut).toHaveBeenCalledTimes(1);
  });

  it('keeps Member Mode read-only without Auth or Session data access', () => {
    render(<MemberPage />);
    expect(screen.getByLabelText('Read-only editor')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ New session' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete session' })).toBeNull();
    expect(firebase.onAuthStateChanged).not.toHaveBeenCalled();
    expect(firebase.listSessions).not.toHaveBeenCalled();
  });
});
