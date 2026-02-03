import type { setTheme } from '~/logic/setTheme'

export interface Meta {
  urlPatterns: `*://${string}`[]
}

export interface EpisodeCard {
  element: HTMLElement
  title: string
  episodeNumber: number
}

export interface ListingPage {
  isValidPage: () => boolean
  episodeCards: () => EpisodeCard[]
  reInit?: (next: () => void) => void
  /**
   * Element within the episode card to apply "watching" state styles to.
   */
  getShimmeringElement?: (card: EpisodeCard) => HTMLElement | null
}

export interface SiteBaseConfig {
  listingPages: ListingPage[]
  /**
   * Normally, AniScore adapts to the system theme by default.
   * You can override this behavior by specifying a theme here.
   *
   * @default 'system'
   */
  theme?: Parameters<typeof setTheme>[1]
}

export interface InternalSiteBaseConfig extends SiteBaseConfig {
  scope: string
}
