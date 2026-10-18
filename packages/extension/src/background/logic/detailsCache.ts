import { tokenKey } from '~/logic/storage';

import type { AnimeDetails } from './fetchDetails';

/**
 * How long AniList's details for a title are used again before asking anew.
 */
export const detailsTtl = 15 * 60 * 1000;

interface Entry {
  at: number;
  details: AnimeDetails | null;
}

// In memory: the service worker lives as long as pages keep talking to it (they do every few seconds), and a worker
// started over just asks AniList again
const entries = new Map<string, Entry>();

/**
 * AniList's details by title, kept for `detailsTtl`, so a page that draws its cards again (and the site editor's
 * preview, which starts over on every change) doesn't ask AniList again. A title AniList didn't find is kept too.
 * Returns what's kept, and the titles to ask for.
 */
export function readCachedDetails(
  titles: string[],
  {
    now = Date.now(),
    /**
     * Asks again for details kept longer than this, e.g. 0 after the user changed the anime on AniList.
     */
    maxAge = detailsTtl,
  } = {},
) {
  const found: Record<string, AnimeDetails | null> = {};
  const missing: string[] = [];

  for (const title of titles) {
    const entry = entries.get(title);

    if (entry && now - entry.at < Math.min(maxAge, detailsTtl)) {
      found[title] = entry.details;
    } else {
      entries.delete(title);
      missing.push(title);
    }
  }

  return { found, missing };
}

export function cacheDetails(
  details: Record<string, AnimeDetails | null>,
  now = Date.now(),
) {
  for (const [title, value] of Object.entries(details)) {
    entries.set(title, { at: now, details: value });
  }
}

/**
 * Drops what's kept for the titles that match, e.g. after the user changed the anime on AniList.
 */
export function forgetDetails(
  matches: (title: string, details: AnimeDetails | null) => boolean,
) {
  for (const [title, entry] of entries) {
    if (matches(title, entry.details)) entries.delete(title);
  }
}

/**
 * The details hold the signed-in user's list progress and favourites, so signing in, out or as someone else (and
 * AniList rejecting the token) starts over.
 */
export function watchAccount() {
  const tokenOf = (value: unknown) =>
    (value as { anilist?: string } | undefined)?.anilist ?? '';

  browser.storage.onChanged.addListener((changes, areaName) => {
    const change = areaName === 'local' ? changes[tokenKey] : undefined;

    if (change && tokenOf(change.oldValue) !== tokenOf(change.newValue)) {
      entries.clear();
    }
  });
}
