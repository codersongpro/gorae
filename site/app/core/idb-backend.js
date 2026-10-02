// IndexedDB 백엔드 (브라우저 전용)
export function createIdbBackend(dbName = 'gorae-mypod') {
  const open = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('works', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('works', mode);
      const req = fn(tx.objectStore('works'));
      tx.oncomplete = () => {
        db.close();
        resolve(req.result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  };
  return {
    getAll: () => run('readonly', (s) => s.getAll()),
    get: (id) => run('readonly', (s) => s.get(id)),
    put: (rec) => run('readwrite', (s) => s.put(rec)),
    delete: (id) => run('readwrite', (s) => s.delete(id)),
  };
}
