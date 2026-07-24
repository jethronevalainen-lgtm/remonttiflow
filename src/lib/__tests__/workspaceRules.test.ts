import { describe, expect, it } from 'vitest';

import { ROLE_ROUTES } from '@/contexts/AuthContext';
import {
  allowedWorkerTransitions,
  isWorkerTransitionAllowed,
} from '@/lib/workspaceRules';

describe('worker route boundaries', () => {
  it('contains only personal and worksite tools', () => {
    expect(ROLE_ROUTES.worker).toEqual([
      '/dashboard',
      '/tyomaaraykset',
      '/kuittaukset',
      '/tuntikirjaukset',
      '/matkakulut',
      '/viestinta',
      '/lomakkeet',
    ]);
  });

  it('does not expose management or administration routes', () => {
    const forbidden = [
      '/projektit',
      '/tyonjohto',
      '/aikataulutus',
      '/tyovuorokalenteri',
      '/henkilosto',
      '/laskenta',
      '/raportit',
      '/hallinta',
    ];

    forbidden.forEach((path) => {
      expect(ROLE_ROUTES.worker).not.toContain(path);
    });
  });
});

describe('worker work-order transitions', () => {
  it('allows starting an open task', () => {
    expect(allowedWorkerTransitions('Avoin')).toEqual(['Käynnissä']);
    expect(isWorkerTransitionAllowed('Avoin', 'Käynnissä')).toBe(true);
  });

  it('allows pausing or completing active work', () => {
    expect(allowedWorkerTransitions('Käynnissä')).toEqual(['Odottaa', 'Valmis']);
  });

  it('allows resuming or completing waiting work', () => {
    expect(allowedWorkerTransitions('Odottaa')).toEqual(['Käynnissä', 'Valmis']);
  });

  it('does not allow workers to reopen completed or cancelled work', () => {
    expect(allowedWorkerTransitions('Valmis')).toEqual([]);
    expect(allowedWorkerTransitions('Peruttu')).toEqual([]);
    expect(isWorkerTransitionAllowed('Valmis', 'Käynnissä')).toBe(false);
  });
});
