import type { AnimeIndexData } from './animeIndex';
import { animeIndexFormat } from './animeIndex';

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

/**
 * Runs `use` in a transaction, and resolves with what the function it returns gives once the transaction completes.
 */
async function withStore<Result>(
  mode: IDBTransactionMode,
  use: (store: IDBObjectStore) => () => Result,
) {
  const database = await openDatabase();

  try {
    return await new Promise<Result>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const result = use(transaction.objectStore(storeName));

      transaction.oncomplete = () => resolve(result());
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

const noResult = () => undefined;

/**
 * The info as stored, with the version of the index it describes.
 */
interface StoredInfo extends DatabaseInfo {
  format: number;
}

const toStored = (info: DatabaseInfo): StoredInfo => ({
  ...info,
  format: animeIndexFormat,
});

/**
 * The info of the stored database, unless its index is missing or of another version; then nothing counts as stored,
 * so it's downloaded again.
 */
export const readDatabaseInfo = () =>
  withStore('readonly', (store) => {
    const info = store.get('info');
    const index = store.getKey('index');

    return (): DatabaseInfo | undefined => {
      const stored = info.result as StoredInfo | undefined;

      if (index.result === undefined || stored?.format !== animeIndexFormat) {
        return undefined;
      }

      const { lastUpdate, source, checkedAt } = stored;

      return { lastUpdate, source, checkedAt };
    };
  });

export const readDatabaseIndex = () =>
  withStore('readonly', (store) => {
    const index = store.get('index');

    return () => index.result as AnimeIndexData | undefined;
  });

export const writeDatabaseInfo = (info: DatabaseInfo) =>
  withStore('readwrite', (store) => {
    store.put(toStored(info), 'info');

    return noResult;
  });

/**
 * Saves both in one transaction, so the info never describes an index that isn't stored.
 */
export const writeDatabase = (info: DatabaseInfo, index: AnimeIndexData) =>
  withStore('readwrite', (store) => {
    store.put(index, 'index');
    store.put(toStored(info), 'info');

    return noResult;
  });

/**
 * Drops an index that can't be read, so the next update check downloads the database again.
 */
export const removeDatabaseIndex = () =>
  withStore('readwrite', (store) => {
    store.delete('index');

    return noResult;
  });
