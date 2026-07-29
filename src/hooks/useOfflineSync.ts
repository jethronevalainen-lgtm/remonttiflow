import { useCallback, useEffect, useState } from 'react';

import {
  countOfflineOperations,
  OFFLINE_QUEUE_CHANGED_EVENT,
} from '@/lib/offlineQueue';
import { flushOfflineQueue } from '@/lib/offlineSync';

export function useOfflineSync() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      setPendingCount(await countOfflineOperations());
    } catch {
      setPendingCount(0);
    }
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      await flushOfflineQueue();
      await refreshCount();
    } finally {
      setSyncing(false);
    }
  }, [refreshCount]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void sync();
    };
    const handleOffline = () => setOnline(false);
    const handleQueueChange = () => void refreshCount();
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'vakantti-sync') void sync();
    };

    void refreshCount();
    if (navigator.onLine) void sync();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChange);
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChange);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [refreshCount, sync]);

  return { online, pendingCount, syncing, sync };
}
