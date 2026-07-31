import { describe, expect, it } from 'vitest';

import { HEADER_SEARCH_ROUTES, routeLabel, ROUTE_LABELS } from '@/lib/routeLabels';

describe('routeLabel', () => {
  it('returns canonical Finnish labels', () => {
    expect(routeLabel('/dashboard')).toBe('Päivän tilannekuva');
    expect(routeLabel('/tyovuorokalenteri')).toBe('Resurssikalenteri');
    expect(routeLabel('/kirjaukset')).toBe('Työmaakirjaukset');
    expect(routeLabel('/viestinta')).toBe('Viestit ja tiedotteet');
    expect(routeLabel('/tyonjohto')).toBe('Työnjohdon koonti');
    expect(routeLabel('/aikataulutus')).toBe('Aikataulutus');
    expect(routeLabel('/tilaukset')).toBe('Tilaukset');
  });

  it('applies worker overrides', () => {
    expect(routeLabel('/tarkastukset', 'worker')).toBe('Puutteet ja tarkastukset');
    expect(routeLabel('/dashboard', 'worker')).toBe('Oma työtila');
  });

  it('matches nested paths to the longest route prefix', () => {
    expect(routeLabel('/projektikeskustelut/abc-123')).toBe('Projektikeskustelut');
    expect(routeLabel('/projektit/abc-123')).toBe('Projektit');
  });

  it('returns null for unknown paths', () => {
    expect(routeLabel('/tuntematon')).toBeNull();
  });
});

describe('HEADER_SEARCH_ROUTES', () => {
  it('covers key management routes with canonical labels', () => {
    const byPath = new Map(HEADER_SEARCH_ROUTES.map((route) => [route.path, route.label]));
    expect(byPath.get('/tyovuorokalenteri')).toBe(ROUTE_LABELS['/tyovuorokalenteri']);
    expect(byPath.get('/projektipyynnot')).toBe('Projektipyynnöt');
    expect(byPath.get('/kirjaukset')).toBe('Työmaakirjaukset');
    expect(byPath.get('/tilaukset')).toBe('Tilaukset');
    expect(byPath.has('/laskenta')).toBe(false);
  });
});
