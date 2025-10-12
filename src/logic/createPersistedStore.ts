import type { Storage } from 'webextension-polyfill'
import { makePersisted } from '@solid-primitives/storage'
import { createSignal } from 'solid-js'

export function createPersistedStore<Data>(key: string, defaultValue: Data, options?: {
  target?: 'local' | 'sync'
  writeDefaults?: boolean
}) {
  const {
    target = 'local',
    writeDefaults = true,
  } = options ?? {}

  const writeDefaultsFacilitator = () => browser.storage[target].set({ [key]: defaultValue })

  let store: ReturnType<typeof initStore>
  let scope: ReturnType<typeof setScope>

  const initStore = () => {
    if (writeDefaults) {
      void browser.storage[target].get(key).then((data) => {
        if (data[key] === undefined && defaultValue !== undefined) {
          void writeDefaultsFacilitator()
        }
      })
    }

    return makePersisted(createSignal(defaultValue), {
      name: key,
      storage: {
        getItem: async key => (await browser.storage[target].get(key))[key] as string,
        setItem: (key, value) => browser.storage[target].set({ [key]: value }),
        removeItem: key => browser.storage[target].remove(key),
      },
      serialize: data => data as string,
      deserialize: data => data as Data,
      sync: [
        (subscriber) => {
          browser.storage.onChanged.addListener((changes: Record<string, Storage.StorageChange>) => {
            Object.entries(changes).forEach(([currentKey, value]) => {
              if (currentKey !== key) {
                return
              }

              if (writeDefaults && value.newValue === undefined && defaultValue !== undefined) {
                void writeDefaultsFacilitator()

                return
              }

              subscriber({ key, newValue: (value.newValue as string || ''), timeStamp: Date.now() })
            })
          })
        },
        () => {},
      ],
    })
  }

  const setScope = () => ({
    data: store[0],
    setData: store[1],
    dataReady: store[2],
  })

  return () => {
    if (!store) {
      store = initStore()
      scope = setScope()
    }

    return scope
  }
}
