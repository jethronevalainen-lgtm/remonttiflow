import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import logger from '@/lib/logger';
import {
  EMPTY_DOMAIN_DATA,
  createCrmLead,
  createCustomer,
  createProject,
  createSafetyItem,
  createTimeEntry,
  createWorkOrder,
  loadDomainData,
  patchCrmLead,
  patchCustomer,
  patchProject,
  patchWorkOrder,
  removeCrmLead,
  removeCustomer,
  removeProject,
  removeWorkOrder,
  type DomainData,
} from '@/lib/supabase/domainData';
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
  const [operationError, setOperationError] = useState<string | null>(null);

  const organizationId = currentOrg?.id;
  const query = useQuery({
    queryKey: domainQueryKey(organizationId),
    queryFn: () => loadDomainData(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    retry: 1,
  });

  const data: DomainData = query.data ?? EMPTY_DOMAIN_DATA;

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    await queryClient.invalidateQueries({ queryKey: domainQueryKey(organizationId) });
  }, [organizationId, queryClient]);

  const runMutation = useCallback(
    async (name: string, mutation: () => Promise<unknown>) => {
      if (!organizationId) {
        setOperationError('Aktiivista organisaatiota ei ole valittu.');
        return;
      }
      setOperationError(null);
      try {
        await mutation();
        await refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tallennus epäonnistui.';
        setOperationError(message);
        logger.error(name, { error });
      }
    },
    [organizationId, refresh],
  );

  const addProject = useCallback(
    (project: Omit<Project, 'id'>) => {
      void runMutation('Projektin luominen epäonnistui', () =>
        createProject(organizationId as string, user?.id, project),
      );
    },
    [organizationId, runMutation, user?.id],
  );

  const updateProject = useCallback(
    (id: string, updates: Partial<Project>) => {
      void runMutation('Projektin päivittäminen epäonnistui', () =>
        patchProject(organizationId as string, id, updates),
      );
    },
    [organizationId, runMutation],
  );

  const deleteProject = useCallback(
    (id: string) => {
      void runMutation('Projektin poistaminen epäonnistui', () =>
        removeProject(organizationId as string, id),
      );
    },
    [organizationId, runMutation],
  );

  const addWorkOrder = useCallback(
    (workOrder: Omit<WorkOrder, 'id'>) => {
      void runMutation('Työmääräyksen luominen epäonnistui', () =>
        createWorkOrder(organizationId as string, user?.id, workOrder),
      );
    },
    [organizationId, runMutation, user?.id],
  );

  const updateWorkOrder = useCallback(
    (id: string, updates: Partial<WorkOrder>) => {
      void runMutation('Työmääräyksen päivittäminen epäonnistui', () =>
        patchWorkOrder(organizationId as string, id, updates),
      );
    },
    [organizationId, runMutation],
  );

  const deleteWorkOrder = useCallback(
    (id: string) => {
      void runMutation('Työmääräyksen poistaminen epäonnistui', () =>
        removeWorkOrder(organizationId as string, id),
      );
    },
    [organizationId, runMutation],
  );

  const addCustomer = useCallback(
    (customer: Omit<Customer, 'id'>) => {
      void runMutation('Asiakkaan luominen epäonnistui', () =>
        createCustomer(organizationId as string, user?.id, customer),
      );
    },
    [organizationId, runMutation, user?.id],
  );

  const updateCustomer = useCallback(
    (id: string, updates: Partial<Customer>) => {
      void runMutation('Asiakkaan päivittäminen epäonnistui', () =>
        patchCustomer(organizationId as string, id, updates),
      );
    },
    [organizationId, runMutation],
  );

  const deleteCustomer = useCallback(
    (id: string) => {
      void runMutation('Asiakkaan poistaminen epäonnistui', () =>
        removeCustomer(organizationId as string, id),
      );
    },
    [organizationId, runMutation],
  );

  const addCrmLead = useCallback(
    (lead: Omit<CrmLead, 'id'>) => {
      void runMutation('Myyntimahdollisuuden luominen epäonnistui', () =>
        createCrmLead(organizationId as string, user?.id, lead),
      );
    },
    [organizationId, runMutation, user?.id],
  );

  const updateCrmLead = useCallback(
    (id: string, updates: Partial<CrmLead>) => {
      void runMutation('Myyntimahdollisuuden päivittäminen epäonnistui', () =>
        patchCrmLead(organizationId as string, id, updates),
      );
    },
    [organizationId, runMutation],
  );

  const deleteCrmLead = useCallback(
    (id: string) => {
      void runMutation('Myyntimahdollisuuden poistaminen epäonnistui', () =>
        removeCrmLead(organizationId as string, id),
      );
    },
    [organizationId, runMutation],
  );

  const addTimeEntry = useCallback(
    (entry: Omit<TimeEntry, 'id'>) => {
      void runMutation('Tuntikirjauksen tallentaminen epäonnistui', () =>
        createTimeEntry(organizationId as string, user?.id, entry),
      );
    },
    [organizationId, runMutation, user?.id],
  );

  const addSafetyItem = useCallback(
    (item: Omit<SafetyItem, 'id'>) => {
      void runMutation('Turvallisuushavainnon tallentaminen epäonnistui', () =>
        createSafetyItem(organizationId as string, user?.id, item),
      );
    },
    [organizationId, runMutation, user?.id],
  );

  const stats = useMemo(
    () => ({
      totalProjects: data.projects.length,
      activeProjects: data.projects.filter((project) => project.status === 'Aktiivinen').length,
      completedProjects: data.projects.filter((project) => project.status === 'Valmis').length,
      totalRevenue: data.projects.reduce((sum, project) => sum + project.budget, 0),
      openWorkOrders: data.workOrders.filter((order) => order.status === 'Avoin').length,
      inProgressWorkOrders: data.workOrders.filter((order) => order.status === 'Käynnissä').length,
      totalEmployees: data.employees.length,
      activeEmployees: data.employees.filter((employee) => employee.status === 'Aktiivinen').length,
      totalCustomers: data.customers.length,
      openLeads: data.crmLeads.filter((lead) => lead.stage === 'Uusi').length,
      totalEquipment: data.equipment.length,
    }),
    [data],
  );

  return {
    ...data,
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
