import { describe, expect, it } from 'bun:test';

import {
  cardElements,
  containerLayout,
  detectSteps,
  firstExtract,
  looksDark,
  posterOf,
} from '../detect';

const episodeCards = (...episodes: string[]) => {
  document.body.innerHTML = episodes
    .map((episode) => `<div class="card"><span>${episode}</span></div>`)
    .join('');

  return Array.from(document.querySelectorAll('.card'));
};

describe('cardElements', () => {
  it('finds the cards, without the excluded ones and those missing what they must have', () => {
    document.body.innerHTML = `
      <div class="card"><a href="/1">1</a></div>
      <div class="card">Ad</div>
      <div class="clone"><div class="card"><a href="/2">2</a></div></div>`;

    expect(
      cardElements({
        selector: '.card',
        exclude: '.clone',
        has: 'a',
        title: {},
        inject: { position: 'append' },
      }).map((card) => card.textContent),
    ).toEqual(['1']);
  });

  it('finds nothing for an empty or unfinished selector', () => {
    const card = { title: {}, inject: { position: 'append' as const } };

    expect(cardElements({ ...card, selector: '' })).toEqual([]);
    expect(cardElements({ ...card, selector: 'div[' })).toEqual([]);
  });
});

describe('firstExtract', () => {
  it("is a field's first extraction", () => {
    expect(firstExtract([{ selector: 'h3' }, {}])).toEqual({ selector: 'h3' });
    expect(firstExtract({ selector: 'h3' })).toEqual({ selector: 'h3' });
    expect(firstExtract(undefined)).toBeUndefined();
  });
});

describe('detectSteps', () => {
  it('reads the episode in the format the cards use, also next to a season', () => {
    const cards = episodeCards('12. Bölüm', '2. Sezon 5. Bölüm');

    expect(detectSteps(cards, 'span', 'episode')).toEqual([
      { match: '(\\d+)(?:[.,]\\d+)?\\.\\s*B[öo]l[üu]m', flags: 'i' },
    ]);
  });

  it('falls back to the first number', () => {
    expect(detectSteps(episodeCards('12', '13'), 'span', 'episode')).toEqual([
      { match: '(\\d+)' },
    ]);
  });

  it('finds a season when a card mentions one, and nothing otherwise', () => {
    expect(
      detectSteps(episodeCards('Sezon 2 Bölüm 5'), 'span', 'season'),
    ).toEqual([{ match: 'Sezon\\s*(\\d+)', flags: 'i' }]);
    expect(
      detectSteps(episodeCards('12. Bölüm'), 'span', 'season'),
    ).toBeUndefined();
  });
});

describe('posterOf', () => {
  it("is the element around the card's image", () => {
    document.body.innerHTML =
      '<div class="card"><div class="frame"><img></div></div><div class="flat"><img></div><div class="none"></div>';

    expect(posterOf(document.querySelector('.card')!)?.className).toBe('frame');
    expect(posterOf(document.querySelector('.flat')!)).toBeUndefined();
    expect(posterOf(document.querySelector('.none')!)).toBeUndefined();
  });
});

describe('looksDark', () => {
  it('checks the first background behind the element that shows', () => {
    document.body.innerHTML = `
      <div style="background-color: rgb(20, 24, 33)"><p id="dark" style="background-color: rgba(0, 0, 0, 0)">Dark</p></div>
      <div style="background-color: rgb(250, 250, 250)"><p id="light">Light</p></div>
      <p id="none">None</p>`;

    expect(looksDark(document.getElementById('dark')!)).toBe(true);
    expect(looksDark(document.getElementById('light')!)).toBe(false);
    expect(looksDark(document.getElementById('none')!)).toBe(false);
  });
});

describe('containerLayout', () => {
  it("reads the container's layout and gap", () => {
    document.body.innerHTML =
      '<div id="grid" style="display: grid; column-gap: 20px"></div><div id="flex" style="display: flex"></div>';

    expect(containerLayout(document.getElementById('grid')!)).toEqual({
      mode: 'grid',
      gap: 20,
    });
    expect(containerLayout(document.getElementById('flex')!)).toEqual({
      mode: 'flex',
      gap: 0,
    });
  });
});
