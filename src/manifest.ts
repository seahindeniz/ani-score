import type { Manifest } from 'webextension-polyfill'
import type PkgType from '../package.json'
import type { Meta } from './contentScripts/site/base'
import { join } from 'node:path'
import fs from 'fs-extra'
import { isDev, isFirefox, port, r } from '../scripts/utils'
import { contentScripts } from './utils/contentScripts'

export async function getManifest() {
  const pkg = await fs.readJSON(r('package.json')) as typeof PkgType

  const manifest: Manifest.WebExtensionManifest = {
    manifest_version: 3,
    name: pkg.displayName || pkg.name,
    version: pkg.version,
    description: pkg.description,
    action: {
      default_icon: 'assets/icon-512.png',
      default_popup: 'dist/popup/index.html',
    },
    // options_ui: {
    //   page: 'dist/options/index.html',
    //   open_in_tab: true,
    // },
    background: isFirefox
      ? {
          scripts: ['dist/background/index.mjs'],
          type: 'module',
        }
      : {
          service_worker: 'dist/background/index.mjs',
        },
    icons: {
      16: 'assets/icon-512.png',
      48: 'assets/icon-512.png',
      128: 'assets/icon-512.png',
    },
    permissions: [
      // 'tabs',
      'activeTab',
      'storage',
      'sidePanel',
      'notifications',
      'identity',
      'unlimitedStorage',
    ],
    host_permissions: ['*://*/*'],
    content_scripts: [
      ...await Promise.all(contentScripts.map(async (entry) => {
        let config = {
          urlPatterns: ['<all_urls>'] as unknown as `*://${string}`[],
        } as Meta
        const filePath = join(entry.relativeDir, 'meta').replace(/\.(ts|tsx)$/, '').replace(/\\/g, '/')

        try {
          const moduleContent = (await import(filePath)) as typeof import('./contentScripts/site/anizm/meta')

          if (moduleContent?.meta) {
            config = moduleContent.meta
          }
        }
        catch {
          //
        }

        return ({
          matches: config.urlPatterns,
          js: [`dist/contentScripts/${entry.directory}/${entry.name}`],
        })
      })),
    ],
    web_accessible_resources: [
      {
        resources: [
          'dist/contentScripts/**/*.css',
          'dist/sidepanel/index.html',
        ],
        matches: ['<all_urls>'],
      },
    ],
    content_security_policy: {
      extension_pages: isDev
        // this is required on dev for Vite script to load
        ? `script-src \'self\' http://localhost:${port}; object-src \'self\'`
        : 'script-src \'self\'; object-src \'self\'',
    },
  }

  if (isFirefox) {
    manifest.sidebar_action = {
      default_panel: 'dist/sidepanel/index.html',
    }
  }
  else {
    Object.assign(manifest, {
      side_panel: {
        default_path: 'dist/sidepanel/index.html',
      } as chrome.sidePanel.SidePanel,
    })
  }

  // FIXME: not work in MV3
  if (isDev && false) {
    // for content script, as browsers will cache them for each reload,
    // we use a background script to always inject the latest version
    // see src/background/contentScriptHMR.ts
    delete manifest.content_scripts
    manifest.permissions?.push('webNavigation')
  }

  return manifest
}
