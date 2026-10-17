import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { useTokenStore } from '~/logic'
import { TokenReceived } from '../TokenReceived'

afterEach(() => {
  cleanup()
  useTokenStore().setData({ anilist: '' })
  history.replaceState(null, '', '/')
})

describe('token received', () => {
  it('stores the AniList token from the URL hash', () => {
    history.replaceState(null, '', '/index.html#access_token=secret&token_type=Bearer')
    render(() => <TokenReceived />)

    expect(useTokenStore().data().anilist).toBe('secret')
    expect(screen.getByText('You can now close this tab.')).toBeTruthy()
  })

  it('keeps the stored token when the hash has none', () => {
    useTokenStore().setData({ anilist: 'existing' })
    history.replaceState(null, '', '/index.html#error=access_denied')
    render(() => <TokenReceived />)

    expect(useTokenStore().data().anilist).toBe('existing')
  })

  it('closes the tab', () => {
    const close = spyOn(window, 'close').mockImplementation(() => {})

    render(() => <TokenReceived />)
    fireEvent.click(screen.getByRole('button', { name: 'Close Tab' }))

    expect(close).toHaveBeenCalledTimes(1)
    close.mockRestore()
  })
})
