import { render, screen, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthProvider, useAuth, ROLE_LABELS, type UserRole } from '../AuthContext';

// Test consumer that exposes the auth context via the DOM.
function AuthConsumer() {
  const { user, login, logout, hasRole } = useAuth();
  return (
    <div>
      <span data-testid="user-name">{user ? user.name : 'null'}</span>
      <span data-testid="user-role">{user ? user.role : 'null'}</span>
      <span data-testid="user-initials">{user ? user.initials : 'null'}</span>
      <span data-testid="role-label">{user ? ROLE_LABELS[user.role] : 'null'}</span>
      <span data-testid="has-admin">{String(hasRole(['admin']))}</span>
      <span data-testid="has-supervisor-or-admin">{String(hasRole(['supervisor', 'admin']))}</span>
      <span data-testid="has-worker">{String(hasRole(['worker']))}</span>
      <button onClick={() => login('admin')}>login-admin</button>
      <button onClick={() => login('worker')}>login-worker</button>
      <button onClick={logout}>logout</button>
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

describe('AuthContext', () => {
  it('defaults to the supervisor user (documents current auto-login behavior)', () => {
    renderWithProvider();
    expect(screen.getByTestId('user-name')).toHaveTextContent('Matti Meikäläinen');
    expect(screen.getByTestId('user-role')).toHaveTextContent('supervisor');
    expect(screen.getByTestId('user-initials')).toHaveTextContent('MM');
  });

  it('maps every role to a Finnish label via ROLE_LABELS', () => {
    expect(ROLE_LABELS.admin).toBe('Järjestelmänvalvoja');
    expect(ROLE_LABELS.supervisor).toBe('Työnjohtaja');
    expect(ROLE_LABELS.worker).toBe('Työntekijä');
    // Exhaustiveness: all roles have labels.
    const roles: UserRole[] = ['admin', 'supervisor', 'worker'];
    roles.forEach((role) => expect(ROLE_LABELS[role]).toBeTruthy());
  });

  it("login('admin') switches the user, initials, and role label", () => {
    renderWithProvider();
    act(() => screen.getByText('login-admin').click());
    expect(screen.getByTestId('user-name')).toHaveTextContent('Jethro Neva');
    expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
    expect(screen.getByTestId('user-initials')).toHaveTextContent('JN');
    expect(screen.getByTestId('role-label')).toHaveTextContent('Järjestelmänvalvoja');
  });

  it("login('worker') switches to the worker user and label", () => {
    renderWithProvider();
    act(() => screen.getByText('login-worker').click());
    expect(screen.getByTestId('user-name')).toHaveTextContent('Laura Kinnunen');
    expect(screen.getByTestId('user-role')).toHaveTextContent('worker');
    expect(screen.getByTestId('role-label')).toHaveTextContent('Työntekijä');
  });

  it('hasRole returns true only for roles that include the current user role', () => {
    renderWithProvider();
    // Default user is supervisor.
    expect(screen.getByTestId('has-supervisor-or-admin')).toHaveTextContent('true');
    expect(screen.getByTestId('has-admin')).toHaveTextContent('false');
    expect(screen.getByTestId('has-worker')).toHaveTextContent('false');

    act(() => screen.getByText('login-admin').click());
    expect(screen.getByTestId('has-admin')).toHaveTextContent('true');
    expect(screen.getByTestId('has-supervisor-or-admin')).toHaveTextContent('true');
    expect(screen.getByTestId('has-worker')).toHaveTextContent('false');
  });

  it('logout sets user to null and hasRole to false for any role set', () => {
    renderWithProvider();
    act(() => screen.getByText('logout').click());
    expect(screen.getByTestId('user-name')).toHaveTextContent('null');
    expect(screen.getByTestId('user-role')).toHaveTextContent('null');
    expect(screen.getByTestId('has-admin')).toHaveTextContent('false');
    expect(screen.getByTestId('has-supervisor-or-admin')).toHaveTextContent('false');
    expect(screen.getByTestId('has-worker')).toHaveTextContent('false');
  });

  it('supports login after logout', () => {
    renderWithProvider();
    act(() => screen.getByText('logout').click());
    expect(screen.getByTestId('user-name')).toHaveTextContent('null');
    act(() => screen.getByText('login-admin').click());
    expect(screen.getByTestId('user-name')).toHaveTextContent('Jethro Neva');
  });

  it('useAuth throws when used outside AuthProvider', () => {
    // Swallow the expected React error output.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<AuthConsumer />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });
});
