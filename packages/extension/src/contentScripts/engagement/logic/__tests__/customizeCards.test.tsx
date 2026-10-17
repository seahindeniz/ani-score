import type { EpisodeCard, InternalSiteBaseConfig, ListingPage } from '~/contentScripts/site/base'
import { afterEach, describe, expect, it, mock } from 'bun:test'
import { wait } from '~/utils/wait'
import { customizeCards } from '../customizeCards'

function episodeCard(title: string, episodeNumber: number): EpisodeCard {
  const element = document.createElement('article')

  document.body.append(element)

  return { element, title, episodeNumber, render: container => element.append(container) }
}

function setUp(cards: (EpisodeCard | null)[], fetchDetails: unknown) {
  const sendMessage = mock(async (id: string) => id === 'fetch-details' ? fetchDetails : undefined)
  const page: ListingPage = { isValidPage: () => true, episodeCards: () => cards }
  const config: InternalSiteBaseConfig = { listingPages: [page], scope: 'site/anizm' }

  window.messageGateway = { sendMessage } as unknown as typeof window.messageGateway

  return { sendMessage, dispose: customizeCards(page, config) }
}

function shadowOf(card: EpisodeCard) {
  return card.element.querySelector('.ani-score')!.shadowRoot!
}

describe('customizeCards', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'messageGateway')
  })

  it('renders details into each readable card with the engagement and site styles', () => {
    const frieren = episodeCard('Frieren', 5)
    const { dispose } = setUp([frieren, null], {})

    const styles = Array.from(shadowOf(frieren).querySelectorAll('link'), link => link.getAttribute('href'))

    expect(styles).toEqual([
      'chrome-extension://test-extension-id/dist/contentScripts/engagement/style.css',
      'chrome-extension://test-extension-id/dist/contentScripts/site/anizm/style.css',
    ])
    dispose()
  })

  it('asks the background for every card\'s details once', async () => {
    const cards = [episodeCard('Frieren', 5), episodeCard('Dandadan', 12)]
    const { sendMessage, dispose } = setUp(cards, { Frieren: null, Dandadan: null })

    await wait(10)

    expect(sendMessage.mock.calls).toEqual([
      ['initialize', null],
      ['fetch-details', { cards: [{ title: 'Frieren', episodeNumber: 5 }, { title: 'Dandadan', episodeNumber: 12 }] }],
    ] as unknown as typeof sendMessage.mock.calls)
    dispose()
  })

  it('shows the fetched details', async () => {
    const frieren = episodeCard('Frieren', 5)
    const { dispose } = setUp([frieren], { Frieren: null })

    await wait(10)

    expect(shadowOf(frieren).textContent).toContain('Not Found')
    dispose()
  })

  it('keeps waiting when the background has no answer', async () => {
    const frieren = episodeCard('Frieren', 5)
    const { dispose } = setUp([frieren], undefined)

    await wait(10)

    expect(shadowOf(frieren).textContent).not.toContain('Not Found')
    dispose()
  })

  it('removes the rendered details when disposed', async () => {
    const frieren = episodeCard('Frieren', 5)
    const { dispose } = setUp([frieren], { Frieren: null })

    await wait(10)
    dispose()

    expect(shadowOf(frieren).textContent).toBe('')
  })
})
