import type { AnimeMatch } from '@ani-score/anime-index';

import { createPersistedStore } from './createPersistedStore';

export const useStorageComposable = createPersistedStore(
  'webext-demo',
  'Storage Demo',
);

export const useThemeStore = createPersistedStore<'light' | 'dark' | 'system'>(
  'theme',
  'system',
  { target: 'sync' },
);

export const tokenKey = 'token';

export const useTokenStore = createPersistedStore(tokenKey, { anilist: '' });

export interface ColorEntry {
  id: string;
  name: string;
  color: string;
}

/**
 * Color settings used to be a record keyed by random UUIDs, but `chrome.storage` returns object keys sorted,
 * which shuffled the entries. Arrays keep their order, so the record shape is only read for migration.
 */
type ColorSettings = ColorEntry[] | Record<string, Omit<ColorEntry, 'id'>>;

export function toColorEntries(settings: ColorSettings): ColorEntry[] {
  return Array.isArray(settings)
    ? settings
    : Object.entries(settings).map(([id, entry]) => ({ ...entry, id }));
}

export const useSettingsStore = createPersistedStore('settings', {
  genreColor: [] as ColorSettings,
  tagColor: [] as ColorSettings,
});

export const useAnimeDatabaseSearchCacheStore = createPersistedStore(
  'animeDatabaseResult',
  {} as Record<string, AnimeMatch>,
);

/**
 * A site config the user made or imported. Stored as given and validated where it's used, so a config from an older
 * schema version is migrated rather than lost.
 */
export interface UserSite {
  config: unknown;
  savedAt: number;
  /**
   * `siteFingerprint` of the bundled config this one was made from, to tell when the bundled one changed since.
   */
  basedOn?: string;
}

export const userSitesKey = 'userSites';

export const useUserSitesStore = createPersistedStore(
  userSitesKey,
  [] as UserSite[],
);

/**
 * Ids of the sites the user turned off. The built-in sites that are on from install keep their access (the browser
 * can't take it back), so this list is what keeps AniScore off them; turning off any other site also gives back the
 * access only it needed.
 */
export const turnedOffSitesKey = 'turnedOffSites';

export const useTurnedOffSitesStore = createPersistedStore(
  turnedOffSitesKey,
  [] as string[],
);
