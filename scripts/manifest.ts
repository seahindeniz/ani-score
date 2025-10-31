import type { Manifest } from 'webextension-polyfill'
import type PkgType from '../package.json'
import { join } from 'node:path'
import fs from 'fs-extra'
import { argv, isDev, isFirefox, log, port, r } from '../scripts/utils'
import { contentScriptPaths } from '../src/utils/contentScripts'

export async function getManifest() {
  const pkg = await fs.readJSON(r('package.json')) as typeof PkgType

  const contentScripts = [
    ...await Promise.all(contentScriptPaths.map(async (entry) => {
      let config = {
        urlPatterns: ['<all_urls>'] as unknown as `*://${string}`[],
      }
      const filePath = join('../', entry.relativeDir, 'meta').replace(/\.(ts|tsx)$/, '').replace(/\\/g, '/')

      try {
        const moduleContent = (await import(filePath))

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
  ]
  const contentScriptsByScope = Object.groupBy(contentScripts, item => item.matches.includes('<all_urls>' as `*://${string}`) ? 'broad' : 'other')
  const websitePatterns = Array.from(new Set(contentScriptsByScope.other?.flatMap(item => item.matches) || []))

  contentScriptsByScope.broad?.forEach((item) => {
    item.matches = websitePatterns
  })

  const manifest: Manifest.WebExtensionManifest = {
    manifest_version: 3,
    name: pkg.displayName || pkg.name,
    version: pkg.version,
    description: pkg.description,
    action: {
      default_icon: 'assets/icon-512.png',
      // default_popup: 'dist/popup/index.html',
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
      16: 'assets/icon16.png',
      32: 'assets/icon32.png',
      48: 'assets/icon48.png',
      128: 'assets/icon128.png',
    },
    permissions: [
      'storage',
      ...isFirefox ? [] : ['sidePanel'],
      'notifications',
      'unlimitedStorage',
    ],
    host_permissions: [
      ...isDev ? [`http://localhost:${port}/*`] : [],
      'https://github.com/manami-project/anime-offline-database/*',
      'https://release-assets.githubusercontent.com/*',
      'https://graphql.anilist.co/*',
      ...websitePatterns,
    ],
    content_scripts: contentScripts,
    web_accessible_resources: [
      {
        resources: [
          'dist/contentScripts/**/*.css',
          'dist/sidepanel/index.html',
        ],
        matches: [
          'https://anilist.co/*',
          ...websitePatterns.filter(item => item.endsWith('/*')),
        ],
      },
    ],
    content_security_policy: {
      extension_pages: isDev && !isFirefox
        // this is required on dev for Vite script to load
        ? `script-src 'self' http://localhost:${port}; object-src 'self'`
        : `script-src 'self'; object-src 'self'`,
    },
  }

  if (isFirefox) {
    Object.assign(manifest, {
      sidebar_action: {
        default_panel: 'dist/sidepanel/index.html',
      },
      browser_specific_settings: {
        gecko: {
          id: `@${pkg.name}.${pkg.author.name}`,
          strict_min_version: '112.0',
        },
      },
    })
  }
  else {
    Object.assign(manifest, {
      side_panel: {
        default_path: 'dist/sidepanel/index.html',
      },
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

if (argv.writeManifest) {
  getManifest().then(async (manifest) => {
    await fs.writeJSON(r('extension/manifest.json'), manifest, { spaces: 2 })
    log('PRE', 'Manifest written to extension/manifest.json')
  })
}
