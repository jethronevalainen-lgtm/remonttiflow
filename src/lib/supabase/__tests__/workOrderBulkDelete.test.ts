import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: { rpc },
}));

import { deleteManagedWorkOrders } from '@/lib/supabase/workOrderBulkDelete';

describe('deleteManagedWorkOrders', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('deduplicates ids and returns the confirmed delete count', async () => {
    rpc.mockResolvedValueOnce({ data: 2, error: null });

    await expect(deleteManagedWorkOrders({
      organizationId: 'org-1',
      workOrderIds: ['a', 'a', 'b'],
    })).resolves.toBe(2);

    expect(rpc).toHaveBeenCalledWith('delete_work_orders_bulk', {
      p_organization_id: 'org-1',
      p_work_order_ids: ['a', 'b'],
    });
  });

  it('rejects an empty selection before calling the database', async () => {
    await expect(deleteManagedWorkOrders({
      organizationId: 'org-1',
      workOrderIds: [],
    })).rejects.toThrow('Valitse vähintään yksi poistettava työmääräys.');

    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a mismatching database confirmation', async () => {
    rpc.mockResolvedValueOnce({ data: 1, error: null });

    await expect(deleteManagedWorkOrders({
      organizationId: 'org-1',
      workOrderIds: ['a', 'b'],
    })).rejects.toThrow('Tietokanta ei vahvistanut kaikkien valittujen työmääräysten poistamista.');
  });
});
