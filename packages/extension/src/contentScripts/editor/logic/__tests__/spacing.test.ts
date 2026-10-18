import { describe, expect, it } from 'bun:test';

import { boxesAround, cutsOff, detectSpacing, inCards } from '../spacing';

const list = (container: string, cell: string, inner = '<b>Card</b>') => {
  document.body.innerHTML = `<div class="list" style="${container}"><div class="cell" style="${cell}">${inner}</div><div class="cell" style="${cell}">${inner}</div></div>`;

  return document.querySelector('.cell')!;
};

describe('detectSpacing', () => {
  it("finds a grid's or a row's gap", () => {
    expect(detectSpacing(list('display: grid; column-gap: 20px', ''))).toEqual({
      mode: 'grid',
      method: 'gap',
      space: 20,
    });
    expect(
      detectSpacing(list('display: inline-flex; column-gap: 12px', '')),
    ).toEqual({ mode: 'flex', method: 'gap', space: 12 });
  });

  it("finds the cards' margins, also in a row without a gap", () => {
    expect(
      detectSpacing(list('display: block', 'float: left; margin: 0 10px')),
    ).toEqual({ mode: 'block', method: 'margin', space: 20 });
    expect(detectSpacing(list('display: flex', 'margin-right: 16px'))).toEqual({
      mode: 'flex',
      method: 'margin',
      space: 16,
    });
  });

  it('finds padding around the visible card', () => {
    expect(
      detectSpacing(list('display: block', 'width: 20%; padding: 0 8px')),
    ).toEqual({ mode: 'block', method: 'padding', space: 16 });
    // Padding of the card itself is inside it, not between cards
    expect(
      detectSpacing(list('display: block', 'padding: 0 8px', 'Card')),
    ).toEqual({ mode: 'block', method: 'margin', space: 0 });
  });

  it('suggests a gap for a grid or a row that spaces nothing yet', () => {
    expect(detectSpacing(list('display: grid', ''))).toEqual({
      mode: 'grid',
      method: 'gap',
      space: 0,
    });
    expect(detectSpacing(document.createElement('div'))).toBeUndefined();
  });
});

describe('inCards', () => {
  it('writes a selector for an element in every card', () => {
    document.body.innerHTML = '<div class="card"><p>One</p><p>Two</p></div>';

    const card = document.querySelector('.card')!;
    const [, second] = card.querySelectorAll('p');

    expect(inCards('.list > .card', card, card)).toBe('.list > .card');
    expect(inCards('.card', card, second)).toBe(':is(.card) > p:nth-child(2)');

    card.innerHTML = '<h3>Name</h3>';

    expect(inCards('.card', card, card.firstElementChild!)).toBe(
      ':is(.card) h3',
    );
  });
});

describe('boxesAround', () => {
  it('lists the elements from the details up to the card, and where they are too small', () => {
    document.body.innerHTML = ['One', 'Two', 'Three']
      .map(
        (name) =>
          `<div class="card" style="height: 300px; width: 180px"><div class="info" style="height: 70px; width: 150px"><h3>${name}</h3><div class="ani-score"></div></div></div>`,
      )
      .join('');

    const cards = Array.from(document.querySelectorAll('.card'));
    const size = (element: Element, sizes: Record<string, number>) =>
      Object.defineProperties(
        element,
        Object.fromEntries(
          Object.entries(sizes).map(([name, value]) => [name, { value }]),
        ),
      );

    for (const [index, card] of cards.entries()) {
      // The first two cards are too short there, the first one too narrow as well
      size(card.querySelector('.info')!, {
        scrollHeight: index < 2 ? 120 : 70,
        clientHeight: 70,
        scrollWidth: index < 1 ? 200 : 150,
        clientWidth: 150,
      });
    }

    expect(boxesAround(cards, '.card')).toEqual([
      {
        selector: ':is(.card) div.info',
        height: 70,
        width: 150,
        short: 2,
        narrow: 1,
      },
      { selector: '.card', height: 300, width: 180, short: 0, narrow: 0 },
    ]);
    expect(boxesAround([document.createElement('div')], '.card')).toEqual([]);
  });

  it('tells the boxes that cut the details off', () => {
    const box = { selector: '.a', height: 0, width: 0, short: 0, narrow: 0 };

    expect(cutsOff(box)).toBe(false);
    expect(cutsOff({ ...box, narrow: 1 })).toBe(true);
    expect(cutsOff({ ...box, short: 1 })).toBe(true);
  });
});
