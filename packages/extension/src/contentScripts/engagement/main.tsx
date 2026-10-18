import bundledSites from 'virtual:ani-score/sites';

import { liveInterval } from '~/constants/main';
import { matchesPattern } from '~/sites/matchPattern';
import type { SiteConfig } from '~/sites/schema';
import { logger } from '~/utils/logger';

import { initSiteLogic } from './logic/loadSite';

export function findSiteConfig(url: URL, sites: SiteConfig[]) {
  return sites.find((site) =>
    site.matches.some((pattern) => matchesPattern(pattern, url)),
  );
}

/**
 * Starts AniScore on the page when a site config matches its URL, and keeps the background awake while it's open.
 * Returns a function that stops it, or `undefined` when no config matches.
 */
export function engage(url = new URL(location.href), sites = bundledSites) {
  const site = findSiteConfig(url, sites);

  if (!site) {
    logger.log('No matching site configuration found for this URL.');
    return undefined;
  }

  const stop = initSiteLogic(site);
  const keepAlive = setInterval(() => {
    void window.messageGateway
      .sendMessage('engage-with-time', Date.now())
      .catch(() => {});
  }, liveInterval);

  return () => {
    stop();
    clearInterval(keepAlive);
  };
}

engage();
