import type { Storage } from 'webextension-polyfill'
import { createEffect, createSignal, onCleanup } from 'solid-js'
import { storage } from 'webextension-polyfill'
import { logger } from '~/utils/logger'

export interface WebExtensionStorageOptions<T> {
  writeDefaults?: boolean
  mergeDefaults?: boolean | ((value: T, initial: T) => T)
  serializer?: {
    read: (v: string) => T | Promise<T>
    write: (v: T) => string | Promise<string>
  }
  onError?: (error: any) => void
  target?: 'local' | 'sync'
}

function guessSerializerType(rawInit: unknown) {
  return rawInit == null
    ? 'any'
    : rawInit instanceof Set
      ? 'set'
      : rawInit instanceof Map
        ? 'map'
        : rawInit instanceof Date
          ? 'date'
          : typeof rawInit === 'boolean'
            ? 'boolean'
            : typeof rawInit === 'string'
              ? 'string'
              : typeof rawInit === 'object'
                ? 'object'
                : Number.isNaN(rawInit)
                  ? 'any'
                  : 'number'
}

const StorageSerializers = {
  boolean: {
    read: (v: string) => v === 'true',
    write: (v: boolean) => String(v),
  },
  object: {
    read: (v: string) => JSON.parse(v),
    write: (v: any) => JSON.stringify(v),
  },
  number: {
    read: (v: string) => Number.parseFloat(v),
    write: (v: number) => String(v),
  },
  any: {
    read: (v: string) => JSON.parse(v),
    write: (v: any) => JSON.stringify(v),
  },
  string: {
    read: (v: string) => v,
    write: (v: string) => v,
  },
  map: {
    read: (v: string) => new Map(JSON.parse(v)),
    write: (v: Map<any, any>) => JSON.stringify(Array.from(v.entries())),
  },
  set: {
    read: (v: string) => new Set(JSON.parse(v)),
    write: (v: Set<any>) => JSON.stringify(Array.from(v)),
  },
  date: {
    read: (v: string) => new Date(v),
    write: (v: Date) => v.toISOString(),
  },
}

export function useWebExtensionStorage<T>(
  key: string,
  initialValue: T,
  options: WebExtensionStorageOptions<T> = {},
) {
  const {
    writeDefaults = true,
    mergeDefaults = false,
    onError = e => logger.error(e),
    target = 'local',
  } = options

  const type = guessSerializerType(initialValue) as keyof typeof StorageSerializers
  const serializer = options.serializer ?? StorageSerializers[type]

  const [data, setData] = createSignal<T>(initialValue)
  const [dataReady, setDataReady] = createSignal(false)

  async function read(event?: { key: string, newValue: string | null }) {
    if (event && event.key !== key)
      return

    try {
      const rawValue = event ? event.newValue : (await storage[target].get(key))[key] as string | undefined

      if (rawValue == null) {
        setData(() => initialValue)
        if (writeDefaults && initialValue !== null) {
          await storage[target].set({ [key]: await serializer.write(initialValue) })
        }
      }
      else if (mergeDefaults) {
        const value = await serializer.read(rawValue) as T
        if (typeof mergeDefaults === 'function') {
          setData(() => mergeDefaults(value, initialValue))
        }
        else if (type === 'object' && !Array.isArray(value)) {
          setData(() => ({ ...(initialValue as any), ...(value as any) } as T))
        }
        else {
          setData(() => value)
        }
      }
      else {
        const value = await serializer.read(rawValue) as T
        setData(() => value)
      }
    }
    catch (error) {
      onError(error)
    }
  }

  async function write(newValue: T) {
    try {
      if (newValue == null) {
        await storage[target].remove(key)
      }
      else {
        await storage[target].set({ [key]: await serializer.write(newValue) })
      }
    }
    catch (error) {
      onError(error)
    }
  }

  // Initialize data
  read().then(() => setDataReady(true))

  // Listen to storage changes
  const listener = async (changes: Record<string, Storage.StorageChange>) => {
    for (const [storageKey, change] of Object.entries(changes)) {
      if (storageKey === key) {
        await read({
          key: storageKey,
          newValue: change.newValue as string | null,
        })
      }
    }
  }

  storage.onChanged.addListener(listener)
  onCleanup(() => {
    storage.onChanged.removeListener(listener)
  })

  // Create effect to write changes
  createEffect(() => {
    const currentData = data()
    if (dataReady()) {
      write(currentData)
    }
  })

  return {
    data,
    setData,
    get dataReady() {
      return new Promise<T>((resolve) => {
        const checkReady = () => {
          if (dataReady()) {
            resolve(data())
          }
          else {
            setTimeout(checkReady, 10)
          }
        }
        checkReady()
      })
    },
    isReady: dataReady,
  }
}
