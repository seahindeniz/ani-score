import { describe, expect, it } from 'bun:test';

import type { UserSite } from '~/logic/storage';
import type { SiteConfig } from '~/sites/schema';
import { wait } from '~/utils/wait';

import { fakeBrowser } from '../../../../test/fake-browser';
import { sitesScriptId, syncSiteScripts, watchSites } from '../registerSites';

function userSite(id: string, matches: string[]): UserSite {
  const config: SiteConfig = {
    schemaVersion: 1,
    id,
    name: id,
    matches,
    pages: [
      {
        match: {},
        cards: [
          { selector: '.card', title: {}, inject: { position: 'append' } },
        ],
      },
    ],
  };

  return { config, savedAt: 1 };
}

const registered = () =>
  fakeBrowser.scripting.getRegisteredContentScripts({ ids: [sitesScriptId] });

describe('syncSiteScripts', () => {
  it('injects the content scripts on the allowed sites only', async () => {
    await fakeBrowser.storage.local.set({
      userSites: [
        userSite('openani', ['*://openani.me/*']),
        userSite('animex', ['*://www.animex.club/*']),
      ],
    });
    await fakeBrowser.permissions.request({ origins: ['*://openani.me/*'] });
    await syncSiteScripts();

    expect(await registered()).toEqual([
      {
        id: sitesScriptId,
        matches: ['*://openani.me/*'],
        excludeMatches: [
          '*://anizm.net/',
          '*://anizm.net/*',
          '*://www.tranimeizle.live/',
          '*://www.tranimeizle.live/*',
        ],
        js: ['dist/gateway.js', 'dist/engagement.js'],
        runAt: 'document_idle',
      },
    ]);
  });

  it("leaves the required sites to the manifest, also when a user's config covers one", async () => {
    await fakeBrowser.storage.local.set({
      userSites: [userSite('anizm', ['*://anizm.net/*'])],
    });
    await fakeBrowser.permissions.request({ origins: ['*://anizm.net/*'] });
    await syncSiteScripts();

    expect(await registered()).toEqual([]);
  });

  it('replaces the registration, and removes it once no site is allowed', async () => {
    await fakeBrowser.storage.local.set({
      userSites: [userSite('openani', ['*://openani.me/*'])],
    });
    await fakeBrowser.permissions.request({ origins: ['*://openani.me/*'] });
    await syncSiteScripts();
    await syncSiteScripts();

    expect(await registered()).toHaveLength(1);

    await fakeBrowser.permissions.remove({ origins: ['*://openani.me/*'] });
    await syncSiteScripts();

    expect(await registered()).toEqual([]);
  });

  it('keeps syncing after a failed sync', async () => {
    await fakeBrowser.storage.local.set({
      userSites: [userSite('openani', ['*://openani.me/*'])],
    });
    await fakeBrowser.permissions.request({ origins: ['*://openani.me/*'] });
    fakeBrowser.scripting.getRegisteredContentScripts.mockImplementationOnce(
      async () => {
        throw new Error('scripting unavailable');
      },
    );

    await syncSiteScripts();

    expect(await registered()).toEqual([]);

    await syncSiteScripts();

    expect(await registered()).toHaveLength(1);
  });
});

describe('watchSites', () => {
  it('syncs on startup, install, permission and config changes', async () => {
    const userSites = [userSite('openani', ['*://openani.me/*'])];

    // Storage change events still pending from the other tests
    await wait(10);
    watchSites();

    const syncs = () =>
      fakeBrowser.scripting.getRegisteredContentScripts.mock.calls.length;
    const expectSync = async (trigger: () => unknown) => {
      const before = syncs();

      await trigger();
      await wait(10);

      expect(syncs()).toBe(before + 1);
    };

    await expectSync(() => fakeBrowser.runtime.onStartup.dispatch());
    await expectSync(() => fakeBrowser.runtime.onInstalled.dispatch());
    await expectSync(() =>
      fakeBrowser.permissions.request({ origins: ['*://openani.me/*'] }),
    );
    await expectSync(() =>
      fakeBrowser.permissions.remove({ origins: ['*://openani.me/*'] }),
    );
    await expectSync(() => fakeBrowser.storage.local.set({ userSites }));

    // Other settings don't matter
    const before = syncs();

    await fakeBrowser.storage.local.set({ theme: 'dark' });
    fakeBrowser.storage.onChanged.dispatch({ userSites: {} }, 'sync');
    await wait(10);

    expect(syncs()).toBe(before);
  });
});
