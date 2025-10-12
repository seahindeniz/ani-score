import { createPersistedStore } from './createPersistedStore'

export const useStorageComposable = createPersistedStore('webext-demo', 'Storage Demo')

export const useTokenStore = createPersistedStore('token', { anilist: '' })

export const useCacheStore = createPersistedStore('cache', {
  fetchDetails: true,
})

export const useSettingsStore = createPersistedStore('settings', {
  genreColor: {} as Record<string, string>,
  tagColor: {} as Record<string, string>,
}, { target: 'sync' })

interface AnimeSeason {
  season: 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER' | 'UNDEFINED'
  year: number | null
}

interface Duration {
  value: number
  unit: 'SECONDS'
}

interface Score {
  arithmeticGeometricMean: number
  arithmeticMean: number
  median: number
}

export interface AnimeData {
  /**
   * URLs to the pages of the meta data providers for this anime.
   */
  sources: string[]
  /**
   * Main title.
   */
  title: string
  /**
   * Distribution type.
   */
  type: 'TV' | 'MOVIE' | 'OVA' | 'ONA' | 'SPECIAL' | 'UNKNOWN'
  /**
   * Number of episodes, movies or parts.
   */
  episodes: number
  /**
   * Status of distribution.
   */
  status: 'FINISHED' | 'ONGOING' | 'UPCOMING' | 'UNKNOWN'
  /**
   * Data on when the anime was first distributed.
   */
  animeSeason: AnimeSeason
  /**
   * URL of a picture which represents the anime.
   */
  picture: string
  /**
   * URL of a smaller version of the picture.
   */
  thumbnail: string
  /**
   * Duration. Normally this is per episode.
   */
  duration: Duration | null
  /**
   * Score calculated using all available scores from meta data providers. Original scores are rescaled if necessary.
   */
  score: Score | null
  /**
   * Alternative titles and spellings under which the anime is also known. Duplicate free (case sensitive). Doesn't contain the `title`
   */
  synonyms: string[]
  /**
   * Lower case studio names. In general a duplicate free list, but might contain duplicates for different writings.
   */
  studios: string[]
  /**
   * Lower case producers names. Companies only. In general a duplicate free list, but might contain duplicates for different writings.
   */
  producers: string[]
  /**
   * URLs to the meta data providers for anime that are somehow related to this anime.
   */
  relatedAnime: string[]
  /**
   * A non-curated list of tags and genres which describe the anime. All entries are lower case.
   */
  tags: string[]
}

export const useAnimeDatabaseStore = createPersistedStore('animeDatabase', {
  lastUpdate: '',
  data: [] as AnimeData[],
})
