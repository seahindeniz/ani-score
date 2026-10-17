import type { ResolvedTheme, Theme } from '~/logic/setTheme'

export interface Meta {
  urlPatterns: `*://${string}`[]
}

export interface EpisodeCard {
  element: HTMLElement
  render: (container: HTMLDivElement) => void
  title: string
  episodeNumber: number
}

export interface ListingPage {
  isValidPage: () => boolean
  episodeCards: () => (EpisodeCard | undefined | null)[]
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
   * To follow the site's own theme, pass a function instead. It's called once per page, and should call `set` with the
   * current theme, then again whenever the site switches theme.
   *
   * @default 'system'
   */
  theme?: Theme | ((set: (theme: ResolvedTheme) => void) => void)
}

export interface InternalSiteBaseConfig extends SiteBaseConfig {
  scope: string
}
