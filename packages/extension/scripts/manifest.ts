import type { Manifest } from 'webextension-polyfill';

import type PkgType from '../package.json';
import { argv, isDev, isFirefox, log, port, r } from '../scripts/utils';
import { contentScriptPaths } from '../src/utils/contentScripts';
import { loadBundledSites } from './sites';

export async function getManifest() {
  const pkg = (await Bun.file(r('package.json')).json()) as typeof PkgType;

  const sites = loadBundledSites();
  const patternsOf = (access: 'required' | 'optional') =>
    Array.from(
      new Set(
        sites
          .filter((site) => (site.access ?? 'optional') === access)
          .flatMap((site) => site.matches),
      ),
    );
  // Sites the extension may access from install; the engagement script picks the config matching the page
  const websitePatterns = patternsOf('required');
  const contentScripts = contentScriptPaths.map((entry) => ({
    matches: websitePatterns,
    js: [`dist/contentScripts/${entry.directory}/${entry.name}`],
  }));

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
      ...(isFirefox ? [] : ['sidePanel']),
      'notifications',
      'unlimitedStorage',
      // Injects AniScore on the optional sites the user allows (`registerContentScripts`)
      'scripting',
    ],
    // Granted per site when the user turns it on, never at install. `*://*/*` grants nothing by itself: the browser
    // only asks for a site that's declared here, so it lets users add sites that no bundled config lists.
    optional_host_permissions: [...patternsOf('optional'), '*://*/*'],
    host_permissions: [
      ...(isDev ? [`http://localhost:${port}/*`] : []),
      'https://github.com/cedya77/anime-offline-database/*',
      'https://github.com/athanasso/anime-offline-database/*',
      'https://release-assets.githubusercontent.com/*',
      'https://graphql.anilist.co/*',
      ...websitePatterns,
    ],
    content_scripts: contentScripts,
    // AniList's sign-in redirects back to the side panel. Content scripts carry their CSS inline, so web pages
    // can't load (or probe for) anything from the extension.
    web_accessible_resources: [
      {
        resources: ['dist/sidepanel/index.html'],
        matches: ['https://anilist.co/*'],
      },
    ],
    content_security_policy: {
      extension_pages:
        isDev && !isFirefox
          ? // this is required on dev for Vite script to load
            `script-src 'self' http://localhost:${port}; object-src 'self'`
          : `script-src 'self'; object-src 'self'`,
    },
  };

  if (isFirefox) {
    Object.assign(manifest, {
      sidebar_action: {
        default_panel: 'dist/sidepanel/index.html',
      },
      browser_specific_settings: {
        gecko: {
          id: `@${pkg.name}.${pkg.author.name}`,
          // Firefox's built-in data collection consent needs 140+
          strict_min_version: '140.0',
          // Shown at install: card titles are sent to AniList, and so is the AniList sign-in token
          data_collection_permissions: {
            required: ['websiteContent', 'authenticationInfo'],
          },
        },
        // Firefox for Android supports the data collection consent from 142
        gecko_android: {
          strict_min_version: '142.0',
        },
      },
    });
  } else {
    Object.assign(manifest, {
      side_panel: {
        default_path: 'dist/sidepanel/index.html',
      },
    });
  }

  // FIXME: not work in MV3
  // eslint-disable-next-line no-constant-condition -- turned off until it works in MV3
  if (isDev && false) {
    // for content script, as browsers will cache them for each reload,
    // we use a background script to always inject the latest version
    // see src/background/contentScriptHMR.ts
    delete manifest.content_scripts;
    manifest.permissions?.push('webNavigation');
  }

  return manifest;
}

if (argv.writeManifest) {
  getManifest().then(async (manifest) => {
    await Bun.write(
      r('extension/manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    log('PRE', 'Manifest written to extension/manifest.json');
  });
}
