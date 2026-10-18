import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

import { cardSpec, episodeGrid, settle } from '../../__tests__/harness';
import { NamePart, nameSummary } from '../NamePart';
import { renderCardPart } from './render';

afterEach(cleanup);

describe('NamePart', () => {
  it('picks the name as it opens, and shows the names it reads', async () => {
    const cards = episodeGrid();
    const { card, marks } = renderCardPart(
      NamePart,
      cardSpec({ title: {} }),
      { autoPick: true },
      [cards[0].querySelector('h3')!],
    );

    expect(screen.getByText('Waiting for your click on a name')).toBeTruthy();

    await settle();

    expect(card().title).toEqual({ selector: 'h3' });
    expect(screen.getByRole('status').textContent).toBe(
      'Read a name on all 5 cards',
    );
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual([
      'Sousou no Frieren',
      'Dandadan',
      'Kusuriya no Hitorigoto',
      'Kaijuu 8-gou',
      'and 1 more',
    ]);
    expect(marks().part).toEqual(
      cards.map((element) => element.querySelector('h3')!),
    );
  });

  it('offers to pick when the user pressed Escape', async () => {
    const cards = episodeGrid();
    const { card, willPick } = renderCardPart(
      NamePart,
      cardSpec({ title: {} }),
      { autoPick: true },
      [undefined as unknown as Element],
    );

    await settle();

    expect(
      screen.getByText('Pick a name in one of the outlined cards.'),
    ).toBeTruthy();

    // The card's text holds the episode too, so it suggests the heading in it
    willPick(cards[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Pick on the page' }));
    await settle();

    expect(card().title).toEqual({ selector: 'h3' });
  });

  it('notices a text that holds more than the name, and suggests the name alone', async () => {
    document.body.innerHTML = [
      ['Ao Ashi', '2.Sezon', '3.Bölüm izle'],
      ['Vertex Force', '', '3.Bölüm Türkçe'],
      ['Da Wang Rao Ming', '3.Sezon', '5.Bölüm'],
    ]
      .map(([name, season, episode]) => {
        const full = [name, season].filter(Boolean).join(' ');

        return `<div class="item"><b>${full}</b><small>${full} ${episode}</small></div>`;
      })
      .join('');

    const line = document.querySelector('small')!;
    const { card } = renderCardPart(
      NamePart,
      cardSpec({ selector: 'div.item', title: {} }),
      { autoPick: true },
      [line],
    );

    await settle();

    expect(screen.getByText('This text holds more than the name')).toBeTruthy();
    expect(card().title).toMatchObject({ selector: 'small' });
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual(['Ao Ashi', 'Vertex Force', 'Da Wang Rao Ming']);

    const radio = (name: RegExp) =>
      screen.getByRole('radio', { name }) as HTMLInputElement;

    expect(radio(/^Ao Ashi/).checked).toBe(true);

    // Keeping it as it is stays possible, and the suggestions stay
    fireEvent.click(radio(/^The whole text/));

    expect(card().title).toEqual({ selector: 'small' });
    expect(
      nameSummary(card(), Array.from(document.querySelectorAll('div.item'))),
    ).toEqual({
      text: 'Names include more than the name',
      status: 'issue',
    });

    fireEvent.click(radio(/^Ao Ashi/));

    expect(card().title).toMatchObject({ selector: 'small', steps: [{}] });
  });

  it('suggests the name in the editor for a setup that reads more', () => {
    episodeGrid();
    renderCardPart(NamePart, cardSpec({ title: { selector: 'span' } }));

    expect(screen.getByText('This text holds more than the name')).toBeTruthy();
  });

  it('warns about cards without a name where it reads', () => {
    episodeGrid();
    document.querySelectorAll('h3')[0].textContent = '';

    const { unmount } = renderCardPart(NamePart, cardSpec());

    expect(screen.getByRole('status').textContent).toBe(
      'Read a name on 4 of 5 cards',
    );
    expect(screen.getByRole('alert').textContent).toStartWith(
      'One card has no name',
    );

    unmount();
    document.querySelectorAll('h3')[1].textContent = '';
    renderCardPart(NamePart, cardSpec());

    expect(screen.getByRole('alert').textContent).toStartWith(
      '2 cards have no name',
    );
  });

  it('picks again, and edits the field under Advanced', async () => {
    const cards = episodeGrid();
    const { card, willPick } = renderCardPart(
      NamePart,
      cardSpec({ title: { selector: 'span' } }),
      { advanced: true },
    );

    willPick(cards[0].querySelector('h3')!);
    fireEvent.click(screen.getByRole('button', { name: 'Pick again' }));
    await settle();

    expect(card().title).toEqual({ selector: 'h3' });

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.input(screen.getAllByRole('textbox')[0], {
      target: { value: '' },
    });

    expect(card().title).toEqual({});
  });
});

describe('nameSummary', () => {
  it('counts the names read', () => {
    const cards = episodeGrid();

    expect(nameSummary(cardSpec(), cards)).toEqual({
      text: 'Read on 5 of 5 cards',
      status: 'ok',
    });
    expect(nameSummary(cardSpec({ title: { selector: 'b' } }), cards)).toEqual({
      text: 'Read on 0 of 5 cards',
      status: 'issue',
    });
  });
});
