import { describe, expect, it } from 'bun:test'
import { createStyleLink } from '../createStyleLink'

describe('createStyleLink', () => {
  it('links the scope\'s stylesheet from the extension', () => {
    const link = createStyleLink('site/anizm')

    expect(link.rel).toBe('stylesheet')
    expect(link.getAttribute('href')).toBe('chrome-extension://test-extension-id/dist/contentScripts/site/anizm/style.css')
  })
})
