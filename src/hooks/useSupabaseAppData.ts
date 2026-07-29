import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import logger from '@/lib/logger';
import { deriveProjectStatus, isRunningProjectStatus } from '@/lib/projectLifecycle';
import {
  createCrmLeadRecord,
  createCustomerRecord,
  deleteCrmLeadRecord,
  deleteCustomerRecord,
  updateCrmLeadRecord,
  updateCustomerRecord,
} from '@/lib/supabase/commercialEntities';
import {
  EMPTY_DOMAIN_DATA,
  createProject,
  createSafetyItem,
  createTimeEntry,
  createWorkOrder,
  patchProject,
  patchWorkOrder,
  removeProject,
  removeWorkOrder,
  type DomainData,
} from '@/lib/supabase/domainData';
import { loadNormalizedDomainData } from '@/lib/supabase/normalizedDomainData';
import type {
  CrmLead,
  Customer,
  Project,
  SafetyItem,
  TimeEntry,
  WorkOrder,
} from '@/types';

const domainQueryKey = (organizationId: string | undefined) => [
  'organization-domain-data',
  organizationId ?? 'none',
] as const;

export function useSupabaseAppData() {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const { isPreviewing, effectiveRole } = useViewAs();
  const [operationError, setOperationError] = useState<string | null>(null);

  const organizationId = currentOrg?.id;
  const query = useQuery({
    queryKey: domainQueryKey(organizationId),
    queryFn: () => loadNormalizedDomainData(organizationId as string),
    enabled: Boolean(organizationId && effectiveRole !== 'customer'),
    staleTime: 30_000,
    retry: 1,
  });

  const data: DomainData = query.data ?? EMPTY_DOMAIN_DATA;
  const projects = useMemo(
    () => data.projects.map((project) => ({
      ...project,
      status: deriveProjectStatus({
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
      }),
    })),
    [data.projects],
  );

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: domainQueryKey(organizationId) }),
      queryClient.invalidateQueries({ queryKey: ['resource-management', organizationId] }),
      queryClient.invalidateQueries({ queryKey: ['customer-relations', organizationId] }),
    ]);
  }, [organizationId, queryClient]);

  const runMutation = useCallback(
    async (name: string, mutation: () => Promise<unknown>): Promise<boolean> => {
      if (isPreviewing) {
        setOperationError('Esikatselutila on vain lukemista varten. Lopeta esikatselu ennen tallentamista.');
        return false;
      }
      if (!organizationId) {
        setOperationError('Aktiivista organisaatiota ei ole valittu.');
        return false;
      }
      setOperationError(null);
      try {
        await mutation();
        await refresh();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tallennus epäonnistui.';
        setOperationError(message);
        logger.error(name, { error });
        return false;
      }
    },
    [isPreviewing, organizationId, refresh],
  );

  const addProject = useCallback(
    (project: Omit<Project, 'id'>) =>
      runMutation('Projektin luominen epäonnistui', () =>
        createProject(organizationId as string, user?.id, project),
      ),
    [organizationId, runMutation, user?.id],
  );

  const updateProject = useCallback(
    (id: string, updates: Partial<Project>) =>
      runMutation('Projektin päivittäminen epäonnistui', () =>
        patchProject(organizationId as string, id, updates),
      ),
    [organizationId, runMutation],
  );

  const deleteProject = useCallback(
    (id: string) =>
      runMutation('Projektin poistaminen epäonnistui', () =>
        removeProject(organizationId as string, id),
      ),
    [organizationId, runMutation],
  );

  const addWorkOrder = useCallback(
    (workOrder: Omit<WorkOrder, 'id'>) =>
      runMutation('Työmääräyksen luominen epäonnistui', () =>
        createWorkOrder(organizationId as string, user?.id, workOrder),
      ),
    [organizationId, runMutation, user?.id],
  );

  const updateWorkOrder = useCallback(
    (id: string, updates: Partial<WorkOrder>) =>
      runMutation('Työmääräyksen päivittäminen epäonnistui', () =>
        patchWorkOrder(organizationId as string, id, updates),
      ),
    [organizationId, runMutation],
  );

  const deleteWorkOrder = useCallback(
    (id: string) =>
      runMutation('Työmääräyksen poistaminen epäonnistui', () =>
        removeWorkOrder(organizationId as string, id),
      ),
    [organizationId, runMutation],
  );

  const addCustomer = useCallback(
    (customer: Omit<Customer, 'id'>) =>
      runMutation('Asiakkaan luominen epäonnistui', () =>
        createCustomerRecord(organizationId as string, user?.id, customer),
      ),
    [organizationId, runMutation, user?.id],
  );

  const updateCustomer = useCallback(
    (id: string, updates: Partial<Customer>) =>
      runMutation('Asiakkaan päivittäminen epäonnistui', () =>
        updateCustomerRecord(organizationId as string, id, updates),
      ),
    [organizationId, runMutation],
  );

  const deleteCustomer = useCallback(
    (id: string) =>
      runMutation('Asiakkaan poistaminen epäonnistui', () =>
        deleteCustomerRecord(organizationId as string, id),
      ),
    [organizationId, runMutation],
  );

  const addCrmLead = useCallback(
    (lead: Omit<CrmLead, 'id'>) =>
      runMutation('Myyntimahdollisuuden luominen epäonnistui', () =>
        createCrmLeadRecord(organizationId as string, user?.id, lead),
      ),
    [organizationId, runMutation, user?.id],
  );

  const updateCrmLead = useCallback(
    (id: string, updates: Partial<CrmLead>) =>
      runMutation('Myyntimahdollisuuden päivittäminen epäonnistui', () =>
        updateCrmLeadRecord(organizationId as string, id, updates),
      ),
    [organizationId, runMutation],
  );

  const deleteCrmLead = useCallback(
    (id: string) =>
      runMutation('Myyntimahdollisuuden poistaminen epäonnistui', () =>
        deleteCrmLeadRecord(organizationId as string, id),
      ),
    [organizationId, runMutation],
  );

  const addTimeEntry = useCallback(
    (entry: Omit<TimeEntry, 'id'>) =>
      runMutation('Tuntikirjauksen tallentaminen epäonnistui', () =>
        createTimeEntry(organizationId as string, user?.id, entry),
      ),
    [organizationId, runMutation, user?.id],
  );

  const addSafetyItem = useCallback(
    (item: Omit<SafetyItem, 'id'>) =>
      runMutation('Turvallisuushavainnon tallentaminen epäonnistui', () =>
        createSafetyItem(organizationId as string, user?.id, item),
      ),
    [organizationId, runMutation, user?.id],
  );

  const stats = useMemo(
    () => ({
      totalProjects: projects.length,
      activeProjects: projects.filter((project) => isRunningProjectStatus(project.status)).length,
      completedProjects: projects.filter((project) => project.status === 'Valmis').length,
      totalRevenue: projects.reduce((sum, project) => sum + project.budget, 0),
      openWorkOrders: data.workOrders.filter((order) => order.status === 'Avoin').length,
      inProgressWorkOrders: data.workOrders.filter((order) => order.status === 'Käynnissä').length,
      totalEmployees: data.employees.length,
      activeEmployees: data.employees.filter((employee) => employee.status === 'Aktiivinen').length,
      totalCustomers: data.customers.length,
      openLeads: data.crmLeads.filter((lead) => lead.stage === 'Uusi').length,
      totalEquipment: data.equipment.length,
    }),
    [data, projects],
  );

  return {
    ...data,
    projects,
    stats,
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    operationError,
    refresh,
    addProject,
    updateProject,
    deleteProject,
    addWorkOrder,
    updateWorkOrder,
    deleteWorkOrder,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addCrmLead,
    updateCrmLead,
    deleteCrmLead,
    addTimeEntry,
    addSafetyItem,
  };
}
