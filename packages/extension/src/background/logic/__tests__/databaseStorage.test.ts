import { afterEach, describe, expect, spyOn, test } from 'bun:test';

import { buildAnimeIndex } from '../animeIndex';
import {
  readDatabaseIndex,
  readDatabaseInfo,
  removeDatabaseIndex,
  writeDatabase,
  writeDatabaseInfo,
} from '../databaseStorage';

const info = {
  lastUpdate: '2026-10-01',
  source: 'cedya77/anime-offline-database',
  checkedAt: 1000,
};

let putSpy: ReturnType<typeof spyOn> | undefined;

afterEach(() => {
  putSpy?.mockRestore();
  putSpy = undefined;
});

describe('database storage', () => {
  test('starts out empty', async () => {
    expect(await readDatabaseInfo()).toBeUndefined();
    expect(await readDatabaseIndex()).toBeUndefined();
  });

  test('reads back the database and its info', async () => {
    const index = buildAnimeIndex([
      {
        title: 'Sousou no Frieren',
        type: 'TV',
        sources: ['https://anilist.co/anime/154587'],
        synonyms: [],
      } as never,
    ]).stored;

    await writeDatabase(info, index);

    expect(await readDatabaseInfo()).toEqual(info);
    expect(await readDatabaseIndex()).toEqual(index);

    await writeDatabaseInfo({ ...info, checkedAt: 2000 });

    expect(await readDatabaseInfo()).toEqual({ ...info, checkedAt: 2000 });
  });

  test('counts a database stored in another format as nothing stored', async () => {
    await writeDatabase(info, buildAnimeIndex([]).stored);

    // As an earlier (or later) version of the extension stored it
    await new Promise((resolve) => {
      indexedDB.open('anime-database', 1).onsuccess = function () {
        const transaction = this.result.transaction('database', 'readwrite');

        transaction.objectStore('database').put({ ...info, format: 0 }, 'info');
        transaction.oncomplete = () => {
          this.result.close();
          resolve(undefined);
        };
      };
    });

    expect(await readDatabaseInfo()).toBeUndefined();
  });

  test('counts info without its index as nothing stored', async () => {
    await writeDatabase(info, buildAnimeIndex([]).stored);
    await removeDatabaseIndex();

    expect(await readDatabaseIndex()).toBeUndefined();
    expect(await readDatabaseInfo()).toBeUndefined();

    await writeDatabaseInfo(info);

    expect(await readDatabaseInfo()).toBeUndefined();
  });

  test("fails when the database can't be opened", async () => {
    // A newer version of the database, which can't be opened as the older one
    await new Promise((resolve) => {
      indexedDB.open('anime-database', 2).onsuccess = function () {
        this.result.close();
        resolve(undefined);
      };
    });

    await expect(readDatabaseInfo()).rejects.toThrow();
  });

  test('fails when the browser aborts a write', async () => {
    const put = IDBObjectStore.prototype.put;

    putSpy = spyOn(IDBObjectStore.prototype, 'put').mockImplementation(
      function (
        this: IDBObjectStore,
        ...args: Parameters<IDBObjectStore['put']>
      ) {
        const request = put.apply(this, args);

        this.transaction.abort();

        return request;
      },
    );

    await expect(writeDatabaseInfo(info)).rejects.toThrow('aborted');
    expect(await readDatabaseInfo()).toBeUndefined();
  });
});
