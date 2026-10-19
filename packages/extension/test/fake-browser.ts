import { mock } from 'bun:test';

type Listener = (...args: any[]) => unknown;

function createEvent() {
  const listeners = new Set<Listener>();

  return {
    addListener: mock((listener: Listener) => void listeners.add(listener)),
    removeListener: mock(
      (listener: Listener) => void listeners.delete(listener),
    ),
    hasListener: (listener: Listener) => listeners.has(listener),
    /**
     * Test helper: calls every listener, like the browser does when the event fires.
     */
    dispatch: (...args: unknown[]) =>
      Array.from(listeners, (listener) => listener(...args)),
    /**
     * Test helper: forgets listeners registered by earlier tests.
     */
    clear: () => listeners.clear(),
  };
}

type StorageChanges = Record<
  string,
  { oldValue?: unknown; newValue?: unknown }
>;

function createStorageArea(
  areaName: 'local' | 'sync',
  onChanged: ReturnType<typeof createEvent>,
) {
  let items: Record<string, unknown> = {};

  // Like the browser: values are copied, and `onChanged` fires after the write resolves
  const commit = (changes: StorageChanges) => {
    if (Object.keys(changes).length)
      setTimeout(() => onChanged.dispatch(changes, areaName));
  };

  return {
    get: mock(
      async (keys?: string | string[] | Record<string, unknown> | null) => {
        if (keys == null) return structuredClone(items);

        const defaults =
          typeof keys === 'string'
            ? { [keys]: undefined }
            : Array.isArray(keys)
              ? Object.fromEntries(keys.map((key) => [key, undefined]))
              : keys;

        return Object.fromEntries(
          Object.entries(defaults).flatMap(([key, fallback]) => {
            const value = key in items ? items[key] : fallback;

            return value === undefined ? [] : [[key, structuredClone(value)]];
          }),
        );
      },
    ),
    set: mock(async (newItems: Record<string, unknown>) => {
      const changes: StorageChanges = {};

      for (const [key, value] of Object.entries(newItems)) {
        changes[key] = {
          oldValue: items[key],
          newValue: structuredClone(value),
        };
        items[key] = structuredClone(value);
      }

      commit(changes);
    }),
    remove: mock(async (keys: string | string[]) => {
      const changes: StorageChanges = {};

      for (const key of [keys].flat()) {
        if (key in items) {
          changes[key] = { oldValue: items[key] };
          delete items[key];
        }
      }

      commit(changes);
    }),
    /**
     * Test helper: the stored items, without going through the async API.
     */
    peek: () => items,
    reset: () => {
      items = {};
    },
  };
}

const extensionId = 'test-extension-id';

interface RegisteredContentScript {
  id: string;
  matches?: string[];
  excludeMatches?: string[];
  js?: string[];
  runAt?: string;
}

