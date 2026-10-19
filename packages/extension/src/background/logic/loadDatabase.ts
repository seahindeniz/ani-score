import type { FuzzyResult } from '@nozbe/microfuzz';
import microfuzz from '@nozbe/microfuzz';

import type { AnimeMatch } from '~/logic';
import { useAnimeDatabaseSearchCacheStore } from '~/logic';
import { logger } from '~/utils/logger';

import type { AnimeIndex } from './animeIndex';
import { readAnimeIndex } from './animeIndex';
import type { DatabaseRelease } from './databaseSources';
import {
  fetchRelease,
  prebuiltSource,
  upstreamSources,
} from './databaseSources';
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

/**
 * Where releases are asked for, in order: the prebuilt index, then the upstream sources it's built from.
 */
const databaseSources = [prebuiltSource, ...upstreamSources];

const upstreamRank = (name: string) =>
  upstreamSources.findIndex((source) => source.name === name);

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
 * Extension storage key for when a downloaded database last couldn't be stored. With no stored check to go by, each
 * restart would download it again.
 */
const unstoredDownloadKey = 'animeDatabaseUnstoredAt';
/**
 * How long to wait before downloading a database again that couldn't be stored; meanwhile titles are searched on
 * AniList by name.
 */
const unstoredRetryInterval = 60 * 60 * 1000;

/**
 * The running (or last) update: the check, and the download it starts. Searches wait for it only while no database is
 * stored, as on a first install.
 */
let update: Promise<unknown> = Promise.resolve();
/**
 * Read on the first search that misses the cache, so a restart that only meets cached titles never reads it.
 */
let animeIndex: Promise<AnimeIndex | undefined> | undefined;
/**
 * Counts the downloads that replaced the index, to tell whether one did while a search or a recovery was under way.
 */
let indexVersion = 0;

const logFailure = (message: string) => (error: unknown) => {
  logger.error(message, error);
};

// A time "in the future" means the clock was set back, so it doesn't count
function isRecent(time: number, interval: number) {
  const since = Date.now() - time;

  return since >= 0 && since < interval;
}

const getBadgeText = async () =>
  (await browser.action.getBadgeText({ tabId: undefined })).trim();

function isDatabaseOutdated(info: DatabaseInfo, release: DatabaseRelease) {
  const currentSourceIndex = upstreamRank(info.source);

  // Replace data from an unknown source, or from a fallback once a preferred source answers again, regardless of dates.
  // A fallback answering for the stored source (e.g. a temporary outage) only replaces it when it has newer data.
  if (
    currentSourceIndex === -1
    || upstreamRank(release.source) < currentSourceIndex
  ) {
    logger.log(`Stored database comes from ${info.source}.`);

    return true;
  }

  return new Date(release.lastUpdate) > new Date(info.lastUpdate);
}

