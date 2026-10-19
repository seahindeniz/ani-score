import type { AnimeIndexData } from './animeIndex';

export interface DatabaseInfo {
  lastUpdate: string;
  /**
   * Name of the database source the stored data came from.
   */
  source: string;
  /**
   * When the source was last asked for updates, in milliseconds since the epoch.
   */
  checkedAt: number;
}

// IndexedDB rather than extension storage: it reads the index back several times faster, and a change to extension
// storage is sent, old and new value, to every open tab that listens for changes
const databaseName = 'anime-database';
const storeName = 'database';

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);

    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<Result>(
  mode: IDBTransactionMode,
  use: (store: IDBObjectStore) => IDBRequest,
) {
  const database = await openDatabase();

  try {
    return await new Promise<Result>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = use(transaction.objectStore(storeName));

      transaction.oncomplete = () => resolve(request.result as Result);
      // A failed request aborts its transaction; one the browser aborts (e.g. on shutdown) has no error
      transaction.onabort = () =>
        reject(
          transaction.error
            ?? new DOMException('The transaction was aborted', 'AbortError'),
        );
    });
  } finally {
    database.close();
  }
}

export const readDatabaseInfo = () =>
  withStore<DatabaseInfo | undefined>('readonly', (store) => store.get('info'));

export const readDatabaseIndex = () =>
  withStore<AnimeIndexData | undefined>('readonly', (store) =>
    store.get('index'),
  );

export const writeDatabaseInfo = (info: DatabaseInfo) =>
  withStore('readwrite', (store) => store.put(info, 'info'));

/**
 * Saves both in one transaction, so the info never describes an index that isn't stored.
 */
export const writeDatabase = (info: DatabaseInfo, index: AnimeIndexData) =>
  withStore('readwrite', (store) => {
    store.put(index, 'index');

    return store.put(info, 'info');
  });
