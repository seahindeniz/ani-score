import type { AnimeData } from '~/logic'
import MiniSearch from 'minisearch'
import { animeDatabaseStore } from '~/logic'
import { logger } from '~/utils/logger'

const DATABASE_URL = 'https://github.com/manami-project/anime-offline-database/releases/download/latest/anime-offline-database-minified.json'
const metaURL = 'https://github.com/manami-project/anime-offline-database/releases/download/latest/animenewsnetwork-minified.json'

const miniSearch = new MiniSearch<AnimeData>({
  fields: ['title', 'synonyms'],
  storeFields: ['title', 'type', 'sources'],
})

async function isDatabaseOutdated() {
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
    // @ts-expect-error assign temporary id for search index
    item.id = crypto.randomUUID()

    return item.sources.some(source => source.includes('anilist.co') || source.includes('myanimelist.net'))
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
  miniSearch.addAll(data.data)

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

    setSearcher(animeDatabaseStore.data())
    logger.log(`Database loaded from storage. Time taken: ${((performance.now() - startTime) / 1000).toFixed(2)} s`)
  }
  catch (error) {
    logger.error('Error loading database:', error)
  }
}

export function searchAnimeByTitle(title: string) {
  return miniSearch.search(title)[0]
}
