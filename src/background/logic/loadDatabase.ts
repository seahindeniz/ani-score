import type { FuzzyResult } from '@nozbe/microfuzz'
import type { SearchResult } from 'minisearch'
import type { AnimeData } from '~/logic'
import createFuzzySearch from '@nozbe/microfuzz'
import MiniSearch from 'minisearch'
import { useAnimeDatabaseSearchCacheStore, useAnimeDatabaseStore } from '~/logic'
import { logger } from '~/utils/logger'
import { wait } from '~/utils/wait'

const DATABASE_URL = 'https://github.com/manami-project/anime-offline-database/releases/download/latest/anime-offline-database-minified.json'
const metaURL = 'https://github.com/manami-project/anime-offline-database/releases/download/latest/animenewsnetwork-minified.json'
const animeDatabaseStore = useAnimeDatabaseStore()
const animeDatabaseSearchCacheStore = useAnimeDatabaseSearchCacheStore()

const deepSearch = new MiniSearch<AnimeData>({
  fields: ['title', 'synonyms'],
  storeFields: ['title', 'type', 'sources', 'synonyms'],
})

async function isDatabaseOutdated(retryCount = 0) {
  try {
    if (!animeDatabaseStore.data().lastUpdate) {
      logger.log('No previous database found.')

      return true
    }

    logger.log('Fetching metadata to check for updates...')

    const response = await fetch(metaURL)

    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`)
    }

    const meta = await response.json() as { lastUpdate: string }

    return new Date(meta.lastUpdate) > new Date(animeDatabaseStore.data().lastUpdate)
  }
  catch (error) {
    if (retryCount < 3) {
      logger.warn(`Retrying database update check... (${retryCount + 1}/3)`)
      await wait(1000)

      return isDatabaseOutdated(retryCount + 1)
    }

    logger.error('Error checking database update:', error)

    return false
  }
}

async function fetchDatabase() {
  const response = await fetch(DATABASE_URL)

  if (!response.ok) {
    throw new Error(`Failed to fetch database: ${response.status} ${response.statusText}`)
  }

  return await response.json() as {
    lastUpdate: string
    data: AnimeData[]
  }
}

function storeDatabase(data: Awaited<ReturnType<typeof fetchDatabase>>) {
  const startTime = performance.now()

  const filteredData = data.data.filter((item) => {
    return item.sources.some(source => source.includes('anilist.co') || source.includes('myanimelist.net'))
  })
    .map((item) => {
    // @ts-expect-error assign temporary id for search index
      item.id = crypto.randomUUID()
      return item
    })

  const newDatabase = {
    data: filteredData,
    lastUpdate: data.lastUpdate,
  }
  animeDatabaseStore.setData(newDatabase)
  setSearcher(newDatabase)
  logger.log(`Database stored. Time taken: ${((performance.now() - startTime) / 1000).toFixed(2)} s`)
}

const getBadgeText = async () => (await browser.action.getBadgeText({ tabId: undefined })).trim()

async function setSearcher(data: Awaited<ReturnType<typeof fetchDatabase>>) {
  deepSearch.addAll(data.data)

  if (!await getBadgeText()) {
    browser.action.setBadgeBackgroundColor({ color: '#00ff00' })
    setTimeout(() => {
      browser.action.setBadgeText({ text: '' })
    }, 2000)
  }
}

export async function loadDatabase() {
  const startTime = performance.now()

  try {
    if (!await getBadgeText()) {
      await browser.action.setBadgeText({ text: ' ' })
      await browser.action.setBadgeBackgroundColor({ color: '#ffd000ff' })
    }
    await animeDatabaseStore.dataReady

    if (await isDatabaseOutdated()) {
      logger.log('Database is outdated or not present. Fetching new data...')

      const data = await fetchDatabase()

      logger.log(`Database fetched, ${data.data.length} items. Time taken: ${((performance.now() - startTime) / 1000).toFixed(2)} s`)
      storeDatabase(data)

      return
    }

    logger.log('Database is up-to-date. Loading from storage...')
    setSearcher(animeDatabaseStore.data())
    logger.log(`Database loaded. Time taken: ${((performance.now() - startTime) / 1000).toFixed(2)} s`)
  }
  catch (error) {
    logger.error('Error loading database:', error)
  }
}

function mapResults(result: SearchResult) {
  return ({
    id: result.id as string,
    title: result.title as AnimeData['title'],
    type: result.type as AnimeData['type'],
    sources: result.sources as AnimeData['sources'],
    synonyms: result.synonyms as AnimeData['synonyms'],
  })
}

function sortSearchResults(a: FuzzyResult<ReturnType<typeof mapResults>>, b: FuzzyResult<ReturnType<typeof mapResults>>) {
  if (a.score === b.score) {
    return a.item.type === 'TV' ? -1 : 1
  }
  return a.score - b.score
}

export function searchAnimeByTitle(title: string) {
  const anime = animeDatabaseSearchCacheStore.data()[title]

  if (anime) {
    return anime
  }

  const narrowedDb = deepSearch.search(title).map(mapResults)

  if (!narrowedDb.length) {
    return undefined
  }

  if (narrowedDb.length === 1) {
    return narrowedDb[0]
  }

  const fuzzySearch = createFuzzySearch(narrowedDb, {
    getText: (item: typeof narrowedDb[number]) => [item.title, ...(item.synonyms ?? [])],
  })

  const [result] = fuzzySearch(title).toSorted(sortSearchResults) || []

  if (!result) {
    return undefined
  }

  animeDatabaseSearchCacheStore.setData({
    ...animeDatabaseSearchCacheStore.data(),
    [title]: result.item,
  })

  return result.item
}
