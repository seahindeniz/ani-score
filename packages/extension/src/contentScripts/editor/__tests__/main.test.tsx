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
      cards: [
        {
          selector: '.card',
          title: { selector: 'h3' },
          inject: { position: 'append' },
        },
      ],
    },
  ],
};

const host = () =>
  document.querySelector<HTMLElement>('[data-ani-score-editor]');
const editor = () => within(host()!.shadowRoot as unknown as HTMLElement);
const panel = (name: string) => editor().queryByRole('dialog', { name });

async function open() {
  await openEditor();
  await wait();
}

function close() {
  const cancel = editor().queryByRole('button', { name: 'Cancel' });

  fireEvent.click(cancel ?? editor().getByRole('button', { name: 'Close' }));
}

describe('openEditor', () => {
  beforeEach(() => {
    // Importing the script opened the editor already
    host()?.remove();
    document.body.innerHTML =
      '<div class="card"><h3>Frieren</h3></div><div class="card"><h3>Dandadan</h3></div>';
    window.messageGateway = {
      sendMessage: mock(async () => undefined),
    } as unknown as typeof window.messageGateway;
  });

  afterEach(() => {
    if (host()) close();
    window.aniScoreEngagement?.pause();
    Reflect.deleteProperty(window, 'messageGateway');
    Reflect.deleteProperty(window, 'aniScoreEngagement');
    useRefStore().portalRoot = null;
  });

  it('sets up a site without a setup, and opens only once', async () => {
    await open();
    await open();

    expect(document.querySelectorAll('[data-ani-score-editor]')).toHaveLength(
      1,
    );
    expect(panel('AniScore setup')).toBeTruthy();
  });

  it('pauses AniScore while open, and restarts it after', async () => {
    const engagement = { pause: mock(), restart: mock(async () => {}) };

    window.aniScoreEngagement = engagement;
    await open();

    expect(engagement.pause).toHaveBeenCalledTimes(1);
    expect(window.aniScoreEditing).toBe(true);

    close();
    await wait();

    expect(engagement.restart).toHaveBeenCalledTimes(1);
    expect(window.aniScoreEditing).toBe(false);
    expect(host()).toBeNull();
  });

  it('keeps the saved setup running on a site AniScore was not on before', async () => {
    await fakeBrowser.storage.local.set({
      userSites: [{ config: saved, savedAt: 1 }],
    });
    await open();
    close();
    await wait(50);

    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(2);

    // Opening the editor again pauses it
    await open();

    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(0);

    close();
    await wait(50);

    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(2);
  });

  it("asks first on a site with a setup, and goes on with the user's draft", async () => {
    await fakeBrowser.storage.local.set({
      userSites: [{ config: saved, savedAt: Date.UTC(2026, 9, 12) }],
    });
    await open();

    expect(
      editor().getByRole('dialog', { name: 'example.com is already set up' })
        .textContent,
    ).toContain('You saved a setup for this site on');

    close();

    // Drafts used to be the config alone
    await fakeBrowser.storage.local.set({
      [draftsKey]: { 'example.com': { ...saved, name: 'Drafted example' } },
    });
    await open();

    expect(panel('AniScore editor')).toBeTruthy();

    close();
    await fakeBrowser.storage.local.set({
      [draftsKey]: { 'example.com': { config: saved, step: 1 } },
    });
    await open();

    expect(editor().getByRole('heading', { level: 1 }).textContent).toBe(
      "Pick the anime's name",
    );
  });

  it('keeps the unsaved setup as a draft', async () => {
    await open();
    document.querySelector('h3')!.click();
    await wait(550);

    expect(fakeBrowser.storage.local.peek()[draftsKey]).toEqual({
      'example.com': {
        config: expect.objectContaining({ id: 'example' }),
        step: 0,
      },
    });
    expect(
      (
        fakeBrowser.storage.local.peek()[draftsKey] as Record<
          string,
          { config: SiteConfig }
        >
      )['example.com'].config.pages[0].cards[0].selector,
    ).toBe('body > div.card');
  });

  it("saves to the user's sites, replacing the config with the same id", async () => {
    const anizm = bundledSites.find((site) => site.id === 'anizm')!;
    const mine = { ...anizm, name: 'My Anizm', access: undefined };

    await fakeBrowser.storage.local.set({
      userSites: [
        { config: { ...anizm, name: 'Older' }, savedAt: 1 },
        { config: saved, savedAt: 1 },
      ],
      [draftsKey]: { 'example.com': { config: mine, step: 7 } },
    });
    await open();

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

  it("saves a site the extension doesn't bundle without a fingerprint, and deletes it", async () => {
    await fakeBrowser.storage.local.set({
      [draftsKey]: { 'example.com': { config: saved, step: 7 } },
    });
    await open();

    fireEvent.click(editor().getByRole('button', { name: 'Save' }));
    await wait(10);

    expect(fakeBrowser.storage.local.peek().userSites).toEqual([
      { config: saved, savedAt: expect.any(Number) },
    ]);

    fireEvent.click(editor().getByRole('button', { name: 'Open the editor' }));
    fireEvent.click(editor().getByRole('button', { name: 'More actions' }));
    fireEvent.click(
      editor().getByRole('menuitem', { name: 'Delete this setup' }),
    );
    fireEvent.click(editor().getByRole('button', { name: 'Delete' }));
    await wait(10);

    expect(fakeBrowser.storage.local.peek().userSites).toEqual([]);
    expect(host()).toBeNull();
  });

  it('asks first on a site AniScore comes with a setup for', async () => {
    const { happyDOM } = window as unknown as {
      happyDOM: { setURL: (url: string) => void };
    };

    happyDOM.setURL('https://anizm.net/yeniler');

    try {
      await open();

      expect(
        editor().getByRole('dialog', { name: 'anizm.net is already set up' })
          .textContent,
      ).toContain('AniScore comes with a setup for this site');
    } finally {
      close();
      happyDOM.setURL('https://example.com/');
    }
  });
});
