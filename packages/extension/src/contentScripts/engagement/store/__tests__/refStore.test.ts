import { describe, expect, it } from 'bun:test'
import { useRefStore } from '../refStore'

describe('useRefStore', () => {
  it('shares one store', () => {
    expect(useRefStore()).toBe(useRefStore())
  })

  it('reads and writes known refs', () => {
    const store = useRefStore()

    store.activeAnimeInfoId = '154587'

    expect(store.activeAnimeInfoId).toBe('154587')
    expect(store.portalRoot).toBeNull()

    store.activeAnimeInfoId = ''
  })

  it('rejects unknown refs', () => {
    const store = useRefStore() as unknown as Record<string, unknown>

    expect(() => store.missing).toThrow('RefStore: Property "missing" has not been initialized yet.')
    expect(() => {
      store.missing = 1
    }).toThrow('RefStore: Cannot set unknown property "missing".')
  })
})
