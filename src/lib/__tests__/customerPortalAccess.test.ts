import { describe, expect, it } from 'vitest';

import {
  customerPreviewRpcArgs,
  normalizeCustomerPreviewScope,
} from '@/lib/customerPortalAccess';

describe('customer portal preview scope', () => {
  it('deduplicates customer and project identifiers for selected-project access', () => {
    expect(normalizeCustomerPreviewScope({
      customerIds: ['customer-a', 'customer-a', 'customer-b'],
      projectIds: ['project-a', 'project-a', 'project-b'],
      accessScope: 'selected_projects',
    })).toEqual({
      customerIds: ['customer-a', 'customer-b'],
      projectIds: ['project-a', 'project-b'],
      accessScope: 'selected_projects',
    });
  });

  it('drops project identifiers when all projects are visible', () => {
    expect(normalizeCustomerPreviewScope({
      customerIds: ['customer-a'],
      projectIds: ['project-a'],
      accessScope: 'all_projects',
    })).toEqual({
      customerIds: ['customer-a'],
      projectIds: [],
      accessScope: 'all_projects',
    });
  });

  it('creates stable named RPC arguments for server-side preview functions', () => {
    expect(customerPreviewRpcArgs({
      customerIds: ['customer-a'],
      projectIds: ['project-a'],
      accessScope: 'selected_projects',
    })).toEqual({
      p_customer_ids: ['customer-a'],
      p_project_ids: ['project-a'],
      p_access_scope: 'selected_projects',
    });
  });
});