function createFakeBrowser() {
  const onChanged = createEvent();
  const onPermissionsAdded = createEvent();
  const onPermissionsRemoved = createEvent();
  let badgeText = '';
  // Optional host permissions the user granted
  const grantedOrigins = new Set<string>();
  let registeredScripts: RegisteredContentScript[] = [];

  return {
    storage: {
      local: createStorageArea('local', onChanged),
      sync: createStorageArea('sync', onChanged),
      onChanged,
    },
    runtime: {
      id: extensionId,
      getURL: mock(
        (path: string) =>
          `chrome-extension://${extensionId}/${path.replace(/^\//, '')}`,
      ),
      sendMessage: mock(
        async (_message: unknown): Promise<unknown> => undefined,
      ),
      openOptionsPage: mock(async () => {}),
      onMessage: createEvent(),
      onInstalled: createEvent(),
      onStartup: createEvent(),
      getManifest: mock(() => ({
        content_scripts: [
          { matches: ['*://anizm.net/*'], js: ['dist/gateway.js'] },
          { matches: ['*://anizm.net/*'], js: ['dist/engagement.js'] },
        ],
      })),
    },
    permissions: {
      contains: mock(async ({ origins = [] }: { origins?: string[] }) =>
        origins.every((origin) => grantedOrigins.has(origin)),
      ),
      // Like the user accepting the browser's prompt; a test can make it decline with `mockResolvedValueOnce(false)`
      request: mock(async ({ origins = [] }: { origins?: string[] }) => {
        origins.forEach((origin) => grantedOrigins.add(origin));
        onPermissionsAdded.dispatch({ origins });

        return true;
      }),
      remove: mock(async ({ origins = [] }: { origins?: string[] }) => {
        origins.forEach((origin) => grantedOrigins.delete(origin));
        onPermissionsRemoved.dispatch({ origins });

        return true;
      }),
      onAdded: onPermissionsAdded,
      onRemoved: onPermissionsRemoved,
    },
    contextMenus: {
      removeAll: mock(async () => {}),
      create: mock((_properties: Record<string, unknown>) => 'id'),
      onClicked: createEvent(),
    },
    scripting: {
      // Resolves with one result per frame, like the browser; set what scripts return with `mockResolvedValueOnce`
      executeScript: mock(
        async (
          _injection: Record<string, unknown>,
        ): Promise<{ result?: unknown }[]> => [{ result: undefined }],
      ),
      getRegisteredContentScripts: mock(
        async ({ ids }: { ids?: string[] } = {}) =>
          registeredScripts.filter((script) => !ids || ids.includes(script.id)),
      ),
      registerContentScripts: mock(
        async (scripts: RegisteredContentScript[]) => {
          registeredScripts.push(...structuredClone(scripts));
        },
      ),
      unregisterContentScripts: mock(
        async ({ ids }: { ids?: string[] } = {}) => {
          registeredScripts = registeredScripts.filter(
            (script) => ids && !ids.includes(script.id),
          );
        },
      ),
    },
    action: {
      getBadgeText: mock(async (_details: unknown) => badgeText),
      setBadgeText: mock(async ({ text }: { text: string }) => {
        badgeText = text;
      }),
      setBadgeBackgroundColor: mock(async ({ color }: { color: unknown }) => {
        if (color === '')
          throw new Error('The color specification could not be parsed.');
      }),
      setIcon: mock(async (_details: unknown) => {}),
    },
    tabs: {
      create: mock(async (properties: Record<string, unknown>) => ({
        id: 1,
        windowId: 1,
        status: 'loading',
        ...properties,
      })),
      // Resolves with the open tabs; set them with `mockResolvedValueOnce`
      query: mock(
        async (
          _query: Record<string, unknown>,
        ): Promise<
          { id: number; windowId: number; active: boolean; url?: string }[]
        > => [],
      ),
      update: mock(async (id: number, properties: Record<string, unknown>) => ({
        id,
        ...properties,
      })),
      onUpdated: createEvent(),
      executeScript: mock(
        async (_tabId: number, _details: unknown): Promise<unknown[]> => [],
      ),
    },
    notifications: {
      create: mock(async (id: string, _options: unknown) => id),
    },
    windows: {
      update: mock(async (id: number, properties: Record<string, unknown>) => ({
        id,
        ...properties,
      })),
    },
    webNavigation: {
      onCommitted: createEvent(),
    },
    sidePanel: {
      setPanelBehavior: mock(async (_behavior: unknown) => {}),
    },
    resetBadge: () => {
      badgeText = '';
    },
    resetPermissions: () => {
      grantedOrigins.clear();
      registeredScripts = [];
    },
  };
}

export type FakeBrowser = ReturnType<typeof createFakeBrowser>;

/**
 * In-memory stand-in for the WebExtension APIs the app uses, exposed as `browser`, `chrome` and the
 * `webextension-polyfill` module.
 */
export const fakeBrowser = createFakeBrowser();

/**
 * Clears stored data, the badge, recorded calls and event listeners between tests. Modules that keep state
 * (e.g. persisted stores) must be re-imported with a fresh module registry to start clean.
 */
export function resetFakeBrowser() {
  const {
    storage,
    runtime,
    action,
    tabs,
    windows,
    notifications,
    webNavigation,
    sidePanel,
    permissions,
    scripting,
    contextMenus,
  } = fakeBrowser;

  storage.local.reset();
  storage.sync.reset();
  fakeBrowser.resetBadge();
  fakeBrowser.resetPermissions();

  for (const event of [
    storage.onChanged,
    runtime.onMessage,
    runtime.onInstalled,
    runtime.onStartup,
    tabs.onUpdated,
    webNavigation.onCommitted,
    permissions.onAdded,
    permissions.onRemoved,
    contextMenus.onClicked,
  ])
    event.clear();

  for (const api of [
    storage.local,
    storage.sync,
    storage.onChanged,
    runtime,
    runtime.onMessage,
    runtime.onInstalled,
    action,
    tabs,
    windows,
    notifications,
    webNavigation.onCommitted,
    sidePanel,
    permissions,
    scripting,
    contextMenus,
    contextMenus.onClicked,
  ]) {
    for (const value of Object.values(api)) {
      if (typeof value === 'function' && 'mockClear' in value)
        (value as ReturnType<typeof mock>).mockClear();
    }
  }
}
