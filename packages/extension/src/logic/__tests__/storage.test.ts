import { describe, expect, it } from 'bun:test';

import * as logic from '..';
import { toColorEntries, useTokenStore } from '../storage';

describe('toColorEntries', () => {
  it('returns entry arrays as they are', () => {
    const entries = [
      { id: 'b', name: 'Drama', color: '#00f' },
      { id: 'a', name: 'Action', color: '#f00' },
    ];

    expect(toColorEntries(entries)).toBe(entries);
  });

  it('migrates the old record shape, keeping ids', () => {
    expect(toColorEntries({ x1: { name: 'Action', color: '#f00' } })).toEqual([
      { id: 'x1', name: 'Action', color: '#f00' },
    ]);
  });
});

describe('stores', () => {
  it('default to empty settings and tokens', async () => {
    // A fresh copy of the module: other test files in the run change the shared stores
    const fresh = '../storage.ts?case=defaults';
    const stores = (await import(fresh)) as typeof import('../storage');

    expect(stores.useTokenStore().data()).toEqual({ anilist: '' });
    expect(stores.useSettingsStore().data()).toEqual({
      genreColor: [],
      tagColor: [],
    });
    expect(stores.useAnimeDatabaseSearchCacheStore().data()).toEqual({});
    expect(stores.useThemeStore().data()).toBe('system');
    expect(stores.useStorageComposable().data()).toBe('Storage Demo');
  });

  it('are re-exported from the logic entry point', () => {
    expect(logic.useTokenStore).toBe(useTokenStore);
    expect(logic.toColorEntries).toBe(toColorEntries);
  });
});
