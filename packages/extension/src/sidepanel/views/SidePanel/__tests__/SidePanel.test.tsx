import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { useTokenStore } from '~/logic'
import { fakeBrowser } from '../../../../../test/fake-browser'
import { SidePanel } from '../SidePanel'

const originalFetch = globalThis.fetch

beforeAll(() => {
  globalThis.fetch = (async () => Response.json({ data: { GenreCollection: ['Action'] } })) as unknown as typeof fetch
})

afterAll(() => {
  globalThis.fetch = originalFetch
})

afterEach(() => {
  cleanup()
  useTokenStore().setData({ anilist: '' })
})

describe('side panel', () => {
  it('opens AniList authorization when signed out', () => {
    render(() => <SidePanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Authorize Anilist' }))

    expect(fakeBrowser.tabs.create).toHaveBeenCalledWith({ url: (globalThis as unknown as { ANILIST_TOKEN_URL: string }).ANILIST_TOKEN_URL })
  })

  it('shows the color settings when signed in', async () => {
    useTokenStore().setData({ anilist: 'token' })
    render(() => <SidePanel />)

    expect(screen.queryByRole('button', { name: 'Authorize Anilist' })).toBeNull()
    expect(screen.getByText('Genre Colors')).toBeTruthy()
    expect(screen.getByText('Tag Colors')).toBeTruthy()
  })

  it('signs out, then offers to authorize again', () => {
    useTokenStore().setData({ anilist: 'token' })
    render(() => <SidePanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out of AniList' }))

    expect(useTokenStore().data().anilist).toBe('')
    expect(screen.queryByRole('button', { name: 'Sign out of AniList' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Authorize Anilist' })).toBeTruthy()
    expect(fakeBrowser.tabs.create).not.toHaveBeenCalled()
  })
})
