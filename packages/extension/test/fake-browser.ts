import { mock } from 'bun:test'

type Listener = (...args: any[]) => unknown

function createEvent() {
  const listeners = new Set<Listener>()

  return {
    addListener: mock((listener: Listener) => void listeners.add(listener)),
    removeListener: mock((listener: Listener) => void listeners.delete(listener)),
    hasListener: (listener: Listener) => listeners.has(listener),
    /**
     * Test helper: calls every listener, like the browser does when the event fires.
     */
    dispatch: (...args: unknown[]) => Array.from(listeners, listener => listener(...args)),
    /**
     * Test helper: forgets listeners registered by earlier tests.
     */
    clear: () => listeners.clear(),
  }
}

type StorageChanges = Record<string, { oldValue?: unknown, newValue?: unknown }>

function createStorageArea(areaName: 'local' | 'sync', onChanged: ReturnType<typeof createEvent>) {
  let items: Record<string, unknown> = {}

  // Like the browser: values are copied, and `onChanged` fires after the write resolves
  const commit = (changes: StorageChanges) => {
    if (Object.keys(changes).length)
      setTimeout(() => onChanged.dispatch(changes, areaName))
  }

  return {
    get: mock(async (keys?: string | string[] | Record<string, unknown> | null) => {
      if (keys == null)
        return structuredClone(items)

      const defaults = typeof keys === 'string'
        ? { [keys]: undefined }
        : Array.isArray(keys)
          ? Object.fromEntries(keys.map(key => [key, undefined]))
          : keys

      return Object.fromEntries(Object.entries(defaults).flatMap(([key, fallback]) => {
        const value = key in items ? items[key] : fallback

        return value === undefined ? [] : [[key, structuredClone(value)]]
      }))
    }),
    set: mock(async (newItems: Record<string, unknown>) => {
      const changes: StorageChanges = {}

      for (const [key, value] of Object.entries(newItems)) {
        changes[key] = { oldValue: items[key], newValue: structuredClone(value) }
        items[key] = structuredClone(value)
      }

      commit(changes)
    }),
    remove: mock(async (keys: string | string[]) => {
      const changes: StorageChanges = {}

      for (const key of [keys].flat()) {
        if (key in items) {
          changes[key] = { oldValue: items[key] }
          delete items[key]
        }
      }

      commit(changes)
    }),
    /**
     * Test helper: the stored items, without going through the async API.
     */
    peek: () => items,
    reset: () => {
      items = {}
    },
  }
}

const extensionId = 'test-extension-id'

function createFakeBrowser() {
  const onChanged = createEvent()
  let badgeText = ''

  return {
    storage: {
      local: createStorageArea('local', onChanged),
      sync: createStorageArea('sync', onChanged),
      onChanged,
    },
    runtime: {
      id: extensionId,
      getURL: mock((path: string) => `chrome-extension://${extensionId}/${path.replace(/^\//, '')}`),
      sendMessage: mock(async (_message: unknown): Promise<unknown> => undefined),
      openOptionsPage: mock(async () => {}),
      onMessage: createEvent(),
      onInstalled: createEvent(),
    },
    action: {
      getBadgeText: mock(async (_details: unknown) => badgeText),
      setBadgeText: mock(async ({ text }: { text: string }) => {
        badgeText = text
      }),
      setBadgeBackgroundColor: mock(async (_details: unknown) => {}),
      setIcon: mock(async (_details: unknown) => {}),
    },
    tabs: {
      create: mock(async (properties: Record<string, unknown>) => ({ id: 1, ...properties })),
      executeScript: mock(async (_tabId: number, _details: unknown): Promise<unknown[]> => []),
    },
    notifications: {
      create: mock(async (id: string, _options: unknown) => id),
    },
    webNavigation: {
      onCommitted: createEvent(),
    },
    sidePanel: {
      setPanelBehavior: mock(async (_behavior: unknown) => {}),
    },
    resetBadge: () => {
      badgeText = ''
    },
  }
}

export type FakeBrowser = ReturnType<typeof createFakeBrowser>

/**
 * In-memory stand-in for the WebExtension APIs the app uses, exposed as `browser`, `chrome` and the
 * `webextension-polyfill` module.
 */
export const fakeBrowser = createFakeBrowser()

/**
 * Clears stored data, the badge, recorded calls and event listeners between tests. Modules that keep state
 * (e.g. persisted stores) must be re-imported with a fresh module registry to start clean.
 */
export function resetFakeBrowser() {
  const { storage, runtime, action, tabs, notifications, webNavigation, sidePanel } = fakeBrowser

  storage.local.reset()
  storage.sync.reset()
  fakeBrowser.resetBadge()

  for (const event of [storage.onChanged, runtime.onMessage, runtime.onInstalled, webNavigation.onCommitted])
    event.clear()

  for (const api of [storage.local, storage.sync, storage.onChanged, runtime, runtime.onMessage, runtime.onInstalled, action, tabs, notifications, webNavigation.onCommitted, sidePanel]) {
    for (const value of Object.values(api)) {
      if (typeof value === 'function' && 'mockClear' in value)
        (value as ReturnType<typeof mock>).mockClear()
    }
  }
}
