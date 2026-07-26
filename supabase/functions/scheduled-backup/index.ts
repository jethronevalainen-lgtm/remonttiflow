import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.110.8';

const DATA_TABLES = [
  'ai_interactions',
  'announcements',
  'audit_logs',
  'change_orders',
  'crm_activities',
  'crm_leads',
  'customer_contacts',
  'customer_users',
  'customer_work_requests',
  'customers',
  'diary_entries',
  'driving_log_entries',
  'employee_absences',
  'employee_certifications',
  'employee_compensation_terms',
  'employee_hr_profiles',
  'employees',
  'equipment',
  'equipment_maintenance',
  'equipment_reservations',
  'estimate_lines',
  'estimates',
  'finding_actions',
  'form_submissions',
  'form_templates',
  'inspection_attachments',
  'inspection_audit_events',
  'inspection_findings',
  'inspection_reports',
  'inspection_results',
  'inspection_signatures',
  'inspection_template_items',
  'inspection_template_sections',
  'inspection_template_versions',
  'inspection_templates',
  'inspections',
  'messages',
  'offer_lines',
  'offer_versions',
  'offers',
  'organization_members',
  'organization_settings',
  'organizations',
  'profiles',
  'project_activity_feed',
  'project_buildings',
  'project_documents',
  'project_members',
  'project_message_attachments',
  'project_message_mentions',
  'project_message_reads',
  'project_messages',
  'project_phases',
  'project_requests',
  'project_stairwells',
  'project_units',
  'projects',
  'quantity_takeoff_lines',
  'quantity_takeoffs',
  'record_attachments',
  'safety_items',
  'saved_reports',
  'shifts',
  'site_receipt_attachments',
  'site_receipts',
  'supervisor_team_members',
  'time_entries',
  'time_entry_period_locks',
  'travel_expenses',
  'waste_entries',
  'work_order_assignees',
  'work_orders',
  'work_site_check_ins',
  'work_site_qr_tokens',
] as const;

const FILE_BUCKETS = [
  'inspection-files',
  'project-documents',
  'project-message-attachments',
  'site-receipts',
] as const;

const BACKUP_BUCKET = 'app-backups';
const PAGE_SIZE = 1000;

interface BackupSettings {
  secret_hash: string;
  enabled: boolean;
  retention_days: number;
}

