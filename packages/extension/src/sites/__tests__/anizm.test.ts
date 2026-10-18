import { afterEach, describe, expect, it } from 'bun:test';

import sites from 'virtual:ani-score/sites';

import { collectCards, pageMatches } from '~/contentScripts/sites/extract';
import type { EpisodeCard } from '~/contentScripts/sites/types';

const config = sites.find((site) => site.id === 'anizm')!;
const [newEpisodesPage, homePage] = config.pages;

function card(
  title: string | null,
  episode: string | null,
  tag = 'article',
  className = 'v3-episode-card',
) {
  const copy =
    title == null && episode == null
      ? ''
      : `<div class="v3-card-copy">${title == null ? '' : `<h3> ${title} </h3>`}${episode == null ? '' : `<span>${episode}</span>`}</div>`;

  return `<${tag} class="${className}"><div class="v3-poster-frame"></div>${copy}</${tag}>`;
}

const unreadableCards = [
  card(null, null),
  card(null, '3. Bölüm '),
  card('No Episode', null),
  card('Bad Episode', 'Film'),
  card('', '2. Bölüm '),
].join('');

const read = (page: typeof homePage) =>
  collectCards([page]).map(({ title, episodeNumber }) => ({
    title,
    episodeNumber,
  }));

function expectRendersAfterTitle(page: typeof homePage) {
  const [episodeCard] = collectCards([page]) as [EpisodeCard];
  const container = document.createElement('div');

  episodeCard.render(container);

  expect(episodeCard.element.querySelector('h3')!.nextElementSibling).toBe(
    container,
  );
  expect(episodeCard.shimmeringElement).toBe(
    episodeCard.element.querySelector<HTMLElement>('.v3-poster-frame'),
  );
}

afterEach(() => {
  history.replaceState(null, '', '/');
});

describe('anizm', () => {
  it('is injected on every anizm.net page, from install', () => {
    expect(config.matches).toEqual(['*://anizm.net/', '*://anizm.net/*']);
    expect(config.access).toBe('required');
  });

  it('uses the dark theme like the site', () => {
    expect(config.theme).toBe('dark');
  });

  it('keeps its grid gaps, ad overlay fix and shimmer corners', () => {
    expect(config.css).toContain('.v3-latest-grid {');
    expect(config.css).toContain('#dontfoid {');
    expect(config.css).toContain('border-radius: 8px;');
  });

  describe('new episodes page', () => {
    it('only applies to /yeniler', () => {
      history.replaceState(null, '', '/yeniler');
      expect(pageMatches(newEpisodesPage, location)).toBe(true);

      history.replaceState(null, '', '/');
      expect(pageMatches(newEpisodesPage, location)).toBe(false);
    });

    it('reads title and episode number from each card', () => {
      document.body.innerHTML = `<div class="v3-latest-grid">${card('Sousou no Frieren', '5. Bölüm ')}${card('One Piece', '1120. Bölüm ')}</div>`;

      expect(read(newEpisodesPage)).toEqual([
        { title: 'Sousou no Frieren', episodeNumber: 5 },
        { title: 'One Piece', episodeNumber: 1120 },
      ]);
    });

    it('skips cards it cannot read', () => {
      document.body.innerHTML = `<div class="v3-latest-grid">${unreadableCards}</div>`;

      expect(read(newEpisodesPage)).toEqual([]);
    });

    it('renders details after the title and shimmers the poster', () => {
      document.body.innerHTML = `<div class="v3-latest-grid">${card('Frieren', '5. Bölüm ')}</div>`;

      expectRendersAfterTitle(newEpisodesPage);
    });
  });

  describe('home page', () => {
    it('only applies to /', () => {
      expect(pageMatches(homePage, location)).toBe(true);

      history.replaceState(null, '', '/yeniler');
      expect(pageMatches(homePage, location)).toBe(false);
    });

    it('reads episode and series cards from the poster rails', () => {
      document.body.innerHTML = `<div class="v3-poster-rail">${card('Frieren', '5. Bölüm ')}${card('Dandadan', '12. Bölüm ', 'article', 'v3-series-card')}${card('Other', '1. Bölüm ', 'div')}</div>`;

      expect(read(homePage).map((item) => item.title)).toEqual([
        'Frieren',
        'Dandadan',
      ]);
    });

    it('skips cards it cannot read', () => {
      document.body.innerHTML = `<div class="v3-poster-rail">${unreadableCards}</div>`;

      expect(read(homePage)).toEqual([]);
    });

    it('renders details after the title and shimmers the poster', () => {
      document.body.innerHTML = `<div class="v3-poster-rail">${card('Frieren', '5. Bölüm ')}</div>`;

      expectRendersAfterTitle(homePage);
    });
  });
});
