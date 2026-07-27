import type { OrganizationRole } from '@/lib/supabase/types';
import type { EmployeeCard, SupervisorTeamMember } from '@/lib/supabase/workforceHr';

/**
 * Restricts employee-card data to the identity and role selected in admin preview.
 *
 * The production database still authorizes requests with the administrator's real
 * session. Therefore preview mode must explicitly narrow the administrator-visible
 * result before it can reach page state or rendering.
 */
export function restrictEmployeeCardsForPreview(
  cards: EmployeeCard[],
  assignments: SupervisorTeamMember[],
  role: OrganizationRole | null,
  userId: string | null,
): EmployeeCard[] {
  if (!role || !userId || role === 'customer') return [];
  if (role === 'admin') return cards;

  if (role === 'worker') {
    return cards.filter((card) => card.userId === userId);
  }

  const permittedEmployeeIds = new Set(
    assignments
      .filter((assignment) => assignment.supervisorUserId === userId)
      .map((assignment) => assignment.employeeId),
  );

  return cards.filter((card) => (
    card.userId === userId || permittedEmployeeIds.has(card.employeeId)
  ));
}
