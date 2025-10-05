import type { AnimeDetails } from '~/background/logic/fetchDetails'
import type { InternalSiteBaseConfig, ListingPage } from '~/contentScripts/site/base'
import { createMutable } from 'solid-js/store'
import { render } from 'solid-js/web'
import { createLogger } from '~/utils/logger'
import { CardDetail } from '../views/CardDetail/CardDetail'

export function createStyleLink(scope: string) {
  const styleEl = document.createElement('link')

  styleEl.setAttribute('rel', 'stylesheet')
  styleEl.setAttribute('href', browser.runtime.getURL(`dist/contentScripts/${scope}/style.css`))

  return styleEl
}

export function customizeCards(page: ListingPage, config: InternalSiteBaseConfig) {
  const logger = createLogger('customizeCards')
  const episodeCards = page.episodeCards()

  logger.log('Found episode cards:', episodeCards)

  const store = createMutable({
    anime: {} as Record<string, AnimeDetails | null>,
  })

  let startFetching = async () => {
    startFetching = () => Promise.resolve()

    logger.log('Starting to fetch details for episode cards')

    const res = await window.messageGateway.sendMessage(
      'fetch-details',
      {
        cards: episodeCards.map(card => ({
          title: card.title,
          episodeNumber: card.episodeNumber,
        })),
      },
    )

    logger.log('the response from background:', res)

    if (!res?.anime) {
      logger.log('No details fetched from background')
      return
    }

    logger.log('Fetched details from background:', res.anime)

    store.anime = res.anime
  }

  logger.log('Customizing cards for site:', config)
  logger.log('store:', store)

  const disposers = episodeCards.map((card) => {
    const container = document.createElement('div')
    const shadowDOM = container.attachShadow?.({ mode: __DEV__ ? 'open' : 'closed' }) || container

    container.className = __NAME__

    shadowDOM.appendChild(createStyleLink('engagement'))
    shadowDOM.appendChild(createStyleLink(config.scope))
    card.element.querySelector('.title')?.before(container)

    return render(() => <CardDetail card={card} store={store} onRender={startFetching} />, shadowDOM)
  })

  return () => {
    disposers.forEach(dispose => dispose())
  }
}
