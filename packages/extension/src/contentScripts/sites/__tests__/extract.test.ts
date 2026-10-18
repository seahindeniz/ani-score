import { afterEach, describe, expect, it } from 'bun:test';

import type { SiteCard, SitePage } from '~/sites/schema';

import {
  collectCards,
  pageMatches,
  readCard,
  readField,
  toQueryTitle,
} from '../extract';

function element(html: string) {
  const template = document.createElement('template');

  template.innerHTML = html.trim();

  return template.content.firstElementChild as HTMLElement;
}

function page(...cards: Partial<SiteCard>[]): SitePage {
  return {
    match: {},
    cards: cards.map((card) => ({
      selector: '.card',
      title: { selector: 'h3' },
      inject: { position: 'append' as const },
      ...card,
    })),
  };
}

afterEach(() => {
  history.replaceState(null, '', '/');
});

describe('readField', () => {
  const card = element(`
    <a class="card" href="/anime/blue-box/2/3" title="Blue Box">
      <span class="name">
        Blue Box
        <small>2. Sezon, 3. Bölüm</small>
      </span>
    </a>`);

  it('reads the text, collapsing whitespace', () => {
    expect(readField(card, { selector: '.name' })).toBe(
      'Blue Box 2. Sezon, 3. Bölüm',
    );
  });

  it("reads an element's own text, without its children's", () => {
    expect(readField(card, { selector: '.name', source: 'ownText' })).toBe(
      'Blue Box',
    );
  });

  it('reads an attribute, of the card itself by default', () => {
    expect(readField(card, { source: { attr: 'href' } })).toBe(
      '/anime/blue-box/2/3',
    );
    expect(readField(card, { source: { attr: 'data-missing' } })).toBe('');
  });

  it('applies the steps in order', () => {
    expect(
      readField(card, {
        source: { attr: 'href' },
        steps: [{ match: '/(\\d+)/(\\d+)$', group: 2 }],
      }),
    ).toBe('3');
    expect(
      readField(card, {
        selector: 'small',
        steps: [
          { replace: 'SEZON', with: 'Season', flags: 'i' },
          { match: '^(.*?),' },
        ],
      }),
    ).toBe('2. Season');
    expect(
      readField(card, {
        selector: 'small',
        steps: [{ match: 'Episode (\\d+)' }],
      }),
    ).toBe('');
  });

  it('falls back to the next extraction while one comes out empty', () => {
    expect(
      readField(card, [
        { selector: '.missing' },
        { selector: 'small', steps: [{ match: 'Episode (\\d+)' }] },
        { source: { attr: 'title' } },
      ]),
    ).toBe('Blue Box');
    expect(readField(card, [{ selector: '.missing' }])).toBe('');
  });
});

describe('readCard', () => {
  const html = `
    <div class="card">
      <img class="poster">
      <h3>Blue Box</h3>
      <p class="episode">Bölüm 3</p>
      <p class="season">Sezon 2</p>
    </div>`;
  const spec: SiteCard = {
    selector: '.card',
    title: { selector: 'h3' },
    episode: { selector: '.episode', steps: [{ match: '(\\d+)' }] },
    season: { selector: '.season', steps: [{ match: '(\\d+)' }] },
    inject: { selector: '.poster', position: 'after' },
    shimmer: { selector: '.poster' },
  };

  it('looks the anime up with its season, from the second one on', () => {
    expect(toQueryTitle('Blue Box')).toBe('Blue Box');
    expect(toQueryTitle('Blue Box', 1)).toBe('Blue Box');
    expect(toQueryTitle('Blue Box', 2)).toBe('Blue Box Season 2');

    const card = readCard(element(html), spec)!;

    expect(card.title).toBe('Blue Box Season 2');
    expect(card.episodeNumber).toBe(3);
  });

  it('renders where the config says and shimmers the given element', () => {
    const cardElement = element(html);
    const card = readCard(cardElement, spec)!;
    const container = document.createElement('div');

    card.render(container);

    expect(cardElement.querySelector('.poster')!.nextElementSibling).toBe(
      container,
    );
    expect(card.shimmeringElement).toBe(cardElement.querySelector('.poster'));
  });

  it('defaults to the card itself, and to no shimmer', () => {
    const cardElement = element(html);

    expect(
      readCard(cardElement, { ...spec, shimmer: {} })!.shimmeringElement,
    ).toBe(cardElement);
    expect(
      readCard(cardElement, { ...spec, shimmer: undefined })!.shimmeringElement,
    ).toBeNull();

    const card = readCard(cardElement, {
      ...spec,
      inject: { position: 'prepend' },
    })!;
    const container = document.createElement('div');

    card.render(container);

    expect(cardElement.firstElementChild).toBe(container);
  });

  it('does without an episode number when the config has none', () => {
    const card = readCard(element(html), {
      ...spec,
      episode: undefined,
      season: undefined,
    })!;

    expect(card.title).toBe('Blue Box');
    expect(card.episodeNumber).toBeUndefined();
  });

  it('keeps a card whose episode it cannot read, when the config allows it', () => {
    const card = readCard(element(html), {
      ...spec,
      episode: { selector: 'h3' },
      season: undefined,
      allowMissingEpisode: true,
    })!;

    expect(card.title).toBe('Blue Box');
    expect(card.episodeNumber).toBeUndefined();
  });

  it('ignores a season it cannot read', () => {
    expect(
      readCard(element(html), { ...spec, season: { selector: '.missing' } })!
        .title,
    ).toBe('Blue Box');
  });

  it('skips cards without a title, a declared episode or the injection point', () => {
    expect(
      readCard(element(html), { ...spec, title: { selector: '.missing' } }),
    ).toBeUndefined();
    expect(
      readCard(element(html), {
        ...spec,
        episode: { selector: 'h3' },
      }),
    ).toBeUndefined();
    expect(
      readCard(element(html), {
        ...spec,
        inject: { selector: '.missing', position: 'after' },
      }),
    ).toBeUndefined();
  });
});

