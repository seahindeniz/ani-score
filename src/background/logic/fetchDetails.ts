import type { EpisodeCard } from '~/contentScripts/site/base'
import type { Media } from '~/gql/graphql'
import { useCacheStore, useTokenStore } from '~/logic'
import { logger } from '~/utils/logger'
import { anilistClient } from '../client/anilist'
import { searchAnimeByTitle } from './loadDatabase'

interface Props {
  cards: Pick<EpisodeCard, 'title' | 'episodeNumber'>[]
}

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
  mediaListEntry: [
    'progress',
    'score',
    'status',
  ],
  nextAiringEpisode: [
    'episode',
  ],
  title: [
    'english',
    'romaji',
  ],
  tags: [
    'name',
    'rank',
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

function createAlias(title: string): string {
  const cleanTitle = title
    .replace(/[^a-z0-9\s]/gi, '')
    .replace(/\s+/g, '_')
    .toLowerCase()

  return cleanTitle
}

function escapeGraphQLString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function generateBatchQuery(animeList: ReturnType<typeof findAnimeListInDatabase>): string {
  const queries = animeList.map(({ title, anilist, mal }) => {
    const alias = createAlias(title)
    let sourceFilter = ''

    if (anilist) {
      sourceFilter += `id: ${anilist}`
    }
    else
      if (mal) {
        sourceFilter += `idMal: ${mal}`
      }

    if (!sourceFilter) {
      sourceFilter = `search: "${escapeGraphQLString(title).trim()}"`
    }

    return `${alias}: Page (perPage: 1) {
      results: media(type: ANIME, ${sourceFilter}) {
        ${mediaFields}
      }
    }`
  }).join('\n    ')

  return `
    query BatchAnimeSearch {
      ${queries}
    }  
  `
}

function removeAllBeforeSlash(url: string): string {
  return url.replace(/.*\//, '')
}

function findSourceInDatabase(title: string) {
  return (searchAnimeByTitle(title).sources as string[]).reduce((map, item) => {
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
  return titles.map(title => ({ title, ...findSourceInDatabase(title) }))
}

export async function fetchDetails(props: Props) {
  const uniqueTitles = [...new Set(props.cards.map(card => card.title))]

  if (uniqueTitles.length === 0) {
    return undefined
  }

  logger.log('Fetching details for titles:', uniqueTitles)

  try {
    const cacheStore = useCacheStore()
    const dbResult = findAnimeListInDatabase(uniqueTitles)
    const query = generateBatchQuery(dbResult)
    const result = await anilistClient.query<Record<string, {
      pageInfo: { hasNextPage: boolean }
      results: AnimeDetails[]
    } | null>>(
      query,
      {},
      { requestPolicy: cacheStore.data().fetchDetails ? 'cache-first' : 'network-only' },

    ).toPromise()

    if (!cacheStore.data().fetchDetails) {
      cacheStore.setData({ fetchDetails: true })
    }

    if (result.error) {
      logger.error('GraphQL query error:', result.error)

      if (result.error.message.includes('Invalid token')) {
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

    if (!result.data) {
      return undefined
    }

    const animeDetails: {
      anime: Record<string, AnimeDetails | null>
    } = {
      anime: {},
    }

    uniqueTitles.forEach((title) => {
      const alias = createAlias(title)
      const animeData = result.data?.[alias]

      animeDetails.anime[title] = animeData?.results[0] || null
    })

    return animeDetails
  }
  catch (error) {
    logger.error('Error fetching anime details:', error)

    return undefined
  }
}
