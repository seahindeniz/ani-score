import type { BrowserContext } from '@playwright/test'
import type { Manifest } from 'webextension-polyfill'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { test as base, chromium } from '@playwright/test'
import fs from 'fs-extra'

export { name } from '../package.json'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const extensionPath = join(__dirname, '../extension')

export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  context: async ({ headless }, use) => {
    // workaround for the Vite server has started but contentScript is not yet.
    await sleep(1000)
    const context = await chromium.launchPersistentContext('', {
      headless,
      args: [
        ...(headless ? ['--headless=new'] : []),
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    })
    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    // for manifest v3:
    let [background] = context.serviceWorkers()
    if (!background)
      background = await context.waitForEvent('serviceworker')

    const extensionId = background.url().split('/')[2]
    await use(extensionId)
  },
})

export const expect = test.expect

export function isDevArtifact() {
  const manifest: Manifest.WebExtensionManifest = fs.readJsonSync(resolve(extensionPath, 'manifest.json'))
  return Boolean(
    typeof manifest.content_security_policy === 'object'
    && manifest.content_security_policy.extension_pages?.includes('localhost'),
  )
}
