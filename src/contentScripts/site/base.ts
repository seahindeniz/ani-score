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
}

export interface SiteBaseConfig {
  listingPages: ListingPage[]
}

export interface InternalSiteBaseConfig extends SiteBaseConfig {
  scope: string
}
