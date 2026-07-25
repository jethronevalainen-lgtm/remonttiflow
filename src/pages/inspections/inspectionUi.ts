import type {
  FindingSeverity, FindingStatus, InspectionFinding, InspectionResultStatus,
  InspectionStatus, ProjectUnit, TemplateEditorSection,
} from '@/lib/supabase/inspectionEntities';

export const INSPECTION_TABS = [
  { value: 'overview', label: 'Tilannekuva' },
  { value: 'inspections', label: 'Tarkastukset' },
  { value: 'findings', label: 'Puutteet' },
  { value: 'units', label: 'Huoneistot' },
  { value: 'templates', label: 'Tarkastuspohjat' },
  { value: 'reports', label: 'Raportit' },
] as const;

export const RESULT_OPTIONS: Array<{
  value: InspectionResultStatus;
  label: string;
  shortLabel: string;
  className: string;
}> = [
  { value: 'Kunnossa', label: 'Kunnossa', shortLabel: 'Kunnossa', className: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' },
  { value: 'Puute', label: 'Kirjaa puute', shortLabel: 'Puute', className: 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100' },
  { value: 'Ei koske kohdetta', label: 'Ei koske kohdetta', shortLabel: 'Ei koske', className: 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100' },
  { value: 'Ei voitu tarkastaa', label: 'Ei voitu tarkastaa', shortLabel: 'Ei voitu', className: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100' },
  { value: 'Tarkastettava myöhemmin', label: 'Tarkastettava myöhemmin', shortLabel: 'Myöhemmin', className: 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100' },
];

export const BLOCKING_SEVERITIES: FindingSeverity[] = [
  'Korjattava ennen luovutusta',
  'Merkittävä',
  'Kriittinen',
];

export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fi-FI', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
}

export function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fi-FI', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export function inspectionStatusClasses(status: InspectionStatus): string {
  const classes: Record<InspectionStatus, string> = {
    Luonnos: 'bg-slate-100 text-slate-700',
    Suunniteltu: 'bg-blue-50 text-blue-700',
    Käynnissä: 'bg-amber-50 text-amber-800',
    'Puutteita havaittu': 'bg-red-50 text-red-700',
    Korjattavana: 'bg-orange-50 text-orange-800',
    Uusintatarkastus: 'bg-violet-50 text-violet-700',
    Hyväksyttävänä: 'bg-cyan-50 text-cyan-800',
    Hyväksytty: 'bg-emerald-50 text-emerald-700',
    Mitätöity: 'bg-slate-200 text-slate-700',
  };
  return classes[status];
}

export function findingStatusClasses(status: FindingStatus): string {
  const classes: Record<FindingStatus, string> = {
    Avoin: 'bg-red-50 text-red-700',
    Osoitettu: 'bg-blue-50 text-blue-700',
    'Työn alla': 'bg-amber-50 text-amber-800',
    'Ilmoitettu korjatuksi': 'bg-cyan-50 text-cyan-800',
    'Odottaa uusintatarkastusta': 'bg-violet-50 text-violet-700',
    Hyväksytty: 'bg-emerald-50 text-emerald-700',
    Hylätty: 'bg-red-100 text-red-800',
    Mitätöity: 'bg-slate-200 text-slate-700',
  };
  return classes[status];
}

export function severityClasses(severity: FindingSeverity): string {
  const classes: Record<FindingSeverity, string> = {
    Vähäinen: 'bg-slate-100 text-slate-700',
    'Korjattava ennen luovutusta': 'bg-amber-50 text-amber-800',
    Merkittävä: 'bg-orange-50 text-orange-800',
    Kriittinen: 'bg-red-100 text-red-800',
  };
  return classes[severity];
}

export function projectName(projects: Array<{ id: string; name: string }>, id: string): string {
  return projects.find((project) => project.id === id)?.name ?? 'Tuntematon projekti';
}

export function personName(people: Array<{ userId: string; name: string; email: string }>, id?: string): string {
  if (!id) return 'Ei nimetty';
  const person = people.find((item) => item.userId === id);
  return person?.name || person?.email || 'Tuntematon käyttäjä';
}

export function unitLabel(units: ProjectUnit[], id?: string): string {
  return units.find((unit) => unit.id === id)?.unitCode ?? 'Koko kohde';
}

export function isFindingOpen(finding: InspectionFinding): boolean {
  return !['Hyväksytty', 'Mitätöity'].includes(finding.status);
}

export function emptyTemplateSection(): TemplateEditorSection {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    items: [{
      id: crypto.randomUUID(),
      title: '',
      guidance: '',
      required: true,
      photoRequiredOnDefect: true,
    }],
  };
}
