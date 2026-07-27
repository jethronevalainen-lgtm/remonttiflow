import { supabase } from '@/lib/supabase/client';

export async function deleteManagedWorkOrders(values: {
  organizationId: string;
  workOrderIds: string[];
}): Promise<number> {
  const uniqueIds = [...new Set(values.workOrderIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new Error('Valitse vähintään yksi poistettava työmääräys.');
  }

  const { data, error } = await supabase.rpc('delete_work_orders_bulk', {
    p_organization_id: values.organizationId,
    p_work_order_ids: uniqueIds,
  });

  if (error) {
    throw new Error(`Työmääräysten poistaminen epäonnistui: ${error.message}`);
  }

  const deletedCount = Number(data);
  if (!Number.isInteger(deletedCount) || deletedCount !== uniqueIds.length) {
    throw new Error('Tietokanta ei vahvistanut kaikkien valittujen työmääräysten poistamista.');
  }

  return deletedCount;
}
