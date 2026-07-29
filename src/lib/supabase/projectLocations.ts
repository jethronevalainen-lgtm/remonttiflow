import { supabase } from './client';

export interface WorkLocationBuilding {
  id: string;
  projectId: string;
  name: string;
  address: string;
}

export interface WorkLocationStairwell {
  id: string;
  projectId: string;
  buildingId: string;
  name: string;
}

export interface WorkLocationUnit {
  id: string;
  projectId: string;
  buildingId?: string;
  stairwellId?: string;
  unitCode: string;
  floor: string;
}

export interface ProjectLocationCatalog {
  buildings: WorkLocationBuilding[];
  stairwells: WorkLocationStairwell[];
  units: WorkLocationUnit[];
}

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function optionalText(row: Row, key: string): string | undefined {
  return text(row, key) || undefined;
}

export async function loadProjectLocationCatalog(
  organizationId: string,
): Promise<ProjectLocationCatalog> {
  const [buildingResponse, stairwellResponse, unitResponse] = await Promise.all([
    supabase
      .from('project_buildings')
      .select('id, project_id, name, address')
      .eq('organization_id', organizationId)
      .order('name'),
    supabase
      .from('project_stairwells')
      .select('id, project_id, building_id, name')
      .eq('organization_id', organizationId)
      .order('name'),
    supabase
      .from('project_units')
      .select('id, project_id, building_id, stairwell_id, unit_code, floor')
      .eq('organization_id', organizationId)
      .order('unit_code'),
  ]);

  const error = buildingResponse.error || stairwellResponse.error || unitResponse.error;
  if (error) throw new Error(`Projektien sijaintien haku epäonnistui: ${error.message}`);

  return {
    buildings: rows(buildingResponse.data).map((row) => ({
      id: text(row, 'id'),
      projectId: text(row, 'project_id'),
      name: text(row, 'name'),
      address: text(row, 'address'),
    })),
    stairwells: rows(stairwellResponse.data).map((row) => ({
      id: text(row, 'id'),
      projectId: text(row, 'project_id'),
      buildingId: text(row, 'building_id'),
      name: text(row, 'name'),
    })),
    units: rows(unitResponse.data).map((row) => ({
      id: text(row, 'id'),
      projectId: text(row, 'project_id'),
      buildingId: optionalText(row, 'building_id'),
      stairwellId: optionalText(row, 'stairwell_id'),
      unitCode: text(row, 'unit_code'),
      floor: text(row, 'floor'),
    })),
  };
}
