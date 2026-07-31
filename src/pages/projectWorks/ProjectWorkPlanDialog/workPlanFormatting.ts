import type { OrganizationPerson } from '@/lib/supabase/workManagement';

export const DEFAULT_ASSIGNEE = '__default__';

export function roleLabel(role: OrganizationPerson['role']): string {
  if (role === 'worker') return 'Työntekijä';
  if (role === 'supervisor') return 'Työnjohtaja';
  if (role === 'project_coordinator') return 'Projektikoordinaattori';
  return 'Ylläpitäjä';
}

export function formatDate(value: string): string {
  if (!value) return 'Ei asetettu';
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('fi-FI');
}
