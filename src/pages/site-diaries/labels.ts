import { SITE_DIARY_STATUS_TONES, type SiteDiaryStatus } from '@/lib/siteDiaryRules';
import type {
  SiteDiaryAttachmentCategory,
  SiteDiaryEventType,
  WorkforceCategory,
  WorkItemState,
} from '@/lib/supabase/siteDiaries';

export function statusTone(status: SiteDiaryStatus) {
  return SITE_DIARY_STATUS_TONES[status];
}

export const STATUS_CLASS: Record<ReturnType<typeof statusTone>, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  locked: 'border-slate-300 bg-slate-100 text-slate-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
};

export const WORKFORCE_LABELS: Record<WorkforceCategory, string> = {
  supervisor: 'Työnjohto',
  own_skilled: 'Omat rakennusammattimiehet',
  own_other: 'Muut omat työntekijät',
  subcontractor: 'Aliurakoitsija',
  temporary: 'Vuokratyö',
  visitor: 'Vierailija / tarkastaja',
};

export const WORK_ITEM_LABELS: Record<WorkItemState, string> = {
  started: 'Aloitettu',
  ongoing: 'Käynnissä',
  completed: 'Päättynyt',
};

export const EVENT_LABELS: Record<SiteDiaryEventType, string> = {
  inspection: 'Tarkastus',
  review: 'Katselmus',
  meeting: 'Työmaakokous',
  delivery: 'Toimitus',
  instruction: 'Ohje tai määräys',
  deviation: 'Poikkeama',
  delay: 'Viive',
  safety: 'Turvallisuus',
  environmental: 'Ympäristö / jätehuolto',
  plan_change: 'Suunnitelmamuutos',
  decision_needed: 'Tilaajan päätös tarvitaan',
  yse_43_3: 'Pieni ja kiireellinen muutos – YSE 43 § 3',
  yse_44_2: 'Lisä- ja muutostyötarjous – YSE 44 § 2',
  other: 'Muu tapahtuma',
};

export const ATTACHMENT_LABELS: Record<SiteDiaryAttachmentCategory, string> = {
  overview: 'Yleiskuva',
  work_phase: 'Työvaihe',
  completed_work: 'Valmis työ',
  deviation: 'Poikkeama',
  damage: 'Vaurio',
  safety: 'Turvallisuus',
  delivery: 'Toimitus',
  inspection: 'Tarkastus',
  other: 'Muu',
};

export function numberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function dateTimeLocalToIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function isoToDateTimeLocal(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fileSize(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} kB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
