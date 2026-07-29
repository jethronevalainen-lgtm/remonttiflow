import {
  listOfflineOperations,
  removeOfflineOperation,
  type OfflineOperation,
} from './offlineQueue';
import { syncInspectionOfflineOperation } from './supabase/inspectionEntities';

let flushing = false;

export async function flushOfflineQueue(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const operations = await listOfflineOperations();
    for (const operation of operations) {
      try {
        await syncOperation(operation);
        await removeOfflineOperation(operation.id);
      } catch {
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

async function syncOperation(operation: OfflineOperation): Promise<void> {
  await syncInspectionOfflineOperation(operation);
}
