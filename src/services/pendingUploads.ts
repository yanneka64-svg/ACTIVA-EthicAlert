/**
 * === AMÉLIORATION AJOUTÉE (pièces jointes du formulaire transmises) ===
 *
 * Fichiers joints au formulaire de signalement, conservés sur l'appareil du
 * déclarant (IndexedDB, jamais dans localStorage) jusqu'à leur envoi au
 * serveur : aussitôt après le dépôt, sinon à la prochaine connexion du
 * déclarant à son suivi. Supprimés dès qu'ils sont transmis. Si IndexedDB
 * est indisponible, seul l'envoi immédiat reste possible.
 */
const DB_NAME = 'activa_pending_uploads';
const STORE = 'files';

export interface PendingUpload {
  id: string;
  trackingNumber: string;
  name: string;
  type: string;
  blob: Blob;
  savedAt: string;
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

const norm = (n: string) => n.trim().toUpperCase();

export async function savePendingUpload(item: Omit<PendingUpload, 'savedAt' | 'trackingNumber'> & { trackingNumber: string }): Promise<void> {
  await run('readwrite', (s) => s.put({ ...item, trackingNumber: norm(item.trackingNumber), savedAt: new Date().toISOString() }));
}

export async function listPendingUploads(trackingNumber: string): Promise<PendingUpload[]> {
  const all = (await run<PendingUpload[]>('readonly', (s) => s.getAll() as IDBRequest<PendingUpload[]>)) ?? [];
  return all.filter((p) => p.trackingNumber === norm(trackingNumber));
}

export async function deletePendingUpload(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}
