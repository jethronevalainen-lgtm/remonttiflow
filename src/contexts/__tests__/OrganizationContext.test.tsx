import { render, screen, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/orgContext', () => ({
  getMyOrganizations: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { getMyOrganizations, type MyOrganization } from '@/lib/supabase/orgContext';
import { useAuth } from '@/contexts/AuthContext';

import {
  CURRENT_ORG_STORAGE_KEY,
  OrganizationProvider,
  useOrganization,
} from '../OrganizationContext';

const ORG_A: MyOrganization = {
  id: 'org-a',
  name: 'VaKantti Demo Oy',
  created_at: '2025-01-01T00:00:00Z',
  role: 'admin',
};

const ORG_B: MyOrganization = {
  id: 'org-b',
  name: 'Rakennus Toinen Oy',
  created_at: '2025-01-02T00:00:00Z',
  role: 'worker',
};

function signedInAuth(): ReturnType<typeof useAuth> {
  return {
    session: { access_token: 'test-token' },
    user: { id: 'user-1' },
    profile: null,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>;
}

function signedOutAuth(): ReturnType<typeof useAuth> {
  return {
    session: null,
    user: null,
    profile: null,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>;
}

function authLoading(): ReturnType<typeof useAuth> {
  return { ...signedOutAuth(), loading: true };
}

// Mutable auth state so tests can simulate sign-in / sign-out via rerender.
let authState = signedOutAuth();

// Test consumer that exposes the organization context via the DOM.
function OrgConsumer() {
  const {
    organizations,
    currentOrg,
    currentRole,
    setCurrentOrg,
    loading,
    error,
  } = useOrganization();
  return (
    <div>
      <span data-testid="org-count">{organizations.length}</span>
      <span data-testid="current-org">{currentOrg ? currentOrg.name : 'null'}</span>
      <span data-testid="current-org-id">{currentOrg ? currentOrg.id : 'null'}</span>
      <span data-testid="current-role">{currentRole ?? 'null'}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? 'null'}</span>
      <button onClick={() => setCurrentOrg('org-b')}>select-b</button>
      <button onClick={() => setCurrentOrg('org-unknown')}>select-unknown</button>
    </div>
  );
}

function renderTree() {
  return render(
    <OrganizationProvider>
      <OrgConsumer />
    </OrganizationProvider>,
  );
}

function rerenderTree(rerender: (ui: React.ReactElement) => void) {
  rerender(
    <OrganizationProvider>
      <OrgConsumer />
    </OrganizationProvider>,
  );
}

describe('OrganizationContext', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    authState = signedOutAuth();
    vi.mocked(useAuth).mockImplementation(() => authState);
    vi.mocked(getMyOrganizations).mockResolvedValue([ORG_A, ORG_B]);
  });

  it('loads organizations when a session appears and selects the first by default', async () => {
    const { rerender } = renderTree();
    expect(screen.getByTestId('org-count')).toHaveTextContent('0');
    expect(screen.getByTestId('current-org')).toHaveTextContent('null');
    expect(getMyOrganizations).not.toHaveBeenCalled();

    authState = signedInAuth();
    rerenderTree(rerender);

    await waitFor(() =>
      expect(screen.getByTestId('org-count')).toHaveTextContent('2'),
    );
    expect(getMyOrganizations).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('current-org-id')).toHaveTextContent('org-a');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('is loading while auth resolves or organizations are fetched', async () => {
    authState = authLoading();
    const { rerender } = renderTree();
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    authState = signedInAuth();
    rerenderTree(rerender);
    // Fetch kicked off — still loading until getMyOrganizations resolves.
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );
  });

  it('derives currentRole from the active organization membership', async () => {
    authState = signedInAuth();
    renderTree();
    await waitFor(() =>
      expect(screen.getByTestId('current-role')).toHaveTextContent('admin'),
    );

    act(() => screen.getByText('select-b').click());
    await waitFor(() =>
      expect(screen.getByTestId('current-role')).toHaveTextContent('worker'),
    );
    expect(screen.getByTestId('current-org-id')).toHaveTextContent('org-b');
  });

  it('persists the selection to localStorage and restores it on next load', async () => {
    authState = signedInAuth();
    const first = renderTree();
    await waitFor(() =>
      expect(screen.getByTestId('current-org-id')).toHaveTextContent('org-a'),
    );

    act(() => screen.getByText('select-b').click());
    await waitFor(() =>
      expect(screen.getByTestId('current-org-id')).toHaveTextContent('org-b'),
    );
    expect(window.localStorage.getItem(CURRENT_ORG_STORAGE_KEY)).toBe('org-b');

    // Simulate a full reload: unmount and render again with the stored id.
    first.unmount();
    renderTree();
    await waitFor(() =>
      expect(screen.getByTestId('current-org-id')).toHaveTextContent('org-b'),
    );
    expect(screen.getByTestId('current-role')).toHaveTextContent('worker');
  });

  it('falls back to the first organization when the stored id is no longer a membership', async () => {
    window.localStorage.setItem(CURRENT_ORG_STORAGE_KEY, 'org-not-a-member');
    authState = signedInAuth();
    renderTree();

    await waitFor(() =>
      expect(screen.getByTestId('current-org-id')).toHaveTextContent('org-a'),
    );
    // Fallback choice is re-persisted over the stale value.
    expect(window.localStorage.getItem(CURRENT_ORG_STORAGE_KEY)).toBe('org-a');
  });

  it('ignores setCurrentOrg for an organization the user is not a member of', async () => {
    authState = signedInAuth();
    renderTree();
    await waitFor(() =>
      expect(screen.getByTestId('current-org-id')).toHaveTextContent('org-a'),
    );

    act(() => screen.getByText('select-unknown').click());
    expect(screen.getByTestId('current-org-id')).toHaveTextContent('org-a');
    expect(window.localStorage.getItem(CURRENT_ORG_STORAGE_KEY)).toBe('org-a');
  });

  it('resets organizations, selection, role and error when the session ends', async () => {
    authState = signedInAuth();
    const { rerender } = renderTree();
    await waitFor(() =>
      expect(screen.getByTestId('org-count')).toHaveTextContent('2'),
    );

    authState = signedOutAuth();
    rerenderTree(rerender);

    await waitFor(() =>
      expect(screen.getByTestId('org-count')).toHaveTextContent('0'),
    );
    expect(screen.getByTestId('current-org')).toHaveTextContent('null');
    expect(screen.getByTestId('current-role')).toHaveTextContent('null');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toHaveTextContent('null');
  });

  it('handles the zero-organizations case gracefully', async () => {
    vi.mocked(getMyOrganizations).mockResolvedValue([]);
    authState = signedInAuth();
    renderTree();

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );
    expect(screen.getByTestId('org-count')).toHaveTextContent('0');
    expect(screen.getByTestId('current-org')).toHaveTextContent('null');
    expect(screen.getByTestId('current-role')).toHaveTextContent('null');
    expect(screen.getByTestId('error')).toHaveTextContent('null');
  });

  it('surfaces a Finnish error string when loading organizations fails', async () => {
    vi.mocked(getMyOrganizations).mockRejectedValue(
      new Error('Organisaatioiden haku epäonnistui: verkkovirhe'),
    );
    authState = signedInAuth();
    renderTree();

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent(
        'Organisaatioiden haku epäonnistui',
      ),
    );
    expect(screen.getByTestId('org-count')).toHaveTextContent('0');
    expect(screen.getByTestId('current-org')).toHaveTextContent('null');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('useOrganization throws when used outside OrganizationProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<OrgConsumer />)).toThrow(
      'useOrganization must be used within OrganizationProvider',
    );
    spy.mockRestore();
  });
});
