// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firebase = vi.hoisted(() => ({
  app: { name: '[DEFAULT]' },
  auth: {},
  observer: undefined as undefined | ((user: User | null) => void),
  unsubscribe: vi.fn(),
  getApp: vi.fn(),
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('client-only', () => ({}));
vi.mock('@/lib/firebase/client', () => ({ getFirebaseApp: firebase.getApp }));
vi.mock('firebase/auth', () => ({
  getAuth: firebase.getAuth,
  onAuthStateChanged: firebase.onAuthStateChanged,
  signInWithEmailAndPassword: firebase.signIn,
  signOut: firebase.signOut,
}));

import OfficerAuthGate from './officer-auth-gate';

const officer = { uid: 'test-officer' } as User;

function renderGate() {
  return render(
    <OfficerAuthGate>
      <button>Protected write control</button>
    </OfficerAuthGate>,
  );
}

function reportUser(user: User | null) {
  act(() => firebase.observer?.(user));
}

beforeEach(() => {
  vi.resetAllMocks();
  firebase.observer = undefined;
  firebase.getApp.mockReturnValue(firebase.app);
  firebase.getAuth.mockReturnValue(firebase.auth);
  firebase.onAuthStateChanged.mockImplementation((_auth, callback) => {
    firebase.observer = callback;
    return firebase.unsubscribe;
  });
  firebase.signIn.mockResolvedValue({ user: officer });
  firebase.signOut.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('Officer auth boundary', () => {
  it('hides protected controls until Firebase confirms authentication', () => {
    renderGate();
    expect(screen.getByRole('status').textContent).toContain('Checking');
    expect(
      screen.queryByRole('button', { name: 'Protected write control' }),
    ).toBeNull();
    expect(screen.queryByLabelText('Password')).toBeNull();
    expect(firebase.getAuth).toHaveBeenCalledWith(firebase.app);
    expect(firebase.onAuthStateChanged.mock.calls[0][0]).toBe(firebase.auth);

    reportUser(null);
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(
      screen.queryByRole('button', { name: 'Protected write control' }),
    ).toBeNull();

    reportUser(officer);
    expect(
      screen.getByRole('button', { name: 'Protected write control' }),
    ).toBeDefined();
    expect(screen.queryByLabelText('Password')).toBeNull();

    reportUser(null);
    expect(
      screen.queryByRole('button', { name: 'Protected write control' }),
    ).toBeNull();
  });

  it('restores the Firebase session on remount and unsubscribes on unmount', () => {
    const view = renderGate();
    reportUser(officer);
    view.unmount();
    expect(firebase.unsubscribe).toHaveBeenCalledOnce();
    renderGate();
    expect(
      screen.queryByRole('button', { name: 'Protected write control' }),
    ).toBeNull();
    reportUser(officer);
    expect(
      screen.getByRole('button', { name: 'Protected write control' }),
    ).toBeDefined();
  });

  it('fails closed when Firebase initialization fails', () => {
    firebase.getApp.mockImplementation(() => {
      throw new Error('internal config');
    });
    renderGate();
    expect(screen.getByRole('alert').textContent).toContain('unavailable');
    expect(screen.queryByText('internal config')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Protected write control' }),
    ).toBeNull();
    expect(
      screen
        .getByRole('link', { name: 'View member site' })
        .getAttribute('href'),
    ).toBe('/');
  });

  it('fails closed if the observer reports an error after authentication', () => {
    renderGate();
    reportUser(officer);
    act(() =>
      firebase.onAuthStateChanged.mock.calls[0][2](new Error('internal')),
    );
    expect(
      screen.queryByRole('button', { name: 'Protected write control' }),
    ).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('unavailable');
  });

  it('submits credentials to the existing Auth instance and waits for the observer', async () => {
    const user = userEvent.setup();
    renderGate();
    reportUser(null);
    await user.type(screen.getByLabelText('Email'), 'officer@example.test');
    await user.type(screen.getByLabelText('Password'), 'test-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(firebase.signIn).toHaveBeenCalledWith(
      firebase.auth,
      'officer@example.test',
      'test-password',
    );
    expect(
      (screen.getByRole('button', { name: 'Signing in…' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.queryByRole('button', { name: 'Protected write control' }),
    ).toBeNull();
    reportUser(officer);
    expect(
      screen.getByRole('button', { name: 'Protected write control' }),
    ).toBeDefined();
  });

  it('shows a generic failed-login message and allows retry without exposing account details', async () => {
    firebase.signIn.mockRejectedValueOnce(new Error('auth/user-not-found'));
    const user = userEvent.setup();
    renderGate();
    reportUser(null);
    await user.type(screen.getByLabelText('Email'), 'officer@example.test');
    await user.type(screen.getByLabelText('Password'), 'test-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Unable to sign in. Check your credentials and try again.',
    );
    expect(screen.queryByText('auth/user-not-found')).toBeNull();
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(
      'officer@example.test',
    );
    expect(
      screen.queryByRole('button', { name: 'Protected write control' }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(firebase.signIn).toHaveBeenCalledTimes(2);
    reportUser(officer);
    expect(
      screen.getByRole('button', { name: 'Protected write control' }),
    ).toBeDefined();
  });

  it('hides controls while signing out and returns to login after Firebase clears the session', async () => {
    let finishLogout!: () => void;
    firebase.signOut.mockReturnValue(
      new Promise<void>((resolve) => {
        finishLogout = resolve;
      }),
    );
    const user = userEvent.setup();
    renderGate();
    reportUser(officer);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(firebase.signOut).toHaveBeenCalledWith(firebase.auth);
    expect(
      screen.queryByRole('button', { name: 'Protected write control' }),
    ).toBeNull();
    expect(
      (
        screen.getByRole('button', {
          name: 'Signing out…',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    reportUser(null);
    await act(async () => finishLogout());
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(
      screen
        .getByRole('link', { name: 'View member site' })
        .getAttribute('href'),
    ).toBe('/');
  });

  it('shows failed logout without pretending Firebase ended the session', async () => {
    firebase.signOut.mockRejectedValue(new Error('network error'));
    const user = userEvent.setup();
    renderGate();
    reportUser(officer);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Unable to sign out',
      ),
    );
    expect(
      screen.getByRole('button', { name: 'Protected write control' }),
    ).toBeDefined();
    expect(
      (screen.getByRole('button', { name: 'Sign out' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
