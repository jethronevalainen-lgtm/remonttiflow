import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEMO_SOURCE_ORGANIZATION_STORAGE_KEY,
  demoRoleOrder,
  isDemoAccountEmail,
  isDemoOrganizationBusinessId,
  readDemoSourceOrganization,
  rememberDemoSourceOrganization,
} from '@/lib/supabase/demoEnvironment';

describe('demo environment helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('recognizes only the isolated VaKantti demo account domain', () => {
    expect(isDemoAccountEmail('worker.user-id@demo.vakantti.invalid')).toBe(true);
    expect(isDemoAccountEmail('WORKER.USER-ID@DEMO.VAKANTTI.INVALID')).toBe(true);
    expect(isDemoAccountEmail('worker@roles.vakantti.invalid')).toBe(false);
    expect(isDemoAccountEmail('real.user@example.com')).toBe(false);
    expect(isDemoAccountEmail(null)).toBe(false);
  });

  it('recognizes demo organizations from their reserved business id prefix', () => {
    expect(isDemoOrganizationBusinessId('DEMO-12345678')).toBe(true);
    expect(isDemoOrganizationBusinessId(' demo-abcd1234 ')).toBe(true);
    expect(isDemoOrganizationBusinessId('1234567-8')).toBe(false);
    expect(isDemoOrganizationBusinessId(null)).toBe(false);
  });

  it('orders the role cards from management to customer', () => {
    const roles = ['customer', 'worker', 'supervisor', 'project_coordinator'] as const;
    expect([...roles].sort((a, b) => demoRoleOrder(a) - demoRoleOrder(b))).toEqual([
      'supervisor',
      'project_coordinator',
      'worker',
      'customer',
    ]);
  });

  it('remembers the real organization for a clear return path from demo mode', () => {
    rememberDemoSourceOrganization(' 00000000-0000-4000-8000-000000000001 ');
    expect(window.localStorage.getItem(DEMO_SOURCE_ORGANIZATION_STORAGE_KEY)).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
    expect(readDemoSourceOrganization()).toBe('00000000-0000-4000-8000-000000000001');
  });
});
