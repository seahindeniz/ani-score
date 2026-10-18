import { describe, expect, it } from 'bun:test';

import { cardElements, firstExtract, looksDark, posterOf } from '../detect';

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
