import { describe, expect, it } from 'vitest';

import {
  demoRoleOrder,
  isDemoAccountEmail,
} from '@/lib/supabase/demoEnvironment';

describe('demo environment helpers', () => {
  it('recognizes only the isolated VaKantti demo account domain', () => {
    expect(isDemoAccountEmail('worker.user-id@demo.vakantti.invalid')).toBe(true);
    expect(isDemoAccountEmail('WORKER.USER-ID@DEMO.VAKANTTI.INVALID')).toBe(true);
    expect(isDemoAccountEmail('worker@roles.vakantti.invalid')).toBe(false);
    expect(isDemoAccountEmail('real.user@example.com')).toBe(false);
    expect(isDemoAccountEmail(null)).toBe(false);
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
});
