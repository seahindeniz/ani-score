import type { AnimeDetails } from '~/background/logic/fetchDetails'
import type { InternalSiteBaseConfig, ListingPage } from '~/contentScripts/site/base'
import { createMutable } from 'solid-js/store'
import { render } from 'solid-js/web'
import { createLogger } from '~/utils/logger'
import { CardDetail } from '../views/CardDetail/CardDetail'
import { createEncapsulatedContainer } from './createEncapsulatedContainer'
import { createStyleLink } from './createStyleLink'

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

    await window.messageGateway.sendMessage('initialize', null)

    const animeMap = await window.messageGateway.sendMessage(
      'fetch-details',
      {
        cards: episodeCards.map(card => ({
          title: card.title,
          episodeNumber: card.episodeNumber,
        })),
      },
    )

    logger.log('the response from background:', animeMap)

    if (!animeMap) {
      logger.log('No details fetched from background')
      return
    }

    logger.log('Fetched details from background:', animeMap)

    // eslint-disable-next-line solid/reactivity
    store.anime = animeMap
  }

  logger.log('Customizing cards for site:', config)
  logger.log('store:', store)

  const disposers = episodeCards.map((card, index) => {
    const { container, root, shadowDOM } = createEncapsulatedContainer(config)

    shadowDOM.appendChild(createStyleLink(config.scope))
    card.element.querySelector('.title')?.before(container)

    return render(() => <CardDetail card={card} store={store} onRender={startFetching} index={index} />, root)
  })

  return () => {
    disposers.forEach(dispose => dispose())
  }
}
