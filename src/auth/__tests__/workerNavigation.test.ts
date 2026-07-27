import { describe, expect, it } from 'vitest';

import { ROLE_ROUTES } from '@/auth/permissions';

describe('worker navigation routes', () => {
  it('shows the worker record history and personal personnel card', () => {
    expect(ROLE_ROUTES.worker).toEqual(expect.arrayContaining([
      '/kirjaukset',
      '/henkilokortit',
    ]));
  });

  it('keeps personnel records hidden from project coordinators', () => {
    expect(ROLE_ROUTES.project_coordinator).not.toContain('/henkilokortit');
  });
});
