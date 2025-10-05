import type { PersistenceSyncCallback } from '@solid-primitives/storage'
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
  let subscriberFunction: PersistenceSyncCallback | undefined

  const writeDefaultsFacilitator = () => browser.storage[target].set({ [key]: defaultValue })

  const handleChange = (changes: Record<string, Storage.StorageChange>) => {
    Object.entries(changes).forEach(([currentKey, value]) => {
      if (currentKey !== key) {
        return
      }

      if (writeDefaults && value.newValue === undefined && defaultValue !== undefined) {
        void writeDefaultsFacilitator()

        return
      }

      subscriberFunction?.({ key, newValue: JSON.stringify(value.newValue as string || ''), timeStamp: Date.now() })
    })
  }

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
        getItem: async (key) => {
          const data = await browser.storage[target].get(key)

          return data[key] && typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key] ?? '')
        },
        setItem: (key, value) => browser.storage[target].set({ [key]: JSON.parse(value) }),
        removeItem: key => browser.storage[target].remove(key),
      },
      sync: [
        (subscriber) => {
          subscriberFunction = subscriber
          browser.storage.onChanged.addListener(handleChange)
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
