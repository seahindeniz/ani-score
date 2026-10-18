import type { BrowserContext, Worker } from '@playwright/test'
import type { Manifest } from 'webextension-polyfill'
import { dirname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { test as base, chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const extensionPath = join(__dirname, '../extension')

// The web server counts as ready once Vite serves pages, but the dev watchers may still be
// writing the manifest, background and content scripts. Chromium can't load a partial build.
async function missingBuildFiles() {
  let manifest: Manifest.WebExtensionManifest

  try {
    manifest = await Bun.file(join(extensionPath, 'manifest.json')).json()
  }
  catch {
    return ['manifest.json']
  }

  const serviceWorker = manifest.background && 'service_worker' in manifest.background
    ? manifest.background.service_worker
    : undefined
  const files = [
    ...(serviceWorker ? [serviceWorker] : []),
    ...(manifest.content_scripts ?? []).flatMap(script => script.js ?? []),
    ...['options', 'popup', 'sidepanel'].map(view => `dist/${view}/index.html`),
  ]
  const exists = await Promise.all(files.map(file => Bun.file(join(extensionPath, file)).exists()))

  return files.filter((_, index) => !exists[index])
}

async function waitForExtensionBuild() {
  let missing = await missingBuildFiles()

  while (missing.length) {
    await sleep(250)
    missing = await missingBuildFiles()
  }
}

export const test = base.extend<{
  context: BrowserContext
  background: Worker
  extensionId: string
  /**
   * Writes to the extension's `browser.storage.local`, e.g. to sign in before a page loads.
   */
  setStorage: (items: Record<string, unknown>) => Promise<void>
  getStorage: <T>(key: string) => Promise<T>
}>({
  context: [async ({ headless }, use) => {
    await waitForExtensionBuild()
    const context = await chromium.launchPersistentContext('', {
      // chromium-headless-shell can't load extensions, so use the full Chromium build
      channel: 'chromium',
      headless,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    })
    await use(context)
    await context.close()
  }, { scope: 'test', timeout: 120_000 }],
  background: async ({ context }, use) => {
    // for manifest v3:
    let [background] = context.serviceWorkers()
    if (!background)
      background = await context.waitForEvent('serviceworker')

    await use(background)
  },
  extensionId: async ({ background }, use) => {
    await use(background.url().split('/')[2])
  },
  setStorage: async ({ background }, use) => {
    await use(items => background.evaluate(items => chrome.storage.local.set(items), items))
  },
  getStorage: async ({ background }, use) => {
    await use(key => background.evaluate(async key => (await chrome.storage.local.get(key))[key], key))
  },
})

export const expect = test.expect
