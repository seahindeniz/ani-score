import type { EpisodeCard, ListingPage } from '../base'
import { afterEach, describe, expect, it } from 'bun:test'
import { config } from '../anizm/main'
import { meta } from '../anizm/meta'

const [newEpisodesPage, homePage] = config.listingPages

function card(title: string | null, episode: string | null, tag = 'article', className = 'v3-episode-card') {
  const copy = title == null && episode == null
    ? ''
    : `<div class="v3-card-copy">${title == null ? '' : `<h3> ${title} </h3>`}${episode == null ? '' : `<span>${episode}</span>`}</div>`

  return `<${tag} class="${className}"><div class="v3-poster-frame"></div>${copy}</${tag}>`
}

const unreadableCards = [
  card(null, null),
  card(null, '3. Bölüm '),
  card('No Episode', null),
  card('Bad Episode', 'Film'),
  card('', '2. Bölüm '),
].join('')

function expectRendersAfterTitle(page: ListingPage) {
  const [episodeCard] = page.episodeCards() as EpisodeCard[]
  const container = document.createElement('div')

  episodeCard.render(container)

  expect(episodeCard.element.querySelector('h3')!.nextElementSibling).toBe(container)
  expect(page.getShimmeringElement!(episodeCard)).toBe(episodeCard.element.querySelector('.v3-poster-frame'))
}

afterEach(() => {
  history.replaceState(null, '', '/')
})

describe('anizm', () => {
  it('is injected on every anizm.net page', () => {
    expect(meta.urlPatterns).toEqual(['*://anizm.net/', '*://anizm.net/*'])
  })

  it('uses the dark theme like the site', () => {
    expect(config.theme).toBe('dark')
  })

  describe('new episodes page', () => {
    it('only applies to /yeniler', () => {
      history.replaceState(null, '', '/yeniler')
      expect(newEpisodesPage.isValidPage()).toBe(true)

      history.replaceState(null, '', '/')
      expect(newEpisodesPage.isValidPage()).toBe(false)
    })

    it('reads title and episode number from each card', () => {
      document.body.innerHTML = `<div class="v3-latest-grid">${card('Sousou no Frieren', '5. Bölüm ')}${card('One Piece', '1120. Bölüm ')}</div>`

      expect(newEpisodesPage.episodeCards().map(item => item && { title: item.title, episodeNumber: item.episodeNumber })).toEqual([
        { title: 'Sousou no Frieren', episodeNumber: 5 },
        { title: 'One Piece', episodeNumber: 1120 },
      ])
    })

    it('skips cards it cannot read', () => {
      document.body.innerHTML = `<div class="v3-latest-grid">${unreadableCards}</div>`

      expect(newEpisodesPage.episodeCards()).toEqual([undefined, undefined, undefined, undefined, undefined])
    })

    it('renders details after the title and shimmers the poster', () => {
      document.body.innerHTML = `<div class="v3-latest-grid">${card('Frieren', '5. Bölüm ')}</div>`

      expectRendersAfterTitle(newEpisodesPage)
    })
  })

  describe('home page', () => {
    it('only applies to /', () => {
      expect(homePage.isValidPage()).toBe(true)

      history.replaceState(null, '', '/yeniler')
      expect(homePage.isValidPage()).toBe(false)
    })

    it('reads episode and series cards from the poster rails', () => {
      document.body.innerHTML = `<div class="v3-poster-rail">${card('Frieren', '5. Bölüm ')}${card('Dandadan', '12. Bölüm ', 'article', 'v3-series-card')}${card('Other', '1. Bölüm ', 'div')}</div>`

      expect(homePage.episodeCards().map(item => item?.title)).toEqual(['Frieren', 'Dandadan'])
    })

    it('skips cards it cannot read', () => {
      document.body.innerHTML = `<div class="v3-poster-rail">${unreadableCards}</div>`

      expect(homePage.episodeCards()).toEqual([undefined, undefined, undefined, undefined, undefined])
    })

    it('renders details after the title and shimmers the poster', () => {
      document.body.innerHTML = `<div class="v3-poster-rail">${card('Frieren', '5. Bölüm ')}</div>`

      expectRendersAfterTitle(homePage)
    })
  })
})
