export interface HeaderAlert {
  id: string;
  title: string;
  detail: string;
  path: string;
  severity: 'info' | 'warning' | 'danger';
}

interface WorkOrderLike {
  dueDate: string;
  status: string;
}

interface TimeEntryLike {
  status: string;
}

interface SafetyItemLike {
  severity?: string;
  status: string;
}

interface ProjectLike {
  budget: number;
  spent: number;
}

export interface HeaderInsightSource {
  workOrders: WorkOrderLike[];
  timeEntries: TimeEntryLike[];
  safetyItems: SafetyItemLike[];
  projects: ProjectLike[];
}

export interface HeaderRoute {
  path: string;
  label: string;
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildHeaderAlerts(
  source: HeaderInsightSource,
  today: Date = new Date(),
): HeaderAlert[] {
  const todayIso = localIsoDate(today);
  const alerts: HeaderAlert[] = [];

  const overdueOrders = source.workOrders.filter(
    (order) =>
      Boolean(order.dueDate) &&
      order.dueDate.slice(0, 10) < todayIso &&
      !['Valmis', 'Peruttu'].includes(order.status),
  ).length;
  if (overdueOrders > 0) {
    alerts.push({
      id: 'overdue-work-orders',
      title: `${overdueOrders} myöhässä olevaa työmääräystä`,
      detail: 'Avaa työmääräykset ja päivitä vastuut tai määräajat.',
      path: '/tyomaaraykset',
      severity: 'danger',
    });
  }

  const pendingEntries = source.timeEntries.filter(
    (entry) => entry.status === 'Odottaa',
  ).length;
  if (pendingEntries > 0) {
    alerts.push({
      id: 'pending-time-entries',
      title: `${pendingEntries} tuntikirjausta odottaa käsittelyä`,
      detail: 'Tarkista ja hyväksy tai hylkää odottavat kirjaukset.',
      path: '/tuntikirjaukset',
      severity: 'warning',
    });
  }

  const seriousSafetyItems = source.safetyItems.filter(
    (item) =>
      item.severity === 'Vakava' &&
      !['Suljettu', 'Korjattu', 'Valmis'].includes(item.status),
  ).length;
  if (seriousSafetyItems > 0) {
    alerts.push({
      id: 'serious-safety-items',
      title: `${seriousSafetyItems} vakavaa turvallisuusasiaa avoinna`,
      detail: 'Turvallisuusasiat vaativat työnjohdon käsittelyn.',
      path: '/tyoturvallisuus',
      severity: 'danger',
    });
  }

  const overBudgetProjects = source.projects.filter(
    (project) => project.budget > 0 && project.spent > project.budget,
  ).length;
  if (overBudgetProjects > 0) {
    alerts.push({
      id: 'over-budget-projects',
      title: `${overBudgetProjects} projektia ylittää budjetin`,
      detail: 'Tarkista projektien toteuma ja kustannusennuste.',
      path: '/raportit',
      severity: 'warning',
    });
  }

  return alerts;
}

export function filterHeaderRoutes(
  routes: HeaderRoute[],
  allowedPaths: string[],
  query: string,
): HeaderRoute[] {
  const normalized = query.trim().toLocaleLowerCase('fi');
  if (!normalized) return [];

  const allowed = new Set(allowedPaths);
  return routes
    .filter((route) => allowed.has(route.path))
    .filter((route) =>
      `${route.label} ${route.path}`
        .toLocaleLowerCase('fi')
        .includes(normalized),
    )
    .slice(0, 8);
}
