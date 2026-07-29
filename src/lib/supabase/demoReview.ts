import type {
  DemoFindingSeverity,
  DemoFindingStatus,
  DemoReviewDevice,
  DemoReviewStatus,
  DemoRole,
  DemoScenario,
} from '@/lib/demoQuality';
import { administratorSupabase } from '@/lib/supabase/client';

export interface DemoReviewItem {
  id: string;
  ownerUserId: string;
  organizationId: string;
  scenario: DemoScenario;
  datasetVersion: number;
  role: DemoRole;
  device: DemoReviewDevice;
  checkKey: string;
  status: DemoReviewStatus;
  note: string;
  updatedAt: string;
}

export interface DemoReviewFinding {
  id: string;
  ownerUserId: string;
  organizationId: string;
  scenario: DemoScenario;
  datasetVersion: number;
  role: DemoRole;
  device: DemoReviewDevice;
  severity: DemoFindingSeverity;
  status: DemoFindingStatus;
  title: string;
  description: string;
  pagePath: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function nullableText(row: Row, key: string): string | null {
  return typeof row[key] === 'string' ? row[key] as string : null;
}

function asRole(value: unknown): DemoRole {
  if (value === 'supervisor' || value === 'project_coordinator' || value === 'worker' || value === 'customer') return value;
  throw new Error('Demotarkistuksen rooli on virheellinen.');
}

function asScenario(value: unknown): DemoScenario {
  if (value === 'normal' || value === 'busy' || value === 'late' || value === 'empty' || value === 'handover') return value;
  throw new Error('Demotarkistuksen skenaario on virheellinen.');
}

function asDevice(value: unknown): DemoReviewDevice {
  return value === 'mobile' ? 'mobile' : 'desktop';
}

function asReviewStatus(value: unknown): DemoReviewStatus {
  if (value === 'passed' || value === 'failed' || value === 'not_tested') return value;
  return 'not_tested';
}

function asSeverity(value: unknown): DemoFindingSeverity {
  if (value === 'critical' || value === 'warning' || value === 'info') return value;
  return 'warning';
}

function asFindingStatus(value: unknown): DemoFindingStatus {
  return value === 'resolved' ? 'resolved' : 'open';
}

async function administratorUserId(): Promise<string> {
  const { data, error } = await administratorSupabase.auth.getUser();
  if (error || !data.user?.id) throw new Error(error?.message || 'Ylläpitäjän istunto ei ole voimassa.');
  return data.user.id;
}

function mapReviewItem(value: unknown): DemoReviewItem {
  const row = value as Row;
  return {
    id: text(row, 'id'),
    ownerUserId: text(row, 'owner_user_id'),
    organizationId: text(row, 'organization_id'),
    scenario: asScenario(row.scenario),
    datasetVersion: Number(row.dataset_version) || 1,
    role: asRole(row.role),
    device: asDevice(row.device),
    checkKey: text(row, 'check_key'),
    status: asReviewStatus(row.status),
    note: text(row, 'note'),
    updatedAt: text(row, 'updated_at'),
  };
}

function mapFinding(value: unknown): DemoReviewFinding {
  const row = value as Row;
  return {
    id: text(row, 'id'),
    ownerUserId: text(row, 'owner_user_id'),
    organizationId: text(row, 'organization_id'),
    scenario: asScenario(row.scenario),
    datasetVersion: Number(row.dataset_version) || 1,
    role: asRole(row.role),
    device: asDevice(row.device),
    severity: asSeverity(row.severity),
    status: asFindingStatus(row.status),
    title: text(row, 'title'),
    description: text(row, 'description'),
    pagePath: text(row, 'page_path'),
    createdAt: text(row, 'created_at'),
    updatedAt: text(row, 'updated_at'),
    resolvedAt: nullableText(row, 'resolved_at'),
  };
}

export async function listDemoReviewItems(values: {
  organizationId: string;
  scenario: DemoScenario;
  datasetVersion: number;
}): Promise<DemoReviewItem[]> {
  const ownerUserId = await administratorUserId();
  const { data, error } = await administratorSupabase
    .from('demo_review_items')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .eq('organization_id', values.organizationId)
    .eq('scenario', values.scenario)
    .eq('dataset_version', values.datasetVersion)
    .order('role')
    .order('device')
    .order('check_key');
  if (error) throw new Error(`Demotarkistusten haku epäonnistui: ${error.message}`);
  return (data ?? []).map(mapReviewItem);
}

export async function saveDemoReviewItem(values: {
  organizationId: string;
  scenario: DemoScenario;
  datasetVersion: number;
  role: DemoRole;
  device: DemoReviewDevice;
  checkKey: string;
  status: DemoReviewStatus;
  note: string;
}): Promise<DemoReviewItem> {
  const ownerUserId = await administratorUserId();
  const now = new Date().toISOString();
  const { data, error } = await administratorSupabase
    .from('demo_review_items')
    .upsert({
      owner_user_id: ownerUserId,
      organization_id: values.organizationId,
      scenario: values.scenario,
      dataset_version: values.datasetVersion,
      role: values.role,
      device: values.device,
      check_key: values.checkKey,
      status: values.status,
      note: values.note.trim().slice(0, 4000),
      updated_at: now,
    }, {
      onConflict: 'owner_user_id,organization_id,scenario,dataset_version,role,device,check_key',
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Demotarkistuksen tallennus epäonnistui: ${error?.message ?? 'riviä ei palautettu'}`);
  return mapReviewItem(data);
}

export async function listDemoReviewFindings(values: {
  organizationId: string;
  scenario: DemoScenario;
  datasetVersion: number;
}): Promise<DemoReviewFinding[]> {
  const ownerUserId = await administratorUserId();
  const { data, error } = await administratorSupabase
    .from('demo_review_findings')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .eq('organization_id', values.organizationId)
    .eq('scenario', values.scenario)
    .eq('dataset_version', values.datasetVersion)
    .order('status')
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Demohavaintojen haku epäonnistui: ${error.message}`);
  return (data ?? []).map(mapFinding);
}

export async function createDemoReviewFinding(values: {
  organizationId: string;
  scenario: DemoScenario;
  datasetVersion: number;
  role: DemoRole;
  device: DemoReviewDevice;
  severity: DemoFindingSeverity;
  title: string;
  description: string;
  pagePath: string;
}): Promise<DemoReviewFinding> {
  const ownerUserId = await administratorUserId();
  const { data, error } = await administratorSupabase
    .from('demo_review_findings')
    .insert({
      owner_user_id: ownerUserId,
      organization_id: values.organizationId,
      scenario: values.scenario,
      dataset_version: values.datasetVersion,
      role: values.role,
      device: values.device,
      severity: values.severity,
      status: 'open',
      title: values.title.trim().slice(0, 240),
      description: values.description.trim().slice(0, 8000),
      page_path: values.pagePath.trim().slice(0, 500),
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Demohavainnon tallennus epäonnistui: ${error?.message ?? 'riviä ei palautettu'}`);
  return mapFinding(data);
}

export async function setDemoReviewFindingStatus(
  findingId: string,
  status: DemoFindingStatus,
): Promise<DemoReviewFinding> {
  const ownerUserId = await administratorUserId();
  const now = new Date().toISOString();
  const { data, error } = await administratorSupabase
    .from('demo_review_findings')
    .update({
      status,
      resolved_at: status === 'resolved' ? now : null,
      updated_at: now,
    })
    .eq('id', findingId)
    .eq('owner_user_id', ownerUserId)
    .select('*')
    .single();
  if (error || !data) throw new Error(`Demohavainnon tilan päivitys epäonnistui: ${error?.message ?? 'riviä ei palautettu'}`);
  return mapFinding(data);
}

export async function deleteDemoReviewFinding(findingId: string): Promise<void> {
  const ownerUserId = await administratorUserId();
  const { error } = await administratorSupabase
    .from('demo_review_findings')
    .delete()
    .eq('id', findingId)
    .eq('owner_user_id', ownerUserId);
  if (error) throw new Error(`Demohavainnon poistaminen epäonnistui: ${error.message}`);
}