async function downloadDatabase(release: DatabaseRelease) {
  const startTime = performance.now();
  // A first install's searches wait for the download, so the badge shows one is running; a badge that's already shown
  // is left alone
  const showsProgress = !(await getBadgeText());
  // The loading badge has no text, so a badge with text was set meanwhile, e.g. to ask for signing in again
  const showsOwnBadge = async () => showsProgress && !(await getBadgeText());

  if (showsProgress) {
    await browser.action.setBadgeText({ text: ' ' });
    await browser.action.setBadgeBackgroundColor({ color: '#ffd000ff' });
  }

  let built;

  try {
    built = await release.download();
    logger.log(
      `Database downloaded. Time taken: ${((performance.now() - startTime) / 1000).toFixed(2)} s`,
    );
  } catch (error) {
    if (await showsOwnBadge()) await browser.action.setBadgeText({ text: '' });

    throw error;
  }

  animeIndex = Promise.resolve(built.index);
  indexVersion++;
  // The new database can hold a closer match, e.g. a season the old one lacked
  animeDatabaseSearchCacheStore.setData({});

  try {
    // The checked date is stored rather than the file's own `lastUpdate`, so the next check compares like with like
    await writeDatabase(
      {
        lastUpdate: release.lastUpdate,
        source: release.source,
        checkedAt: Date.now(),
      },
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
    await browser.storage.local
      .set({ [unstoredDownloadKey]: Date.now() })
      .catch(logFailure('Error noting the unstored database:'));
  }

  if (await showsOwnBadge()) {
    browser.action.setBadgeBackgroundColor({ color: '#00ff00' });
    setTimeout(async () => {
      if (await showsOwnBadge()) browser.action.setBadgeText({ text: '' });
    }, 2000);
  }
}

async function downloadedUnstoredRecently() {
  const unstoredAt = (
    await browser.storage.local
      .get(unstoredDownloadKey)
      .catch(logFailure('Error reading extension storage:'))
  )?.[unstoredDownloadKey];

  return (
    typeof unstoredAt === 'number'
    && isRecent(unstoredAt, unstoredRetryInterval)
  );
}

async function updateDatabase() {
  const info = await readDatabaseInfo().catch(
    // Downloaded all the same, and kept in memory if it can't be stored either
    logFailure('Error reading the stored database:'),
  );

  if (!info) {
    logger.log('No previous database found.');
    // Earlier versions kept the database in extension storage, which sent it to every open tab on each change
    void browser.storage.local
      .remove('animeDatabase')
      .catch(logFailure('Error removing the old database:'));
  }

  // Whether nothing is stored or an older database is: its replacement would fail to be stored again
  if (await downloadedUnstoredRecently()) {
    logger.log("Recently downloaded a database that couldn't be stored.");

    return;
  }

  if (info && isRecent(info.checkedAt, updateCheckInterval)) {
    logger.log('Checked for database updates recently.');

    return;
  }

  // The first source that answers decides whether an update is needed; later sources are only tried when it fails
  for (const source of databaseSources) {
    try {
      logger.log(
        `Fetching metadata from ${source.name} to check for updates...`,
      );

      const release = await fetchRelease(source, (attempt, retries) =>
        logger.warn(
          `Retrying database update check... (${attempt}/${retries})`,
        ),
      );

      if (info && !isDatabaseOutdated(info, release)) {
        logger.log('Database is up-to-date.');
        // Not storing the check only means asking again on the next start; the next source isn't asked
        await writeDatabaseInfo({ ...info, checkedAt: Date.now() }).catch(
          logFailure('Error storing the update check:'),
        );

        return;
      }

      logger.log(
        `Database is outdated or not present. Fetching new data from ${source.name}...`,
      );
      await downloadDatabase(release);

      return;
    } catch (error) {
      logger.error(`Error updating database from ${source.name}:`, error);
    }
  }
}

/**
 * Checks for a newer database, at most once a day, and downloads it; the stored one is read by the first search. The
 * check starts once `after` settles, whether it succeeds or not, but a search made before then already waits for it
 * when no database is stored.
 */
export function loadDatabase(after: Promise<unknown> = Promise.resolve()) {
  update = Promise.allSettled([after]).then(updateDatabase);

  return update;
}

async function readStoredIndex() {
  const startTime = performance.now();
  const version = indexVersion;
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
    logger.error(
      'The stored database is unreadable; downloading it again:',
      error,
    );
    // After the update that may be running, unless that one replaced it. Without its index nothing counts as stored, so
    // the update downloads it, and searches wait for it.
    update = Promise.allSettled([update]).then(async () => {
      if (indexVersion !== version) return;

      await removeDatabaseIndex().catch(
        logFailure('Error removing the unreadable database:'),
      );
      await updateDatabase();
    });

    return undefined;
  }
}

/**
 * The index to search, and whether it's still the current one: a download can replace it while a search runs.
 */
async function readIndex() {
  const version = indexVersion;
  const reading = (animeIndex ??= readStoredIndex());
  const index = await reading;

  // The next search reads again, unless a download has replaced it meanwhile
  if (!index && animeIndex === reading) animeIndex = undefined;

  return { index, isCurrent: () => indexVersion === version };
}

/**
 * The stored index, or the one a download replaced it with. A download running meanwhile doesn't hold searches up:
 * they use the index it replaces, and don't cache what they find there. Only when nothing is stored, as on a first
 * install, do they wait for the update.
 */
async function getAnimeIndex() {
  const read = await readIndex();

  if (read.index) return read;

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

  const { index, isCurrent } = await getAnimeIndex();
  const narrowedDb = index?.search(title, maxCandidates) ?? [];

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

  // A download that replaced the index meanwhile cleared the cache for matches from the new one
  if (isCurrent()) {
    animeDatabaseSearchCacheStore.setData({
      ...animeDatabaseSearchCacheStore.data(),
      [title]: result.item,
    });
  }

  return result.item;
}
