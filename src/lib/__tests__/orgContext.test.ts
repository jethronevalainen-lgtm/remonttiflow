import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  abortSignal: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: mocks.from,
    auth: { getUser: vi.fn() },
  },
}));

import { getMyOrganizations, OrgContextError } from '@/lib/supabase/orgContext';

describe('organization context query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits membership lookup to the signed-in user and passes the abort signal', async () => {
    const response = {
      data: [{
        role: 'admin',
        organizations: {
          id: 'org-1',
          name: 'VaKantti Oy',
          business_id: null,
          created_at: '2026-07-26T00:00:00.000Z',
          updated_at: '2026-07-26T00:00:00.000Z',
        },
      }],
      error: null,
    };

    const query = {
      select: mocks.select,
      eq: mocks.eq,
      abortSignal: mocks.abortSignal,
      then: (resolve: (value: typeof response) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(response).then(resolve, reject),
    };
    mocks.from.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.abortSignal.mockReturnValue(query);

    const controller = new AbortController();
    const organizations = await getMyOrganizations('user-1', controller.signal);

    expect(mocks.from).toHaveBeenCalledWith('organization_members');
    expect(mocks.select).toHaveBeenCalledWith(
      'role, organizations:organizations!organization_members_organization_id_fkey(*)',
    );
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(organizations).toEqual([{ ...response.data[0].organizations, role: 'admin' }]);
  });

  it('turns an aborted request into a user-facing timeout error', async () => {
    const response = {
      data: null,
      error: { message: 'AbortError: This operation was aborted' },
    };
    const query = {
      select: mocks.select,
      eq: mocks.eq,
      abortSignal: mocks.abortSignal,
      then: (resolve: (value: typeof response) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(response).then(resolve, reject),
    };
    mocks.from.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.abortSignal.mockReturnValue(query);

    await expect(getMyOrganizations('user-1', new AbortController().signal))
      .rejects.toEqual(expect.objectContaining<Partial<OrgContextError>>({
        name: 'OrgContextError',
        message: expect.stringContaining('aikakatkaistiin'),
      }));
  });
});
