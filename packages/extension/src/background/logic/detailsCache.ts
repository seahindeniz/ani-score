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
export function readCachedDetails(titles: string[], now = Date.now()) {
  const found: Record<string, AnimeDetails | null> = {};
  const missing: string[] = [];

  for (const title of titles) {
    const entry = entries.get(title);

    if (entry && now - entry.at < detailsTtl) {
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
