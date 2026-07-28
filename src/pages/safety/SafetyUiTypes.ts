import type { UserRole } from '@/contexts/AuthContext';
import type { ProjectSafetyProfile, SafetyBriefingSeverity, SafetyBriefingStatus } from '@/lib/supabase/safetyWorkspace';
import type { SafetyItemSeverity, SafetyItemType } from '@/types';

export const SAFETY_ACTIONS: Array<{ value: SafetyItemType; label: string; detail: string }> = [
  { value: 'risk', label: 'Tee turvallisuushavainto', detail: 'Vaara, puute tai turvaton toimintatapa' },
  { value: 'incident', label: 'Ilmoita tapaturma / läheltä piti', detail: 'Tapahtuma, joka aiheutti tai olisi voinut aiheuttaa vahingon' },
  { value: 'inspection', label: 'Aloita turvallisuustarkastus', detail: 'Työmaan järjestelmällinen tarkastuskierros' },
  { value: 'training', label: 'Perehdytykset ja ohjeet', detail: 'Perehdytys, ohje tai koulutustapahtuma' },
];
export const SAFETY_STATUSES = ['Avoin', 'Arvioitu', 'Osoitettu', 'Korjattavana', 'Ilmoitettu korjatuksi', 'Vahvistettu', 'Suljettu'];
export const SAFETY_AUDIENCE_ROLES: UserRole[] = ['admin', 'supervisor', 'project_coordinator', 'worker', 'customer'];
export const BASIC_SAFETY_GUIDANCE = [
  'Tarkista kulkureitit, poistumistiet ja työalue ennen työn aloittamista.',
  'Käytä työvaiheen edellyttämiä henkilönsuojaimia ja varmista suojausten kunto.',
  'Keskeytä työ ja tee havainto heti, jos huomaat välittömän vaaran.',
];

export type SafetyViewFilter = 'action' | 'open' | 'verification' | 'closed' | 'all';

export interface SafetyItemForm {
  type: SafetyItemType;
  title: string;
  description: string;
  date: string;
  projectId: string;
  location: string;
  severity: SafetyItemSeverity;
  status: string;
  assigneeUserId: string;
  dueDate: string;
  rootCause: string;
  correctiveAction: string;
  preventiveAction: string;
}

export interface SafetyBriefingForm {
  id?: string;
  projectId: string;
  title: string;
  introduction: string;
  instructions: string;
  severity: SafetyBriefingSeverity;
  audienceRoles: UserRole[];
  validFrom: string;
  validUntil: string;
  requiresAcknowledgement: boolean;
  status: SafetyBriefingStatus;
  version: number;
}

export function emptySafetyItemForm(today: string, projectId = '', type: SafetyItemType = 'risk'): SafetyItemForm {
  return { type, title: '', description: '', date: today, projectId, location: '', severity: 'Keskitasoinen', status: 'Avoin', assigneeUserId: '', dueDate: '', rootCause: '', correctiveAction: '', preventiveAction: '' };
}

export function emptySafetyBriefingForm(today: string): SafetyBriefingForm {
  return { projectId: '', title: '', introduction: '', instructions: '', severity: 'info', audienceRoles: ['admin', 'supervisor', 'project_coordinator', 'worker'], validFrom: today, validUntil: '', requiresAcknowledgement: true, status: 'published', version: 1 };
}

export function emptySafetyProfile(organizationId: string, projectId = ''): ProjectSafetyProfile {
  return { organizationId, projectId, siteAddress: '', assemblyPoint: '', firstAidLocation: '', defibrillatorLocation: '', safetyContactName: '', safetyContactPhone: '', firstAidContactName: '', firstAidContactPhone: '', dutyPhone: '', emergencyInstructions: '' };
}

export function safetyStatusTone(status: string) {
  if (['Suljettu', 'Vahvistettu'].includes(status)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['Korjattavana', 'Ilmoitettu korjatuksi'].includes(status)) return 'border-amber-200 bg-amber-50 text-amber-800';
  return status === 'Avoin' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700';
}

export function safetySeverityTone(severity?: SafetyItemSeverity) {
  return severity === 'Vakava' ? 'border-red-200 bg-red-50 text-red-700' : severity === 'Keskitasoinen' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-blue-700';
}

export function safetyBriefingGradient(severity: SafetyBriefingSeverity) {
  return severity === 'danger' ? 'from-red-950 via-slate-950 to-orange-950' : severity === 'warning' ? 'from-amber-950 via-slate-950 to-orange-950' : 'from-slate-950 via-slate-900 to-emerald-950';
}

export function safetyDateLabel(value?: string) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fi-FI');
}

export function safetyPhoneHref(value: string) {
  return `tel:${value.replace(/[^+\d]/g, '')}`;
}
