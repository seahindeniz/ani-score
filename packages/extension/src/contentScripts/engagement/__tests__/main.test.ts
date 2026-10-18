import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
} from 'bun:test';

import { useRefStore } from '../store/refStore';
import '../main';

describe('engageWithSite', () => {
  let sendMessage: ReturnType<typeof mock>;

  beforeEach(() => {
    jest.useFakeTimers();
    sendMessage = mock(async () => undefined);
    window.messageGateway = {
      sendMessage,
    } as unknown as typeof window.messageGateway;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    Reflect.deleteProperty(window, 'messageGateway');
    useRefStore().portalRoot = null;
  });

  it('does nothing on sites without a configuration', () => {
    expect(window.engageWithSite(null as never, 'site/unknown')).toBeNull();

    jest.advanceTimersByTime(5000);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('starts the site logic and keeps the background awake', () => {
    const episodeCards = mock(() => []);

    window.engageWithSite(
      { listingPages: [{ isValidPage: () => true, episodeCards }] },
      'site/anizm',
    );

    expect(episodeCards).toHaveBeenCalled();
    expect(document.querySelector('link')!.getAttribute('href')).toContain(
      '/site/anizm/style.css',
    );

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
    window.engageWithSite({ listingPages: [] }, 'site/anizm');

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
