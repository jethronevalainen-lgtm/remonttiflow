import type { OfferStatus, OfferVersion } from '@/lib/supabase/offers';

export const OFFER_CATEGORIES = ['Työ', 'Materiaali', 'Aliurakka', 'Kalusto', 'Kuljetus', 'Jäte', 'Muu'] as const;
export const OFFER_STATUSES: OfferStatus[] = [
  'Luonnos',
  'Lähetetty',
  'Hyväksytty',
  'Hylätty',
  'Vanhentunut',
  'Arkistoitu',
];
export const UNSECTIONED = '__none__';

export function euro(cents: number): string {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function date(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}

export function dateTime(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' });
}

export function moneyInput(value: string): number {
  return Number(value.replace(/\s/g, '').replace(',', '.'));
}

export function centsInput(value: string): number {
  const euros = moneyInput(value);
  return Number.isFinite(euros) ? Math.round(euros * 100) : Number.NaN;
}

export function statusTone(status: OfferStatus | string): string {
  if (status === 'Hyväksytty') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'Lähetetty') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (status === 'Hylätty') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Vanhentunut') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Korvattu' || status === 'Arkistoitu') return 'border-slate-200 bg-slate-100 text-slate-600';
  return 'border-orange-200 bg-orange-50 text-orange-800';
}

export function marginTone(percent: number): string {
  if (percent >= 25) return 'text-emerald-700';
  if (percent >= 15) return 'text-amber-700';
  return 'text-red-700';
}

export function daysUntil(value?: string): number | null {
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function expiryLabel(value?: string, status?: OfferStatus): string | null {
  if (status === 'Hyväksytty' || status === 'Hylätty' || status === 'Arkistoitu') return null;
  const remaining = daysUntil(value);
  if (remaining == null) return null;
  if (remaining < 0) return `Vanhentunut ${Math.abs(remaining)} pv sitten`;
  if (remaining === 0) return 'Voimassa tänään';
  if (remaining <= 7) return `Voimassa ${remaining} pv`;
  return null;
}

export function latestVersionForOffer(
  versions: OfferVersion[],
  offerId: string,
): OfferVersion | undefined {
  const matching = versions.filter((version) => version.offerId === offerId);
  return matching.find((version) => version.status === 'Luonnos')
    ?? matching.find((version) => version.status === 'Lähetetty')
    ?? matching.find((version) => version.status === 'Hyväksytty')
    ?? matching[0];
}

export function workflowStep(status: OfferStatus): number {
  if (status === 'Luonnos') return 0;
  if (status === 'Lähetetty') return 1;
  if (status === 'Hyväksytty') return 2;
  if (status === 'Arkistoitu') return 3;
  return -1;
}

export interface OfferWizardForm {
  name: string;
  customerId: string;
  crmLeadId: string;
  projectId: string;
  offerNumber: string;
  validUntil: string;
  notes: string;
  assignedUserId: string;
  paymentTerms: string;
  deliveryTime: string;
  vatRate: string;
  overheadPercent: string;
  riskPercent: string;
  marginPercent: string;
  terms: string;
  templateId: string;
}

export function emptyOfferWizardForm(): OfferWizardForm {
  return {
    name: '',
    customerId: '',
    crmLeadId: '',
    projectId: '',
    offerNumber: '',
    validUntil: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    notes: '',
    assignedUserId: '',
    paymentTerms: '14 päivää netto',
    deliveryTime: 'Sovitaan erikseen',
    vatRate: '25.5',
    overheadPercent: '8',
    riskPercent: '3',
    marginPercent: '20',
    terms: 'Tarjous on voimassa ilmoitettuun päivään. Työt aloitetaan sopimuksen jälkeen.',
    templateId: 'blank',
  };
}
