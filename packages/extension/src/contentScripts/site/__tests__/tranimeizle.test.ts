import type { EpisodeCard } from '../base'
import type { ResolvedTheme } from '~/logic/setTheme'
import { afterEach, describe, expect, it } from 'bun:test'
import { wait } from '~/utils/wait'
import { config } from '../tranimeizle/main'
import { meta } from '../tranimeizle/meta'

const [listingPage] = config.listingPages
const followSiteTheme = config.theme as (set: (theme: ResolvedTheme) => void) => void

function block(text: string | null) {
  return `<div class="flx-block"><a class="news-image" href="#"></a>${text == null ? '' : `<div class="bar"><h4>${text}</h4></div>`}</div>`
}

function cardsFor(...texts: (string | null)[]) {
  document.body.innerHTML = `<div class="flex-wrap-layout">${texts.map(block).join('')}</div>`

  return listingPage.episodeCards().map(item => item && { title: item.title, episodeNumber: item.episodeNumber })
}

afterEach(() => {
  history.replaceState(null, '', '/')
  localStorage.clear()
})

describe('tranimeizle', () => {
  it('is injected on every www.tranimeizle.live page', () => {
    expect(meta.urlPatterns).toEqual(['*://www.tranimeizle.live/', '*://www.tranimeizle.live/*'])
  })

  it('applies to the home page and the paginated new episodes list', () => {
    const cases = [
      ['/', true],
      ['/listeler/yenibolum/sayfa-2', true],
      ['/listeler/yenibolum/sayfa-12/', true],
      ['/listeler/yenibolum', false],
      ['/anime/frieren', false],
    ] as const

    for (const [path, valid] of cases) {
      history.replaceState(null, '', path)
      expect(listingPage.isValidPage()).toBe(valid)
    }
  })

  it('reads the title and episode number from the card heading', () => {
    expect(cardsFor('Sousou no Frieren 5. Bölüm İzle')).toEqual([{ title: 'Sousou no Frieren', episodeNumber: 5 }])
  })

  it('writes Turkish season and part markers the way the database does', () => {
    expect(cardsFor(
      'The Apothecary Diaries 3. Sezon 3. Bölüm İzle',
      'Attack on Titan 4. Sezon 2. Kısım 10. Bölüm İzle',
    )).toEqual([
      { title: 'The Apothecary Diaries Season 3', episodeNumber: 3 },
      { title: 'Attack on Titan Season 4 Part 2', episodeNumber: 10 },
    ])
  })

  it('tolerates extra words before "İzle" and half episodes', () => {
    expect(cardsFor('Frieren 28. Bölüm Final İzle', 'Dandadan 12.5. Bölüm İzle')).toEqual([
      { title: 'Frieren', episodeNumber: 28 },
      { title: 'Dandadan', episodeNumber: 12 },
    ])
  })

  it('skips cards without a readable episode or title', () => {
    expect(cardsFor(null, 'Frieren Fragman İzle', '5. Bölüm İzle')).toEqual([undefined, undefined, undefined])
  })

  it('renders details before the bar and shimmers the poster link', () => {
    cardsFor('Frieren 5. Bölüm İzle')

    const [episodeCard] = listingPage.episodeCards() as EpisodeCard[]
    const container = document.createElement('div')

    episodeCard.render(container)

    expect(container.nextElementSibling).toBe(episodeCard.element.querySelector('.bar'))
    expect(listingPage.getShimmeringElement!(episodeCard)).toBe(episodeCard.element.querySelector('a.news-image'))
  })

  it('follows the site\'s theme toggle', async () => {
    const themes: ResolvedTheme[] = []

    localStorage.setItem('temabuton', 'dark')
    followSiteTheme(theme => themes.push(theme))

    // What the site's toggle does: swap the body class, then save the choice
    document.body.className = 'light-mode'
    localStorage.setItem('temabuton', 'light')
    await wait()

    expect(themes).toEqual(['dark', 'light'])
  })

  it('defaults to light when the site has no stored theme', () => {
    const themes: ResolvedTheme[] = []

    followSiteTheme(theme => themes.push(theme))

    expect(themes).toEqual(['light'])
  })
})
