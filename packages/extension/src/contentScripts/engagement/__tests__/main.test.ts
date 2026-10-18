import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
} from 'bun:test';

import { findSiteConfig } from '~/sites/resolveSites';
import type { SiteConfig } from '~/sites/schema';
import { wait } from '~/utils/wait';

import { fakeBrowser } from '../../../../test/fake-browser';
import { engage, start } from '../main';
import { useRefStore } from '../store/refStore';

const example: SiteConfig = {
  schemaVersion: 1,
  id: 'example',
  name: 'Example',
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
const other: SiteConfig = {
  ...example,
  id: 'other',
  matches: ['*://other.org/*'],
};

describe('engage', () => {
  let sendMessage: ReturnType<typeof mock>;
  let stop: (() => void) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    sendMessage = mock(async () => undefined);
    window.messageGateway = {
      sendMessage,
    } as unknown as typeof window.messageGateway;
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    jest.clearAllTimers();
    jest.useRealTimers();
    Reflect.deleteProperty(window, 'messageGateway');
    useRefStore().portalRoot = null;
  });

  it('picks the config whose patterns match the URL', () => {
    expect(
      findSiteConfig(new URL('https://other.org/list'), [example, other]),
    ).toBe(other);
    expect(
      findSiteConfig(new URL('https://unknown.net/'), [example, other]),
    ).toBeUndefined();
  });

  it('does nothing on sites without a configuration', () => {
    expect(engage(new URL('https://unknown.net/'), [example])).toBeUndefined();

    jest.advanceTimersByTime(5000);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('starts the site logic and keeps the background awake', () => {
    document.body.innerHTML = '<div class="card"><h3>Frieren</h3></div>';

    stop = engage(new URL('https://example.com/'), [example]);

    expect(document.querySelector('.card .ani-score')).not.toBeNull();

    jest.advanceTimersByTime(5000);

    expect(sendMessage).toHaveBeenCalledWith(
      'engage-with-time',
      expect.any(Number),
    );
  });

  it('ignores failed keep-alive pings', async () => {
    sendMessage.mockImplementation(async () => {
      throw new Error('Extension context invalidated.');
    });
    stop = engage(new URL('https://example.com/'), [example]);

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(sendMessage).toHaveBeenCalledWith(
      'engage-with-time',
      expect.any(Number),
    );
  });

  it('stops the site logic and the keep-alive', () => {
    document.body.innerHTML = '<div class="card"><h3>Frieren</h3></div>';
    engage(new URL('https://example.com/'), [example])!();

    jest.advanceTimersByTime(5000);

    expect(document.querySelector('.card .ani-score')).toBeNull();
    expect(sendMessage).not.toHaveBeenCalledWith(
      'engage-with-time',
      expect.any(Number),
    );
  });
});

describe('start', () => {
  beforeEach(() => {
    // Importing the script started it already; each test starts it afresh
    window.aniScoreStarted = false;
    fakeBrowser.storage.onChanged.clear();
    window.messageGateway = {
      sendMessage: mock(async () => undefined),
    } as unknown as typeof window.messageGateway;
  });

  afterEach(async () => {
    // Stops the site logic the test started
    await fakeBrowser.storage.local.set({ userSites: [] });
    await wait(10);
    Reflect.deleteProperty(window, 'messageGateway');
    useRefStore().portalRoot = null;
  });

  it("engages with the user's configs, and again when they change", async () => {
    document.body.innerHTML = '<div class="card"><h3>Frieren</h3></div>';
    await fakeBrowser.storage.local.set({
      userSites: [{ config: example, savedAt: 1 }],
    });
    await start();

    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(1);

    await fakeBrowser.storage.local.set({
      userSites: [
        {
          config: { ...example, pages: [{ ...example.pages[0], css: '.x{}' }] },
          savedAt: 2,
        },
      ],
    });
    await wait(10);

    // Started over: one set of details, with the new page styles
    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(1);
    expect(
      Array.from(document.querySelectorAll('style')).some(
        (style) => style.textContent === '.x{}',
      ),
    ).toBe(true);

    // Other storage changes don't matter
    fakeBrowser.storage.onChanged.dispatch({ userSites: {} }, 'sync');
    await fakeBrowser.storage.local.set({ theme: 'dark' });
    await wait(10);

    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(1);
  });

  it('leaves the sites the user turned off, and comes back when turned on', async () => {
    document.body.innerHTML = '<div class="card"><h3>Frieren</h3></div>';
    await fakeBrowser.storage.local.set({
      userSites: [{ config: example, savedAt: 1 }],
      turnedOffSites: ['example'],
    });
    await start();

    expect(document.querySelector('.ani-score')).toBeNull();

    await fakeBrowser.storage.local.set({ turnedOffSites: [] });
    await wait(10);

    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(1);

    await fakeBrowser.storage.local.set({ turnedOffSites: ['example'] });
    await wait(10);

    expect(document.querySelector('.ani-score')).toBeNull();
  });

  it('runs once per page', async () => {
    await start();
    await start();

    expect(fakeBrowser.storage.local.get).toHaveBeenCalledTimes(1);
  });

  it('pauses for the editor, and stays paused while it is open', async () => {
    document.body.innerHTML = '<div class="card"><h3>Frieren</h3></div>';
    await fakeBrowser.storage.local.set({
      userSites: [{ config: example, savedAt: 1 }],
    });
    await start();

    window.aniScoreEngagement!.pause();
    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(0);

    // Saving in the editor changes the configs, but its preview shows the page
    window.aniScoreEditing = true;
    await window.aniScoreEngagement!.restart();
    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(0);

    window.aniScoreEditing = false;
    await window.aniScoreEngagement!.restart();
    expect(document.querySelectorAll('.card .ani-score')).toHaveLength(1);
  });
});
