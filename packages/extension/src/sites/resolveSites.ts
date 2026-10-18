import type { UserSite } from '~/logic/storage';

import { matchesPattern } from './matchPattern';
import type { SiteConfig } from './schema';
import { parseSiteConfig } from './schema';

export interface InvalidUserSite {
  index: number;
  id?: string;
  error: string;
}

/**
 * The configs in effect: the user's, then the bundled ones they don't replace (by id). `access` only applies to bundled
 * configs, so a user's config is always optional.
 */
export function resolveSites(userSites: UserSite[], bundled: SiteConfig[]) {
  const user: SiteConfig[] = [];
  const invalid: InvalidUserSite[] = [];

  userSites.forEach((entry, index) => {
    const result = parseSiteConfig(entry.config);

    if (result.success) {
      user.push({ ...result.config, access: 'optional' });
    } else {
      invalid.push({
        index,
        id: (entry.config as { id?: string } | null)?.id,
        error: result.error,
      });
    }
  });

  const userIds = new Set(user.map((site) => site.id));

  return {
    sites: [...user, ...bundled.filter((site) => !userIds.has(site.id))],
    invalid,
  };
}

/**
 * A short, stable digest of a config, to tell whether it changed.
 */
export function siteFingerprint(site: SiteConfig) {
  let hash = 0x811c9dc5;

  for (const char of JSON.stringify(site)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

/**
 * The config, among those in effect, whose patterns match the URL.
 */
export function findSiteConfig(url: URL, sites: SiteConfig[]) {
  return sites.find((site) =>
    site.matches.some((pattern) => matchesPattern(pattern, url)),
  );
}
