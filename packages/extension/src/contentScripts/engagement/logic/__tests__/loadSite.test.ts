import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import type { ListingPage } from '~/contentScripts/site/base';

import { useRefStore } from '../../store/refStore';
import { initSiteLogic } from '../loadSite';

describe('initSiteLogic', () => {
  beforeEach(() => {
    window.messageGateway = {
      sendMessage: mock(async () => undefined),
    } as unknown as typeof window.messageGateway;
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'messageGateway');
    useRefStore().portalRoot = null;
  });

  function page(
    valid: boolean,
    reInit?: ListingPage['reInit'],
  ): ListingPage & { episodeCards: ReturnType<typeof mock> } {
    return { isValidPage: () => valid, episodeCards: mock(() => []), reInit };
  }

  it('leaves pages without a matching listing alone', async () => {
    const listing = page(false);

    await initSiteLogic({
      listingPages: [listing],
      scope: 'site/anizm',
      theme: 'dark',
    });

    expect(listing.episodeCards).not.toHaveBeenCalled();
    expect(document.body.childElementCount).toBe(0);
  });

  it('adds the site styles and a portal root once, then customizes the cards', async () => {
    const first = page(true);
    const second = page(true);

    await initSiteLogic({
      listingPages: [first, second],
      scope: 'site/anizm',
      theme: 'dark',
    });

    const [style, portal] = Array.from(document.body.children);

    expect(document.body.childElementCount).toBe(2);
    expect(style.getAttribute('href')).toBe(
      'chrome-extension://test-extension-id/dist/contentScripts/site/anizm/style.css',
    );
    expect(portal.classList.contains('ani-score-portal-root')).toBe(true);
    expect(useRefStore().portalRoot!.container).toBe(portal as HTMLDivElement);
    expect(first.episodeCards).toHaveBeenCalledTimes(1);
    expect(second.episodeCards).toHaveBeenCalledTimes(1);
  });

  it('customizes the cards again when the site re-renders them', async () => {
    let reRender!: () => void;
    const listing = page(true, (next) => {
      reRender = next;
    });

    await initSiteLogic({ listingPages: [listing], scope: 'site/anizm' });

    expect(listing.episodeCards).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 300));
    // A burst of re-renders customizes the cards right away, then once more after it settles
    reRender();
    reRender();
    reRender();

    expect(listing.episodeCards).toHaveBeenCalledTimes(2);

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(listing.episodeCards).toHaveBeenCalledTimes(3);
  });

  it('still customizes the cards when the site re-renders them right after the first pass', async () => {
    let reRender!: () => void;
    const listing = page(true, (next) => {
      reRender = next;
    });

    await initSiteLogic({ listingPages: [listing], scope: 'site/anizm' });
    reRender();

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(listing.episodeCards).toHaveBeenCalledTimes(2);
  });
});
