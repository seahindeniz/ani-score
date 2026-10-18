import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

import { cardSpec, episodeGrid, settle } from '../../__tests__/harness';
import { isUnset, NamePart, nameSummary } from '../NamePart';
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

    // Picking the card itself reads all of its text
    willPick(cards[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Pick on the page' }));
    await settle();

    expect(isUnset(card().title)).toBe(true);
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
