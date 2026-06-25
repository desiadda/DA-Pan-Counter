import { isFirebaseEnabled } from "./config";
import { getLocalData, setLocalData } from "./storage";
import { LS_KEYS } from "../constants";
import { logError } from "./errorLog";

const SYNC_KEY = "pan_sync_queue";

function getSyncQueue() {
  return getLocalData(SYNC_KEY, []);
}

function saveSyncQueue(queue) {
  setLocalData(SYNC_KEY, queue);
}

export function addToSyncQueue(entry) {
  const queue = getSyncQueue();
  queue.push({ ...entry, _ts: Date.now() });
  saveSyncQueue(queue);
}

export function removeFromSyncQueue(index) {
  const queue = getSyncQueue();
  queue.splice(index, 1);
  saveSyncQueue(queue);
}

export function getQueueLength() {
  return getSyncQueue().length;
}

export async function processSyncQueue() {
  if (!isFirebaseEnabled) return 0;
  const queue = getSyncQueue();
  if (queue.length === 0) return 0;
  let synced = 0;
  for (let i = queue.length - 1; i >= 0; i--) {
    const entry = queue[i];
    try {
      await entry.fn();
      removeFromSyncQueue(i);
      synced++;
    } catch (e) {
      if (Date.now() - entry._ts > 86400000) {
        removeFromSyncQueue(i);
      }
    }
  }
  return synced;
}

export function syncHelper(firebaseFn) {
  return async (...args) => {
    if (!isFirebaseEnabled) return await firebaseFn(...args);
    try {
      return await firebaseFn(...args);
    } catch (err) {
      addToSyncQueue({ fn: () => firebaseFn(...args), _ts: Date.now() });
      return null;
    }
  };
}
