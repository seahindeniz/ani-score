import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
} from 'bun:test';

import type { SiteConfig } from '~/sites/schema';

import { engage, findSiteConfig } from '../main';
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
