import bundledSites from 'virtual:ani-score/sites';

import { liveInterval } from '~/constants/main';
import type { UserSite } from '~/logic/storage';
import { turnedOffSitesKey, userSitesKey } from '~/logic/storage';
import { findSiteConfig, resolveSites, turnedOn } from '~/sites/resolveSites';
import type { SiteConfig } from '~/sites/schema';
import { keepAlive } from '~/utils/keepAlive';
import { logger } from '~/utils/logger';

import { initSiteLogic } from './logic/loadSite';

/**
 * Starts AniScore on the page when a site config matches its URL, and keeps the background awake while it's open.
 * Returns a function that stops it, or `undefined` when no config matches.
 */
export function engage(url: URL, sites: SiteConfig[]) {
  const site = findSiteConfig(url, sites);

  if (!site) {
    logger.log('No matching site configuration found for this URL.');
    return undefined;
  }

  const stop = initSiteLogic(site);
  const stopKeepAlive = keepAlive(() => {
    void window.messageGateway
      .sendMessage('engage-with-time', Date.now())
      .catch(() => {});
  }, liveInterval);

  return () => {
    stop();
    stopKeepAlive();
  };
}

// The user's configs and the bundled ones, less the sites the user turned off
async function sitesInEffect() {
  const { [userSitesKey]: userSites = [], [turnedOffSitesKey]: turnedOff } =
    (await browser.storage.local.get([userSitesKey, turnedOffSitesKey])) as {
      [userSitesKey]?: UserSite[];
      [turnedOffSitesKey]?: string[];
    };

  return turnedOn(resolveSites(userSites, bundledSites).sites, turnedOff);
}

/**
 * Engages with the user's configs and the bundled ones, and starts over when the user's configs change or a site is
 * turned on or off. Runs once per
 * page, also when both the manifest and a registration for an allowed site inject this script. While the editor is
 * open, it shows its own preview instead (see `window.aniScoreEngagement`).
 */
export async function start() {
  if (window.aniScoreStarted) return;

  window.aniScoreStarted = true;

  let stop: (() => void) | undefined;
  const pause = () => {
    stop?.();
    stop = undefined;
  };
  const restart = async () => {
    const sites = await sitesInEffect();

    pause();

    if (!window.aniScoreEditing) stop = engage(new URL(location.href), sites);
  };

  window.aniScoreEngagement = { pause, restart };
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === 'local'
      && (userSitesKey in changes || turnedOffSitesKey in changes)
    ) {
      void restart();
    }
  });

  await restart();
}

void start();
