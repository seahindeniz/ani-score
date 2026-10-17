import { describe, expect, it } from 'bun:test'
import { wait } from '~/utils/wait'
import { fakeBrowser } from '../../../test/fake-browser'
import { createPersistedStore } from '../createPersistedStore'

let keyCount = 0
const uniqueKey = () => `test-store-${++keyCount}`

describe('createPersistedStore', () => {
  it('starts with the default value and writes it to storage when the key is missing', async () => {
    const key = uniqueKey()
    const store = createPersistedStore(key, { anilist: '' })()

    expect(store.data()).toEqual({ anilist: '' })
    await store.dataReady
    await wait()

    expect(fakeBrowser.storage.local.peek()[key]).toEqual({ anilist: '' })
  })

  it('loads the stored value', async () => {
    const key = uniqueKey()

    await fakeBrowser.storage.local.set({ [key]: { anilist: 'token' } })

    const store = createPersistedStore(key, { anilist: '' })()

    await store.dataReady
    await wait()

    expect(store.data()).toEqual({ anilist: 'token' })
    expect(fakeBrowser.storage.local.set).toHaveBeenCalledTimes(1)
  })

  it('creates the store once and shares it', () => {
    const useStore = createPersistedStore(uniqueKey(), 1)

    expect(useStore()).toBe(useStore())
  })

  it('can skip writing defaults', async () => {
    const key = uniqueKey()
    const store = createPersistedStore(key, 'system', { writeDefaults: false })()

    await store.dataReady
    await wait()

    expect(key in fakeBrowser.storage.local.peek()).toBe(false)
  })

  it('persists updates and removals in the chosen storage area', async () => {
    const key = uniqueKey()
    const store = createPersistedStore<string | null>(key, 'system', { target: 'sync', writeDefaults: false })()

    await store.dataReady
    store.setData('dark')

    expect(fakeBrowser.storage.sync.peek()[key]).toBe('dark')
    expect(store.data()).toBe('dark')

    store.setData(null)

    expect(key in fakeBrowser.storage.sync.peek()).toBe(false)
  })

  it('follows changes made elsewhere, such as another extension page', async () => {
    const key = uniqueKey()
    const store = createPersistedStore(key, { anilist: '' })()

    await store.dataReady
    await wait()
    await fakeBrowser.storage.local.set({ [key]: { anilist: 'from-side-panel' }, unrelated: true })
    await wait()

    expect(store.data()).toEqual({ anilist: 'from-side-panel' })
  })

  it('restores the default when the key is removed elsewhere', async () => {
    const key = uniqueKey()
    const store = createPersistedStore(key, { anilist: '' })()

    await store.dataReady
    await fakeBrowser.storage.local.set({ [key]: { anilist: 'token' } })
    await wait()
    await fakeBrowser.storage.local.remove(key)
    await wait()
    await wait()

    expect(fakeBrowser.storage.local.peek()[key]).toEqual({ anilist: '' })
    expect(store.data()).toEqual({ anilist: '' })
  })

  it('clears the value when the key is removed elsewhere and defaults are not written', async () => {
    const key = uniqueKey()
    const store = createPersistedStore(key, 'dark', { writeDefaults: false })()

    await store.dataReady
    await fakeBrowser.storage.local.remove(key)
    await fakeBrowser.storage.local.set({ [key]: 'light' })
    await wait()

    expect(store.data()).toBe('light')

    await fakeBrowser.storage.local.remove(key)
    await wait()

    expect(store.data()).toBe('')
  })
})
