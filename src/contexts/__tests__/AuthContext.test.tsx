import { useState } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';

import type { ProfileRow } from '@/lib/supabase/types';

// Hoisted mock handles for the Supabase client — no real network in tests.
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
    from: mocks.from,
  },
}));

import { AuthProvider, useAuth, ROLE_LABELS, type UserRole } from '../AuthContext';

type AuthChangeCallback = (event: string, session: Session | null) => void;

const fakeUser = {
  id: 'user-1',
  email: 'matti@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2025-01-01T00:00:00Z',
} as User;

const fakeSession = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: fakeUser,
} as Session;

const fakeProfile: ProfileRow = {
  id: 'user-1',
  full_name: 'Matti Meikäläinen',
  email: 'matti@example.com',
  created_at: '2025-01-01T00:00:00Z',
};

/** Latest auth-state-change callback registered by the provider. */
function latestAuthCallback(): AuthChangeCallback {
  const calls = mocks.onAuthStateChange.mock.calls;
  if (calls.length === 0) throw new Error('onAuthStateChange was not called');
  return calls[calls.length - 1][0] as AuthChangeCallback;
}

// Test consumer that exposes the auth context via the DOM.
function AuthConsumer() {
  const { session, user, profile, loading, signIn, signOut } = useAuth();
  const [signInError, setSignInError] = useState<string | null>(null);
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user-id">{user ? user.id : 'null'}</span>
      <span data-testid="session-token">{session ? session.access_token : 'null'}</span>
      <span data-testid="profile-name">{profile ? (profile.full_name ?? 'null') : 'null'}</span>
      <button
        onClick={async () => {
          const result = await signIn('matti@example.com', 'salasana');
          setSignInError(result.error);
        }}
      >
        sign-in
      </button>
      <span data-testid="sign-in-error">{signInError ?? 'null'}</span>
      <button onClick={() => void signOut()}>sign-out</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );
}

describe('AuthContext (Supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mocks.unsubscribe } },
    });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it('resolves loading with null session/user when no session exists', async () => {
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );
    expect(screen.getByTestId('user-id')).toHaveTextContent('null');
    expect(screen.getByTestId('session-token')).toHaveTextContent('null');
    expect(screen.getByTestId('profile-name')).toHaveTextContent('null');
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
  });

  it('subscribes to onAuthStateChange and unsubscribes on unmount', async () => {
    const { unmount } = renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );
    expect(mocks.onAuthStateChange).toHaveBeenCalledTimes(1);
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('exposes the session/user and fetches the profile when a session exists', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: fakeSession } });
    mocks.maybeSingle.mockResolvedValue({ data: fakeProfile, error: null });

    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('profile-name')).toHaveTextContent('Matti Meikäläinen'),
    );
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-1');
    expect(screen.getByTestId('session-token')).toHaveTextContent('access-token');
    expect(mocks.from).toHaveBeenCalledWith('profiles');
    expect(mocks.select).toHaveBeenCalledWith('*');
    expect(mocks.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('degrades to null profile when the profile fetch fails', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: fakeSession } });
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'row level security' },
    });

    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-1');
    expect(screen.getByTestId('profile-name')).toHaveTextContent('null');
  });

  it('signIn returns no error on success and forwards credentials to Supabase', async () => {
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );
    await act(async () => {
      screen.getByText('sign-in').click();
    });
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent('null'),
    );
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'matti@example.com',
      password: 'salasana',
    });
  });

  it('maps invalid credentials to a Finnish error message', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    });
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );
    await act(async () => {
      screen.getByText('sign-in').click();
    });
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent(
        'Virheellinen sähköposti tai salasana',
      ),
    );
  });

  it('maps unexpected sign-in errors to a generic Finnish message', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'fetch failed' },
    });
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );
    await act(async () => {
      screen.getByText('sign-in').click();
    });
    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent(
        'Kirjautuminen epäonnistui. Yritä uudelleen myöhemmin.',
      ),
    );
  });

  it('updates session/profile when the auth listener fires SIGNED_IN', async () => {
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );
    expect(screen.getByTestId('user-id')).toHaveTextContent('null');

    mocks.maybeSingle.mockResolvedValue({ data: fakeProfile, error: null });
    await act(async () => {
      latestAuthCallback()('SIGNED_IN', fakeSession);
    });
    await waitFor(() =>
      expect(screen.getByTestId('profile-name')).toHaveTextContent('Matti Meikäläinen'),
    );
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-1');
  });

  it('signOut signs out of Supabase and clears session and profile', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: fakeSession } });
    mocks.maybeSingle.mockResolvedValue({ data: fakeProfile, error: null });

    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('profile-name')).toHaveTextContent('Matti Meikäläinen'),
    );
    await act(async () => {
      screen.getByText('sign-out').click();
    });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('user-id')).toHaveTextContent('null');
    expect(screen.getByTestId('session-token')).toHaveTextContent('null');
    expect(screen.getByTestId('profile-name')).toHaveTextContent('null');
  });

  it('clears state when the auth listener fires SIGNED_OUT', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: fakeSession } });
    mocks.maybeSingle.mockResolvedValue({ data: fakeProfile, error: null });

    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId('user-id')).toHaveTextContent('user-1'),
    );
    await act(async () => {
      latestAuthCallback()('SIGNED_OUT', null);
    });
    expect(screen.getByTestId('user-id')).toHaveTextContent('null');
    expect(screen.getByTestId('profile-name')).toHaveTextContent('null');
  });

  it('maps every role to a Finnish label via ROLE_LABELS', () => {
    expect(ROLE_LABELS.admin).toBe('Järjestelmänvalvoja');
    expect(ROLE_LABELS.supervisor).toBe('Työnjohtaja');
    expect(ROLE_LABELS.worker).toBe('Työntekijä');
    // Exhaustiveness: all roles have labels.
    const roles: UserRole[] = ['admin', 'supervisor', 'worker'];
    roles.forEach((role) => expect(ROLE_LABELS[role]).toBeTruthy());
  });

  it('useAuth throws when used outside AuthProvider', () => {
    // Swallow the expected React error output.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<AuthConsumer />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });
});
