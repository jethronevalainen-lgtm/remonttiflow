/**
 * Canonical Finnish UI labels for app routes.
 * Keep Navbar, Header search, breadcrumbs and page H1s aligned with these.
 */
export const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Päivän tilannekuva',
  '/tyonjohto': 'Työnjohdon koonti',
  '/projektit': 'Projektit',
  '/projektikeskustelut': 'Projektikeskustelut',
  '/projektipyynnot': 'Projektipyynnöt',
  '/tyomaaraykset': 'Työmääräykset',
  '/aikataulutus': 'Aikataulutus',
  '/tyovuorokalenteri': 'Resurssikalenteri',
  '/paivakirjat': 'Päiväkirjat',
  '/tilaukset': 'Tilaukset',
  '/jatehuolto': 'Jätehuolto',
  '/tarkastukset': 'Tarkastukset ja luovutukset',
  '/tyoturvallisuus': 'Työturvallisuus',
  '/kuittaukset': 'Kuittaukset',
  '/lomakkeet': 'Lomakkeet',
  '/tuntikirjaukset': 'Tuntikirjaukset',
  '/kirjaukset': 'Työmaakirjaukset',
  '/matkakulut': 'Matkakulut',
  '/henkilosto': 'Henkilöstö',
  '/henkilokortit': 'Henkilökortit ja palkat',
  '/palkka-aineisto': 'Palkka-aineisto',
  '/asiakkaat': 'Asiakkaat',
  '/crm': 'CRM',
  '/tarjoukset': 'Tarjouslaskenta',
  '/laskenta': 'Tarjouslaskenta',
  '/maaralaskenta': 'Määrälaskenta',
  '/toiminnanohjaus': 'Toiminnanohjaus',
  '/raportit': 'Raporttikeskus',
  '/viestinta': 'Viestit ja tiedotteet',
  '/kalusto': 'Kalusto',
  '/ai': 'AI-työkalut',
  '/qr-hallinta': 'QR-kirjautumisen hallinta',
  '/hallinta': 'Organisaation hallinta',
  '/varmuuskopiot': 'Varmuuskopiot',
  '/kayttajaesikatselu': 'Toimi käyttäjänä',
  '/tilaajan-tyot': 'Projektini',
};

/** Role-specific overrides for the same path. */
export const ROLE_ROUTE_LABELS: Partial<
  Record<'worker' | 'customer' | 'management', Partial<Record<string, string>>>
> = {
  worker: {
    '/dashboard': 'Oma työtila',
    '/tyomaaraykset': 'Minun työni',
    '/tarkastukset': 'Puutteet ja tarkastukset',
    '/tyoturvallisuus': 'Turvallisuushavainnot',
    '/henkilokortit': 'Omat henkilöstö- ja palkkatiedot',
    '/viestinta': 'Viestit ja tiedotteet',
  },
  customer: {
    '/viestinta': 'Tiedotteet',
    '/tyoturvallisuus': 'Turvallisuushavainto',
  },
};

export function routeLabel(
  path: string,
  role?: 'worker' | 'customer' | 'management' | string | null,
): string | null {
  const base = (path.split('?')[0] ?? path).replace(/\/$/, '') || '/';
  const candidates = Object.keys(ROUTE_LABELS)
    .filter((route) => base === route || base.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length);
  const matched = candidates[0];
  if (!matched) return null;

  if (role === 'worker' && ROLE_ROUTE_LABELS.worker?.[matched]) {
    return ROLE_ROUTE_LABELS.worker[matched]!;
  }
  if (role === 'customer' && ROLE_ROUTE_LABELS.customer?.[matched]) {
    return ROLE_ROUTE_LABELS.customer[matched]!;
  }
  return ROUTE_LABELS[matched] ?? null;
}

/** Flat list for header search – one entry per searchable path. */
export const HEADER_SEARCH_ROUTES: { path: string; label: string }[] = [
  { path: '/dashboard', label: ROUTE_LABELS['/dashboard'] },
  { path: '/tyonjohto', label: ROUTE_LABELS['/tyonjohto'] },
  { path: '/projektit', label: ROUTE_LABELS['/projektit'] },
  { path: '/projektikeskustelut', label: ROUTE_LABELS['/projektikeskustelut'] },
  { path: '/projektipyynnot', label: ROUTE_LABELS['/projektipyynnot'] },
  { path: '/tyomaaraykset', label: ROUTE_LABELS['/tyomaaraykset'] },
  { path: '/aikataulutus', label: ROUTE_LABELS['/aikataulutus'] },
  { path: '/tyovuorokalenteri', label: ROUTE_LABELS['/tyovuorokalenteri'] },
  { path: '/paivakirjat', label: ROUTE_LABELS['/paivakirjat'] },
  { path: '/tilaukset', label: ROUTE_LABELS['/tilaukset'] },
  { path: '/jatehuolto', label: ROUTE_LABELS['/jatehuolto'] },
  { path: '/tarkastukset', label: ROUTE_LABELS['/tarkastukset'] },
  { path: '/tyoturvallisuus', label: ROUTE_LABELS['/tyoturvallisuus'] },
  { path: '/kuittaukset', label: ROUTE_LABELS['/kuittaukset'] },
  { path: '/lomakkeet', label: ROUTE_LABELS['/lomakkeet'] },
  { path: '/tuntikirjaukset', label: ROUTE_LABELS['/tuntikirjaukset'] },
  { path: '/kirjaukset', label: ROUTE_LABELS['/kirjaukset'] },
  { path: '/matkakulut', label: ROUTE_LABELS['/matkakulut'] },
  { path: '/henkilosto', label: ROUTE_LABELS['/henkilosto'] },
  { path: '/henkilokortit', label: ROUTE_LABELS['/henkilokortit'] },
  { path: '/palkka-aineisto', label: ROUTE_LABELS['/palkka-aineisto'] },
  { path: '/asiakkaat', label: ROUTE_LABELS['/asiakkaat'] },
  { path: '/crm', label: ROUTE_LABELS['/crm'] },
  { path: '/tarjoukset', label: ROUTE_LABELS['/tarjoukset'] },
  { path: '/maaralaskenta', label: ROUTE_LABELS['/maaralaskenta'] },
  { path: '/toiminnanohjaus', label: ROUTE_LABELS['/toiminnanohjaus'] },
  { path: '/raportit', label: ROUTE_LABELS['/raportit'] },
  { path: '/viestinta', label: ROUTE_LABELS['/viestinta'] },
  { path: '/kalusto', label: ROUTE_LABELS['/kalusto'] },
  { path: '/ai', label: ROUTE_LABELS['/ai'] },
  { path: '/qr-hallinta', label: ROUTE_LABELS['/qr-hallinta'] },
  { path: '/hallinta', label: ROUTE_LABELS['/hallinta'] },
  { path: '/varmuuskopiot', label: ROUTE_LABELS['/varmuuskopiot'] },
  { path: '/kayttajaesikatselu', label: ROUTE_LABELS['/kayttajaesikatselu'] },
  { path: '/tilaajan-tyot', label: ROUTE_LABELS['/tilaajan-tyot'] },
];
