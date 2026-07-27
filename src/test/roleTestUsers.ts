import type { Permission, UserRole } from '@/auth/permissions';

export interface RoleTestUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  home: string;
  requiredPermissions: Permission[];
  forbiddenPermissions: Permission[];
}

/**
 * Deterministic identities for automated authorization and navigation tests.
 * The .invalid domain guarantees these can never receive real mail or be
 * mistaken for production credentials.
 */
export const ROLE_TEST_USERS: Record<UserRole, RoleTestUser> = {
  admin: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'admin@roles.vakantti.invalid',
    displayName: 'Automaatiotesti Admin',
    role: 'admin',
    home: '/dashboard',
    requiredPermissions: [
      'organization.manage',
      'project_chat.internal',
      'project_documents.customer.share',
      'change_orders.customer.submit',
    ],
    forbiddenPermissions: ['change_orders.customer.decide'],
  },
  supervisor: {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'supervisor@roles.vakantti.invalid',
    displayName: 'Automaatiotesti Työnjohtaja',
    role: 'supervisor',
    home: '/dashboard',
    requiredPermissions: [
      'projects.manage',
      'project_chat.internal',
      'project_documents.customer.share',
      'change_orders.customer.submit',
      'time_entries.read.all',
    ],
    forbiddenPermissions: ['organization.manage', 'change_orders.customer.decide'],
  },
  project_coordinator: {
    id: '00000000-0000-4000-8000-000000000005',
    email: 'project-coordinator@roles.vakantti.invalid',
    displayName: 'Automaatiotesti Projektikoordinaattori',
    role: 'project_coordinator',
    home: '/dashboard',
    requiredPermissions: [
      'projects.manage',
      'work_orders.manage',
      'project_chat.internal',
      'project_documents.customer.share',
      'time_entries.read.all',
    ],
    forbiddenPermissions: [
      'organization.manage',
      'members.manage',
      'change_orders.customer.decide',
    ],
  },
  worker: {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'worker@roles.vakantti.invalid',
    displayName: 'Automaatiotesti Työntekijä',
    role: 'worker',
    home: '/dashboard',
    requiredPermissions: [
      'projects.read.assigned',
      'project_chat.internal',
      'project_chat.attach',
      'safety.create',
    ],
    forbiddenPermissions: [
      'projects.read.all',
      'project_documents.customer.share',
      'change_orders.customer.submit',
      'change_orders.customer.decide',
    ],
  },
  customer: {
    id: '00000000-0000-4000-8000-000000000004',
    email: 'customer@roles.vakantti.invalid',
    displayName: 'Automaatiotesti Tilaaja',
    role: 'customer',
    home: '/tilaajan-tyot',
    requiredPermissions: [
      'projects.read.customer',
      'project_chat.shared',
      'project_chat.attach',
      'project_documents.customer.read',
      'change_orders.customer.decide',
    ],
    forbiddenPermissions: [
      'project_chat.internal',
      'project_documents.customer.share',
      'change_orders.customer.submit',
      'organization.manage',
    ],
  },
};
