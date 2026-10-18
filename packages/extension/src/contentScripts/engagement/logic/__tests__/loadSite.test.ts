import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import type { SiteConfig, SitePage } from '~/sites/schema';
import { wait } from '~/utils/wait';

import { useRefStore } from '../../store/refStore';
import { createStyle } from '../createStyle';
import { initSiteLogic } from '../loadSite';

// Longer than the 250ms throttle, so a change has been handled
const settle = () => wait(300);

function site(
  overrides: Partial<SiteConfig> = {},
  page: Partial<SitePage> = {},
): SiteConfig {
  return {
    schemaVersion: 1,
    id: 'example',
    name: 'Example',
    matches: ['*://example.com/*'],
    css: '.grid { gap: 30px }',
    pages: [
      {
        match: {},
        cards: [
          {
            selector: '.card',
            title: { selector: 'h3' },
            inject: { position: 'append' },
            shimmer: {},
          },
        ],
        ...page,
      },
    ],
    ...overrides,
  };
}

function addCard(title: string, parent: Element = document.body) {
  const card = document.createElement('div');

  card.className = 'card';
  card.innerHTML = `<h3>${title}</h3>`;
  parent.append(card);

  return card;
}

const detailsOf = (card: Element) => card.querySelectorAll('.ani-score');

