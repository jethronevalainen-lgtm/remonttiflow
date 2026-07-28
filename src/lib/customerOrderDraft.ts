import type { PortalOrderDraft, PortalOrderItemDraft } from '@/lib/supabase/customerPortalOrders';

export const EMPTY_ORDER_ITEM: PortalOrderItemDraft = {
  title: '',
  description: '',
  locationDetails: '',
  quantity: '',
  unit: 'kpl',
  priority: 'Normaali',
};

export const EMPTY_ORDER_DRAFT: Omit<PortalOrderDraft, 'organizationId'> = {
  customerId: '',
  projectId: '',
  title: '',
  category: '',
  description: '',
  urgency: 'Normaali',
  locationDetails: '',
  serviceAddress: '',
  building: '',
  stairwell: '',
  unit: '',
  contactName: '',
  contactPhone: '',
  requestedDate: '',
  desiredCompletionDate: '',
  preferredTime: '',
  accessWindow: '',
  accessInstructions: '',
  safetyNotes: '',
  customerReference: '',
  purchaseOrderNumber: '',
  budgetLimitCents: undefined,
  items: [{ ...EMPTY_ORDER_ITEM }],
};
