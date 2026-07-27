import { supabase } from './client';

export async function convertCrmLeadToProject(input: {
  organizationId: string;
  leadId: string;
  projectName: string;
  startDate: string;
  endDate: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('convert_crm_lead_to_project', {
    p_organization_id: input.organizationId,
    p_lead_id: input.leadId,
    p_project_name: input.projectName.trim(),
    p_start_date: input.startDate,
    p_end_date: input.endDate,
  });

  if (error) {
    throw new Error(`Projektin luominen voitetusta kaupasta epäonnistui: ${error.message}`);
  }

  if (typeof data !== 'string' || !data) {
    throw new Error('Projektin luominen ei palauttanut projektin tunnistetta.');
  }

  return data;
}