describe('initSiteLogic', () => {
  let stop: (() => void) | undefined;
  const querySelectorAll = document.querySelectorAll;
  // Counts the passes over the page: each one queries the card selector
  const passes = () =>
    (document.querySelectorAll as unknown as ReturnType<typeof mock>).mock.calls
      .length;

  beforeEach(() => {
    window.messageGateway = {
      sendMessage: mock(async () => undefined),
    } as unknown as typeof window.messageGateway;
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    document.querySelectorAll = querySelectorAll;
    Reflect.deleteProperty(window, 'messageGateway');
    useRefStore().portalRoot = null;
    history.replaceState(null, '', '/');
  });

  function countPasses() {
    document.querySelectorAll = mock(querySelectorAll) as never;
  }

  it('leaves pages without a matching listing alone', () => {
    addCard('Frieren');
    stop = initSiteLogic(site({}, { match: { path: '^/episodes$' } }));

    expect(document.body.childElementCount).toBe(1);
    expect(detailsOf(document.body)).toHaveLength(0);
  });

  it('adds the styles and a portal root once, then customizes the cards', () => {
    const card = addCard('Frieren');

    stop = initSiteLogic(site());

    const [, style, portal] = Array.from(document.body.children);

    expect(document.body.childElementCount).toBe(3);
    // The shared styles, then the site's
    expect(style.textContent).toContain('.ani-score-portal-root {');
    expect(style.textContent).toEndWith('.grid { gap: 30px }');
    expect(portal.classList.contains('ani-score-portal-root')).toBe(true);
    expect(useRefStore().portalRoot!.container).toBe(portal as HTMLDivElement);
    expect(detailsOf(card)).toHaveLength(1);
  });

  it('customizes the cards the site renders later', async () => {
    stop = initSiteLogic(site());

    const card = addCard('Frieren');

    await settle();

    expect(detailsOf(card)).toHaveLength(1);
  });

  it('renders again when the site reuses a card for another anime', async () => {
    const card = addCard('Frieren');

    stop = initSiteLogic(site());

    const [before] = detailsOf(card);

    card.querySelector('h3')!.firstChild!.textContent = 'Dandadan';
    await settle();

    const [after] = detailsOf(card);

    expect(after).not.toBe(before);
    expect(before.isConnected).toBe(false);
  });

  it('removes the details of cards the site removed', async () => {
    const card = addCard('Frieren');

    stop = initSiteLogic(site());
    card.classList.add('ani-score-watching');
    document.body.replaceChildren();
    await settle();

    expect(detailsOf(card)).toHaveLength(0);
    expect(card.classList.contains('ani-score-watching')).toBe(false);
  });

  it('notices a card the site removed on its own', async () => {
    const list = document.createElement('section');

    document.body.append(list);

    const card = addCard('Frieren', list);

    stop = initSiteLogic(site());
    await settle();
    card.classList.add('ani-score-watching');
    card.remove();
    await settle();

    expect(card.classList.contains('ani-score-watching')).toBe(false);
  });

  it('puts back details the site removed, but not forever', async () => {
    const card = addCard('Frieren');

    stop = initSiteLogic(site());

    for (let removal = 1; removal <= 4; removal++) {
      detailsOf(card)[0].remove();
      await settle();

      expect(detailsOf(card)).toHaveLength(removal <= 3 ? 1 : 0);
    }
  });

  it("doesn't react to its own changes", async () => {
    const card = addCard('Frieren');

    stop = initSiteLogic(site());
    countPasses();

    card.classList.add('ani-score-watching');
    document.body.append(createStyle(''));
    await settle();

    expect(passes()).toBe(0);

    // Another class change is the site's
    card.classList.add('active');
    await settle();

    expect(passes()).toBeGreaterThan(0);
  });

  it('only watches the attributes the config can depend on', async () => {
    const card = addCard('Frieren');

    stop = initSiteLogic(
      site(
        {},
        {
          cards: [
            {
              selector: '.card[data-kind="episode"]',
              title: { source: { attr: 'data-title' } },
              inject: { position: 'append' },
            },
          ],
        },
      ),
    );
    countPasses();

    // Animations change `style` on every frame
    card.style.opacity = '0.5';
    await settle();

    expect(passes()).toBe(0);

    card.setAttribute('data-title', 'Frieren');
    card.setAttribute('data-kind', 'episode');
    await settle();

    expect(detailsOf(card)).toHaveLength(1);
  });

  it("adds and removes a page's styles as the site navigates", async () => {
    history.replaceState(null, '', '/episodes');
    stop = initSiteLogic(
      site({}, { match: { path: '^/episodes$' }, css: '.list { gap: 8px }' }),
    );

    const pageStyle = () =>
      Array.from(document.querySelectorAll('style')).find(
        (style) => style.textContent === '.list { gap: 8px }',
      );

    expect(pageStyle()).toBeDefined();

    history.replaceState(null, '', '/anime/frieren');
    addCard('Frieren');
    await settle();

    expect(pageStyle()).toBeUndefined();

    history.replaceState(null, '', '/episodes');
    document.body.append(document.createElement('main'));
    await settle();

    expect(pageStyle()).toBeDefined();
  });

  it('watches the given element only', async () => {
    const list = document.createElement('section');

    list.id = 'list';
    document.body.append(list);
    stop = initSiteLogic(site({ observe: '#list' }));

    const outside = addCard('Frieren');

    await settle();

    expect(detailsOf(outside)).toHaveLength(0);

    const inside = addCard('Dandadan', list);

    await settle();

    expect(detailsOf(outside)).toHaveLength(1);
    expect(detailsOf(inside)).toHaveLength(1);
  });

  it('watches the given element again when the site replaces it', async () => {
    const list = document.createElement('section');

    list.id = 'list';
    document.body.append(list);
    stop = initSiteLogic(site({ observe: '#list' }));
    await settle();

    const replaced = document.createElement('section');

    replaced.id = 'list';
    list.replaceWith(replaced);
    await settle();

    const card = addCard('Frieren', replaced);

    await settle();

    expect(detailsOf(card)).toHaveLength(1);
  });

  it("stops following the site's theme when stopped, so the next setup's theme holds", async () => {
    const card = addCard('Frieren');
    const themeOf = () =>
      detailsOf(card)[0]
        .shadowRoot!.querySelector('[data-kb-theme]')!
        .getAttribute('data-kb-theme');

    initSiteLogic(site({ theme: { dark: { selector: 'body.dark' } } }))();
    stop = initSiteLogic(site({ theme: 'light' }));
    await settle();

    expect(themeOf()).toBe('light');

    document.body.classList.add('dark');
    await settle();

    expect(themeOf()).toBe('light');
    document.body.classList.remove('dark');
  });

  it('leaves the page as it was when stopped', async () => {
    const card = addCard('Frieren');

    initSiteLogic(site({}, { css: '.list { gap: 8px }' }))();

    expect(detailsOf(card)).toHaveLength(0);
    expect(Array.from(document.body.children)).toEqual([card]);

    const later = addCard('Dandadan');

    await settle();

    expect(detailsOf(later)).toHaveLength(0);
  });
});
