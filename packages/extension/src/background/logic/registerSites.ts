import bundledSites from 'virtual:ani-score/sites';

import type { UserSite } from '~/logic/storage';
import { userSitesKey } from '~/logic/storage';
import { resolveSites } from '~/sites/resolveSites';
import { logger } from '~/utils/logger';

export const sitesScriptId = 'ani-score-sites';

// The manifest injects these on the required sites from install
const requiredPatterns = new Set(
  bundledSites
    .filter((site) => site.access === 'required')
    .flatMap((site) => site.matches),
);

async function grantedPatterns() {
  const { [userSitesKey]: userSites = [] } = (await browser.storage.local.get(
    userSitesKey,
  )) as { [userSitesKey]?: UserSite[] };
  const patterns = new Set(
    resolveSites(userSites, bundledSites)
      .sites.flatMap((site) => site.matches)
      .filter((pattern) => !requiredPatterns.has(pattern)),
  );
  const granted = await Promise.all(
    Array.from(patterns, (pattern) =>
      browser.permissions.contains({ origins: [pattern] }),
    ),
  );

  return Array.from(patterns).filter((_, index) => granted[index]);
}

async function sync() {
  const matches = await grantedPatterns();
  // The same scripts the manifest injects on the required sites
  const js = (browser.runtime.getManifest().content_scripts ?? []).flatMap(
    (script) => script.js ?? [],
  );
  const registered = await browser.scripting.getRegisteredContentScripts({
    ids: [sitesScriptId],
  });

  if (registered.length) {
    await browser.scripting.unregisterContentScripts({ ids: [sitesScriptId] });
  }

  if (matches.length) {
    await browser.scripting.registerContentScripts([
      {
        id: sitesScriptId,
        matches,
        // A user's config may also cover a required site (say `*://*.anizm.net/*`), where the manifest injects already
        excludeMatches: Array.from(requiredPatterns),
        js,
        runAt: 'document_idle',
      },
    ]);
  }

  logger.log('Registered AniScore on the allowed sites:', matches);
}

let queue = Promise.resolve();

/**
 * Injects AniScore on the optional sites (bundled or the user's) that the user allowed, and on no others. Runs again
 * whenever the allowed sites or the user's configs change; calls are queued, since each one replaces the registration.
 */
export function syncSiteScripts() {
  queue = queue.then(sync).catch((error: unknown) => logger.error(error));

  return queue;
}

export function watchSites() {
  browser.runtime.onInstalled.addListener(() => void syncSiteScripts());
  browser.runtime.onStartup.addListener(() => void syncSiteScripts());
  browser.permissions.onAdded.addListener(() => void syncSiteScripts());
  browser.permissions.onRemoved.addListener(() => void syncSiteScripts());
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && userSitesKey in changes) {
      void syncSiteScripts();
    }
  });
}
