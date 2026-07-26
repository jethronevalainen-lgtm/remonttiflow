import { describe, expect, it } from 'vitest';

import { ROLE_HOME, ROLE_ROUTES, hasPermission, homeForRole } from '@/auth/permissions';
import { ROLE_TEST_USERS } from '@/test/roleTestUsers';

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

  it('matches every deterministic test identity with its role home', () => {
    for (const user of Object.values(ROLE_TEST_USERS)) {
      expect(homeForRole(user.role)).toBe(user.home);
      expect(ROLE_ROUTES[user.role]).toContain(user.home);
    }
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

  it('allows all project participants to attach files and edit their own messages', () => {
    for (const role of ['admin', 'supervisor', 'worker', 'customer'] as const) {
      expect(hasPermission(role, 'project_chat.attach')).toBe(true);
      expect(hasPermission(role, 'project_chat.edit_own')).toBe(true);
    }
  });

  it('separates customer decisions from management publishing', () => {
    expect(hasPermission('admin', 'project_documents.customer.share')).toBe(true);
    expect(hasPermission('supervisor', 'project_documents.customer.share')).toBe(true);
    expect(hasPermission('worker', 'project_documents.customer.share')).toBe(false);
    expect(hasPermission('customer', 'project_documents.customer.share')).toBe(false);

    expect(hasPermission('admin', 'change_orders.customer.submit')).toBe(true);
    expect(hasPermission('supervisor', 'change_orders.customer.submit')).toBe(true);
    expect(hasPermission('customer', 'change_orders.customer.submit')).toBe(false);
    expect(hasPermission('customer', 'change_orders.customer.decide')).toBe(true);
  });

  it('validates the full permission contract for every automated role user', () => {
    for (const user of Object.values(ROLE_TEST_USERS)) {
      for (const permission of user.requiredPermissions) {
        expect(hasPermission(user.role, permission), `${user.role} requires ${permission}`).toBe(true);
      }
      for (const permission of user.forbiddenPermissions) {
        expect(hasPermission(user.role, permission), `${user.role} forbids ${permission}`).toBe(false);
      }
    }
  });
});
