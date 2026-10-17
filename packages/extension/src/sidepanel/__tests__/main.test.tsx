import { afterAll, describe, expect, it } from 'bun:test'
import { screen, waitFor } from '@solidjs/testing-library'
import { useTokenStore } from '~/logic'

// The router only re-reads the URL when the path changes, so each step uses its own folder before `.html`
function navigate(url: string) {
  history.replaceState(null, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

afterAll(() => {
  useTokenStore().setData({ anilist: '' })
  history.replaceState(null, '', '/')
})

describe('side panel entry', () => {
  it('routes the extension page URL to the side panel and the auth callback', async () => {
    useTokenStore().setData({ anilist: '' })
    history.replaceState(null, '', '/dist/sidepanel/index.html')

    const root = document.createElement('div')

    root.id = 'app'
    document.body.append(root)

    await import('../main')

    expect(await screen.findByRole('button', { name: 'Authorize Anilist' })).toBeTruthy()

    for (const url of ['/hash/index.html#top', '/empty/index.html??', '/query/index.html?theme=dark']) {
      navigate(url)
      expect(await screen.findByRole('button', { name: 'Authorize Anilist' })).toBeTruthy()
    }

    // AniList appends the token to the redirect URL, `index.html?auth/`
    navigate('/callback/index.html?auth/#access_token=abc')
    expect(await screen.findByText('Token Received')).toBeTruthy()
    await waitFor(() => expect(useTokenStore().data().anilist).toBe('abc'))

    navigate('/state/index.html?auth/?state=1&x=2')
    expect(await screen.findByText('Token Received')).toBeTruthy()

    expect(document.documentElement.getAttribute('data-kb-theme')).toMatch(/^(light|dark)$/)
  })
})
