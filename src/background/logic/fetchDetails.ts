import type { EpisodeCard } from '~/contentScripts/site/base'
import type { Media } from '~/gql/graphql'
import { useCacheStore, useTokenStore } from '~/logic'
import { logger } from '~/utils/logger'
import { wait } from '~/utils/wait'
import { anilistClient } from '../client/anilist'
import { searchAnimeByTitle } from './loadDatabase'

interface Props {
  cards: Pick<EpisodeCard, 'title' | 'episodeNumber'>[]
}

const maxAnimePerQuery = 14
const maxAliasCharacters = 70
const fields = [
  'id',
  'episodes',
  'favourites',
  'popularity',
  'genres',
  'isFavourite',
  'description',
] as const satisfies (keyof Media)[]

const fieldGroups = {
  title: [
    'romaji',
  ],
  mediaListEntry: [
    'progress',
  ],
  nextAiringEpisode: [
    'episode',
  ],
  tags: [
    'name',
    'rank',
  ],
  startDate: [
    'day',
    'month',
    'year',
  ],
} as const satisfies {
  [key in keyof Media]?: (NonNullable<Media[key]> extends (infer ArrayItem)[] ? (keyof NonNullable<ArrayItem>)[] : (keyof NonNullable<Media[key]>)[])
}

export type AnimeDetails = Pick<Media, (typeof fields)[number]> & {
  [Key in keyof typeof fieldGroups]?: NonNullable<Media[Key]> extends (infer ArrayItem)[] ? (
    (Pick<
      NonNullable<ArrayItem>,
      (typeof fieldGroups[Key][number]) extends keyof NonNullable<ArrayItem> ? (typeof fieldGroups[Key][number]) : never
    >)[]
  ) : (
    Pick<
      NonNullable<Media[Key]>,
      (typeof fieldGroups[Key][number]) extends keyof NonNullable<Media[Key]> ? (typeof fieldGroups[Key][number]) : never
    >
) | null
}

const mediaFields = `${fields.join('\n  ')}\n${Object.entries(fieldGroups).map(([groupName, groupFields]) => {
  return `${groupName} {\n    ${groupFields.join('\n    ')}\n  }`
}).join('\n  ')}`

function createAlias(title: string, index: number): string {
  const cleanTitle = title
    .slice(0, maxAliasCharacters)
    .replace(/[^a-z0-9\s]/gi, '')
    .replace(/\s+/g, '_')
    .toLowerCase()

  return `a_${index + 1}_${cleanTitle}`
}

function escapeGraphQLString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function generateBatchQuery(animeList: ReturnType<typeof findAnimeListInDatabase>): string[] {
  let currentChunk: string[] = []
  let chunkIndex = 0
  const chunkLimit = Math.min(Math.ceil(animeList.length / 2), maxAnimePerQuery)

  return animeList.reduce((acc, { title, anilist, mal }, index) => {
    const alias = createAlias(title, index)
    let sourceFilter = ''

    if (anilist) {
      sourceFilter += `id: ${anilist}`
    }
    else if (mal) {
      sourceFilter += `idMal: ${mal}`
    }

    if (!sourceFilter) {
      sourceFilter = `search: "${escapeGraphQLString(title).trim()}"`
    }

    const queryPart = `${alias}: Page (perPage: 1) {
      results: media(type: ANIME, ${sourceFilter}) {
        ${mediaFields}
      }
    }`

    currentChunk.push(queryPart)

    if (currentChunk.length === chunkLimit || index === animeList.length - 1) {
      const query = `
        query BatchAnimeSearch${chunkIndex > 0 ? `_${chunkIndex}` : ''} {
          ${currentChunk.join('\n    ')}
        }
      `
      acc.push(query)
      currentChunk = []
      chunkIndex++
    }

    return acc
  }, [] as string[])
}

function removeAllBeforeSlash(url: string): string {
  return url.replace(/.*\//, '')
}

function findSourceInDatabase(title: string) {
  const anime = searchAnimeByTitle(title)

  if (!anime) {
    return undefined
  }

  return anime.sources?.sort(
    (a, b) => (Number.parseInt(removeAllBeforeSlash(a)) - Number.parseInt(removeAllBeforeSlash(b))),
  ).reduce((map, item) => {
    if (item.includes('anilist.co')) {
      map.anilist = removeAllBeforeSlash(item)
    }

    if (item.includes('myanimelist.net')) {
      map.mal = removeAllBeforeSlash(item)
    }

    return map
  }, {} as { anilist?: string, mal?: string })
}

function findAnimeListInDatabase(titles: string[]) {
  return titles.map((title) => {
    const sources = findSourceInDatabase(title)

    return ({ title, ...sources })
  })
}

type FetchResult = Record<string, {
  pageInfo: { hasNextPage: boolean }
  results: AnimeDetails[]
} | null>

export async function fetchDetails(props: Props) {
  const uniqueTitles = [...new Set(props.cards.map(card => card.title))]

  if (uniqueTitles.length === 0) {
    return undefined
  }

  logger.log('Fetching details for titles:', uniqueTitles)

  try {
    const cacheStore = useCacheStore()
    const dbResult = findAnimeListInDatabase(uniqueTitles)
    const queries = generateBatchQuery(dbResult)
    const queryPromises = []

    for (const query of queries) {
      queryPromises.push(
        anilistClient.query<FetchResult>(query, {}, {
          requestPolicy: cacheStore.data().fetchDetails ? 'cache-first' : 'network-only',
        }).toPromise(),
      )

      await wait(150)
    }

    const results = await Promise.allSettled(queryPromises)

    if (!cacheStore.data().fetchDetails) {
      cacheStore.setData({ fetchDetails: true })
    }

    for (const result of results) {
      if (result.status === 'rejected' && result.reason.error) {
        logger.error('GraphQL query error:', result.reason.error)

        if (result.reason?.error?.message?.includes('Invalid token')) {
          const tokenStore = useTokenStore()

          tokenStore.setData({ ...tokenStore.data(), anilist: '' })

          browser.notifications.create('open-side-panel', {
            type: 'basic',
            iconUrl: browser.runtime.getURL('assets/icon-512.png'),
            title: 'AniScore',
            message: 'Anilist token is invalid. Please click on the AniScore extension icon and re-authenticate.',
            priority: 2,
          })
        }

        return undefined
      }
    }

    const mergedData = results.reduce(
      (map, result) => {
        if (result.status === 'fulfilled' && result.value.data) {
          Object.assign(map, result.value.data)
        }

        return map
      },
      {} as Record<string, {
        pageInfo: { hasNextPage: boolean }
        results: AnimeDetails[]
      } | null>,
    )

    return uniqueTitles.reduce((map, title, index) => {
      const alias = createAlias(title, index)
      const animeData = mergedData[alias]

      map[title] = animeData?.results[0] || null

      return map
    }, {} as Record<string, AnimeDetails | null>)
  }
  catch (error) {
    logger.error('Error fetching anime details:', error)

    return undefined
  }
}
