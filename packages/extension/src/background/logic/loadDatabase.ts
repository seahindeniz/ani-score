import type { FuzzyResult } from '@nozbe/microfuzz';
import microfuzz from '@nozbe/microfuzz';

import type { AnimeData, AnimeMatch } from '~/logic';
import { useAnimeDatabaseSearchCacheStore } from '~/logic';
import { logger } from '~/utils/logger';
import { wait } from '~/utils/wait';

import type { AnimeIndex } from './animeIndex';
import { buildAnimeIndex, readAnimeIndex } from './animeIndex';
import type { DatabaseInfo } from './databaseStorage';
import {
  readDatabaseIndex,
  readDatabaseInfo,
  removeDatabaseIndex,
  writeDatabase,
  writeDatabaseInfo,
} from './databaseStorage';

// microfuzz is CommonJS with its function on `exports.default`. Vite 8 follows Node and imports `module.exports`
// as the default, while Bun (unit tests) imports `exports.default`, so take the function from either shape.
const createFuzzySearch: typeof microfuzz =
  typeof microfuzz === 'function'
    ? microfuzz
    : (microfuzz as unknown as { default: typeof microfuzz }).default;

interface DatabaseSource {
  name: string;
  databaseURL: string;
  /**
   * Resolves the source's last update date as `YYYY-MM-DD`.
   */
  fetchLastUpdate: () => Promise<string>;
}

/**
 * Continuations of the archived manami-project/anime-offline-database, in order of preference.
 */
const databaseSources: DatabaseSource[] = [
  {
    name: 'cedya77/anime-offline-database',
    databaseURL:
      'https://github.com/cedya77/anime-offline-database/releases/download/latest/anime-offline-database-minified.json',
    // A small file from the same release, so the update check doesn't download the whole database
    fetchLastUpdate: async () =>
      (
        await fetchJSON<{ lastUpdate: string }>(
          'https://github.com/cedya77/anime-offline-database/releases/download/latest/animenewsnetwork-minified.json',
        )
      ).lastUpdate,
  },
  {
    name: 'athanasso/anime-offline-database',
    databaseURL:
      'https://github.com/athanasso/anime-offline-database/releases/latest/download/anime-offline-database-minified.json',
    // No small metadata file is published and its `lastUpdate` is a Unix timestamp, so the release date is used instead
    fetchLastUpdate: async () =>
      (
        await fetchJSON<{ published_at: string }>(
          'https://api.github.com/repos/athanasso/anime-offline-database/releases/latest',
        )
      ).published_at.slice(0, 10),
  },
];

/**
 * The sources publish weekly and each check is a request to GitHub, while the background restarts whenever it has been
 * idle for a while (30 seconds on Chrome), so it checks at most this often.
 */
const updateCheckInterval = 24 * 60 * 60 * 1000;

/**
 * How many of the entries the index finds are compared with the title. A common word like "no" makes it find
 * thousands, and comparing all of them took over 100 ms per title. The index ranks entries sharing the title's rarer
 * words first, and in 600 sample titles the closest entry was among the first 50.
 */
const maxCandidates = 50;

const animeDatabaseSearchCacheStore = useAnimeDatabaseSearchCacheStore();

/**
 * The running (or last) update: the check, and the download it starts. Searches wait for it only while no database is
 * stored, as on a first install.
 */
let update: Promise<unknown> = Promise.resolve();
/**
 * The running (or last) download. Searches wait for it, rather than read the index it's replacing.
 */
let download: Promise<unknown> = Promise.resolve();
/**
 * Read on the first search that misses the cache, so a restart that only meets cached titles never reads it.
 */
let animeIndex: Promise<AnimeIndex | undefined> | undefined;

const getBadgeText = async () =>
  (await browser.action.getBadgeText({ tabId: undefined })).trim();

