import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganization } from '@/contexts/OrganizationContext';
import {
  loadOfferCenter,
  type OfferCenterData,
  type OrganizationCommercialSettings,
} from '@/lib/supabase/offers';

const EMPTY_SETTINGS: OrganizationCommercialSettings = {
  organizationId: '',
  locale: 'fi-FI',
  timezone: 'Europe/Helsinki',
  defaultVatRate: 25.5,
  defaultOverheadPercent: 0,
  defaultRiskPercent: 0,
  defaultMarginPercent: 0,
  defaultHourlyCostCents: 0,
  defaultPaymentTermDays: 14,
  defaultOfferValidDays: 30,
};

const EMPTY_DATA: OfferCenterData = {
  offers: [],
  versions: [],
  lines: [],
  attachments: [],
  settings: EMPTY_SETTINGS,
};

export function useOfferCenter() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = currentOrg?.id;
  const queryKey = ['offer-center', organizationId ?? 'none'] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => loadOfferCenter(organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 15_000,
    retry: 1,
  });

  return {
    ...(query.data ?? {
      ...EMPTY_DATA,
      settings: { ...EMPTY_SETTINGS, organizationId: organizationId ?? '' },
    }),
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
