export type CustomerAccessScope = 'all_projects' | 'selected_projects';

export interface CustomerPreviewScope {
  customerIds: string[];
  projectIds: string[];
  accessScope: CustomerAccessScope;
}

export interface CustomerAccessProject {
  id: string;
  name: string;
  location: string | null;
  status: string;
}

export interface CustomerAccessCatalogItem {
  customerId: string;
  customerName: string;
  projects: CustomerAccessProject[];
}

export interface CustomerAccessAssignment {
  customerId: string;
  customerName?: string;
  accessScope: CustomerAccessScope;
  projectIds: string[];
}

export function normalizeCustomerPreviewScope(scope: CustomerPreviewScope): CustomerPreviewScope {
  const customerIds = [...new Set(scope.customerIds.filter(Boolean))];
  const projectIds = [...new Set(scope.projectIds.filter(Boolean))];
  return {
    customerIds,
    projectIds: scope.accessScope === 'all_projects' ? [] : projectIds,
    accessScope: scope.accessScope,
  };
}

export function customerPreviewRpcArgs(scope: CustomerPreviewScope) {
  const normalized = normalizeCustomerPreviewScope(scope);
  return {
    p_customer_ids: normalized.customerIds,
    p_project_ids: normalized.projectIds,
    p_access_scope: normalized.accessScope,
  };
}