interface StorageFile {
  bucket: string;
  path: string;
  size: number;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function getServiceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!raw) throw new Error('Supabasen palvelinavainta ei ole saatavilla.');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  for (const value of Object.values(parsed)) {
    if (typeof value === 'string' && value.length > 20) return value;
    if (value && typeof value === 'object' && 'key' in value) {
      const key = (value as { key?: unknown }).key;
      if (typeof key === 'string' && key.length > 20) return key;
    }
  }
  throw new Error('Supabasen palvelinavaimen muotoa ei tunnistettu.');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeBytea(value: string): string {
  return value.toLowerCase().replace(/^\\x/, '');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function readAllRows(client: SupabaseClient, table: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function listBucketFiles(
  client: SupabaseClient,
  bucket: string,
  path = '',
): Promise<StorageFile[]> {
  const files: StorageFile[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.storage.from(bucket).list(path, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`${bucket}/${path}: ${error.message}`);
    const entries = data ?? [];
    for (const entry of entries) {
      const childPath = path ? `${path}/${entry.name}` : entry.name;
      if (entry.id) {
        const metadata = entry.metadata as { size?: number | string } | null;
        const size = Number(metadata?.size ?? 0);
        files.push({ bucket, path: childPath, size: Number.isFinite(size) ? size : 0 });
      } else {
        files.push(...await listBucketFiles(client, bucket, childPath));
      }
    }
    if (entries.length < PAGE_SIZE) break;
  }
  return files;
}

async function copyStorageFiles(
  client: SupabaseClient,
  snapshotId: string,
): Promise<{ files: StorageFile[]; bytes: number }> {
  const copied: StorageFile[] = [];
  let bytes = 0;

  for (const bucket of FILE_BUCKETS) {
    const sourceFiles = await listBucketFiles(client, bucket);
    for (const source of sourceFiles) {
      const { data, error: downloadError } = await client.storage.from(source.bucket).download(source.path);
      if (downloadError || !data) {
        throw new Error(`Tiedoston ${source.bucket}/${source.path} lataus epäonnistui: ${downloadError?.message ?? 'ei sisältöä'}`);
      }
      const targetPath = `files/${snapshotId}/${source.bucket}/${source.path}`;
      const { error: uploadError } = await client.storage.from(BACKUP_BUCKET).upload(targetPath, data, {
        contentType: 'application/octet-stream',
        upsert: true,
      });
      if (uploadError) throw new Error(`Tiedoston ${targetPath} varmistus epäonnistui: ${uploadError.message}`);
      copied.push(source);
      bytes += source.size || data.size;
    }
  }

  return { files: copied, bytes };
}

async function removeBackupPrefix(client: SupabaseClient, path: string): Promise<void> {
  const files = await listBucketFiles(client, BACKUP_BUCKET, path);
  if (files.length === 0) return;
  for (let index = 0; index < files.length; index += 100) {
    const batch = files.slice(index, index + 100).map((file) => file.path);
    const { error } = await client.storage.from(BACKUP_BUCKET).remove(batch);
    if (error) throw new Error(`Vanhan varmuuskopion poisto epäonnistui: ${error.message}`);
  }
}

async function enforceRetention(
  client: SupabaseClient,
  retentionDays: number,
): Promise<void> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const { data, error } = await client.storage.from(BACKUP_BUCKET).list('snapshots', {
    limit: 1000,
    sortBy: { column: 'created_at', order: 'asc' },
  });
  if (error) throw new Error(`Varmuuskopioiden säilytyskierron tarkistus epäonnistui: ${error.message}`);

  for (const item of data ?? []) {
    if (!item.id || !item.name.endsWith('.json')) continue;
    const timestamp = Date.parse(item.created_at ?? item.updated_at ?? '');
    if (!Number.isFinite(timestamp) || timestamp >= cutoff) continue;
    const snapshotId = item.name.replace(/\.json$/, '');
    await removeBackupPrefix(client, `files/${snapshotId}`);
    const { error: removeError } = await client.storage.from(BACKUP_BUCKET).remove([`snapshots/${item.name}`]);
    if (removeError) throw new Error(`Vanhentuneen varmuuskopion poisto epäonnistui: ${removeError.message}`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return jsonResponse({ error: 'SUPABASE_URL puuttuu.' }, 500);

  let client: SupabaseClient;
  try {
    client = createClient(supabaseUrl, getServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Palvelinavaimen luku epäonnistui.' }, 500);
  }

  const { data: settingsData, error: settingsError } = await client
    .from('backup_cron_settings')
    .select('secret_hash, enabled, retention_days')
    .eq('id', true)
    .single();
  if (settingsError || !settingsData) {
    return jsonResponse({ error: `Varmuuskopioasetusten luku epäonnistui: ${settingsError?.message ?? 'asetuksia ei löytynyt'}` }, 500);
  }
  const settings = settingsData as BackupSettings;
  if (!settings.enabled) return jsonResponse({ skipped: true, reason: 'Varmuuskopiointi ei ole käytössä.' });

  const suppliedSecret = request.headers.get('x-backup-secret') ?? '';
  const suppliedHash = await sha256Hex(suppliedSecret);
  if (!suppliedSecret || !constantTimeEqual(suppliedHash, normalizeBytea(settings.secret_hash))) {
    return jsonResponse({ error: 'Varmuuskopioajon tunnistus epäonnistui.' }, 401);
  }

  const requestedBody = await request.json().catch(() => ({})) as { triggered_by?: string };
  const triggeredBy = requestedBody.triggered_by === 'manual' ? 'manual' : 'cron';
  const snapshotId = new Date().toISOString().replaceAll(':', '-');
  const storagePath = `snapshots/${snapshotId}.json`;

  const { data: run, error: runError } = await client
    .from('backup_runs')
    .insert({ status: 'running', triggered_by: triggeredBy, storage_prefix: snapshotId })
    .select('id')
    .single();
  if (runError || !run) return jsonResponse({ error: `Varmuuskopioajon lokia ei voitu aloittaa: ${runError?.message ?? 'tuntematon virhe'}` }, 500);

  try {
    const tables: Record<string, unknown[]> = {};
    let rowCount = 0;
    for (const table of DATA_TABLES) {
      const rows = await readAllRows(client, table);
      tables[table] = rows;
      rowCount += rows.length;
    }

    const storageCopy = await copyStorageFiles(client, snapshotId);
    const snapshot = {
      format: 'vakantti-logical-backup-v1',
      createdAt: new Date().toISOString(),
      projectRef: new URL(supabaseUrl).hostname.split('.')[0],
      tableCount: DATA_TABLES.length,
      rowCount,
      storageFileCount: storageCopy.files.length,
      storageFiles: storageCopy.files,
      tables,
    };
    const json = JSON.stringify(snapshot);
    const databaseBytes = new TextEncoder().encode(json).byteLength;

    const { error: uploadError } = await client.storage.from(BACKUP_BUCKET).upload(storagePath, json, {
      contentType: 'application/json',
      upsert: false,
    });
    if (uploadError) throw new Error(`Varmuuskopiotiedoston tallennus epäonnistui: ${uploadError.message}`);

    await enforceRetention(client, settings.retention_days);

    const totalBytes = databaseBytes + storageCopy.bytes;
    const { error: finishError } = await client
      .from('backup_runs')
      .update({
        status: 'completed',
        table_count: DATA_TABLES.length,
        row_count: rowCount,
        file_count: storageCopy.files.length,
        total_bytes: totalBytes,
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id);
    if (finishError) throw new Error(`Varmuuskopioajon lokin viimeistely epäonnistui: ${finishError.message}`);

    return jsonResponse({
      ok: true,
      runId: run.id,
      storagePath,
      tableCount: DATA_TABLES.length,
      rowCount,
      fileCount: storageCopy.files.length,
      totalBytes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Varmuuskopiointi epäonnistui.';
    await client
      .from('backup_runs')
      .update({ status: 'failed', error_message: message, finished_at: new Date().toISOString() })
      .eq('id', run.id);
    return jsonResponse({ error: message, runId: run.id }, 500);
  }
});