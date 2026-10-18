import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

import { cardSpec, episodeGrid, settle } from '../../__tests__/harness';
import { PlacementPart, placementSummary } from '../PlacementPart';
import { renderCardPart } from './render';

afterEach(cleanup);

const choices = () =>
  screen.getAllByRole('radio').map((radio) => radio.parentElement!.textContent);

describe('PlacementPart', () => {
  it('offers the spots the cards have, and moves the details there', () => {
    episodeGrid();

    const { card } = renderCardPart(PlacementPart, cardSpec());

    expect(choices()).toEqual([
      'Under the nameSuggested',
      'Above the name',
      'On the poster',
      'End of the card',
    ]);
    expect(
      (
        screen.getByRole('radio', {
          name: /End of the card/,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);

    fireEvent.click(screen.getByRole('radio', { name: /Under the name/ }));

    expect(card().inject).toEqual({ selector: 'h3', position: 'after' });

    fireEvent.click(screen.getByRole('radio', { name: /Above the name/ }));

    expect(card().inject).toEqual({ selector: 'h3', position: 'before' });

    fireEvent.click(screen.getByRole('radio', { name: /On the poster/ }));

    expect(card().inject).toEqual({
      selector: 'div.poster',
      position: 'append',
    });
  });

  it('keeps a spot set elsewhere, and leaves out the ones the cards lack', () => {
    episodeGrid();
    document.querySelectorAll('img').forEach((image) => image.remove());

    const { card } = renderCardPart(
      PlacementPart,
      cardSpec({
        title: {},
        inject: { selector: 'span', position: 'prepend' },
      }),
    );

    expect(choices()).toEqual(['End of the card', 'Where you set it']);

    fireEvent.click(screen.getByRole('radio', { name: /End of the card/ }));

    expect(card().inject).toEqual({ position: 'append' });
  });

  it('sets the spot by hand under Advanced', async () => {
    const cards = episodeGrid();
    const { card, willPick } = renderCardPart(PlacementPart, cardSpec(), {
      advanced: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    fireEvent.input(
      screen.getByRole('textbox', { name: /Show the details next to/ }),
      {
        target: { value: 'span' },
      },
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Position' }), {
      target: { value: 'before' },
    });

    expect(card().inject).toEqual({ selector: 'span', position: 'before' });

    fireEvent.input(
      screen.getByRole('textbox', { name: /Show the details next to/ }),
      {
        target: { value: '' },
      },
    );

    expect(card().inject).toEqual({ selector: undefined, position: 'before' });

    willPick(cards[0].querySelector('h3')!, cards[0]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Pick where the details go' }),
    );
    await settle();

    expect(card().inject).toEqual({ selector: 'h3', position: 'before' });

    fireEvent.click(
      screen.getByRole('button', { name: 'Pick where the details go' }),
    );
    await settle();

    expect(card().inject).toEqual({ selector: undefined, position: 'before' });

    // Escape keeps it
    willPick(undefined);
    fireEvent.click(
      screen.getByRole('button', { name: 'Pick where the details go' }),
    );
    await settle();

    expect(card().inject).toEqual({ selector: undefined, position: 'before' });
  });
});

describe('placementSummary', () => {
  it('names the spot', () => {
    const cards = episodeGrid();

    expect(
      placementSummary(
        cardSpec({ inject: { selector: 'h3', position: 'after' } }),
        cards,
      ),
    ).toEqual({ text: 'Under the name', status: 'none' });
  });
});