describe('pageMatches', () => {
  it('tests the path, the query and an element, all of the given ones', () => {
    history.replaceState(null, '', '/episodes/latest/2?sort=new');
    document.body.innerHTML = '<main class="episodes"></main>';

    const matches = (match: SitePage['match']) =>
      pageMatches({ ...page(), match }, location);

    expect(matches({})).toBe(true);
    expect(matches({ path: '^/episodes/latest/\\d+$' })).toBe(true);
    expect(matches({ path: '^/$' })).toBe(false);
    expect(matches({ search: 'sort=new' })).toBe(true);
    expect(matches({ search: 'sort=old' })).toBe(false);
    expect(matches({ selector: 'main.episodes' })).toBe(true);
    expect(matches({ selector: 'main.series' })).toBe(false);
  });
});

describe('collectCards', () => {
  it('reads every readable card', () => {
    document.body.innerHTML = `
      <div class="card"><h3>Frieren</h3></div>
      <div class="card"><h3></h3></div>
      <div class="card"><h3>Dandadan</h3></div>`;

    expect(collectCards([page({})]).map((card) => card.title)).toEqual([
      'Frieren',
      'Dandadan',
    ]);
  });

  it('skips excluded cards, also inside an excluded element', () => {
    document.body.innerHTML = `
      <div class="card"><h3>Frieren</h3></div>
      <div class="card skeleton"><h3>Loading</h3></div>
      <div class="cloned"><div class="card"><h3>Frieren clone</h3></div></div>`;

    expect(
      collectCards([page({ exclude: '.skeleton, .cloned' })]).map(
        (card) => card.title,
      ),
    ).toEqual(['Frieren']);
  });

  it('only keeps cards that contain the given element', () => {
    document.body.innerHTML = `
      <div class="card"><a href="/frieren/bolum-3"></a><h3>Frieren</h3></div>
      <div class="card"><a href="/dandadan"></a><h3>Dandadan</h3></div>`;

    expect(
      collectCards([page({ has: 'a[href*="/bolum-"]' })]).map(
        (card) => card.title,
      ),
    ).toEqual(['Frieren']);
  });

  it('counts a card once, for the first card type that reads it', () => {
    document.body.innerHTML = `
      <div class="card episode"><h3>Frieren</h3><p>Bölüm 3</p></div>
      <div class="card"><h3>Dandadan</h3></div>`;

    const cards = collectCards([
      page({
        selector: '.card.episode',
        episode: { selector: 'p', steps: [{ match: '(\\d+)' }] },
      }),
      page({ selector: '.card' }),
    ]);

    expect(
      cards.map(({ title, episodeNumber }) => ({ title, episodeNumber })),
    ).toEqual([
      { title: 'Frieren', episodeNumber: 3 },
      { title: 'Dandadan', episodeNumber: undefined },
    ]);
  });

  it('lets a later card type read a card the earlier one could not', () => {
    document.body.innerHTML = '<div class="card"><h4>Frieren</h4></div>';

    expect(
      collectCards([page({}), page({ title: { selector: 'h4' } })]).map(
        (card) => card.title,
      ),
    ).toEqual(['Frieren']);
  });
});
