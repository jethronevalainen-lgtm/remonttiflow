import type { ProjectUnitImportSource } from '../projectWorkPlanBuilder';
import { supabase } from './client';

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function optionalNumber(row: Row, key: string): number | undefined {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export async function loadProjectWorkTargetImportOptions(input: {
  organizationId: string;
  projectId: string;
}): Promise<ProjectUnitImportSource[]> {
  const [buildingResponse, stairwellResponse, unitResponse] = await Promise.all([
    supabase
      .from('project_buildings')
      .select('id, name, address')
      .eq('organization_id', input.organizationId)
      .eq('project_id', input.projectId)
      .order('name'),
    supabase
      .from('project_stairwells')
      .select('id, building_id, name')
      .eq('organization_id', input.organizationId)
      .eq('project_id', input.projectId)
      .order('name'),
    supabase
      .from('project_units')
      .select('id, building_id, stairwell_id, unit_code, floor, unit_type, area_m2, renovation_scope, planned_completion_date, notes')
      .eq('organization_id', input.organizationId)
      .eq('project_id', input.projectId)
      .order('unit_code'),
  ]);

  if (buildingResponse.error) throw new Error(`Rakennusten haku epäonnistui: ${buildingResponse.error.message}`);
  if (stairwellResponse.error) throw new Error(`Rappujen haku epäonnistui: ${stairwellResponse.error.message}`);
  if (unitResponse.error) throw new Error(`Huoneistojen haku epäonnistui: ${unitResponse.error.message}`);

  const buildingMap = new Map(rows(buildingResponse.data).map((row) => [text(row, 'id'), text(row, 'name')]));
  const stairwellMap = new Map(rows(stairwellResponse.data).map((row) => [text(row, 'id'), text(row, 'name')]));

  return rows(unitResponse.data).map((row) => ({
    id: text(row, 'id'),
    unitCode: text(row, 'unit_code'),
    buildingName: buildingMap.get(text(row, 'building_id')) || undefined,
    stairwellName: stairwellMap.get(text(row, 'stairwell_id')) || undefined,
    floor: text(row, 'floor') || undefined,
    unitType: text(row, 'unit_type') || undefined,
    areaM2: optionalNumber(row, 'area_m2'),
    renovationScope: text(row, 'renovation_scope') || undefined,
    plannedCompletionDate: text(row, 'planned_completion_date') || undefined,
    notes: text(row, 'notes') || undefined,
  })).filter((unit) => unit.id && unit.unitCode);
}
