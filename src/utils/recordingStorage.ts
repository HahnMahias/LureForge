// Simulation recordings (utils/simulationRecorder.ts) are stored in
// IndexedDB rather than localStorage: projects themselves live in
// localStorage (projectStorage.ts), which typically caps out around 5-10MB
// per site — a few seconds of video as base64 would eat that quota fast and
// start failing future Saves. IndexedDB has far more headroom and can store
// Blobs directly, no base64 detour needed.

export interface StoredRecording {
  id: string;
  projectId: string;
  createdAt: number;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('lureworks.recordings', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('recordings')) {
        const store = db.createObjectStore('recordings', { keyPath: 'id' });
        store.createIndex('projectId', 'projectId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecording(projectId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const rec: StoredRecording = { id: crypto.randomUUID(), projectId, createdAt: Date.now(), blob };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite');
    tx.objectStore('recordings').put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listRecordingsForProject(projectId: string): Promise<StoredRecording[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recordings', 'readonly');
    const req = tx.objectStore('recordings').index('projectId').getAll(projectId);
    req.onsuccess = () => resolve(req.result as StoredRecording[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite');
    tx.objectStore('recordings').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
