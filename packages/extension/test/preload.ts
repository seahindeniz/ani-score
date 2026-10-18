import { afterEach, mock } from 'bun:test';

import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { plugin } from 'bun';

import { fakeBrowser, resetFakeBrowser } from './fake-browser';
import { viteCompatPlugin } from './vite-compat-plugin';

GlobalRegistrator.register({
  url: 'https://example.com/',
  // Content scripts add <link> stylesheets; happy-dom can't load them and would log an error for each
  settings: { handleDisabledFileLoadingAsSuccess: true },
});
plugin(viteCompatPlugin);

// Values Vite's `define` replaces at build time
Object.assign(globalThis, {
  __DEV__: true,
  __NAME__: 'ani-score',
  __TARGET_BROWSER__: 'chrome',
  ANILIST_TOKEN_URL: 'https://anilist.co/api/v2/oauth/authorize?client_id=test',
  // `browser` is auto-imported by unplugin-auto-import in the app
  browser: fakeBrowser,
  chrome: fakeBrowser,
});

mock.module('webextension-polyfill', () => ({ default: fakeBrowser }));

afterEach(() => {
  resetFakeBrowser();
  document.body.replaceChildren();
  document.head.replaceChildren();
});
