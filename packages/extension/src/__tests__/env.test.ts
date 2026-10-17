import { afterEach, describe, expect, it } from 'bun:test'
import { isFirefox, isForbiddenUrl } from '../env'

describe('isForbiddenUrl', () => {
  it('rejects browser-internal pages and the Chrome Web Store', () => {
    for (const url of ['chrome://extensions', 'chrome-extension://id/popup.html', 'edge://settings', 'devtools://devtools', 'chrome-search://local-ntp', 'https://chrome.google.com/webstore/detail/x'])
      expect(isForbiddenUrl(url)).toBe(true)
  })

  it('allows regular websites', () => {
    expect(isForbiddenUrl('https://anizm.net/yeniler')).toBe(false)
    expect(isForbiddenUrl('https://chrome.google.com/search')).toBe(false)
  })
})

describe('isFirefox', () => {
  const userAgent = navigator.userAgent

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
  })

  it('is false outside Firefox', () => {
    expect(isFirefox).toBe(false)
  })

  it('detects Firefox from the user agent', async () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0', configurable: true })

    const freshEnv = '../env.ts?firefox'
    const env = await import(freshEnv) as typeof import('../env')

    expect(env.isFirefox).toBe(true)
  })
})
