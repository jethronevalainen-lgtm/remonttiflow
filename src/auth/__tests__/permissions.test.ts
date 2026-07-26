import { describe, expect, it } from 'vitest';

import { ROLE_HOME, ROLE_ROUTES, hasPermission, homeForRole } from '@/auth/permissions';

describe('role home routes', () => {
  it('routes customer accounts to the customer workspace', () => {
    expect(ROLE_HOME.customer).toBe('/tilaajan-tyot');
    expect(homeForRole('customer')).toBe('/tilaajan-tyot');
  });

  it('keeps internal roles on the operational dashboard', () => {
    expect(homeForRole('admin')).toBe('/dashboard');
    expect(homeForRole('supervisor')).toBe('/dashboard');
    expect(homeForRole('worker')).toBe('/dashboard');
  });
});

describe('role permissions', () => {
  it('reserves organization management for admin', () => {
    expect(hasPermission('admin', 'organization.manage')).toBe(true);
    expect(hasPermission('supervisor', 'organization.manage')).toBe(false);
    expect(hasPermission('worker', 'organization.manage')).toBe(false);
    expect(hasPermission('customer', 'organization.manage')).toBe(false);
  });

  it('allows every role to create safety observations', () => {
    for (const role of ['admin', 'supervisor', 'worker', 'customer'] as const) {
      expect(hasPermission(role, 'safety.create')).toBe(true);
      expect(ROLE_ROUTES[role]).toContain('/tyoturvallisuus');
    }
  });

  it('keeps internal project chat away from customers', () => {
    expect(hasPermission('admin', 'project_chat.internal')).toBe(true);
    expect(hasPermission('supervisor', 'project_chat.internal')).toBe(true);
    expect(hasPermission('worker', 'project_chat.internal')).toBe(true);
    expect(hasPermission('customer', 'project_chat.internal')).toBe(false);
  });
});
