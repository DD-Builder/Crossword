/** Promisified IndexedDB wrapper. Stores:
 *   solves  (key: puzzleId)  one summary row per completed puzzle
 *   clues   (autoIncrement; indexes: category, date) one row per clue solved
 *   profile (key: 'main')    derived aggregates for the adaptive layer
 */

const DB_NAME = 'crossword';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('solves')) {
        const solves = db.createObjectStore('solves', { keyPath: 'puzzleId' });
        solves.createIndex('date', 'date');
        solves.createIndex('kind', 'kind');
      }
      if (!db.objectStoreNames.contains('clues')) {
        const clues = db.createObjectStore('clues', { autoIncrement: true });
        clues.createIndex('category', 'category');
        clues.createIndex('date', 'date');
        clues.createIndex('puzzleId', 'puzzleId');
      }
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
  return dbPromise;
}

export async function put(store: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value as never);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put failed'));
  });
}

export async function putMany(store: string, values: unknown[]): Promise<void> {
  if (values.length === 0) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const v of values) os.put(v as never);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB putMany failed'));
  });
}

export async function get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get failed'));
  });
}

export async function getAll<T>(store: string, index?: string, query?: IDBValidKey | IDBKeyRange): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const source = index ? tx.objectStore(store).index(index) : tx.objectStore(store);
    const req = source.getAll(query);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB getAll failed'));
  });
}

export async function count(store: string): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB count failed'));
  });
}
