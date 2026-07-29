import type { InspectionResultStatus } from './supabase/inspectionTypes';

const DATABASE_NAME = 'vakantti-offline';
const DATABASE_VERSION = 1;
const STORE_NAME = 'operations';
export const OFFLINE_QUEUE_CHANGED_EVENT = 'vakantti-offline-queue-changed';

export interface QueuedInspectionResult {
  inspectionId: string;
  itemId: string;
  status: InspectionResultStatus;
  comment?: string;
  measurementValue?: number;
  measurementUnit?: string;
}

export interface QueuedInspectionAttachment {
  organizationId: string;
  inspectionId?: string;
  resultId?: string;
  findingId?: string;
  file: File;
  kind: string;
  caption?: string;
  userId: string;
}

export type OfflineOperation =
  | {
    id: string;
    type: 'inspection-result';
    createdAt: string;
    payload: QueuedInspectionResult;
  }
  | {
    id: string;
    type: 'inspection-attachment';
    createdAt: string;
    payload: QueuedInspectionAttachment;
  };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Offline-tallennuksen avaaminen epäonnistui.'));
  });
}

function notifyQueueChanged() {
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_CHANGED_EVENT));
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = createRequest(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Offline-tallennus epäonnistui.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error('Offline-tallennus epäonnistui.'));
  });
}

export async function enqueueOfflineOperation(
  operation: Omit<OfflineOperation, 'id' | 'createdAt'>,
): Promise<void> {
  await runRequest('readwrite', (store) => store.put({
    ...operation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  } as OfflineOperation));
  notifyQueueChanged();
}

export async function listOfflineOperations(): Promise<OfflineOperation[]> {
  const operations = await runRequest<OfflineOperation[]>('readonly', (store) => store.getAll());
  return operations.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function removeOfflineOperation(id: string): Promise<void> {
  await runRequest('readwrite', (store) => store.delete(id));
  notifyQueueChanged();
}

export async function countOfflineOperations(): Promise<number> {
  return runRequest<number>('readonly', (store) => store.count());
}

export function isLikelyNetworkError(error: unknown): boolean {
  if (!navigator.onLine) return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /failed to fetch|network|load failed|fetch failed|connection/i.test(message);
}
