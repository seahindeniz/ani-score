import type { FuzzyResult } from '@nozbe/microfuzz';
import createFuzzySearch from '@nozbe/microfuzz';
import type { Options, SearchResult } from 'minisearch';
import MiniSearch from 'minisearch';

import type { AnimeData } from '~/logic';
import {
  useAnimeDatabaseSearchCacheStore,
  useAnimeDatabaseStore,
} from '~/logic';
import { logger } from '~/utils/logger';
import { wait } from '~/utils/wait';

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

const animeDatabaseStore = useAnimeDatabaseStore();
const animeDatabaseSearchCacheStore = useAnimeDatabaseSearchCacheStore();

let deepSearch: MiniSearch<AnimeData>;

const getBadgeText = async () =>
  (await browser.action.getBadgeText({ tabId: undefined })).trim();

async function setDeepSearchInstance(
  props:
    | { data: AnimeData[]; lastUpdate: string; source: string }
    | { index: string },
) {
  const options = {
    fields: ['title', 'synonyms'],
    storeFields: ['title', 'type', 'sources', 'synonyms'],
  } as Options<AnimeData>;

  deepSearch = new MiniSearch<AnimeData>(options);

  if ('data' in props) {
    await deepSearch.addAllAsync(props.data);
    animeDatabaseStore.setData({
      lastUpdate: props.lastUpdate,
      source: props.source,
      data: JSON.stringify(deepSearch),
    });
    // Cached matches point at entries of the replaced database
    animeDatabaseSearchCacheStore.setData({});
  } else {
    deepSearch = await MiniSearch.loadJSONAsync<AnimeData>(
      props.index,
      options,
    );
  }

  if (!(await getBadgeText())) {
    browser.action.setBadgeBackgroundColor({ color: '#00ff00' });
    setTimeout(() => {
      browser.action.setBadgeText({ text: '' });
    }, 2000);
  }
}

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

function isDatabaseOutdated(source: DatabaseSource, lastUpdate: string) {
  const { lastUpdate: currentLastUpdate, source: currentSource } =
    animeDatabaseStore.data();

  if (!currentLastUpdate) {
    logger.log('No previous database found.');

    return true;
  }

  const currentSourceIndex = databaseSources.findIndex(
    ({ name }) => name === currentSource,
  );

  // Replace data from an unknown source, or from a fallback once a preferred source answers again, regardless of dates.
  // A fallback answering for the stored source (e.g. a temporary outage) only replaces it when it has newer data.
  if (
    currentSourceIndex === -1
    || databaseSources.indexOf(source) < currentSourceIndex
  ) {
    logger.log(
      `Stored database comes from ${currentSource || 'an unknown source'}.`,
    );

    return true;
  }

  return new Date(lastUpdate) > new Date(currentLastUpdate);
}

async function storeDatabase(data: {
  data: AnimeData[];
  lastUpdate: string;
  source: string;
}) {
  const startTime = performance.now();

  const filteredData = data.data
    .filter((item) =>
      item.sources.some(
        (source) =>
          source.includes('anilist.co') || source.includes('myanimelist.net'),
      ),
    )
    .map((item) => ({ ...item, id: crypto.randomUUID() }));

  const newDatabase = {
    data: filteredData,
    lastUpdate: data.lastUpdate,
    source: data.source,
  };

  await setDeepSearchInstance(newDatabase);
  logger.log(
    `Database stored. Time taken: ${((performance.now() - startTime) / 1000).toFixed(2)} s`,
  );
}

export async function loadDatabase() {
  const startTime = performance.now();

  try {
    if (!(await getBadgeText())) {
      await browser.action.setBadgeText({ text: ' ' });
      await browser.action.setBadgeBackgroundColor({ color: '#ffd000ff' });
    }

    await animeDatabaseStore.dataReady;

    // The first source that answers decides whether an update is needed; later sources are only tried when it fails
    for (const source of databaseSources) {
      try {
        const lastUpdate = await fetchLastUpdate(source);

        if (!isDatabaseOutdated(source, lastUpdate)) {
          logger.log('Database is up-to-date.');
          break;
        }

        logger.log(
          `Database is outdated or not present. Fetching new data from ${source.name}...`,
        );

        const { data } = await fetchJSON<{ data: AnimeData[] }>(
          source.databaseURL,
        );

        logger.log(
          `Database fetched, ${data.length} items. Time taken: ${((performance.now() - startTime) / 1000).toFixed(2)} s`,
        );
        // The checked date is stored rather than the file's own `lastUpdate`, so the next check compares like with like
        await storeDatabase({ data, lastUpdate, source: source.name });

        return;
      } catch (error) {
        logger.error(`Error updating database from ${source.name}:`, error);
      }
    }

    logger.log('Loading database from storage...');
    await setDeepSearchInstance({ index: animeDatabaseStore.data().data });
    logger.log(
      `Database loaded. Time taken: ${((performance.now() - startTime) / 1000).toFixed(2)} s`,
    );
  } catch (error) {
    logger.error('Error loading database:', error);
  }
}

function mapResults(result: SearchResult) {
  return {
    id: result.id as string,
    title: result.title as AnimeData['title'],
    type: result.type as AnimeData['type'],
    sources: result.sources as AnimeData['sources'],
    synonyms: result.synonyms as AnimeData['synonyms'],
  };
}

function sortSearchResults(
  a: FuzzyResult<ReturnType<typeof mapResults>>,
  b: FuzzyResult<ReturnType<typeof mapResults>>,
) {
  if (a.score === b.score) {
    return a.item.type === 'TV' ? -1 : 1;
  }

  return a.score - b.score;
}

export function searchAnimeByTitle(title: string) {
  const anime = animeDatabaseSearchCacheStore.data()[title];

  if (anime) {
    return anime;
  }

  const narrowedDb = deepSearch.search(title).map(mapResults);

  if (!narrowedDb.length) {
    return undefined;
  }

  if (narrowedDb.length === 1) {
    return narrowedDb[0];
  }

  const fuzzySearch = createFuzzySearch(narrowedDb, {
    getText: (item: (typeof narrowedDb)[number]) => [
      item.title,
      ...(item.synonyms ?? []),
    ],
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
