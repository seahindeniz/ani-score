import { afterEach, describe, expect, it } from 'bun:test'
import { createEncapsulatedContainer } from '../createEncapsulatedContainer'

describe('createEncapsulatedContainer', () => {
  const attachShadow = HTMLElement.prototype.attachShadow

  afterEach(() => {
    Object.assign(globalThis, { __DEV__: true })
    HTMLElement.prototype.attachShadow = attachShadow
  })

  it('wraps a root and the engagement styles in a shadow root', () => {
    const { container, root, shadowDOM } = createEncapsulatedContainer()

    expect(container.className).toBe('ani-score')
    expect(shadowDOM).toBe(container.shadowRoot!)
    expect(Array.from(shadowDOM.childNodes)).toEqual([expect.any(HTMLLinkElement), root])
    expect((shadowDOM.firstChild as HTMLLinkElement).getAttribute('href')).toBe('chrome-extension://test-extension-id/dist/contentScripts/engagement/style.css')
  })

  it('closes the shadow root in production builds', () => {
    Object.assign(globalThis, { __DEV__: false })

    const { container, shadowDOM } = createEncapsulatedContainer()

    expect(container.shadowRoot).toBeNull()
    expect(shadowDOM).not.toBe(container)
  })

  it('falls back to the container itself without shadow DOM support', () => {
    HTMLElement.prototype.attachShadow = undefined as unknown as typeof attachShadow

    const { container, root, shadowDOM } = createEncapsulatedContainer()

    expect<Node>(shadowDOM).toBe(container)
    expect(container.lastChild).toBe(root)
  })
})
