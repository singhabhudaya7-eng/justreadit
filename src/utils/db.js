// db.js — Minimal native IndexedDB wrapper for devread.
// One database, one object store per "table". No external dependency.

const DB_NAME    = 'devread';
const DB_VERSION = 1;
export const STORES = ['books', 'bookText', 'progress', 'bookmarks', 'stats', 'config', 'highlights'];

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return _dbPromise;
}

export async function dbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function dbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly').objectStore(store);
    const keysReq = tx.getAllKeys();
    const valsReq = tx.getAll();
    let keys, vals;
    keysReq.onsuccess = () => { keys = keysReq.result; done(); };
    valsReq.onsuccess = () => { vals = valsReq.result; done(); };
    keysReq.onerror = valsReq.onerror = () => reject(keysReq.error || valsReq.error);
    function done() {
      if (keys === undefined || vals === undefined) return;
      const out = {};
      keys.forEach((k, i) => { out[k] = vals[i]; });
      resolve(out);
    }
  });
}

export async function dbSet(store, key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function dbDelete(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
