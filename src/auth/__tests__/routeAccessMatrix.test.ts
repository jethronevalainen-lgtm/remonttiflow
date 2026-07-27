import { describe, expect, it } from 'vitest';

import { rolesForRoute } from '@/auth/permissions';

describe('central route access matrix', () => {
  it('allows internal users to open the dashboard', () => {
    expect(rolesForRoute('/dashboard')).toEqual([
      'admin',
      'supervisor',
      'project_coordinator',
      'worker',
    ]);
  });

  it('keeps employee personnel cards outside project coordinator access', () => {
    expect(rolesForRoute('/henkilokortit')).toEqual([
      'admin',
      'supervisor',
      'worker',
    ]);
  });

  it('allows every internal role to use a QR check-in link', () => {
    expect(rolesForRoute('/qr-kirjautuminen')).toEqual([
      'admin',
      'supervisor',
      'project_coordinator',
      'worker',
    ]);
  });

  it('reserves payroll reports for admin and supervisors', () => {
    expect(rolesForRoute('/raportit')).toEqual(['admin', 'supervisor']);
  });

  it('reserves the customer project list for customer accounts', () => {
    expect(rolesForRoute('/tilaajan-tyot')).toEqual(['customer']);
  });

  it('denies routes that are not part of the access contract', () => {
    expect(rolesForRoute('/not-a-real-route')).toEqual([]);
  });
});
