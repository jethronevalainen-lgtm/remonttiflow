export type UserRole = 'admin' | 'supervisor' | 'worker' | 'customer';

export type Permission =
  | 'organization.manage'
  | 'members.manage'
  | 'projects.read.all'
  | 'projects.read.assigned'
  | 'projects.read.customer'
  | 'projects.manage'
  | 'projects.request'
  | 'project_requests.manage'
  | 'work_orders.read.all'
  | 'work_orders.read.assigned'
  | 'work_orders.manage'
  | 'work_orders.transition'
  | 'safety.create'
  | 'safety.read.all'
  | 'safety.read.project'
  | 'safety.read.own'
  | 'safety.manage'
  | 'project_chat.shared'
  | 'project_chat.internal'
  | 'project_chat.attach'
  | 'project_chat.edit_own'
  | 'project_documents.customer.read'
  | 'project_documents.customer.share'
  | 'change_orders.customer.read'
  | 'change_orders.customer.submit'
  | 'change_orders.customer.decide';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Järjestelmänvalvoja',
  supervisor: 'Työnjohtaja',
  worker: 'Työntekijä',
  customer: 'Tilaaja',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-500',
  supervisor: 'bg-orange-500',
  worker: 'bg-blue-500',
  customer: 'bg-teal-500',
};

export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/dashboard',
  supervisor: '/dashboard',
  worker: '/dashboard',
  customer: '/tilaajan-tyot',
};

export const ROLE_ROUTES: Record<UserRole, string[]> = {
  admin: [
    '/dashboard', '/tyonjohto', '/tarkastukset', '/projektit', '/projektipyynnot',
    '/projektikeskustelut', '/aikataulutus', '/paivakirjat', '/kuittaukset',
    '/laskenta', '/maaralaskenta', '/jatehuolto', '/tyomaaraykset', '/tilaukset',
    '/tyovuorokalenteri', '/tuntikirjaukset', '/matkakulut', '/tyoturvallisuus',
    '/crm', '/asiakkaat', '/ai', '/viestinta', '/kalusto', '/henkilosto',
    '/lomakkeet', '/raportit', '/hallinta', '/kayttajaesikatselu',
  ],
  supervisor: [
    '/dashboard', '/tyonjohto', '/tarkastukset', '/projektit', '/projektipyynnot',
    '/projektikeskustelut', '/aikataulutus', '/paivakirjat', '/kuittaukset',
    '/laskenta', '/maaralaskenta', '/jatehuolto', '/tyomaaraykset', '/tilaukset',
    '/tyovuorokalenteri', '/tuntikirjaukset', '/matkakulut', '/tyoturvallisuus',
    '/crm', '/asiakkaat', '/viestinta', '/kalusto', '/henkilosto', '/lomakkeet',
    '/raportit',
  ],
  worker: [
    '/dashboard', '/tarkastukset', '/tyomaaraykset', '/kuittaukset',
    '/tuntikirjaukset', '/matkakulut', '/tyoturvallisuus',
    '/projektikeskustelut', '/viestinta', '/lomakkeet',
  ],
  customer: [
    '/tilaajan-tyot', '/tilaajan-projektit', '/projektikeskustelut',
    '/tyoturvallisuus',
  ],
};

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    'organization.manage', 'members.manage', 'projects.read.all', 'projects.manage',
    'projects.request', 'project_requests.manage', 'work_orders.read.all',
    'work_orders.manage', 'work_orders.transition', 'safety.create',
    'safety.read.all', 'safety.manage', 'project_chat.shared',
    'project_chat.internal', 'project_chat.attach', 'project_chat.edit_own',
    'project_documents.customer.read', 'project_documents.customer.share',
    'change_orders.customer.read', 'change_orders.customer.submit',
  ]),
  supervisor: new Set<Permission>([
    'projects.read.all', 'projects.manage', 'projects.request',
    'project_requests.manage', 'work_orders.read.all', 'work_orders.manage',
    'work_orders.transition', 'safety.create', 'safety.read.all', 'safety.manage',
    'project_chat.shared', 'project_chat.internal', 'project_chat.attach',
    'project_chat.edit_own', 'project_documents.customer.read',
    'project_documents.customer.share', 'change_orders.customer.read',
    'change_orders.customer.submit',
  ]),
  worker: new Set<Permission>([
    'projects.read.assigned', 'work_orders.read.assigned', 'work_orders.transition',
    'safety.create', 'safety.read.project', 'safety.read.own',
    'project_chat.shared', 'project_chat.internal', 'project_chat.attach',
    'project_chat.edit_own',
  ]),
  customer: new Set<Permission>([
    'projects.read.customer', 'projects.request', 'safety.create',
    'safety.read.project', 'safety.read.own', 'project_chat.shared',
    'project_chat.attach', 'project_chat.edit_own',
    'project_documents.customer.read', 'change_orders.customer.read',
    'change_orders.customer.decide',
  ]),
};

export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  return Boolean(role && ROLE_PERMISSIONS[role].has(permission));
}

export function homeForRole(role: UserRole | null | undefined): string {
  return role ? ROLE_HOME[role] : '/login';
}
