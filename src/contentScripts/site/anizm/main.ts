import type { SiteBaseConfig } from '../base'
import { createLogger } from '~/utils/logger'
import './global.scss'

const logger = createLogger('Anizm')

export const config: SiteBaseConfig = {
  listingPages: [
    {
      isValidPage: () => {
        return window.location.pathname === '/' || window.location.pathname === '/anime-izle'
      },
      episodeCards: () => {
        const elements = document.querySelectorAll<HTMLDivElement>('#episodesContent > #episodesMiddle')

        return Array.from(elements)
          .map((element) => {
            const title = element.querySelector('.titleShortened')?.textContent.trim()
            const episodeNumberText = element.querySelector('.posterAlt')?.textContent.trim()
            const episodeNumber = episodeNumberText ? Number.parseInt(episodeNumberText.replace('Episode ', '')) : Number.NaN

            if (!title || episodeNumber == null || Number.isNaN(episodeNumber))
              return undefined

            return { element, title, episodeNumber }
          })
          .filter(card => card != null)
      },
      reInit: (next) => {
        const container = document.querySelector<HTMLDivElement>('#episodesContent')

        if (!container) {
          return
        }

        const observer = new MutationObserver(([mutation]) => {
          logger.log('Detected DOM changes, re-initializing...')

          if (mutation.addedNodes.length > 0) {
            next()
          }
        })

        observer.observe(container, { childList: true })
      },
    },
  ],
}
