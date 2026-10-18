import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { fireEvent, within } from '@solidjs/testing-library';
import bundledSites from 'virtual:ani-score/sites';

import { useRefStore } from '~/contentScripts/engagement/store/refStore';
import { siteFingerprint } from '~/sites/resolveSites';
import type { SiteConfig } from '~/sites/schema';
import { wait } from '~/utils/wait';

import { fakeBrowser } from '../../../../test/fake-browser';
import { draftsKey, openEditor } from '../main';

const saved: SiteConfig = {
  schemaVersion: 1,
  id: 'example',
  name: 'Saved example',
  matches: ['*://example.com/*'],
  pages: [
    {
      match: {},
      cards: [{ selector: '.card', title: {}, inject: { position: 'append' } }],
    },
  ],
};

const host = () =>
  document.querySelector<HTMLElement>('[data-ani-score-editor]');
const editor = () => within(host()!.shadowRoot as unknown as HTMLElement);
const title = () =>
  editor().getByRole('dialog').querySelector('strong')!.textContent;

async function open() {
  await openEditor();
  await wait();
}

function close() {
  fireEvent.click(editor().getByRole('button', { name: 'Close' }));
}

describe('openEditor', () => {
  beforeEach(() => {
    // Importing the script opened the editor already
    host()?.remove();
    window.messageGateway = {
      sendMessage: mock(async () => undefined),
    } as unknown as typeof window.messageGateway;
  });

  afterEach(() => {
    if (host()) close();
    Reflect.deleteProperty(window, 'messageGateway');
    Reflect.deleteProperty(window, 'aniScoreEngagement');
    useRefStore().portalRoot = null;
  });

  it('starts a new config on a site without one, and opens only once', async () => {
    await open();
    await open();

    expect(document.querySelectorAll('[data-ani-score-editor]')).toHaveLength(
      1,
    );
    expect(title()).toBe('AniScore · Example');
  });

  it('pauses AniScore while open, and restarts it after', async () => {
    const engagement = { pause: mock(), restart: mock(async () => {}) };

    window.aniScoreEngagement = engagement;
    await open();

    expect(engagement.pause).toHaveBeenCalledTimes(1);
    expect(window.aniScoreEditing).toBe(true);

    close();

    expect(engagement.restart).toHaveBeenCalledTimes(1);
    expect(window.aniScoreEditing).toBe(false);
    expect(host()).toBeNull();
  });

  it("starts from the config in effect, or from the user's draft", async () => {
    await fakeBrowser.storage.local.set({
      userSites: [{ config: saved, savedAt: 1 }],
    });
    await open();

    expect(title()).toBe('AniScore · Saved example');

    close();
    await fakeBrowser.storage.local.set({
      [draftsKey]: { 'example.com': { ...saved, name: 'Drafted example' } },
    });
    await open();

    expect(title()).toBe('AniScore · Drafted example');
  });

  it('keeps unsaved changes as a draft, and starts over from the saved config', async () => {
    await fakeBrowser.storage.local.set({
      userSites: [{ config: saved, savedAt: 1 }],
    });
    await open();

    fireEvent.click(editor().getByRole('tab', { name: 'Site' }));
    fireEvent.input(editor().getByRole('textbox', { name: /^Name/ }), {
      target: { value: 'Renamed' },
    });
    await wait(550);

    expect(fakeBrowser.storage.local.peek()[draftsKey]).toEqual({
      'example.com': { ...saved, name: 'Renamed' },
    });

    fireEvent.click(editor().getByRole('button', { name: 'Start over' }));
    await wait(10);

    expect(title()).toBe('AniScore · Saved example');
    expect(fakeBrowser.storage.local.peek()[draftsKey]).toEqual({});
  });

  it("saves to the user's sites, replacing the config with the same id", async () => {
    const anizm = bundledSites.find((site) => site.id === 'anizm')!;

    await fakeBrowser.storage.local.set({
      userSites: [
        { config: { ...anizm, name: 'Older' }, savedAt: 1 },
        { config: saved, savedAt: 1 },
      ],
      [draftsKey]: {
        'example.com': { ...anizm, name: 'My Anizm', access: undefined },
      },
    });
    await open();

    fireEvent.click(editor().getByRole('tab', { name: 'Save' }));
    fireEvent.click(editor().getByRole('button', { name: 'Save' }));
    await wait(10);

    const stored = fakeBrowser.storage.local.peek();

    expect(stored.userSites).toEqual([
      { config: saved, savedAt: 1 },
      {
        config: expect.objectContaining({ id: 'anizm', name: 'My Anizm' }),
        savedAt: expect.any(Number),
        basedOn: siteFingerprint(anizm),
      },
    ]);
    expect(stored[draftsKey]).toEqual({});
  });

  it("saves a site the extension doesn't bundle without a fingerprint", async () => {
    await fakeBrowser.storage.local.set({
      [draftsKey]: { 'example.com': saved },
    });
    await open();

    fireEvent.click(editor().getByRole('tab', { name: 'Save' }));
    fireEvent.click(editor().getByRole('button', { name: 'Save' }));
    await wait(10);

    expect(fakeBrowser.storage.local.peek().userSites).toEqual([
      { config: saved, savedAt: expect.any(Number) },
    ]);
  });
});
