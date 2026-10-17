import type { SiteBaseConfig } from '../base'
import './global.scss'

export const config: SiteBaseConfig = {
  theme: 'dark',
  listingPages: [
    {
      isValidPage: () => window.location.pathname === '/yeniler',
      episodeCards: () => {
        const elements = document.querySelectorAll<HTMLElement>('.v3-latest-grid > article.v3-episode-card')

        return Array.from(elements)
          .map((element) => {
            const infoContainer = element.querySelector<HTMLDivElement>('.v3-card-copy')
            const header = infoContainer?.querySelector('h3')

            if (!infoContainer || !header)
              return undefined

            const title = header.textContent.trim()
            const episodeNumberText = infoContainer.querySelector('span')?.textContent.trim()
            const episodeNumber = episodeNumberText ? Number.parseInt(episodeNumberText.replace('. Bölüm ', '')) : Number.NaN

            if (!title || episodeNumber == null || Number.isNaN(episodeNumber))
              return undefined

            return {
              element,
              render: container => header.after(container),
              title,
              episodeNumber,
            }
          })
      },
      getShimmeringElement: card => card.element.querySelector<HTMLDivElement>('div.v3-poster-frame'),
    },
    {
      isValidPage: () => window.location.pathname === '/',
      episodeCards: () => {
        const elements = document.querySelectorAll<HTMLElement>('.v3-poster-rail > :is(article.v3-episode-card, article.v3-series-card)')

        return Array.from(elements)
          .map((element) => {
            const infoContainer = element.querySelector<HTMLDivElement>('.v3-card-copy')
            const header = infoContainer?.querySelector('h3')

            if (!infoContainer || !header)
              return undefined

            const title = header.textContent.trim()
            const episodeNumberText = infoContainer.querySelector('span')?.textContent.trim()
            const episodeNumber = episodeNumberText ? Number.parseInt(episodeNumberText.replace('. Bölüm ', '')) : Number.NaN

            if (!title || episodeNumber == null || Number.isNaN(episodeNumber))
              return undefined

            return {
              element,
              render: container => header.after(container),
              title,
              episodeNumber,
            }
          })
      },
      getShimmeringElement: card => card.element.querySelector<HTMLDivElement>('div.v3-poster-frame'),
    },
  ],
}
