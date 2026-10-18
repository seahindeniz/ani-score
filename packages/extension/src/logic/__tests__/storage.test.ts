import { describe, expect, it } from 'bun:test';

import * as logic from '..';
import {
  toColorEntries,
  useAnimeDatabaseSearchCacheStore,
  useAnimeDatabaseStore,
  useSettingsStore,
  useStorageComposable,
  useThemeStore,
  useTokenStore,
} from '../storage';

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
  it('default to empty settings and tokens', () => {
    expect(useTokenStore().data()).toEqual({ anilist: '' });
    expect(useSettingsStore().data()).toEqual({ genreColor: [], tagColor: [] });
    expect(useAnimeDatabaseStore().data()).toEqual({
      lastUpdate: '',
      source: '',
      data: '',
    });
    expect(useAnimeDatabaseSearchCacheStore().data()).toEqual({});
    expect(useThemeStore().data()).toBe('system');
    expect(useStorageComposable().data()).toBe('Storage Demo');
  });

  it('are re-exported from the logic entry point', () => {
    expect(logic.useTokenStore).toBe(useTokenStore);
    expect(logic.toColorEntries).toBe(toColorEntries);
  });
});
