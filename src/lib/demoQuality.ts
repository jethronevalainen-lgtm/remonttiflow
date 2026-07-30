import type { OrganizationRole } from '@/lib/supabase/types';

export type DemoRole = Exclude<OrganizationRole, 'admin'>;
export type DemoScenario = 'normal' | 'busy' | 'late' | 'empty' | 'handover';
export type DemoReviewDevice = 'desktop' | 'mobile';
export type DemoReviewStatus = 'not_tested' | 'passed' | 'failed';
export type DemoFindingSeverity = 'info' | 'warning' | 'critical';
export type DemoFindingStatus = 'open' | 'resolved';

export const DEMO_DATASET_VERSION = 4;

export interface DemoScenarioDefinition {
  id: DemoScenario;
  label: string;
  description: string;
  expected: string;
}

export interface DemoRoleCheck {
  key: string;
  label: string;
  path: string;
}

export interface DemoRoleGuide {
  summary: string;
  boundary: string;
  checks: DemoRoleCheck[];
}

export const DEMO_SCENARIOS: DemoScenarioDefinition[] = [
  {
    id: 'normal',
    label: 'Normaali työpäivä',
    description: 'Tasapainoinen perusnäkymä aktiivisilla, tulevilla ja valmistuneilla töillä.',
    expected: '3 projektia · 3 työmääräystä · 2 tuntikirjausta',
  },
  {
    id: 'busy',
    label: 'Kiireinen työmaa',
    description: 'Pitkät listat, useita samanaikaisia töitä, hyväksyntöjä ja turvallisuushavaintoja.',
    expected: '5 projektia · 10 työmääräystä · 6 tuntikirjausta',
  },
  {
    id: 'late',
    label: 'Myöhässä ja poikkeamia',
    description: 'Aikataulupoikkeamat, erääntyneet tehtävät ja kiireelliset korjaustoimet korostuvat.',
    expected: '3 myöhässä olevaa projektia · 6 erääntynyttä tai estynyttä työtä',
  },
  {
    id: 'empty',
    label: 'Tyhjä uusi organisaatio',
    description: 'Roolit ovat olemassa, mutta liiketoimintadata puuttuu. Soveltuu tyhjien tilojen tarkistukseen.',
    expected: '0 projektia · 0 työmääräystä · 0 tuntikirjausta',
  },
  {
    id: 'handover',
    label: 'Valmistuminen ja luovutus',
    description: 'Lähes valmis projekti, tarkastettavat työt, dokumentointi ja tilaajan luovutusnäkymä.',
    expected: '2 aktiivista tai valmista projektia · 5 luovutusvaiheen työmääräystä',
  },
];

export const DEMO_ROLES: DemoRole[] = [
  'supervisor',
  'project_coordinator',
  'worker',
  'customer',
];

export const DEMO_ROLE_GUIDES: Record<DemoRole, DemoRoleGuide> = {
  supervisor: {
    summary: 'Työnjohdon koko operatiivinen näkymä sekä henkilöstö- ja hyväksyntätoiminnot.',
    checks: [
      { key: 'dashboard-exceptions', label: 'Päivän poikkeamat ja myöhässä olevat työt näkyvät selkeästi', path: '/dashboard' },
      { key: 'projects-resources', label: 'Projektit, resurssit ja aikataulut ovat hallittavissa', path: '/projektit' },
      { key: 'time-approvals', label: 'Tuntien hyväksyntä ja henkilöstötoiminnot toimivat', path: '/tuntikirjaukset' },
      { key: 'mobile-navigation', label: 'Mobiilin päätoiminnot löytyvät ilman tarpeetonta selaamista', path: '/dashboard' },
    ],
    boundary: 'Organisaation järjestelmäasetukset kuuluvat vain ylläpitäjälle.',
  },
  project_coordinator: {
    summary: 'Projektien operatiivinen hallinta ilman työntekijöiden arkaluonteisia tietoja.',
    checks: [
      { key: 'project-situation', label: 'Projektien tilanne, aikataulut ja työvaiheet näkyvät', path: '/projektit' },
      { key: 'work-order-management', label: 'Työmääräysten luonti, kohdistus ja seuranta toimivat', path: '/tyomaaraykset' },
      { key: 'project-hours-messages', label: 'Projektikohtainen työaika ja viestintä ovat käytettävissä', path: '/projektikeskustelut' },
      { key: 'hr-data-hidden', label: 'Henkilöstö-, palkka-, matka- ja poissaolotiedot eivät näy', path: '/dashboard' },
    ],
    boundary: 'Henkilöstö-, palkka-, matka- ja poissaolotietojen ei pidä näkyä.',
  },
  worker: {
    summary: 'Työmaalla käytettävä oma työtila, jossa näkyvät vain käyttäjälle osoitetut asiat.',
    checks: [
      { key: 'own-work-orders', label: 'Omat työmääräykset, aloitus ja työn päättäminen toimivat', path: '/tyomaaraykset' },
      { key: 'own-time', label: 'Omat tuntikirjaukset ja korjauspyynnöt ovat selkeitä', path: '/tuntikirjaukset' },
      { key: 'site-tools', label: 'Turvallisuushavainnot, puutteet ja viestit löytyvät', path: '/tyoturvallisuus' },
      { key: 'other-data-hidden', label: 'Muiden työntekijöiden tiedot, talous ja kaikki projektit eivät näy', path: '/dashboard' },
    ],
    boundary: 'Muiden työntekijöiden tiedot, kaikki projektit ja taloustiedot eivät saa näkyä.',
  },
  customer: {
    summary: 'Tilaajaportaali, jossa näkyvät vain tilaajalle jaetut projektit ja aineistot.',
    checks: [
      { key: 'shared-projects', label: 'Vain tilaajalle jaetut projektit ja niiden tilanne näkyvät', path: '/tilaajan-tyot' },
      { key: 'documents-decisions', label: 'Jaetut dokumentit ja päätettävät muutokset löytyvät', path: '/tilaajan-tyot' },
      { key: 'customer-communication', label: 'Tilaajaviestit, tiedotteet ja turvallisuushavainto toimivat', path: '/viestinta' },
      { key: 'internal-data-hidden', label: 'Sisäiset työmääräykset, kustannukset ja henkilöstötiedot eivät näy', path: '/tilaajan-tyot' },
    ],
    boundary: 'Sisäiset työmääräykset, kustannukset ja henkilöstötiedot eivät saa näkyä.',
  },
};

export function isDemoScenario(value: unknown): value is DemoScenario {
  return value === 'normal'
    || value === 'busy'
    || value === 'late'
    || value === 'empty'
    || value === 'handover';
}

export function demoScenarioDefinition(scenario: DemoScenario): DemoScenarioDefinition {
  return DEMO_SCENARIOS.find((item) => item.id === scenario) ?? DEMO_SCENARIOS[0];
}

export function demoReviewExpectedCount(): number {
  return DEMO_ROLES.reduce((sum, role) => sum + DEMO_ROLE_GUIDES[role].checks.length * 2, 0);
}