class FetchError extends Error {
  constructor(
    url: string,
    readonly response: Response,
  ) {
    super(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
}

async function fetchJSON<T>(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new FetchError(url, response);
  }

  return (await response.json()) as T;
}

async function fetchLastUpdate(
  source: DatabaseSource,
  retryCount = 0,
): Promise<string> {
  let lastUpdate: string;

  try {
    logger.log(`Fetching metadata from ${source.name} to check for updates...`);

    lastUpdate = await source.fetchLastUpdate();
  } catch (error) {
    // 4xx responses (missing file, rate limit) won't recover by retrying
    const isClientError =
      error instanceof FetchError
      && error.response.status >= 400
      && error.response.status < 500;

    if (retryCount < 3 && !isClientError) {
      logger.warn(`Retrying database update check... (${retryCount + 1}/3)`);
      await wait(1000 * 2 ** retryCount);

      return fetchLastUpdate(source, retryCount + 1);
    }

    throw error;
  }

  // An unparsable date would make every comparison false and silently keep the stored database forever
  if (Number.isNaN(Date.parse(lastUpdate))) {
    throw new TypeError(
      `Invalid last update date from ${source.name}: ${lastUpdate}`,
    );
  }

  return lastUpdate;
}

function isDatabaseOutdated(
  info: DatabaseInfo,
  source: DatabaseSource,
  lastUpdate: string,
) {
  const currentSourceIndex = databaseSources.findIndex(
    ({ name }) => name === info.source,
  );

  // Replace data from an unknown source, or from a fallback once a preferred source answers again, regardless of dates.
  // A fallback answering for the stored source (e.g. a temporary outage) only replaces it when it has newer data.
  if (
    currentSourceIndex === -1
    || databaseSources.indexOf(source) < currentSourceIndex
  ) {
    logger.log(`Stored database comes from ${info.source}.`);

    return true;
  }

  return new Date(lastUpdate) > new Date(info.lastUpdate);
}

async function downloadDatabase(source: DatabaseSource, lastUpdate: string) {
  const startTime = performance.now();
  // Searches wait for the download, so the badge shows one is running; a badge that's already shown is left alone
  const showsProgress = !(await getBadgeText());

  if (showsProgress) {
    await browser.action.setBadgeText({ text: ' ' });
    await browser.action.setBadgeBackgroundColor({ color: '#ffd000ff' });
  }

  let built;

  try {
    const { data } = await fetchJSON<{ data: AnimeData[] }>(source.databaseURL);

    logger.log(
      `Database fetched, ${data.length} items. Time taken: ${((performance.now() - startTime) / 1000).toFixed(2)} s`,
    );
    built = buildAnimeIndex(data);
  } catch (error) {
    if (showsProgress) await browser.action.setBadgeText({ text: '' });

    throw error;
  }

  animeIndex = Promise.resolve(built.index);
  // The new database can hold a closer match, e.g. a season the old one lacked
  animeDatabaseSearchCacheStore.setData({});

  try {
    // The checked date is stored rather than the file's own `lastUpdate`, so the next check compares like with like
    await writeDatabase(
      { lastUpdate, source: source.name, checkedAt: Date.now() },
      built.stored,
    );
    logger.log(
      `Database stored. Time taken: ${((performance.now() - startTime) / 1000).toFixed(2)} s`,
    );
  } catch (error) {
    // Rather than download it again from the next source
    logger.error(
      'Could not store the database; it is kept until the background restarts:',
      error,
    );
  }

  if (showsProgress) {
    browser.action.setBadgeBackgroundColor({ color: '#00ff00' });
    setTimeout(() => {
      browser.action.setBadgeText({ text: '' });
    }, 2000);
  }
}

async function updateDatabase() {
  const info = await readDatabaseInfo().catch((error: unknown) => {
    // Downloaded all the same, and kept in memory if it can't be stored either
    logger.error('Error reading the stored database:', error);

    return undefined;
  });

  if (!info) {
    logger.log('No previous database found.');
    // Earlier versions kept the database in extension storage, which sent it to every open tab on each change
    void browser.storage.local.remove('animeDatabase');
  } else {
    const sinceCheck = Date.now() - info.checkedAt;

    // A check "in the future" means the clock was set back, so it doesn't count
    if (sinceCheck >= 0 && sinceCheck < updateCheckInterval) {
      logger.log('Checked for database updates recently.');

      return;
    }
  }

  // The first source that answers decides whether an update is needed; later sources are only tried when it fails
  for (const source of databaseSources) {
    try {
      const lastUpdate = await fetchLastUpdate(source);

      if (info && !isDatabaseOutdated(info, source, lastUpdate)) {
        logger.log('Database is up-to-date.');
        // Not storing the check only means asking again on the next start; the next source isn't asked
        await writeDatabaseInfo({ ...info, checkedAt: Date.now() }).catch(
          (error: unknown) =>
            logger.error('Error storing the update check:', error),
        );

        return;
      }

      logger.log(
        `Database is outdated or not present. Fetching new data from ${source.name}...`,
      );
      download = downloadDatabase(source, lastUpdate);
      await download;

      return;
    } catch (error) {
      logger.error(`Error updating database from ${source.name}:`, error);
    }
  }
}

/**
 * Checks for a newer database, at most once a day, and downloads it; the stored one is read by the first search. The
 * check starts once `after` settles, but a search made before then already waits for it when no database is stored.
 */
export function loadDatabase(after: Promise<unknown> = Promise.resolve()) {
  update = after.then(updateDatabase);

  return update;
}

async function readStoredIndex() {
  const startTime = performance.now();
  let data;

  try {
    data = await readDatabaseIndex();
  } catch (error) {
    logger.error('Error loading database:', error);

    return undefined;
  }

  if (!data) return undefined;

  try {
    const index = readAnimeIndex(data);

    logger.log(
      `Database loaded. Time taken: ${((performance.now() - startTime) / 1000).toFixed(2)} s`,
    );

    return index;
  } catch (error) {
    logger.error('The stored database is unreadable:', error);
    void removeDatabaseIndex();

    return undefined;
  }
}

async function readIndex() {
  const reading = (animeIndex ??= readStoredIndex());
  const index = await reading;

  // The next search reads again, unless a download has replaced it meanwhile
  if (!index && animeIndex === reading) animeIndex = undefined;

  return index;
}

async function getAnimeIndex() {
  await Promise.allSettled([download]);

  const index = await readIndex();

  if (index) return index;

  // None stored, as on a first install: the running update may download one
  await Promise.allSettled([update]);

  return readIndex();
}

function sortSearchResults(
  a: FuzzyResult<AnimeMatch>,
  b: FuzzyResult<AnimeMatch>,
) {
  if (a.score === b.score) {
    return a.item.type === 'TV' ? -1 : 1;
  }

  return a.score - b.score;
}

export async function searchAnimeByTitle(title: string) {
  // Until the cache has loaded, every title would look new, and the first match stored would replace the others
  await animeDatabaseSearchCacheStore.dataReady;

  const anime = animeDatabaseSearchCacheStore.data()[title];

  if (anime) {
    return anime;
  }

  const narrowedDb =
    (await getAnimeIndex())?.search(title, maxCandidates) ?? [];

  if (!narrowedDb.length) {
    return undefined;
  }

  if (narrowedDb.length === 1) {
    return narrowedDb[0];
  }

  const fuzzySearch = createFuzzySearch(narrowedDb, {
    getText: (item: AnimeMatch) => [item.title, ...(item.synonyms ?? [])],
  });

  const [result] = fuzzySearch(title).toSorted(sortSearchResults) || [];

  if (!result) {
    return undefined;
  }

  animeDatabaseSearchCacheStore.setData({
    ...animeDatabaseSearchCacheStore.data(),
    [title]: result.item,
  });

  return result.item;
}
