import { supabase } from '@/lib/supabase/client';

export async function publishCustomerPortalUpdate(values: {
  organizationId: string;
  projectId: string;
  type: string;
  title: string;
  summary?: string;
  requiresAcknowledgement?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await supabase.rpc('management_publish_customer_portal_item_v3', {
    p_organization_id: values.organizationId,
    p_project_id: values.projectId,
    p_publication_type: values.type,
    p_title: values.title,
    p_summary: values.summary || null,
    p_source_table: null,
    p_source_id: null,
    p_requires_acknowledgement: values.requiresAcknowledgement ?? false,
    p_metadata: values.metadata ?? {},
  });
  if (error) throw new Error(`Tilaajapäivityksen julkaisu epäonnistui: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Julkaisun tunnistetta ei palautettu.');
  return data;
}
